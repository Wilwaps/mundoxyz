const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, verifyRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

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

// --- POS CUSTOMERS (CI-based) ---

// POST /api/store/:storeId/customers
// Crea (o reutiliza) un usuario basado en CI y lo asocia a la tienda
router.post('/:storeId/customers', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const {
            ci_prefix,
            ci_number,
            full_name,
            phone,
            email
        } = req.body || {};

        const prefix = (ci_prefix || '').trim().toUpperCase();
        const rawNumber = String(ci_number || '').trim();
        const number = rawNumber.replace(/[^0-9]/g, '');

        if (!['V', 'E', 'J'].includes(prefix)) {
            return res.status(400).json({ error: 'Prefijo de CI inválido (V/E/J)' });
        }
        if (!number) {
            return res.status(400).json({ error: 'Número de CI obligatorio' });
        }

        const name = (full_name || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'El nombre completo es obligatorio' });
        }

        const ciFull = `${prefix}-${number}`;

        let emailNormalized = (email || '').trim();
        if (emailNormalized === '') {
            emailNormalized = null;
        }

        const phoneNormalized = (phone || '').trim() || null;

        const result = await transaction(async (client) => {
            // 1) Buscar usuario existente por CI
            const existingUserResult = await client.query(
                `SELECT id, username, display_name, ci_prefix, ci_number, ci_full, phone, email
           FROM users
           WHERE ci_full = $1
           LIMIT 1`,
                [ciFull]
            );

            let userId;
            let userRow;

            if (existingUserResult.rows.length > 0) {
                // Reutilizar usuario existente, actualizar datos básicos si vienen
                userRow = existingUserResult.rows[0];

                const fields = [];
                const values = [];
                let idx = 1;

                if (!userRow.display_name && name) {
                    fields.push(`display_name = $${idx++}`);
                    values.push(name);
                }
                if (!userRow.phone && phoneNormalized) {
                    fields.push(`phone = $${idx++}`);
                    values.push(phoneNormalized);
                }
                if (!userRow.email && emailNormalized) {
                    fields.push(`email = $${idx++}`);
                    values.push(emailNormalized.toLowerCase());
                }
                if (!userRow.ci_prefix || !userRow.ci_number || !userRow.ci_full) {
                    fields.push(`ci_prefix = $${idx++}`);
                    values.push(prefix);
                    fields.push(`ci_number = $${idx++}`);
                    values.push(number);
                    fields.push(`ci_full = $${idx++}`);
                    values.push(ciFull);
                }

                if (fields.length > 0) {
                    values.push(userRow.id);
                    const updated = await client.query(
                        `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
                        values
                    );
                    userRow = updated.rows[0];
                }

                userId = userRow.id;
            } else {
                // 2) Crear nuevo usuario con CI como username y login
                const username = ciFull;

                // Contraseña por defecto 123456
                const passwordHash = await bcrypt.hash('123456', 10);

                const userInsert = await client.query(
                    `INSERT INTO users 
             (username, display_name, email, ci_prefix, ci_number, ci_full, phone, must_change_password,
              is_verified, first_seen_at, last_seen_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, FALSE, NOW(), NOW(), NOW(), NOW())
             RETURNING *`,
                    [
                        username,
                        name,
                        emailNormalized ? emailNormalized.toLowerCase() : null,
                        prefix,
                        number,
                        ciFull,
                        phoneNormalized
                    ]
                );

                userRow = userInsert.rows[0];
                userId = userRow.id;

                // Crear auth_identity para provider 'ci'
                await client.query(
                    `INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
             VALUES ($1, 'ci', $2, $3, NOW())
             ON CONFLICT (provider, provider_uid) DO NOTHING`,
                    [userId, ciFull, passwordHash]
                );

                // Crear wallet
                await client.query(
                    `INSERT INTO wallets (user_id, coins_balance, fires_balance, created_at, updated_at)
             VALUES ($1, 0, 0, NOW(), NOW())
             ON CONFLICT (user_id) DO NOTHING`,
                    [userId]
                );

                // Asignar rol 'user'
                await client.query(
                    `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE name = 'user'
             ON CONFLICT DO NOTHING`,
                    [userId]
                );
            }

            // 3) Asociar cliente a la tienda
            await client.query(
                `INSERT INTO store_customers (store_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (store_id, user_id) DO NOTHING`,
                [storeId, userId]
            );

            return {
                id: userRow.id,
                ci_full: userRow.ci_full || ciFull,
                full_name: userRow.display_name || name,
                phone: userRow.phone || phoneNormalized,
                email: userRow.email || emailNormalized,
                store_id: storeId
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('Error creating POS customer:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/:storeId/customers/search?q=
// Búsqueda GLOBAL de clientes (usuarios) para POS, con marca de clientes de tienda y CAI
router.get('/:storeId/customers/search', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const qRaw = (req.query.q || '').toString().trim();

        if (!qRaw) {
            return res.json([]);
        }

        // Búsqueda flexible:
        // - qRaw se usa para nombre/usuario/email/teléfono (LIKE %qRaw%)
        // - digitsOnly se usa para CI numérico (ci_number) y también para buscar dentro de ci_full (V-XXXXXXXX)
        const digitsOnly = qRaw.replace(/[^0-9]/g, '');
        const likeAny = `%${qRaw}%`;
        const ciFullLike = digitsOnly ? `%${digitsOnly}%` : likeAny;
        // Siempre enviamos un string para $3; cuando no haya CI numérico, será ""
        const ciNumberLike = digitsOnly ? `${digitsOnly}%` : '';

        const result = await query(
            `SELECT 
                u.id,
                u.ci_full,
                u.display_name,
                u.username,
                u.phone,
                u.email,
                (sc.user_id IS NOT NULL) AS is_store_customer,
                EXISTS (
                    SELECT 1
                    FROM caida_rooms cr
                    WHERE cr.host_id = u.id
                       OR u.id::text IN (
                            SELECT jsonb_array_elements_text(cr.player_ids)
                        )
                ) AS is_cai
           FROM users u
           LEFT JOIN store_customers sc
             ON sc.user_id = u.id
            AND sc.store_id = $1
           WHERE 
                (u.ci_full ILIKE $2)
             OR ($3 <> '' AND u.ci_number::text LIKE $3)
             OR (u.display_name ILIKE $4)
             OR (u.username ILIKE $4)
             OR (u.email ILIKE $4)
             OR (u.phone ILIKE $4)
           ORDER BY u.display_name NULLS LAST, u.username
           LIMIT 20`,
            [storeId, ciFullLike, ciNumberLike, likeAny]
        );

        const mapped = result.rows.map((row) => ({
            id: row.id,
            ci_full: row.ci_full,
            full_name: row.display_name || row.username,
            phone: row.phone,
            email: row.email,
            is_store_customer: !!row.is_store_customer,
            is_cai: !!row.is_cai
        }));

        res.json(mapped);
    } catch (error) {
        logger.error('Error searching POS customers:', error);
        res.status(400).json({ error: error.message });
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
