const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const BingoV2Service = require('../services/bingoV2Service');
const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Get all active rooms
 */
router.get('/rooms', async (req, res) => {
  try {
    const { mode, currency, status } = req.query;
    
    let sql = `
      SELECT r.*, u.username as host_name,
        (SELECT COUNT(*) FROM bingo_v2_room_players WHERE room_id = r.id) as player_count
      FROM bingo_v2_rooms r
      JOIN users u ON r.host_id = u.id
      WHERE r.status IN ('waiting', 'in_progress')
    `;
    
    const params = [];
    
    if (mode === '75' || mode === '90') {
      sql += ` AND r.mode = $${params.length + 1}`;
      params.push(mode);
    }
    
    if (currency === 'coins' || currency === 'fires') {
      sql += ` AND r.currency_type = $${params.length + 1}`;
      params.push(currency);
    }
    
    sql += ` ORDER BY r.created_at DESC LIMIT 50`;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      rooms: result.rows
    });
  } catch (error) {
    logger.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Error getting rooms' });
  }
});

/**
 * Create a new room
 */
router.post('/rooms', verifyToken, async (req, res) => {
  try {
    const room = await BingoV2Service.createRoom(req.user.id, {
      ...req.body,
      host_name: req.user.username
    });
    
    res.json({
      success: true,
      room
    });
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ error: error.message || 'Error creating room' });
  }
});

/**
 * Join a room
 */
router.post('/rooms/:code/join', verifyToken, async (req, res) => {
  try {
    const { cards_count = 1 } = req.body;
    const result = await BingoV2Service.joinRoom(
      req.params.code,
      req.user.id,
      cards_count
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Error joining room:', error);
    res.status(500).json({ error: error.message || 'Error joining room' });
  }
});

/**
 * Get room details
 */
router.get('/rooms/:code', async (req, res) => {
  try {
    const room = await BingoV2Service.getRoomDetails(req.params.code);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
      success: true,
      room
    });
  } catch (error) {
    logger.error('Error getting room:', error);
    res.status(500).json({ error: 'Error getting room details' });
  }
});

/**
 * Get user messages/inbox
 */
router.get('/messages', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM bingo_v2_messages 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [req.user.id]
    );
    
    // Get unread count
    const unreadResult = await query(
      `SELECT COUNT(*) as count FROM bingo_v2_messages 
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      messages: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count)
    });
  } catch (error) {
    logger.error('Error getting messages:', error);
    res.status(500).json({ error: 'Error getting messages' });
  }
});

/**
 * Mark message as read
 */
router.put('/messages/:id/read', verifyToken, async (req, res) => {
  try {
    await query(
      `UPDATE bingo_v2_messages 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Error updating message' });
  }
});

/**
 * Delete message
 */
router.delete('/messages/:id', verifyToken, async (req, res) => {
  try {
    await query(
      `DELETE FROM bingo_v2_messages 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Error deleting message' });
  }
});

/**
 * Get user experience and stats
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT experience, total_games_played, total_games_won 
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Error getting stats' });
  }
});

module.exports = router;
