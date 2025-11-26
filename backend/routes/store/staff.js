const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { query } = require('../../db');

// Get current user's staff role for a specific store
router.get('/:storeId/staff/me', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        if (!storeId || !userId) {
            return res.status(400).json({ error: 'Store ID and user ID required' });
        }

        // Check if user is staff for this store
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

        if (staffResult.rows.length === 0) {
            return res.status(404).json({ error: 'Not a staff member of this store' });
        }

        const staffData = staffResult.rows[0];

        res.json({
            role: staffData.role,
            is_active: staffData.is_active,
            store_name: staffData.store_name,
            store_slug: staffData.store_slug
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
            `SELECT id, slug, name FROM stores WHERE id = $1 AND is_active = TRUE LIMIT 1`,
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

module.exports = router;
