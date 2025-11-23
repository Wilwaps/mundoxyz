const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, adminAuth, requireTote } = require('../middleware/auth');
const giftService = require('../services/giftService');
const logger = require('../utils/logger');

// Admin: Enviar regalo directo
router.post('/send', adminAuth, async (req, res) => {
  try {
    const senderId = req.user.id;
    const result = await giftService.sendDirectGift(senderId, req.body);
    
    logger.info('Direct gift sent', {
      senderId,
      giftId: result.id,
      targetType: req.body.target_type
    });
    
    res.json({
      success: true,
      gift: result,
      message: 'Gift sent successfully'
    });
  } catch (error) {
    logger.error('Error sending direct gift:', error);
    res.status(400).json({ error: error.message || 'Failed to send gift' });
  }
});

// Usuario: Aceptar regalo
router.post('/claim/:giftId', verifyToken, async (req, res) => {
  try {
    const giftId = parseInt(req.params.giftId);
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      return await giftService.creditGiftToUser(client, giftId, userId, req.ip);
    });
    
    logger.info('Gift claimed', {
      userId,
      giftId,
      coinsReceived: result.coins_received,
      firesReceived: result.fires_received
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error claiming gift:', error);
    res.status(400).json({ error: error.message || 'Failed to claim gift' });
  }
});

// Tote: Crear link de regalo desde supply
router.post('/links', verifyToken, requireTote, async (req, res) => {
  try {
    const senderId = req.user.id;
    const gift = await giftService.createGiftLink(senderId, req.body);

    const originHeader = req.get('origin');
    const baseUrl = originHeader ? originHeader.replace(/\/$/, '') : '';
    const url = gift.link_token && baseUrl
      ? `${baseUrl}/gift-link/${gift.link_token}`
      : null;

    res.json({
      success: true,
      gift,
      url
    });
  } catch (error) {
    logger.error('Error creating gift link:', error);
    res.status(400).json({ error: error.message || 'Failed to create gift link' });
  }
});

// Usuario: Reclamar link de regalo por token
router.post('/links/claim', verifyToken, async (req, res) => {
  try {
    const { token } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await giftService.claimGiftLink(token, req.user.id, req.ip);

    logger.info('Gift link claimed', {
      userId: req.user.id,
      firesReceived: result.fires_received,
      coinsReceived: result.coins_received
    });

    res.json(result);
  } catch (error) {
    logger.error('Error claiming gift link:', error);
    res.status(400).json({ error: error.message || 'Failed to claim gift link' });
  }
});

// Tote: Listar links de regalo creados
router.get('/links/my', verifyToken, requireTote, async (req, res) => {
  try {
    const senderId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await query(
      `SELECT 
        dg.id,
        dg.message,
        dg.fires_amount,
        dg.max_claims,
        dg.claimed_count,
        dg.status,
        dg.origin,
        dg.link_token,
        dg.created_at,
        dg.expires_at
       FROM direct_gifts dg
       WHERE dg.sender_id = $1
         AND dg.target_type = 'link'
       ORDER BY dg.created_at DESC
       LIMIT $2 OFFSET $3`,
      [senderId, limit, offset]
    );

    res.json({
      links: result.rows,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching gift links:', error);
    res.status(500).json({ error: 'Failed to fetch gift links' });
  }
});

// Usuario: Obtener mis regalos pendientes
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener regalos directos pendientes
    const giftsResult = await query(
      `SELECT 
        dg.*,
        u.username as sender_username,
        CASE 
          WHEN dg.expires_at IS NULL THEN NULL
          WHEN dg.expires_at < NOW() THEN true
          ELSE false
        END as is_expired
       FROM direct_gifts dg
       LEFT JOIN users u ON dg.sender_id = u.id
       WHERE (dg.target_user_id = $1 OR dg.target_type != 'single')
         AND dg.status = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM direct_gift_claims dgc 
           WHERE dgc.gift_id = dg.id AND dgc.user_id = $1
         )
       ORDER BY dg.created_at DESC`,
      [userId]
    );
    
    res.json({
      gifts: giftsResult.rows,
      total: giftsResult.rows.length
    });
  } catch (error) {
    logger.error('Error fetching pending gifts:', error);
    res.status(500).json({ error: 'Failed to fetch pending gifts' });
  }
});

// Usuario: Obtener historial de regalos reclamados
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await query(
      `SELECT 
        dgc.*,
        dg.message,
        dg.created_at as gift_created_at,
        u.username as sender_username
       FROM direct_gift_claims dgc
       JOIN direct_gifts dg ON dgc.gift_id = dg.id
       LEFT JOIN users u ON dg.sender_id = u.id
       WHERE dgc.user_id = $1
       ORDER BY dgc.claimed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    res.json({
      claims: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching gift history:', error);
    res.status(500).json({ error: 'Failed to fetch gift history' });
  }
});

// Admin: Obtener estadísticas de eventos
router.get('/analytics/events', adminAuth, async (req, res) => {
  try {
    const { event_id } = req.query;
    const stats = await giftService.getEventAnalytics(event_id);
    
    res.json({
      events: stats
    });
  } catch (error) {
    logger.error('Error fetching event analytics:', error);
    res.status(500).json({ error: 'Failed to fetch event analytics' });
  }
});

// Admin: Obtener estadísticas de regalos
router.get('/analytics/gifts', adminAuth, async (req, res) => {
  try {
    const { gift_id } = req.query;
    const stats = await giftService.getGiftAnalytics(gift_id);
    
    res.json({
      gifts: stats
    });
  } catch (error) {
    logger.error('Error fetching gift analytics:', error);
    res.status(500).json({ error: 'Failed to fetch gift analytics' });
  }
});

// Admin: Obtener dashboard completo
router.get('/analytics/dashboard', adminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dashboard = await giftService.getDashboardAnalytics(parseInt(days));
    
    res.json(dashboard);
  } catch (error) {
    logger.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// Admin: Listar todos los regalos enviados
router.get('/list', adminAuth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query_str = `
      SELECT 
        dg.*,
        u.username as sender_username,
        (SELECT COUNT(*) FROM direct_gift_claims WHERE gift_id = dg.id) as claim_count
      FROM direct_gifts dg
      LEFT JOIN users u ON dg.sender_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query_str += ` AND dg.status = $${paramCount}`;
      params.push(status);
    }
    
    query_str += ` ORDER BY dg.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await query(query_str, params);
    
    res.json({
      gifts: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error listing gifts:', error);
    res.status(500).json({ error: 'Failed to list gifts' });
  }
});

// Admin: Buscar usuarios para envío directo
router.get('/users/search', adminAuth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }
    
    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.level,
        u.last_seen_at,
        w.coins_balance,
        w.fires_balance
       FROM users u
       JOIN wallets w ON u.id = w.user_id
       WHERE u.username ILIKE $1 OR u.email ILIKE $1
       ORDER BY u.username
       LIMIT $2`,
      [`%${q}%`, limit]
    );
    
    res.json({
      users: result.rows
    });
  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
