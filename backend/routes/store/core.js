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

// GET /api/store/:storeId/inventory/purchases - List purchase invoices for a store
router.get('/:storeId/inventory/purchases', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const result = await query(
            `SELECT pi.*, s.name AS supplier_name
       FROM purchase_invoices pi
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.store_id = $1
       ORDER BY pi.invoice_date DESC NULLS LAST, pi.created_at DESC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching purchase invoices:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/inventory/purchases - Create a purchase invoice with items
router.post('/:storeId/inventory/purchases', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const {
            supplier_id,
            invoice_number,
            invoice_date,
            supplier_address_snapshot,
            contact_info,
            notes,
            items
        } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'La factura debe tener al menos un ítem' });
        }

        const userId = req.user.id;

        const result = await transaction(async (client) => {
            let snapshotAddress = supplier_address_snapshot || null;

            if (supplier_id && !snapshotAddress) {
                const supplierResult = await client.query(
                    `SELECT address FROM suppliers WHERE id = $1 AND store_id = $2`,
                    [supplier_id, storeId]
                );
                if (supplierResult.rows.length > 0) {
                    snapshotAddress = supplierResult.rows[0].address || null;
                }
            }

            let totalCostUsdt = 0;

            const normalizedItems = [];

            for (const rawItem of items) {
                if (!rawItem) continue;

                const productId = rawItem.product_id || null;
                const ingredientId = rawItem.ingredient_id || null;

                if ((productId && ingredientId) || (!productId && !ingredientId)) {
                    throw new Error('Cada ítem debe referenciar únicamente un producto o un ingrediente');
                }

                const quantity = Number(rawItem.quantity);
                const unitCost = Number(rawItem.unit_cost_usdt);

                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error('Cantidad inválida en uno de los ítems');
                }
                if (!Number.isFinite(unitCost) || unitCost < 0) {
                    throw new Error('Costo unitario inválido en uno de los ítems');
                }

                const lineTotal = quantity * unitCost;
                totalCostUsdt += lineTotal;

                normalizedItems.push({
                    product_id: productId,
                    ingredient_id: ingredientId,
                    description: rawItem.description || null,
                    quantity,
                    unit_cost_usdt: unitCost,
                    total_cost_usdt: lineTotal
                });
            }

            const contactInfoJson = contact_info && typeof contact_info === 'object'
                ? contact_info
                : null;

            const invoiceResult = await client.query(
                `INSERT INTO purchase_invoices
         (store_id, supplier_id, invoice_number, invoice_date,
          supplier_address_snapshot, contact_info, notes, total_cost_usdt, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
                [
                    storeId,
                    supplier_id || null,
                    invoice_number || null,
                    invoice_date || null,
                    snapshotAddress,
                    contactInfoJson ? JSON.stringify(contactInfoJson) : null,
                    notes || null,
                    totalCostUsdt,
                    userId
                ]
            );

            const invoice = invoiceResult.rows[0];

            for (const item of normalizedItems) {
                await client.query(
                    `INSERT INTO purchase_invoice_items
             (invoice_id, product_id, ingredient_id, description, quantity, unit_cost_usdt, total_cost_usdt)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        invoice.id,
                        item.product_id,
                        item.ingredient_id,
                        item.description,
                        item.quantity,
                        item.unit_cost_usdt,
                        item.total_cost_usdt
                    ]
                );

                if (item.product_id) {
                    await client.query(
                        `UPDATE products
                 SET stock = stock + $1, updated_at = NOW()
                 WHERE id = $2 AND store_id = $3`,
                        [item.quantity, item.product_id, storeId]
                    );
                } else if (item.ingredient_id) {
                    await client.query(
                        `UPDATE ingredients
                 SET current_stock = current_stock + $1, updated_at = NOW()
                 WHERE id = $2 AND store_id = $3`,
                        [item.quantity, item.ingredient_id, storeId]
                    );

                    await client.query(
                        `INSERT INTO inventory_logs
                 (store_id, ingredient_id, change_amount, reason, reference_id, logged_by)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                        [storeId, item.ingredient_id, item.quantity, 'purchase', invoice.id, userId]
                    );
                }
            }

            return {
                invoice,
                total_cost_usdt: totalCostUsdt
            };
        });

        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error creating purchase invoice:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/:storeId/suppliers - List suppliers for a store
router.get('/:storeId/suppliers', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const result = await query(
            `SELECT * FROM suppliers WHERE store_id = $1 ORDER BY name ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching suppliers:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/suppliers - Create a new supplier
router.post('/:storeId/suppliers', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const {
            name,
            contact_name,
            phone,
            email,
            address,
            extra_contact
        } = req.body || {};

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
        }

        let extraContactObj = {};
        if (extra_contact && typeof extra_contact === 'object') {
            extraContactObj = extra_contact;
        }

        const result = await query(
            `INSERT INTO suppliers
       (store_id, name, contact_name, phone, email, address, extra_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [
                storeId,
                name.trim(),
                contact_name || null,
                phone || null,
                email || null,
                address || null,
                JSON.stringify(extraContactObj)
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating supplier:', error);
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
            category_id,
            sku,
            name,
            description,
            image_url,
            price_usdt,
            price_fires,
            is_menu_item,
            has_modifiers,
            accepts_fires
        } = req.body;

        const normalizedAcceptsFires = accepts_fires === true;
        let normalizedStock = 0;

        if (req.body && req.body.stock !== undefined) {
            const parsedStock = parseInt(req.body.stock, 10);
            if (Number.isFinite(parsedStock) && parsedStock >= 0) {
                normalizedStock = parsedStock;
            }
        }

        const normalizedSku = sku && String(sku).trim() !== '' ? String(sku).trim() : null;

        const result = await query(
            `INSERT INTO products 
       (store_id, category_id, sku, name, description, image_url, 
        price_usdt, price_fires, stock, is_menu_item, has_modifiers, accepts_fires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
            [
                storeId,
                category_id,
                normalizedSku,
                name,
                description,
                image_url,
                price_usdt,
                price_fires,
                normalizedStock,
                is_menu_item,
                has_modifiers,
                normalizedAcceptsFires
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
            sku,
            name,
            description,
            image_url,
            price_usdt,
            price_fires,
            is_menu_item,
            has_modifiers,
            accepts_fires,
            stock
        } = req.body || {};

        const fields = [];
        const values = [];
        let idx = 1;

        if (category_id !== undefined) {
            fields.push(`category_id = $${idx++}`);
            values.push(category_id);
        }
        if (sku !== undefined) {
            const normalizedSku = sku && String(sku).trim() !== '' ? String(sku).trim() : null;
            fields.push(`sku = $${idx++}`);
            values.push(normalizedSku);
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
        if (accepts_fires !== undefined) {
            fields.push(`accepts_fires = $${idx++}`);
            values.push(accepts_fires === true);
        }
        if (stock !== undefined) {
            let normalizedStock = parseInt(stock, 10);
            if (!Number.isFinite(normalizedStock) || normalizedStock < 0) {
                normalizedStock = 0;
            }
            fields.push(`stock = $${idx++}`);
            values.push(normalizedStock);
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
           (store_id, category_id, sku, name, description, image_url, 
            price_usdt, price_fires, stock, is_menu_item, has_modifiers, accepts_fires)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
                [
                    original.store_id,
                    original.category_id,
                    null,
                    newName,
                    original.description,
                    original.image_url,
                    original.price_usdt,
                    original.price_fires,
                    0,
                    original.is_menu_item,
                    original.has_modifiers,
                    original.accepts_fires === true
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
