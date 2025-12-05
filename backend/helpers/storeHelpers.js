const { query } = require('../db');

const STORE_CACHE_TTL_MS = 5_000;
const STORE_CACHE_MAX_KEYS = 200;
const storeCache = new Map();

const setStoreCache = (storeId, data) => {
  if (!storeId) return;
  if (storeCache.size >= STORE_CACHE_MAX_KEYS) {
    const firstKey = storeCache.keys().next().value;
    if (firstKey) {
      storeCache.delete(firstKey);
    }
  }
  storeCache.set(storeId, {
    data,
    expiresAt: Date.now() + STORE_CACHE_TTL_MS
  });
};

const getStoreBasics = async (storeId) => {
  if (!storeId) return null;

  const cached = storeCache.get(storeId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const result = await query(
    `SELECT id, owner_id
     FROM stores
     WHERE id = $1
     LIMIT 1`,
    [storeId]
  );

  const storeRow = result.rows[0] || null;
  setStoreCache(storeId, storeRow);
  return storeRow;
};

const invalidateStoreCache = (storeId) => {
  if (storeId) {
    storeCache.delete(storeId);
  }
};

const clearStoreCache = () => {
  storeCache.clear();
};

/**
 * Verifica si la tienda tiene alquiler activo (no bloqueada y no vencida)
 * @param {string} storeId UUID de la tienda
 * @returns {Promise<boolean>} true si está activa, false si está bloqueada o vencida
 */
async function isStoreRentalActive(storeId) {
  const storeRow = await getStoreBasics(storeId);

  if (!storeRow) {
    return false;
  }

  // Columnas is_blocked/rent_expires_at no existen aún en producción; asumir tienda activa.
  return true;
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
  const storeRow = await getStoreBasics(storeId);

  if (storeRow && storeRow.owner_id && String(storeRow.owner_id) === String(user.id)) {
    return true;
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
  getStoreBasics,
  isStoreRentalActive,
  userCanManageStoreOperations,
  userCanViewStoreReports,
  invalidateStoreCache,
  clearStoreCache
};
