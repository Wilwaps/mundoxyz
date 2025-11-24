const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// GET /api/store/inventory/:storeId/ingredients
router.get('/:storeId/ingredients', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        const result = await query(
            `SELECT * FROM ingredients WHERE store_id = $1 ORDER BY name ASC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching ingredients:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/ingredient
router.post('/:storeId/ingredient', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { name, unit, cost_per_unit_usdt, current_stock, min_stock_alert } = req.body;

        const result = await query(
            `INSERT INTO ingredients 
       (store_id, name, unit, cost_per_unit_usdt, current_stock, min_stock_alert)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [storeId, name, unit, cost_per_unit_usdt, current_stock, min_stock_alert]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/product/:productId/recipe
router.post('/product/:productId/recipe', verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const { ingredient_id, quantity_required } = req.body;

        const result = await transaction(async (client) => {
            // Add recipe item
            const recipeResult = await client.query(
                `INSERT INTO recipes (product_id, ingredient_id, quantity_required)
         VALUES ($1, $2, $3)
         RETURNING *`,
                [productId, ingredient_id, quantity_required]
            );

            // Recalculate Product Cost (Escandallo)
            await client.query(
                `UPDATE products 
         SET cost_usdt = (
           SELECT SUM(r.quantity_required * i.cost_per_unit_usdt)
           FROM recipes r
           JOIN ingredients i ON r.ingredient_id = i.id
           WHERE r.product_id = $1
         )
         WHERE id = $1`,
                [productId]
            );

            return recipeResult.rows[0];
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/store/:storeId/waste
router.post('/:storeId/waste', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { ingredient_id, quantity, reason } = req.body;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            // Deduct stock
            await client.query(
                `UPDATE ingredients 
         SET current_stock = current_stock - $1, updated_at = NOW()
         WHERE id = $2`,
                [quantity, ingredient_id]
            );

            // Log waste
            const logResult = await client.query(
                `INSERT INTO waste_logs 
         (store_id, ingredient_id, quantity, reason, logged_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
                [storeId, ingredient_id, quantity, reason, userId]
            );

            return logResult.rows[0];
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
