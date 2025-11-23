const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { verifyToken, requireRole, requireAdmin } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// Get all staff for a specific store (Admin or Store Owner/Admin)
router.get('/store/:storeId', verifyToken, async (req, res) => {
    try {
        const { storeId } = req.params;

        // Check permissions: Must be Global Admin OR Store Staff (Owner/Admin)
        const isGlobalAdmin = req.user.roles.includes('admin') || req.user.roles.includes('tote');

        if (!isGlobalAdmin) {
            const staffCheck = await query(
                `SELECT role FROM store_staff 
         WHERE store_id = $1 AND user_id = $2 AND is_active = true`,
                [storeId, req.user.id]
            );

            const userRole = staffCheck.rows[0]?.role;
            if (!userRole || !['owner', 'admin'].includes(userRole)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }

        const result = await query(
            `SELECT s.*, u.username, u.display_name, u.avatar_url, u.email
       FROM store_staff s
       JOIN users u ON s.user_id = u.id
       WHERE s.store_id = $1
       ORDER BY s.created_at DESC`,
            [storeId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching store staff:', error);
        res.status(500).json({ error: 'Failed to fetch store staff' });
    }
});

// Get all stores for a specific user
router.get('/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Users can only see their own stores unless they are admin
        if (req.user.id !== userId && !req.user.roles.includes('admin') && !req.user.roles.includes('tote')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await query(
            `SELECT s.*, st.name as store_name, st.slug as store_slug, st.logo_url
       FROM store_staff s
       JOIN stores st ON s.store_id = st.id
       WHERE s.user_id = $1 AND s.is_active = true`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching user stores:', error);
        res.status(500).json({ error: 'Failed to fetch user stores' });
    }
});

// Assign user to store (Global Admin only for now, or Store Owner)
router.post('/assign', verifyToken, async (req, res) => {
    try {
        const { store_id, user_id, role } = req.body;

        if (!['owner', 'admin', 'manager', 'seller', 'marketing'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Permission check
        const isGlobalAdmin = req.user.roles.includes('admin') || req.user.roles.includes('tote');
        if (!isGlobalAdmin) {
            // Check if user is owner/admin of the store
            const staffCheck = await query(
                `SELECT role FROM store_staff 
         WHERE store_id = $1 AND user_id = $2 AND is_active = true`,
                [store_id, req.user.id]
            );
            const userRole = staffCheck.rows[0]?.role;
            if (!userRole || !['owner', 'admin'].includes(userRole)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }

        // Upsert assignment
        await query(
            `INSERT INTO store_staff (store_id, user_id, role, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (store_id, user_id) 
       DO UPDATE SET role = $3, is_active = true, updated_at = NOW()`,
            [store_id, user_id, role]
        );

        res.json({ success: true, message: 'Staff assigned successfully' });
    } catch (error) {
        logger.error('Error assigning staff:', error);
        res.status(500).json({ error: 'Failed to assign staff' });
    }
});

// Remove staff from store
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Get assignment details to check permissions
        const staffMember = await query('SELECT * FROM store_staff WHERE id = $1', [id]);
        if (staffMember.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        const assignment = staffMember.rows[0];

        // Permission check
        const isGlobalAdmin = req.user.roles.includes('admin') || req.user.roles.includes('tote');
        if (!isGlobalAdmin) {
            const staffCheck = await query(
                `SELECT role FROM store_staff 
         WHERE store_id = $1 AND user_id = $2 AND is_active = true`,
                [assignment.store_id, req.user.id]
            );
            const userRole = staffCheck.rows[0]?.role;
            if (!userRole || !['owner', 'admin'].includes(userRole)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }

        await query('DELETE FROM store_staff WHERE id = $1', [id]);

        res.json({ success: true, message: 'Staff removed successfully' });
    } catch (error) {
        logger.error('Error removing staff:', error);
        res.status(500).json({ error: 'Failed to remove staff' });
    }
});

module.exports = router;
