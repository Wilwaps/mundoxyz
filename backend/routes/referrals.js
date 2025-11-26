const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, requireTote } = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  getGlobalConfig,
  getLevelsBySource,
  distributeCommissions,
  executeTap,
  getMyReferralInfo,
  getStats
} = require('../services/referralService');

const REFERRAL_SOURCES = ['withdrawal', 'transfer', 'bingo_room', 'raffle_fire_room', 'store'];

// GET /api/referrals/me - Info para el usuario actual
router.get('/me', verifyToken, async (req, res) => {
  try {
    const info = await getMyReferralInfo(null, req.user.id);
    if (!info) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json(info);
  } catch (error) {
    logger.error('[Referrals] Error fetching my referral info', error);
    return res.status(500).json({ error: 'Error al obtener información de referidos' });
  }
});

// POST /api/referrals/tap - Tap entre referidor y referido, 1 vez cada 24h por usuario
router.post('/tap', verifyToken, async (req, res) => {
  try {
    const { target_user_id } = req.body || {};

    if (!target_user_id) {
      return res.status(400).json({ error: 'target_user_id es requerido' });
    }

    const result = await executeTap({ client: null, fromUserId: req.user.id, toUserId: target_user_id });

    if (!result.success && result.cooldown) {
      return res.status(429).json({
        error: 'Solo puedes enviar un tap cada 24 horas',
        last_tap_at: result.lastTapAt,
        next_available_at: result.nextAvailableAt
      });
    }

    return res.json(result);
  } catch (error) {
    logger.error('[Referrals] Error executing tap', error);
    return res.status(400).json({ error: error.message || 'Error al ejecutar tap' });
  }
});

// GET /api/referrals/config - Configuración global + niveles (solo Tote)
router.get('/config', verifyToken, requireTote, async (req, res) => {
  try {
    const configRow = await getGlobalConfig(null);
    const levelsBySource = {};

    for (const source of REFERRAL_SOURCES) {
      levelsBySource[source] = await getLevelsBySource(null, source);
    }

    return res.json({ config: configRow, levels: levelsBySource });
  } catch (error) {
    logger.error('[Referrals] Error fetching config', error);
    return res.status(500).json({ error: 'Error al obtener configuración de referidos' });
  }
});

// POST /api/referrals/config - Actualizar configuración y niveles (solo Tote)
router.post('/config', verifyToken, requireTote, async (req, res) => {
  const {
    enabled,
    enable_withdrawals,
    enable_transfers,
    enable_bingo_rooms,
    enable_raffle_fire_rooms,
    enable_stores,
    levels
  } = req.body || {};

  try {
    const result = await transaction(async (client) => {
      const executor = client;

      const fields = [];
      const values = [];
      let idx = 1;

      if (enabled !== undefined) {
        fields.push(`enabled = $${idx++}`);
        values.push(!!enabled);
      }
      if (enable_withdrawals !== undefined) {
        fields.push(`enable_withdrawals = $${idx++}`);
        values.push(!!enable_withdrawals);
      }
      if (enable_transfers !== undefined) {
        fields.push(`enable_transfers = $${idx++}`);
        values.push(!!enable_transfers);
      }
      if (enable_bingo_rooms !== undefined) {
        fields.push(`enable_bingo_rooms = $${idx++}`);
        values.push(!!enable_bingo_rooms);
      }
      if (enable_raffle_fire_rooms !== undefined) {
        fields.push(`enable_raffle_fire_rooms = $${idx++}`);
        values.push(!!enable_raffle_fire_rooms);
      }
      if (enable_stores !== undefined) {
        fields.push(`enable_stores = $${idx++}`);
        values.push(!!enable_stores);
      }

      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        values.push(1);
        await executor.query(
          `UPDATE referral_config SET ${fields.join(', ')} WHERE id = $${idx}`,
          values
        );
      }

      if (Array.isArray(levels)) {
        for (const lvl of levels) {
          if (!lvl) continue;
          const src = typeof lvl.source === 'string' ? lvl.source.trim() : '';
          if (!REFERRAL_SOURCES.includes(src)) continue;

          let levelNum = parseInt(lvl.level, 10);
          if (!Number.isFinite(levelNum) || levelNum < 1 || levelNum > 5) {
            continue;
          }

          const pctRaw = typeof lvl.percentage === 'number'
            ? lvl.percentage
            : Number(String(lvl.percentage ?? '').replace(',', '.'));
          const percentage = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : 0;
          const active = lvl.active !== false;

          await executor.query(
            `INSERT INTO referral_levels (level, source, percentage, active)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (level, source)
             DO UPDATE SET percentage = EXCLUDED.percentage, active = EXCLUDED.active, updated_at = NOW()`,
            [levelNum, src, percentage, active]
          );
        }
      }

      const configRow = await getGlobalConfig(client);
      const levelsBySource = {};
      for (const source of REFERRAL_SOURCES) {
        levelsBySource[source] = await getLevelsBySource(client, source);
      }

      return { config: configRow, levels: levelsBySource };
    });

    return res.json(result);
  } catch (error) {
    logger.error('[Referrals] Error updating config', error);
    return res.status(500).json({ error: 'Error al actualizar configuración de referidos' });
  }
});

// GET /api/referrals/stats - Métricas globales (solo Tote)
router.get('/stats', verifyToken, requireTote, async (req, res) => {
  try {
    const stats = await getStats(null);
    return res.json(stats);
  } catch (error) {
    logger.error('[Referrals] Error fetching stats', error);
    return res.status(500).json({ error: 'Error al obtener estadísticas de referidos' });
  }
});

module.exports = router;
