'use strict';

const { query } = require('../db');
const { getStoreBasics } = require('./storeHelpers');

/**
 * Obtiene rol de staff y definición de store_roles (si existe) para un usuario en una tienda.
 */
async function getStoreStaffAndRole(userId, storeId) {
  if (!userId || !storeId) return null;

  const staffResult = await query(
    `SELECT s.role AS role_key, r.id AS store_role_id, r.display_name, r.description, r.permissions, r.is_system
     FROM store_staff s
     LEFT JOIN store_roles r
       ON r.store_id = s.store_id
      AND r.role_key = s.role
     WHERE s.user_id = $1
       AND s.store_id = $2
       AND s.is_active = TRUE
     LIMIT 1`,
    [userId, storeId]
  );

  if (staffResult.rows.length === 0) {
    // Fallback: si es owner "nativo" de la tienda pero no está en store_staff, tratarlo como owner
    const storeRow = await getStoreBasics(storeId);
    if (storeRow && String(storeRow.owner_id) === String(userId)) {
      const roleResult = await query(
        `SELECT id AS store_role_id, role_key, display_name, description, permissions, is_system
         FROM store_roles
         WHERE store_id = $1 AND role_key = 'owner'
         LIMIT 1`,
        [storeId]
      );

      const roleRow = roleResult.rows[0] || null;
      return roleRow
        ? {
            role_key: 'owner',
            store_role_id: roleRow.store_role_id,
            display_name: roleRow.display_name,
            description: roleRow.description,
            permissions: roleRow.permissions,
            is_system: roleRow.is_system,
          }
        : {
            role_key: 'owner',
            store_role_id: null,
            display_name: 'Dueño',
            description: null,
            permissions: [],
            is_system: true,
          };
    }

    return null;
  }

  const row = staffResult.rows[0];
  return {
    role_key: row.role_key,
    store_role_id: row.store_role_id || null,
    display_name: row.display_name || row.role_key,
    description: row.description || null,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    is_system: !!row.is_system,
  };
}

/**
 * Devuelve el conjunto de permisos efectivos para un usuario en una tienda.
 * Los administradores globales (tote/admin) tienen siempre permiso total ('*').
 */
async function getStorePermissionsForUser(user, storeId) {
  if (!user || !storeId) return new Set();

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

  if (isGlobalAdmin) {
    return new Set(['*']);
  }

  const staffAndRole = await getStoreStaffAndRole(user.id, storeId);
  if (!staffAndRole) {
    return new Set();
  }

  const permissions = Array.isArray(staffAndRole.permissions)
    ? staffAndRole.permissions.filter((p) => typeof p === 'string')
    : [];

  return new Set(permissions);
}

/**
 * Verifica si un usuario tiene un permiso concreto en una tienda.
 * Incluye fallback especial para store.roles.manage: solo el dueño puede usarlo
 * si aún no hay permisos configurados en store_roles.
 */
async function userHasStorePermission(user, storeId, permissionKey) {
  if (!user || !storeId || !permissionKey) return false;

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');
  if (isGlobalAdmin) return true;

  const perms = await getStorePermissionsForUser(user, storeId);
  if (perms.has('*') || perms.has(permissionKey)) {
    return true;
  }

  // Fallback duro para gestión de roles de tienda: solo el dueño nativo
  if (permissionKey === 'store.roles.manage') {
    const storeRow = await getStoreBasics(storeId);
    if (storeRow && storeRow.owner_id && String(storeRow.owner_id) === String(user.id)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  getStoreStaffAndRole,
  getStorePermissionsForUser,
  userHasStorePermission,
};
