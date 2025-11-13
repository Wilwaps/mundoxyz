const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken } = require('../middleware/auth');

// List user messages (buzón)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, category } = req.query;
    const params = [req.user.id, limit, offset];
    const whereCat = category ? 'AND category = $4' : '';
    if (category) params.push(category);

    const result = await query(
      `SELECT id, category, title, content, metadata, is_read, created_at
       FROM bingo_v2_messages
       WHERE user_id = $1 ${whereCat}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('[messages] list error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Unread count
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM bingo_v2_messages
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ unread: result.rows[0].count });
  } catch (error) {
    console.error('[messages] unread error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE bingo_v2_messages
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read` ,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error('[messages] mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;
