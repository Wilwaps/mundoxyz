const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, verifyRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

// --- PUBLIC ENDPOINTS ---

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

module.exports = router;
