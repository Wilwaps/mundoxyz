const { query } = require('../db');
const logger = require('../utils/logger');

// Executor genérico que funciona con client de transacción o con el pool global
function getExecutor(client) {
  if (client && typeof client.query === 'function') {
    return client;
  }
  return { query };
}

/**
 * Resuelve un token de Tito y devuelve el user_id del Tito dueño si está activo.
 * No lanza errores hacia arriba: en caso de fallo devuelve null para no bloquear registros.
 */
async function resolveTitoOwnerIdByToken(client, rawToken) {
  const token = (rawToken || '').toString().trim();
  if (!token) return null;

  const executor = getExecutor(client);

  try {
    const res = await executor.query(
      `SELECT tito_user_id FROM tito_tokens
       WHERE token = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [token]
    );

    if (!res.rows.length) {
      return null;
    }

    return res.rows[0].tito_user_id || null;
  } catch (error) {
    logger.error('[TitoService] Error resolviendo token de Tito', {
      token,
      error: error.message
    });
    return null;
  }
}

module.exports = {
  resolveTitoOwnerIdByToken
};
