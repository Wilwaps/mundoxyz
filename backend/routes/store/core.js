const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, verifyRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Simple in-memory cache with TTL (short-lived to avoid stale data)
const memoryCache = new Map();
const CACHE_TTL_MS = 30_000; // 30s

function getCache(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    const { expiresAt, value } = entry;
    if (Date.now() > expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return value;
}

function setCache(key, value, ttlMs = CACHE_TTL_MS) {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function normalizeStoreId(rawStoreId) {
    if (!rawStoreId) return null;

    const str = String(rawStoreId).trim();
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (uuidRegex.test(str)) {
        return str;
    }

    const result = await query(
        `SELECT id FROM stores WHERE slug = $1 LIMIT 1`,
        [str]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].id;
}

async function userCanManageStoreProducts(user, storeId) {
    if (!user || !storeId) return false;

    const normalizedStoreId = await normalizeStoreId(storeId);
    if (!normalizedStoreId) return false;

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

    // Los admins globales siempre pueden gestionar cualquier tienda
    if (isGlobalAdmin) return true;

    // 1) Intentar resolver permisos desde store_staff activo
    const staffResult = await query(
        `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
        [user.id, normalizedStoreId]
    );

    if (staffResult.rows.length > 0) {
        const staffRole = staffResult.rows[0].role;
        return ['owner', 'admin', 'manager'].includes(staffRole);
    }

    // 2) Fallback: si el usuario es el dueño (owner_id) de la tienda, darle acceso completo
    const ownerResult = await query(
        `SELECT owner_id FROM stores WHERE id = $1 LIMIT 1`,
        [normalizedStoreId]
    );

    if (ownerResult.rows.length > 0) {
        const ownerId = ownerResult.rows[0].owner_id;
        if (String(ownerId) === String(user.id)) {
            return true;
        }
    }

    return false;
}

// Permisos para manejar mesas del POS (incluye mesoneros, vendedores, delivery)
async function userCanManageStoreTables(user, storeId) {
    if (!user || !storeId) return false;

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

    if (isGlobalAdmin) return true;

    // Intentar resolver rol desde store_staff activo
    const staffResult = await query(
        `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
        [user.id, storeId]
    );

    if (staffResult.rows.length > 0) {
        const staffRole = staffResult.rows[0].role;
        const allowedRoles = ['owner', 'admin', 'manager', 'seller', 'mesonero', 'delivery'];
        if (allowedRoles.includes(staffRole)) {
            return true;
        }
    }

    // Fallback: si es el dueño de la tienda, también puede usar POS/mesas
    const ownerResult = await query(
        `SELECT owner_id FROM stores WHERE id = $1 LIMIT 1`,
        [storeId]
    );

    if (ownerResult.rows.length > 0) {
        const ownerId = ownerResult.rows[0].owner_id;
        if (String(ownerId) === String(user.id)) {
            return true;
        }
    }

    return false;
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
            `SELECT 
                id, 
                slug, 
                name, 
                logo_url,
                description,
                currency_config,
                commission_percentage,
                store_type,
                allowed_currencies,
                level
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
// Get store details for customer view and increment views counter
router.get('/public/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        // Update views count in background (non-blocking)
        query(
            `UPDATE stores
         SET views_count = views_count + 1,
             updated_at = NOW()
         WHERE slug = $1`,
            [slug]
        ).catch(err => {
            // Log error but don't block the response
            logger.error('Error updating views_count:', err);
        });

        // Get store data immediately (don't wait for views update)
        const storeResult = await query(
            `SELECT id, name, slug, description, logo_url, cover_url,
                   currency_config, settings, location, views_count
       FROM stores
       WHERE slug = $1`,
            [slug]
        );

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];

        // Fetch categories and products in parallel
        const [categoriesResult, productsResult] = await Promise.all([
            query(
                `SELECT * FROM categories WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order`,
                [store.id]
            ),
            query(
                `SELECT p.*
         FROM products p
         WHERE p.store_id = $1 AND p.is_active = TRUE AND p.is_menu_item = TRUE
         ORDER BY p.name ASC`,
                [store.id]
            )
        ]);

        const productIds = productsResult.rows.map((product) => product.id).filter(Boolean);
        let modifiersResult = { rows: [] };

        if (productIds.length > 0) {
            modifiersResult = await query(
                `SELECT pm.*
         FROM product_modifiers pm
         WHERE pm.product_id = ANY($1::uuid[])`,
                [productIds]
            );
        }

        const modifiersByProduct = modifiersResult.rows.reduce((acc, modifier) => {
            if (!modifier || !modifier.product_id) return acc;
            if (!acc[modifier.product_id]) {
                acc[modifier.product_id] = [];
            }
            acc[modifier.product_id].push(modifier);
            return acc;
        }, {});

        res.json({
            store,
            categories: categoriesResult.rows,
            products: productsResult.rows.map((product) => ({
                ...product,
                modifiers: modifiersByProduct[product.id] || []
            }))
        });
        setCache(cacheKey, {
            store,
            categories: categoriesResult.rows,
            products: productsResult.rows.map((product) => ({
                ...product,
                modifiers: modifiersByProduct[product.id] || []
            }))
        });
    } catch (error) {
        logger.error('Error fetching store:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/store/by-slug/:slug
// Resolver id y datos básicos de tienda a partir del slug
router.get('/by-slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const cacheKey = `store_slug:${slug}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const result = await query(
            `SELECT id, slug, name
           FROM stores
           WHERE slug = $1
           LIMIT 1`,
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        setCache(cacheKey, result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching store by slug:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/store/public-list
// Lista pública de tiendas para el Mercado (clientes)
router.get('/public-list', verifyToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, slug, name, description, logo_url, cover_url
       FROM stores
       ORDER BY name ASC`
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching public stores list:', error);
        res.status(500).json({ error: 'Failed to fetch stores list' });
    }
});

// --- POS CUSTOMERS (CI-based) ---

// GET /api/store/:storeId/customers
// Lista todos los clientes asociados a la tienda (store_customers).
router.get('/:storeId/customers', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        if (!storeId) {
            return res.status(400).json({ error: 'storeId requerido' });
        }

        const result = await query(
            `SELECT sc.store_id,
                    sc.user_id,
                    u.id,
                    u.display_name,
                    u.username,
                    u.phone,
                    u.email,
                    sc.created_at
             FROM store_customers sc
             JOIN users u ON u.id = sc.user_id
             WHERE sc.store_id = $1
             ORDER BY sc.created_at DESC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error listing store customers:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/customers
// Crea (o reutiliza) un usuario basado en CI y lo asocia a la tienda.
// IMPORTANTE: solo los usuarios NUEVOS creados desde este flujo reciben home_store_id = storeId.
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
                `SELECT id, username, display_name, ci_prefix, ci_number, ci_full, phone, email, home_store_id
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
              is_verified, first_seen_at, last_seen_at, created_at, updated_at, home_store_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, FALSE, NOW(), NOW(), NOW(), NOW(), $8)
             RETURNING *`,
                    [
                        username,
                        name,
                        emailNormalized ? emailNormalized.toLowerCase() : null,
                        prefix,
                        number,
                        ciFull,
                        phoneNormalized,
                        storeId
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

// GET /api/store/:storeId/metrics - basic metrics for store owner panel
router.get('/:storeId/metrics', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const result = await query(
            `SELECT 
                s.id,
                COALESCE(s.views_count, 0) AS views_count,
                COALESCE(c.customers_count, 0) AS customers_count
           FROM stores s
           LEFT JOIN (
                SELECT store_id, COUNT(*)::BIGINT AS customers_count
                FROM store_customers
                GROUP BY store_id
           ) c ON c.store_id = s.id
           WHERE s.id = $1`,
            [storeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching store metrics:', error);
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/store/:storeId/settings - update store public settings and branding
router.patch('/:storeId/settings', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
        const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

        const {
            name,
            description,
            logo_url,
            cover_url,
            settings_patch: settingsPatch,
            location_patch: locationPatch,
            commission_percentage,
            store_type,
            allowed_currencies,
            level
        } = req.body || {};

        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(name);
        }
        if (description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(description);
        }
        if (logo_url !== undefined) {
            fields.push(`logo_url = $${idx++}`);
            values.push(logo_url);
        }
        if (cover_url !== undefined) {
            fields.push(`cover_url = $${idx++}`);
            values.push(cover_url);
        }
        if (settingsPatch && typeof settingsPatch === 'object') {
            fields.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx++}::jsonb`);
            values.push(JSON.stringify(settingsPatch));
        }
        if (locationPatch && typeof locationPatch === 'object') {
            fields.push(`location = COALESCE(location, '{}'::jsonb) || $${idx++}::jsonb`);
            values.push(JSON.stringify(locationPatch));
        }

        // Solo admin global puede modificar nivel, comisión y monedas permitidas
        if (isGlobalAdmin && commission_percentage !== undefined) {
            const raw = Number(commission_percentage);
            let commission = Number.isFinite(raw) && raw >= 0 ? raw : 0;
            if (commission > 100) commission = 100;
            fields.push(`commission_percentage = $${idx++}`);
            values.push(commission);
        }

        if (isGlobalAdmin && store_type !== undefined) {
            const allowedTypes = ['papeleria', 'restaurante', 'joyeria', 'otro'];
            let normalizedType = typeof store_type === 'string' ? store_type.toLowerCase() : 'papeleria';
            if (!allowedTypes.includes(normalizedType)) {
                normalizedType = 'papeleria';
            }
            fields.push(`store_type = $${idx++}`);
            values.push(normalizedType);
        }

        if (isGlobalAdmin && allowed_currencies !== undefined) {
            const baseSet = ['coins', 'fires', 'usdt', 'ves'];
            let normalized = Array.isArray(allowed_currencies)
                ? allowed_currencies
                    .map((c) => (c != null ? String(c).toLowerCase() : ''))
                    .filter((c) => baseSet.includes(c))
                : null;
            if (!normalized || normalized.length === 0) {
                normalized = baseSet;
            }
            fields.push(`allowed_currencies = $${idx++}::jsonb`);
            values.push(JSON.stringify(normalized));
        }

        if (isGlobalAdmin && level !== undefined) {
            let lvl = parseInt(level, 10);
            if (!Number.isFinite(lvl)) lvl = 3;
            if (lvl < 1) lvl = 1;
            if (lvl > 3) lvl = 3;
            fields.push(`level = $${idx++}`);
            values.push(lvl);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        fields.push('updated_at = NOW()');

        values.push(storeId);

        const result = await query(
            `UPDATE stores SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, slug, description, logo_url, cover_url,
                 currency_config, settings, location, views_count`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating store settings:', error);
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

// --- POS TABLE TABS (Restaurant mode) ---

// GET /api/store/:storeId/tables - listar totales por mesa
router.get('/:storeId/tables', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreTables(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar mesas de esta tienda' });
        }

        const result = await query(
            `SELECT table_label, total_usdt, version
           FROM store_table_tabs
           WHERE store_id = $1
           ORDER BY table_label ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching store table tabs:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/:storeId/tables/:tableLabel - obtener detalle de una mesa
router.get('/:storeId/tables/:tableLabel', verifyToken, async (req, res) => {
    try {
        const { storeId, tableLabel } = req.params;

        const canManage = await userCanManageStoreTables(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar mesas de esta tienda' });
        }

        const result = await query(
            `SELECT table_label, cart_items, total_usdt, version
           FROM store_table_tabs
           WHERE store_id = $1 AND table_label = $2
           LIMIT 1`,
            [storeId, tableLabel]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mesa no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching store table tab:', error);
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/store/:storeId/tables/:tableLabel - guardar/actualizar cuenta de mesa
router.put('/:storeId/tables/:tableLabel', verifyToken, async (req, res) => {
    try {
        const { storeId, tableLabel } = req.params;

        const canManage = await userCanManageStoreTables(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar mesas de esta tienda' });
        }

        const { cart_items, total_usdt, previous_version } = req.body || {};

        const items = Array.isArray(cart_items) ? cart_items : [];
        const totalRaw = Number(total_usdt);
        const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : 0;

        const result = await transaction(async (client) => {
            const existingRes = await client.query(
                `SELECT id, version
             FROM store_table_tabs
             WHERE store_id = $1 AND table_label = $2
             FOR UPDATE`,
                [storeId, tableLabel]
            );

            if (existingRes.rows.length > 0) {
                const existing = existingRes.rows[0];
                const currentVersion = Number(existing.version) || 1;

                if (previous_version != null && Number(previous_version) !== currentVersion) {
                    return { conflict: true, currentVersion };
                }

                const newVersion = currentVersion + 1;

                const updateRes = await client.query(
                    `UPDATE store_table_tabs
                 SET cart_items = $1,
                     total_usdt = $2,
                     version = $3,
                     locked_by = NULL,
                     locked_at = NULL,
                     updated_at = NOW()
                 WHERE id = $4
                 RETURNING table_label, cart_items, total_usdt, version`,
                    [JSON.stringify(items), total, newVersion, existing.id]
                );

                return { row: updateRes.rows[0] };
            }

            const insertRes = await client.query(
                `INSERT INTO store_table_tabs
             (id, store_id, table_label, cart_items, total_usdt, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
             RETURNING table_label, cart_items, total_usdt, version`,
                [uuidv4(), storeId, tableLabel, JSON.stringify(items), total]
            );

            return { row: insertRes.rows[0] };
        });

        if (result.conflict) {
            return res.status(409).json({
                error: 'La mesa fue actualizada desde otro dispositivo. Recarga antes de guardar.',
                current_version: result.currentVersion
            });
        }

        res.json(result.row);
    } catch (error) {
        logger.error('Error saving store table tab:', error);
        res.status(400).json({ error: error.message });
    }
});

// --- ADMIN ENDPOINTS (Protected) ---

// POST /api/store/create (Super Admin or specific role)
router.post('/create', verifyToken, async (req, res) => {
    try {
        const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
        const isAdmin = roles.includes('tote') || roles.includes('admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'No autorizado para crear tiendas' });
        }

        const {
            name,
            slug,
            description,
            currency_config,
            commission_percentage,
            store_type,
            allowed_currencies,
            level
        } = req.body || {};

        const ownerId = req.user.id; // Or assigned user

        // Normalizar comisión
        const rawCommission = Number(commission_percentage);
        let commission = Number.isFinite(rawCommission) && rawCommission >= 0 ? rawCommission : 0;
        if (commission > 100) commission = 100;

        // Normalizar currency_config (JSONB)
        // El frontend envía un string ("coins", "coins_fires", etc.), pero la DB espera JSON.
        // Lo envolvemos en un objeto para que sea válido.
        let normalizedCurrencyConfig = {};
        if (typeof currency_config === 'string') {
            normalizedCurrencyConfig = { mode: currency_config };
        } else if (typeof currency_config === 'object' && currency_config !== null) {
            normalizedCurrencyConfig = currency_config;
        } else {
            normalizedCurrencyConfig = { mode: 'coins' }; // Default
        }

        // Normalizar tipo de tienda
        const allowedTypes = ['papeleria', 'restaurante', 'joyeria', 'otro'];
        let normalizedType = typeof store_type === 'string' ? store_type.toLowerCase() : 'papeleria';
        if (!allowedTypes.includes(normalizedType)) {
            normalizedType = 'papeleria';
        }

        // Normalizar monedas permitidas
        const baseCurrencies = ['coins', 'fires', 'usdt', 'ves'];
        let normalizedAllowed = Array.isArray(allowed_currencies)
            ? allowed_currencies
                .map((c) => (c != null ? String(c).toLowerCase() : ''))
                .filter((c) => baseCurrencies.includes(c))
            : null;
        if (!normalizedAllowed || normalizedAllowed.length === 0) {
            normalizedAllowed = baseCurrencies;
        }

        // Normalizar nivel
        let lvl = parseInt(level, 10);
        if (!Number.isFinite(lvl)) lvl = 3;
        if (lvl > 3) lvl = 3;

        const result = await query(
            `INSERT INTO stores (name, slug, description, owner_id, currency_config, commission_percentage, store_type, allowed_currencies, level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, slug`,
            [
                name,
                slug,
                description,
                ownerId,
                JSON.stringify(normalizedCurrencyConfig),
                commission,
                normalizedType,
                JSON.stringify(normalizedAllowed),
                lvl
            ]
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

// GET /api/store/:storeId/inventory/purchases/:invoiceId - Get a specific purchase invoice
router.get('/:storeId/inventory/purchases/:invoiceId', verifyToken, async (req, res) => {
    try {
        const { storeId, invoiceId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        // Get invoice with supplier info
        const invoiceResult = await query(
            `SELECT pi.*, s.name AS supplier_name
       FROM purchase_invoices pi
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.store_id = $1 AND pi.id = $2`,
            [storeId, invoiceId]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // Get invoice items
        const itemsResult = await query(
            `SELECT pii.*, 
              p.name AS product_name, 
              i.name AS ingredient_name,
              i.unit AS ingredient_unit,
              m.name AS modifier_name
       FROM purchase_invoice_items pii
       LEFT JOIN products p ON pii.product_id = p.id
       LEFT JOIN ingredients i ON pii.ingredient_id = i.id
       LEFT JOIN product_modifiers m ON pii.modifier_id = m.id
       WHERE pii.invoice_id = $1
       ORDER BY pii.id`,
            [invoiceId]
        );

        res.json({
            invoice: invoiceResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        logger.error('Error fetching purchase invoice:', error);
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
            items,
            invoice_image_url,
            invoice_ocr_data
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
                const modifierId = rawItem.modifier_id || null;

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
                    modifier_id: modifierId,
                    description: rawItem.description || null,
                    quantity,
                    unit_cost_usdt: unitCost,
                    total_cost_usdt: lineTotal
                });
            }

            const contactInfoJson = contact_info && typeof contact_info === 'object'
                ? contact_info
                : null;

            const normalizedOcrData = invoice_ocr_data && typeof invoice_ocr_data === 'object'
                ? invoice_ocr_data
                : null;

            const invoiceResult = await client.query(
                `INSERT INTO purchase_invoices
         (store_id, supplier_id, invoice_number, invoice_date,
          supplier_address_snapshot, contact_info, notes, total_cost_usdt, created_by,
          invoice_image_url, invoice_ocr_data, invoice_ocr_status, invoice_ocr_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
                    userId,
                    invoice_image_url || null,
                    normalizedOcrData ? JSON.stringify(normalizedOcrData) : null,
                    normalizedOcrData ? 'success' : 'pending',
                    null
                ]
            );

            const invoice = invoiceResult.rows[0];

            for (const item of normalizedItems) {
                await client.query(
                    `INSERT INTO purchase_invoice_items
             (invoice_id, product_id, ingredient_id, modifier_id, description, quantity, unit_cost_usdt, total_cost_usdt)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        invoice.id,
                        item.product_id,
                        item.ingredient_id,
                        item.modifier_id,
                        item.description,
                        item.quantity,
                        item.unit_cost_usdt,
                        item.total_cost_usdt
                    ]
                );

                if (item.product_id) {
                    // Aumentar stock total del producto
                    await client.query(
                        `UPDATE products
                 SET stock = stock + $1, updated_at = NOW()
                 WHERE id = $2 AND store_id = $3`,
                        [item.quantity, item.product_id, storeId]
                    );

                    // Si viene un modificador asociado, actualizar también stock por variante
                    if (item.modifier_id) {
                        await client.query(
                            `INSERT INTO product_modifier_stock (store_id, product_id, modifier_id, stock, reserved, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
                     ON CONFLICT (product_id, modifier_id)
                     DO UPDATE SET stock = product_modifier_stock.stock + EXCLUDED.stock,
                                   updated_at = NOW()`,
                            [storeId, item.product_id, item.modifier_id, item.quantity]
                        );
                    }
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

// POST /api/store/:storeId/inventory/purchases/ocr-preview - Stub para lectura de factura con ron-ia
router.post('/:storeId/inventory/purchases/ocr-preview', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { invoice_image_url } = req.body || {};

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        if (!invoice_image_url || typeof invoice_image_url !== 'string') {
            return res.status(400).json({ error: 'Imagen de factura requerida para lectura' });
        }

        // Stub inicial: estructura base para que el frontend pueda autocompletar.
        // Más adelante se integrará el motor real de ron-ia / OCR.
        res.json({
            supplier_name: null,
            invoice_number: null,
            invoice_date: null,
            contact_info: null,
            totals: null,
            items: []
        });
    } catch (error) {
        logger.error('Error en OCR preview de factura de compra:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/store/:storeId/suppliers - List suppliers for a store
router.get('/:storeId/suppliers', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const normalizedStoreId = await normalizeStoreId(storeId);
        if (!normalizedStoreId) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const canManage = await userCanManageStoreProducts(req.user, normalizedStoreId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const result = await query(
            `SELECT * FROM suppliers WHERE store_id = $1 ORDER BY name ASC`,
            [normalizedStoreId]
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

        const normalizedStoreId = await normalizeStoreId(storeId);
        if (!normalizedStoreId) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const canManage = await userCanManageStoreProducts(req.user, normalizedStoreId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const {
            name,
            contact_name,
            phone,
            email,
            address,
            tax_id,
            extra_contact
        } = req.body || {};

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
        }

        let extraContactObj = {};
        if (extra_contact && typeof extra_contact === 'object') {
            extraContactObj = extra_contact;
        }

        const normalizedTaxId =
            typeof tax_id === 'string' && tax_id.trim() ? tax_id.trim() : null;

        const result = await query(
            `INSERT INTO suppliers
       (store_id, name, contact_name, phone, email, address, tax_id, extra_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                normalizedStoreId,
                name.trim(),
                contact_name || null,
                phone || null,
                email || null,
                address || null,
                normalizedTaxId,
                JSON.stringify(extraContactObj)
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating supplier:', error);
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/store/:storeId/suppliers/:supplierId - Update supplier data (RIF no editable)
router.patch('/:storeId/suppliers/:supplierId', verifyToken, async (req, res) => {
    try {
        const { storeId, supplierId } = req.params;

        const normalizedStoreId = await normalizeStoreId(storeId);
        if (!normalizedStoreId) {
            return res.status(404).json({ error: 'Tienda no encontrada' });
        }

        const canManage = await userCanManageStoreProducts(req.user, normalizedStoreId);
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

        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) {
            const trimmedName = typeof name === 'string' ? name.trim() : '';
            if (!trimmedName) {
                return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
            }
            fields.push(`name = $${idx++}`);
            values.push(trimmedName);
        }

        if (contact_name !== undefined) {
            fields.push(`contact_name = $${idx++}`);
            values.push(contact_name || null);
        }

        if (phone !== undefined) {
            fields.push(`phone = $${idx++}`);
            values.push(phone || null);
        }

        if (email !== undefined) {
            fields.push(`email = $${idx++}`);
            values.push(email || null);
        }

        if (address !== undefined) {
            fields.push(`address = $${idx++}`);
            values.push(address || null);
        }

        if (extra_contact !== undefined) {
            let extraContactObj = {};
            if (extra_contact && typeof extra_contact === 'object') {
                extraContactObj = extra_contact;
            }
            fields.push(`extra_contact = $${idx++}`);
            values.push(JSON.stringify(extraContactObj));
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        fields.push('updated_at = NOW()');

        values.push(normalizedStoreId);
        values.push(supplierId);

        const result = await query(
            `UPDATE suppliers
       SET ${fields.join(', ')}
       WHERE store_id = $${idx++} AND id = $${idx}
       RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating supplier:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/category
router.post('/:storeId/category', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { name, sort_order } = req.body || {};

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) {
            return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
        }

        let normalizedSortOrder = 0;
        if (sort_order !== undefined && sort_order !== null && String(sort_order).trim() !== '') {
            const parsed = parseInt(sort_order, 10);
            if (Number.isFinite(parsed)) {
                normalizedSortOrder = parsed;
            }
        }

        const result = await query(
            `INSERT INTO categories (store_id, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [storeId, trimmedName, normalizedSortOrder]
        );

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating category:', error);
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/store/:storeId/category/:categoryId - Update category fields
router.patch('/:storeId/category/:categoryId', verifyToken, async (req, res) => {
    try {
        const { storeId, categoryId } = req.params;
        const { name, sort_order, is_active } = req.body || {};

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) {
            const trimmedName = typeof name === 'string' ? name.trim() : '';
            if (!trimmedName) {
                return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
            }
            fields.push(`name = $${idx++}`);
            values.push(trimmedName);
        }

        if (sort_order !== undefined) {
            let normalizedSortOrder = 0;
            if (sort_order !== null && String(sort_order).trim() !== '') {
                const parsed = parseInt(sort_order, 10);
                if (Number.isFinite(parsed)) {
                    normalizedSortOrder = parsed;
                }
            }
            fields.push(`sort_order = $${idx++}`);
            values.push(normalizedSortOrder);
        }

        if (is_active !== undefined) {
            fields.push(`is_active = $${idx++}`);
            values.push(!!is_active);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        values.push(storeId);
        values.push(categoryId);

        const result = await query(
            `UPDATE categories
       SET ${fields.join(', ')}
       WHERE store_id = $${idx++} AND id = $${idx}
       RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating category:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/store/:storeId/category/:categoryId - Delete category and detach products
router.delete('/:storeId/category/:categoryId', verifyToken, async (req, res) => {
    try {
        const { storeId, categoryId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar esta tienda' });
        }

        const deletedCategory = await transaction(async (client) => {
            await client.query(
                `UPDATE products
         SET category_id = NULL
         WHERE store_id = $1 AND category_id = $2`,
                [storeId, categoryId]
            );

            const deleteResult = await client.query(
                `DELETE FROM categories
         WHERE store_id = $1 AND id = $2
         RETURNING *`,
                [storeId, categoryId]
            );

            if (deleteResult.rows.length === 0) {
                throw new Error('CATEGORY_NOT_FOUND');
            }

            return deleteResult.rows[0];
        });

        res.json(deletedCategory);
    } catch (error) {
        if (error && error.message === 'CATEGORY_NOT_FOUND') {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        logger.error('Error deleting category:', error);
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
            product_type,
            is_menu_item,
            has_modifiers,
            accepts_fires,
            stock,
            min_stock_alert,
            is_active,
            modifierGroups
        } = req.body || {};

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar productos de esta tienda' });
        }

        const normalizedSku = sku && String(sku).trim() !== '' ? String(sku).trim() : null;

        const normalizedIsMenuItem = is_menu_item === undefined ? true : Boolean(is_menu_item);
        const normalizedHasModifiers = has_modifiers === undefined ? false : Boolean(has_modifiers);
        const normalizedIsActive = is_active === undefined ? true : Boolean(is_active);
        const normalizedAcceptsFires = accepts_fires === true;

        let normalizedStock = 0;
        if (stock !== undefined && stock !== null && String(stock).trim() !== '') {
            const parsedStock = parseInt(stock, 10);
            if (Number.isFinite(parsedStock) && parsedStock >= 0) {
                normalizedStock = parsedStock;
            }
        }

        let normalizedMinStockAlert = 0;
        if (min_stock_alert !== undefined && min_stock_alert !== null && String(min_stock_alert).trim() !== '') {
            const parsedMin = parseInt(min_stock_alert, 10);
            if (Number.isFinite(parsedMin) && parsedMin >= 0) {
                normalizedMinStockAlert = parsedMin;
            }
        }

        // Normalizar precios para evitar errores "invalid input syntax for type numeric: \"\""
        // price_usdt: por defecto 0 si no es un número válido o viene vacío
        let normalizedPriceUsdt = 0;
        if (price_usdt !== undefined && price_usdt !== null && String(price_usdt).trim() !== '') {
            const parsed = Number(String(price_usdt).replace(',', '.'));
            if (Number.isFinite(parsed) && parsed >= 0) {
                normalizedPriceUsdt = parsed;
            }
        }

        // price_fires: permitir NULL si viene vacío o no es válido
        let normalizedPriceFires = null;
        if (price_fires !== undefined && price_fires !== null && String(price_fires).trim() !== '') {
            const parsedFires = Number(String(price_fires).replace(',', '.'));
            if (Number.isFinite(parsedFires) && parsedFires >= 0) {
                normalizedPriceFires = parsedFires;
            }
        }

        const normalizedProductType = product_type === 'service' ? 'service' : 'product';

        const insertResult = await query(
            `INSERT INTO products 
       (store_id, category_id, sku, name, description, image_url, 
        product_type, price_usdt, price_fires, stock, is_menu_item, has_modifiers, accepts_fires, min_stock_alert, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
            [
                storeId,
                category_id,
                normalizedSku,
                name,
                description,
                image_url,
                normalizedProductType,
                normalizedPriceUsdt,
                normalizedPriceFires,
                normalizedStock,
                normalizedIsMenuItem,
                normalizedHasModifiers,
                normalizedAcceptsFires,
                normalizedMinStockAlert,
                normalizedIsActive
            ]
        );
        const product = insertResult.rows[0];

        // Persistir modificadores si vienen desde el dashboard
        if (Array.isArray(modifierGroups) && modifierGroups.length > 0) {
            for (const group of modifierGroups) {
                if (!group || !group.groupName) continue;
                const groupName = String(group.groupName).trim();
                if (!groupName) continue;

                const groupMaxSelRaw = group.maxSelection;
                let groupMaxSel = parseInt(groupMaxSelRaw, 10);
                if (!Number.isFinite(groupMaxSel) || groupMaxSel <= 0) {
                    groupMaxSel = 1;
                }

                const options = Array.isArray(group.options) ? group.options : [];
                for (const opt of options) {
                    if (!opt || !opt.name) continue;
                    const optName = String(opt.name).trim();
                    if (!optName) continue;

                    const rawAdj = opt.priceAdjustmentUsdt;
                    const parsedAdj =
                        rawAdj === '' || rawAdj === null || rawAdj === undefined
                            ? 0
                            : Number(String(rawAdj).replace(',', '.'));
                    const priceAdj =
                        Number.isFinite(parsedAdj) && parsedAdj >= 0 ? parsedAdj : 0;

                    const optMaxSelRaw = opt.maxSelection;
                    let optMaxSel = parseInt(optMaxSelRaw, 10);
                    if (!Number.isFinite(optMaxSel) || optMaxSel <= 0) {
                        optMaxSel = groupMaxSel;
                    }

                    await query(
                        `INSERT INTO product_modifiers 
                 (product_id, group_name, name, price_adjustment_usdt, max_selection)
                 VALUES ($1, $2, $3, $4, $5)`,
                        [product.id, groupName, optName, priceAdj, optMaxSel]
                    );
                }
            }
        }

        const detailedResult = await query(
            `SELECT p.*,
                COALESCE((
                    SELECT json_agg(pm ORDER BY pm.group_name, pm.name)
                    FROM product_modifiers pm
                    WHERE pm.product_id = p.id
                ), '[]'::json) AS modifiers
            FROM products p
            WHERE p.id = $1
            LIMIT 1`,
            [product.id]
        );

        res.json(detailedResult.rows[0] || product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/:storeId/products', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const canManage = await userCanManageStoreProducts(req.user, storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'No autorizado para gestionar productos de esta tienda' });
        }

        const result = await query(
            `SELECT p.*
             FROM products p
             WHERE p.store_id = $1
             ORDER BY p.name ASC`,
            [storeId]
        );

        const productIds = result.rows.map((product) => product.id).filter(Boolean);
        let modifiersResult = { rows: [] };

        if (productIds.length > 0) {
            modifiersResult = await query(
                `SELECT pm.*
                 FROM product_modifiers pm
                 WHERE pm.product_id = ANY($1::uuid[])
                 ORDER BY pm.group_name, pm.name`,
                [productIds]
            );
        }

        const modifiersByProduct = modifiersResult.rows.reduce((acc, modifier) => {
            if (!modifier || !modifier.product_id) return acc;
            if (!acc[modifier.product_id]) {
                acc[modifier.product_id] = [];
            }
            acc[modifier.product_id].push(modifier);
            return acc;
        }, {});

        res.json(
            result.rows.map((product) => ({
                ...product,
                modifiers: modifiersByProduct[product.id] || []
            }))
        );
    } catch (error) {
        logger.error('Error fetching products for store:', error);
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
            product_type,
            is_menu_item,
            has_modifiers,
            accepts_fires,
            stock,
            min_stock_alert,
            modifierGroups
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
        const normalizeProductType = (rawType) => {
            return rawType === 'service' ? 'service' : 'product';
        };

        if (product_type !== undefined) {
            fields.push(`product_type = $${idx++}`);
            values.push(normalizeProductType(product_type));
        }
        const normalizeNumericField = (raw) => {
            if (raw === '' || raw === null || raw === undefined) {
                return null;
            }
            const parsed = Number(String(raw).replace(',', '.'));
            return Number.isFinite(parsed) ? parsed : null;
        };

        if (price_usdt !== undefined) {
            const normalizedPriceUsdt = normalizeNumericField(price_usdt);
            fields.push(`price_usdt = $${idx++}`);
            values.push(normalizedPriceUsdt);
        }
        if (price_fires !== undefined) {
            const normalizedPriceFires = normalizeNumericField(price_fires);
            fields.push(`price_fires = $${idx++}`);
            values.push(normalizedPriceFires);
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

        if (min_stock_alert !== undefined) {
            let normalizedMinStockAlert = parseInt(min_stock_alert, 10);
            if (!Number.isFinite(normalizedMinStockAlert) || normalizedMinStockAlert < 0) {
                normalizedMinStockAlert = 0;
            }
            fields.push(`min_stock_alert = $${idx++}`);
            values.push(normalizedMinStockAlert);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        values.push(productId);

        const updateResult = await query(
            `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        const updatedProduct = updateResult.rows[0];

        // Si llegan nuevos grupos de modificadores, reemplazar configuración existente
        if (Array.isArray(modifierGroups)) {
            await query('DELETE FROM product_modifiers WHERE product_id = $1', [productId]);

            for (const group of modifierGroups) {
                if (!group || !group.groupName) continue;
                const groupName = String(group.groupName).trim();
                if (!groupName) continue;

                const groupMaxSelRaw = group.maxSelection;
                let groupMaxSel = parseInt(groupMaxSelRaw, 10);
                if (!Number.isFinite(groupMaxSel) || groupMaxSel <= 0) {
                    groupMaxSel = 1;
                }

                const options = Array.isArray(group.options) ? group.options : [];
                for (const opt of options) {
                    if (!opt || !opt.name) continue;
                    const optName = String(opt.name).trim();
                    if (!optName) continue;

                    const rawAdj = opt.priceAdjustmentUsdt;
                    const parsedAdj =
                        rawAdj === '' || rawAdj === null || rawAdj === undefined
                            ? 0
                            : Number(String(rawAdj).replace(',', '.'));
                    const priceAdj =
                        Number.isFinite(parsedAdj) && parsedAdj >= 0 ? parsedAdj : 0;

                    const optMaxSelRaw = opt.maxSelection;
                    let optMaxSel = parseInt(optMaxSelRaw, 10);
                    if (!Number.isFinite(optMaxSel) || optMaxSel <= 0) {
                        optMaxSel = groupMaxSel;
                    }

                    await query(
                        `INSERT INTO product_modifiers 
                 (product_id, group_name, name, price_adjustment_usdt, max_selection)
                 VALUES ($1, $2, $3, $4, $5)`,
                        [productId, groupName, optName, priceAdj, optMaxSel]
                    );
                }
            }
        }

        res.json(updatedProduct);
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
            product_type, price_usdt, price_fires, stock, is_menu_item, has_modifiers, accepts_fires, min_stock_alert)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
                [
                    original.store_id,
                    original.category_id,
                    null,
                    newName,
                    original.description,
                    original.image_url,
                    original.product_type || 'product',
                    original.price_usdt,
                    original.price_fires,
                    0,
                    original.is_menu_item,
                    original.has_modifiers,
                    original.accepts_fires === true,
                    original.min_stock_alert || 0
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

// Get current user's staff role for a specific store
router.get('/:storeId/staff/me', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        if (!storeId || !userId) {
            return res.status(400).json({ error: 'Store ID and user ID required' });
        }

        const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
        const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

        // 1) Admin global: siempre puede ver el panel de cualquier tienda
        if (isGlobalAdmin) {
            const storeResult = await query(
                `SELECT id, name, slug FROM stores WHERE id = $1 LIMIT 1`,
                [storeId]
            );

            if (storeResult.rows.length === 0) {
                return res.status(404).json({ error: 'Store not found' });
            }

            const store = storeResult.rows[0];

            return res.json({
                role: 'admin',
                is_active: true,
                store_name: store.name,
                store_slug: store.slug
            });
        }

        // 2) Intentar resolver rol desde store_staff activo
        const staffResult = await query(
            `SELECT 
                ss.role,
                ss.is_active,
                s.name as store_name,
                s.slug as store_slug
            FROM store_staff ss
            JOIN stores s ON s.id = ss.store_id
            WHERE ss.store_id = $1 
              AND ss.user_id = $2 
              AND ss.is_active = TRUE
            LIMIT 1`,
            [storeId, userId]
        );

        if (staffResult.rows.length > 0) {
            const staffData = staffResult.rows[0];

            return res.json({
                role: staffData.role,
                is_active: staffData.is_active,
                store_name: staffData.store_name,
                store_slug: staffData.store_slug
            });
        }

        // 3) Fallback: si el usuario es el dueño (owner_id), tratarlo como role "owner" aunque no exista en store_staff
        const ownerResult = await query(
            `SELECT id, name, slug, owner_id FROM stores WHERE id = $1 LIMIT 1`,
            [storeId]
        );

        if (ownerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = ownerResult.rows[0];

        if (String(store.owner_id) !== String(userId)) {
            return res.status(404).json({ error: 'Not a staff member of this store' });
        }

        return res.json({
            role: 'owner',
            is_active: true,
            store_name: store.name,
            store_slug: store.slug
        });

    } catch (error) {
        console.error('Error fetching staff role:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get basic store info by ID (for slug resolution)
router.get('/:storeId/info', async (req, res) => {
    try {
        const { storeId } = req.params;

        const storeResult = await query(
            `SELECT id, slug, name FROM stores WHERE id = $1 LIMIT 1`,
            [storeId]
        );

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];

        res.json({
            id: store.id,
            slug: store.slug,
            name: store.name
        });

    } catch (error) {
        console.error('Error fetching store info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get store ID by slug (para lógica interna de panel/POS/KDS, no para público)
router.get('/by-slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const storeResult = await query(
            `SELECT id, name FROM stores WHERE slug = $1 LIMIT 1`,
            [slug]
        );

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }

        const store = storeResult.rows[0];

        res.json({
            id: store.id,
            name: store.name
        });

    } catch (error) {
        console.error('Error fetching store by slug:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
