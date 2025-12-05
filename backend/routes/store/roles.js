const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { verifyToken, requireStorePermission } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// GET /api/store/:storeId/roles
// Lista de roles de tienda (store_roles) para configuración
router.get('/:storeId/roles', verifyToken, requireStorePermission('store.roles.manage'), async (req, res) => {
  try {
    const { storeId } = req.params;

    const result = await query(
      `SELECT id,
              store_id,
              role_key,
              display_name,
              description,
              permissions,
              is_system,
              created_at,
              updated_at
         FROM store_roles
        WHERE store_id = $1
        ORDER BY role_key ASC`,
      [storeId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching store roles:', error);
    res.status(500).json({ error: 'Failed to fetch store roles' });
  }
});

// PUT /api/store/:storeId/roles/:roleId
// Actualiza nombre, descripción y permisos de un rol de tienda
router.put('/:storeId/roles/:roleId', verifyToken, requireStorePermission('store.roles.manage'), async (req, res) => {
  try {
    const { storeId, roleId } = req.params;
    const { display_name, description, permissions } = req.body || {};

    const permsArray = Array.isArray(permissions)
      ? permissions.filter((p) => typeof p === 'string')
      : [];

    const result = await query(
      `UPDATE store_roles
          SET display_name = COALESCE($1, display_name),
              description = COALESCE($2, description),
              permissions = $3::jsonb,
              updated_at = NOW()
        WHERE id = $4
          AND store_id = $5
        RETURNING id, store_id, role_key, display_name, description, permissions, is_system, created_at, updated_at`,
      [
        display_name || null,
        description || null,
        JSON.stringify(permsArray),
        roleId,
        storeId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store role not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating store role:', error);
    res.status(500).json({ error: 'Failed to update store role' });
  }
});

// GET /api/store/:storeId/roles/staff
// Lista de staff de tienda con su rol actual
router.get('/:storeId/roles/staff', verifyToken, requireStorePermission('store.roles.manage'), async (req, res) => {
  try {
    const { storeId } = req.params;

    const result = await query(
      `SELECT s.id,
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
    logger.error('Error fetching store staff for roles:', error);
    res.status(500).json({ error: 'Failed to fetch store staff' });
  }
});

// POST /api/store/:storeId/roles/assign
// Asigna (o actualiza) el rol de tienda de un usuario en store_staff
router.post('/:storeId/roles/assign', verifyToken, requireStorePermission('store.roles.manage'), async (req, res) => {
  try {
    const { storeId } = req.params;
    const { user_id, role_key } = req.body || {};

    if (!user_id || !role_key) {
      return res.status(400).json({ error: 'user_id y role_key son requeridos' });
    }

    // Validar que el rol exista en store_roles para esta tienda
    const roleResult = await query(
      `SELECT id, role_key, is_system
         FROM store_roles
        WHERE store_id = $1 AND role_key = $2
        LIMIT 1`,
      [storeId, role_key]
    );

    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Rol de tienda inválido para esta tienda' });
    }

    const existing = await query(
      'SELECT id FROM store_staff WHERE user_id = $1 AND store_id = $2',
      [user_id, storeId]
    );

    let staffRow;

    if (existing.rows.length > 0) {
      const update = await query(
        `UPDATE store_staff
            SET role = $1,
                is_active = TRUE,
                updated_at = NOW()
          WHERE id = $2
      RETURNING *`,
        [role_key, existing.rows[0].id]
      );
      staffRow = update.rows[0];
    } else {
      const insert = await query(
        `INSERT INTO store_staff (store_id, user_id, role, is_active)
         VALUES ($1, $2, $3, TRUE)
      RETURNING *`,
        [storeId, user_id, role_key]
      );
      staffRow = insert.rows[0];
    }

    res.json({ success: true, staff: staffRow });
  } catch (error) {
    logger.error('Error assigning store role to staff:', error);
    res.status(500).json({ error: 'Failed to assign store role' });
  }
});

module.exports = router;
