const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { verifyToken, requireTote } = require('../../middleware/auth');
const logger = require('../../utils/logger');

router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const isSelf = req.user && String(req.user.id) === String(userId);

    if (!isSelf) {
      if (!req.user || !(req.user.roles?.includes('tote') || req.user.roles?.includes('admin'))) {
        return res.status(403).json({ error: 'No autorizado para ver tiendas de otros usuarios' });
      }
    }

    const result = await query(
      `SELECT 
         s.id,
         s.store_id,
         s.user_id,
         s.role,
         s.is_active,
         s.created_at,
         s.updated_at,
         st.slug AS store_slug,
         st.name AS store_name,
         st.logo_url
       FROM store_staff s
       JOIN stores st ON st.id = s.store_id
       WHERE s.user_id = $1
       ORDER BY st.name ASC, s.created_at ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching store staff by user:', error);
    res.status(500).json({ error: 'Failed to fetch store staff for user' });
  }
});

router.get('/store/:storeId', verifyToken, requireTote, async (req, res) => {
  try {
    const { storeId } = req.params;

    const result = await query(
      `SELECT 
         s.id,
         s.store_id,
         s.user_id,
         s.role,
         s.is_active,
         s.created_at,
         s.updated_at,
         u.username,
         u.display_name
       FROM store_staff s
       JOIN users u ON u.id = s.user_id
       WHERE s.store_id = $1
       ORDER BY s.created_at ASC`,
      [storeId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching store staff by store:', error);
    res.status(500).json({ error: 'Failed to fetch store staff for store' });
  }
});

router.post('/assign', verifyToken, requireTote, async (req, res) => {
  try {
    const { user_id, store_id, role } = req.body || {};

    if (!user_id || !store_id || !role) {
      return res.status(400).json({ error: 'user_id, store_id y role son requeridos' });
    }

    const validRoles = ['owner', 'admin', 'manager', 'seller', 'marketing'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol de tienda inválido' });
    }

    const existing = await query(
      'SELECT id FROM store_staff WHERE user_id = $1 AND store_id = $2',
      [user_id, store_id]
    );

    let staffRow;

    if (existing.rows.length > 0) {
      const update = await query(
        `UPDATE store_staff 
         SET role = $1, is_active = TRUE, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [role, existing.rows[0].id]
      );
      staffRow = update.rows[0];
    } else {
      const insert = await query(
        `INSERT INTO store_staff (store_id, user_id, role, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        [store_id, user_id, role]
      );
      staffRow = insert.rows[0];
    }

    res.json({ success: true, staff: staffRow });
  } catch (error) {
    logger.error('Error assigning store staff:', error);
    res.status(500).json({ error: 'Failed to assign store staff' });
  }
});

router.delete('/:id', verifyToken, requireTote, async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM store_staff WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting store staff assignment:', error);
    res.status(500).json({ error: 'Failed to delete store staff assignment' });
  }
});

module.exports = router;
