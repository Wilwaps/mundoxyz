const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, verifyRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function userCanManageStoreProducts(user, storeId) {
    if (!user || !storeId) return false;

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

    if (isGlobalAdmin) return true;

    const staffResult = await query(
        `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
        [user.id, storeId]
    );

    if (staffResult.rows.length === 0) return false;

    const staffRole = staffResult.rows[0].role;
    return ['owner', 'admin', 'manager'].includes(staffRole);
}

// --- PUBLIC ENDPOINTS ---

router.get('/list', verifyToken, async (req, res) => {
    try {
        const roles = req.user?.roles || [];
        const isAdmin = roles.includes('tote') || roles.includes('admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const result = await query(
            `SELECT id, slug, name, logo_url
       FROM stores
       ORDER BY name ASC`
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching stores list:', error);
        res.status(500).json({ error: 'Failed to fetch stores list' });
    }
});

// GET /api/store/public/:slug
// Get store details for customer view
router.get('/public/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const storeResult = await query(
            `SELECT id, name, slug, description, logo_url, cover_url, 
              currency_config, settings, location
       FROM stores 
       WHERE slug = $1`,
            [slug]
        );

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];

        // Fetch categories and products
        const categoriesResult = await query(
            `SELECT * FROM categories WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order`,
            [store.id]
        );

        const productsResult = await query(
            `SELECT p.*, 
              (SELECT json_agg(pm.*) FROM product_modifiers pm WHERE pm.product_id = p.id) as modifiers
       FROM products p
       WHERE p.store_id = $1 AND p.is_active = TRUE AND p.is_menu_item = TRUE`,
            [store.id]
        );

        res.json({
            store,
            categories: categoriesResult.rows,
            products: productsResult.rows
        });
    } catch (error) {
        logger.error('Error fetching store:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- ADMIN ENDPOINTS (Protected) ---

// POST /api/store/create (Super Admin or specific role)
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { name, slug, description, currency_config } = req.body;
        const ownerId = req.user.id; // Or assigned user

        const result = await query(
            `INSERT INTO stores (name, slug, description, owner_id, currency_config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [name, slug, description, ownerId, currency_config]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/category
router.post('/:storeId/category', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { name, sort_order } = req.body;

        // Validate ownership/role (TODO: Implement granular permissions)

        const result = await query(
            `INSERT INTO categories (store_id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [storeId, name, sort_order || 0]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/product
router.post('/:storeId/product', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const {
            category_id, name, description, image_url,
            price_usdt, price_fires,
            is_menu_item, has_modifiers
        } = req.body;

        const result = await query(
            `INSERT INTO products 
       (store_id, category_id, name, description, image_url, 
        price_usdt, price_fires, is_menu_item, has_modifiers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [
                storeId, category_id, name, description, image_url,
                price_usdt, price_fires, is_menu_item, has_modifiers
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/product/:productId/modifier
router.post('/product/:productId/modifier', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { group_name, name, price_adjustment_usdt, max_selection } = req.body;

        const result = await query(
            `INSERT INTO product_modifiers 
       (product_id, group_name, name, price_adjustment_usdt, max_selection)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [productId, group_name, name, price_adjustment_usdt, max_selection]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/store/product/:productId - Update basic product fields
router.patch('/product/:productId', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;

        const productResult = await query(
            `SELECT id, store_id FROM products WHERE id = $1`,
            [productId]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const storeId = productResult.rows[0].store_id;
        const canManage = await userCanManageStoreProducts(req.user, storeId);

        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar productos de esta tienda' });
        }

        const {
            category_id,
            name,
            description,
            image_url,
            price_usdt,
            price_fires,
            is_menu_item,
            has_modifiers
        } = req.body || {};

        const fields = [];
        const values = [];
        let idx = 1;

        if (category_id !== undefined) {
            fields.push(`category_id = $${idx++}`);
            values.push(category_id);
        }
        if (name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(name);
        }
        if (description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(description);
        }
        if (image_url !== undefined) {
            fields.push(`image_url = $${idx++}`);
            values.push(image_url);
        }
        if (price_usdt !== undefined) {
            fields.push(`price_usdt = $${idx++}`);
            values.push(price_usdt);
        }
        if (price_fires !== undefined) {
            fields.push(`price_fires = $${idx++}`);
            values.push(price_fires);
        }
        if (is_menu_item !== undefined) {
            fields.push(`is_menu_item = $${idx++}`);
            values.push(is_menu_item);
        }
        if (has_modifiers !== undefined) {
            fields.push(`has_modifiers = $${idx++}`);
            values.push(has_modifiers);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        values.push(productId);

        const updateResult = await query(
            `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        res.json(updateResult.rows[0]);
    } catch (error) {
        logger.error('Error updating product:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/product/:productId/duplicate - Duplicate a product (and its modifiers)
router.post('/product/:productId/duplicate', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;

        const originalResult = await query(
            `SELECT * FROM products WHERE id = $1`,
            [productId]
        );

        if (originalResult.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const original = originalResult.rows[0];
        const storeId = original.store_id;

        const canManage = await userCanManageStoreProducts(req.user, storeId);

        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar productos de esta tienda' });
        }

        const nameSuffix = (req.body && typeof req.body.name_suffix === 'string' && req.body.name_suffix.trim()) || ' (Copia)';
        const newName = `${original.name || 'Producto'}${nameSuffix}`;

        const result = await transaction(async (client) => {
            const insertProduct = await client.query(
                `INSERT INTO products 
           (store_id, category_id, name, description, image_url, 
            price_usdt, price_fires, is_menu_item, has_modifiers)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
                [
                    original.store_id,
                    original.category_id,
                    newName,
                    original.description,
                    original.image_url,
                    original.price_usdt,
                    original.price_fires,
                    original.is_menu_item,
                    original.has_modifiers
                ]
            );

            const newProduct = insertProduct.rows[0];

            const modifiersResult = await client.query(
                `SELECT group_name, name, price_adjustment_usdt, max_selection
           FROM product_modifiers
           WHERE product_id = $1`,
                [original.id]
            );

            for (const mod of modifiersResult.rows) {
                await client.query(
                    `INSERT INTO product_modifiers 
             (product_id, group_name, name, price_adjustment_usdt, max_selection)
             VALUES ($1, $2, $3, $4, $5)`,
                    [
                        newProduct.id,
                        mod.group_name,
                        mod.name,
                        mod.price_adjustment_usdt,
                        mod.max_selection
                    ]
                );
            }

            return {
                product: newProduct,
                duplicatedModifiers: modifiersResult.rows.length
            };
        });

        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error duplicating product:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
