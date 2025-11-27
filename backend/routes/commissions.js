const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');
const crypto = require('crypto');

async function ensureUserIsTito(userId) {
  const res = await query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'tito'
     LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

router.get('/tito/me/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const isTito = await ensureUserIsTito(userId);
    if (!isTito) {
      return res.status(403).json({ error: 'No tienes rol Tito' });
    }

    const { from, to } = req.query;
    const params = [userId];
    let where = 'WHERE tito_user_id = $1';

    if (from) {
      params.push(from);
      where += ` AND created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND created_at <= $${params.length}`;
    }

    const summaryResult = await query(
      `SELECT 
         COALESCE(SUM(tito_commission_amount), 0) AS total_tito_commission,
         COALESCE(SUM(tito_base_amount), 0) AS total_tito_base,
         COALESCE(SUM(tito_referral_amount), 0) AS total_tito_referral,
         COUNT(*) AS operations
       FROM commissions_log
       ${where}`,
      params
    );

    const byTypeResult = await query(
      `SELECT 
         operation_type,
         COALESCE(SUM(tito_commission_amount), 0) AS total_tito_commission,
         COUNT(*) AS operations
       FROM commissions_log
       ${where}
       GROUP BY operation_type
       ORDER BY operation_type`,
      params
    );

    res.json({
      summary: summaryResult.rows[0] || {
        total_tito_commission: 0,
        total_tito_base: 0,
        total_tito_referral: 0,
        operations: 0
      },
      byType: byTypeResult.rows
    });
  } catch (error) {
    logger.error('[Commissions] Error fetching Tito summary', error);
    res.status(500).json({ error: 'Error al obtener resumen de comisiones Tito' });
  }
});

router.get('/tito/me/operations', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const isTito = await ensureUserIsTito(userId);
    if (!isTito) {
      return res.status(403).json({ error: 'No tienes rol Tito' });
    }

    const { limit = 20, offset = 0 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const safeOffset = parseInt(offset, 10) || 0;

    const result = await query(
      `SELECT 
         id,
         operation_id,
         operation_type,
         amount_base,
         platform_commission_total,
         tito_commission_amount,
         tito_base_amount,
         tito_referral_amount,
         leader_commission_amount,
         community_pot_amount,
         tote_commission_amount,
         created_at
       FROM commissions_log
       WHERE tito_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    );

    res.json({
      operations: result.rows,
      limit: safeLimit,
      offset: safeOffset
    });
  } catch (error) {
    logger.error('[Commissions] Error fetching Tito operations', error);
    res.status(500).json({ error: 'Error al obtener operaciones Tito' });
  }
});

router.get('/tito/me/referrals', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const isTito = await ensureUserIsTito(userId);
    if (!isTito) {
      return res.status(403).json({ error: 'No tienes rol Tito' });
    }

    const { limit = 50, offset = 0 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const safeOffset = parseInt(offset, 10) || 0;

    const result = await query(
      `SELECT 
         id,
         username,
         created_at
       FROM users
       WHERE tito_owner_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    );

    res.json({
      referrals: result.rows,
      limit: safeLimit,
      offset: safeOffset
    });
  } catch (error) {
    logger.error('[Commissions] Error fetching Tito referrals', error);
    res.status(500).json({ error: 'Error al obtener usuarios referidos' });
  }
});

router.post('/tito/me/link', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const isTito = await ensureUserIsTito(userId);
    if (!isTito) {
      return res.status(403).json({ error: 'No tienes rol Tito' });
    }

    // Buscar token activo existente (no expirado)
    const existing = await query(
      `SELECT token, expires_at
       FROM tito_tokens
       WHERE tito_user_id = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );

    let token;
    let expiresAt = null;

    if (existing.rows.length > 0) {
      token = existing.rows[0].token;
      expiresAt = existing.rows[0].expires_at || null;
    } else {
      token = crypto.randomBytes(12).toString('hex');
      const insertRes = await query(
        `INSERT INTO tito_tokens (tito_user_id, token, status, metadata, expires_at)
         VALUES ($1, $2, 'active', $3, NOW() + INTERVAL '24 hours')
         RETURNING expires_at`,
        [userId, token, JSON.stringify({ created_from: 'tito_panel', ttl_hours: 24 })]
      );
      expiresAt = insertRes.rows[0]?.expires_at || null;
    }

    const frontendBase = config.server.frontendUrl || '';
    const inviteUrl = frontendBase
      ? `${frontendBase.replace(/\/$/, '')}/?tito=${encodeURIComponent(token)}`
      : `/?tito=${encodeURIComponent(token)}`;

    res.json({
      token,
      inviteUrl,
      expiresAt
    });
  } catch (error) {
    logger.error('[Commissions] Error generating Tito link', error);
    res.status(500).json({ error: 'Error al generar link de Tito' });
  }
});

// Admin: listado general de comisiones con filtros básicos
router.get('/admin/list', adminAuth, async (req, res) => {
  try {
    const {
      user_id,
      tito_user_id,
      operation_type,
      from,
      to,
      limit = 50,
      offset = 0
    } = req.query;

    const params = [];
    let where = 'WHERE 1=1';

    if (user_id) {
      params.push(user_id);
      where += ` AND user_id = $${params.length}`;
    }
    if (tito_user_id) {
      params.push(tito_user_id);
      where += ` AND tito_user_id = $${params.length}`;
    }
    if (operation_type) {
      params.push(operation_type);
      where += ` AND operation_type = $${params.length}`;
    }
    if (from) {
      params.push(from);
      where += ` AND created_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND created_at <= $${params.length}`;
    }

    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const safeOffset = parseInt(offset, 10) || 0;
    params.push(safeLimit, safeOffset);

    const result = await query(
      `SELECT 
         id,
         operation_id,
         operation_type,
         user_id,
         amount_base,
         platform_commission_total,
         tito_user_id,
         tito_commission_amount,
         leader_user_id,
         leader_commission_amount,
         community_pot_amount,
         tote_commission_amount,
         metadata,
         created_at
       FROM commissions_log
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      commissions: result.rows,
      limit: safeLimit,
      offset: safeOffset
    });
  } catch (error) {
    logger.error('[Commissions] Error fetching admin list', error);
    res.status(500).json({ error: 'Error al listar comisiones' });
  }
});

module.exports = router;
