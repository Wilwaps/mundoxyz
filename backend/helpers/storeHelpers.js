const { query } = require('../db');

/**
 * Verifica si la tienda tiene alquiler activo (no bloqueada y no vencida)
 * @param {string} storeId UUID de la tienda
 * @returns {Promise<boolean>} true si está activa, false si está bloqueada o vencida
 */
async function isStoreRentalActive(storeId) {
  if (!storeId) return false;

  const result = await query(
    `SELECT rent_expires_at, is_blocked FROM stores WHERE id = $1 LIMIT 1`,
    [storeId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const row = result.rows[0];
  const blocked = row.is_blocked === true;
  const expiresAt = row.rent_expires_at ? new Date(row.rent_expires_at) : null;
  const expired = expiresAt && expiresAt <= new Date();

  return !(blocked || expired);
}

/**
 * Verifica si un usuario puede gestionar operaciones de tienda (POS, caja, etc.)
 * @param {object} user Objeto de usuario con roles
 * @param {string} storeId UUID de la tienda
 * @returns {Promise<boolean>}
 */
async function userCanManageStoreOperations(user, storeId) {
  if (!user || !storeId) return false;

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

  if (isGlobalAdmin) return true;

  // Verificar rol en store_staff activo
  const staffResult = await query(
    `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
    [user.id, storeId]
  );

  if (staffResult.rows.length > 0) {
    const staffRole = staffResult.rows[0].role;
    const allowedRoles = ['owner', 'admin', 'manager', 'seller', 'mesonero', 'delivery'];
    return allowedRoles.includes(staffRole);
  }

  // Fallback: si es el dueño de la tienda
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

/**
 * Verifica si un usuario puede ver reportes de una tienda.
 * Por ahora reutiliza la misma lógica que operaciones (POS/caja),
 * pero se mantiene separado por si en el futuro se amplían roles (marketing, etc.).
 */
async function userCanViewStoreReports(user, storeId) {
  return userCanManageStoreOperations(user, storeId);
}

module.exports = {
  isStoreRentalActive,
  userCanManageStoreOperations,
  userCanViewStoreReports
};
