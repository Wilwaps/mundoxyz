const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get user profile
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user data with wallet and roles
    const result = await query(
      `SELECT 
        u.id,
        u.xyz_id,
        u.tg_id,
        u.username,
        u.display_name,
        u.email,
        u.avatar_url,
        u.locale,
        u.is_active,
        u.is_verified,
        u.created_at,
        u.last_seen_at,
        w.coins_balance,
        w.fires_balance,
        w.total_coins_earned,
        w.total_fires_earned,
        w.total_coins_spent,
        w.total_fires_spent,
        array_agg(DISTINCT r.name) as roles,
        json_object_agg(
          DISTINCT gs.game_type, 
          json_build_object(
            'games_played', gs.games_played,
            'games_won', gs.games_won,
            'fires_won', gs.fires_won,
            'coins_won', gs.coins_won
          )
        ) FILTER (WHERE gs.game_type IS NOT NULL) as game_stats
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN game_stats gs ON gs.user_id = u.id
      WHERE u.id = $1 OR u.tg_id = $1::bigint OR u.username = $1
      GROUP BY u.id, w.coins_balance, w.fires_balance, w.total_coins_earned, 
               w.total_fires_earned, w.total_coins_spent, w.total_fires_spent`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if this is the user's own profile or they have permission
    const isOwnProfile = req.user && (
      req.user.id === user.id || 
      req.user.tg_id === user.tg_id
    );
    
    const isAdmin = req.user && (
      req.user.roles?.includes('admin') || 
      req.user.roles?.includes('tote')
    );

    // Build response based on permissions
    const profile = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at,
      is_verified: user.is_verified,
      roles: user.roles?.filter(Boolean) || [],
      stats: {
        coins_balance: user.coins_balance || 0,
        fires_balance: user.fires_balance || 0,
        total_coins_earned: user.total_coins_earned || 0,
        total_fires_earned: user.total_fires_earned || 0,
        games: user.game_stats || {}
      }
    };

    // Add private data if authorized
    if (isOwnProfile || isAdmin) {
      profile.tg_id = user.tg_id;
      profile.email = user.email;
      profile.locale = user.locale;
      profile.total_coins_spent = user.total_coins_spent || 0;
      profile.total_fires_spent = user.total_fires_spent || 0;
    }

    // Get recent transactions if own profile
    if (isOwnProfile) {
      const txResult = await query(
        `SELECT 
          wt.id,
          wt.type,
          wt.currency,
          wt.amount,
          wt.balance_after,
          wt.description,
          wt.created_at,
          u2.username as related_username
        FROM wallet_transactions wt
        LEFT JOIN wallets w ON w.id = wt.wallet_id
        LEFT JOIN users u2 ON u2.id = wt.related_user_id
        WHERE w.user_id = $1
        ORDER BY wt.created_at DESC
        LIMIT 10`,
        [user.id]
      );

      profile.recent_transactions = txResult.rows;
    }

    res.json(profile);

  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { display_name, avatar_url, locale, email } = req.body;

    // Check if user can update this profile
    const canUpdate = 
      req.user.id === userId ||
      req.user.tg_id?.toString() === userId ||
      req.user.username === userId ||
      req.user.roles?.includes('admin') ||
      req.user.roles?.includes('tote');

    if (!canUpdate) {
      return res.status(403).json({ error: 'Cannot update this profile' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url);
    }

    if (locale !== undefined) {
      updates.push(`locale = $${paramCount++}`);
      values.push(locale);
    }

    if (email !== undefined && req.user.roles?.includes('admin')) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add user identifier
    values.push(userId);

    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} OR tg_id = $${paramCount}::bigint OR username = $${paramCount}
       RETURNING id, username, display_name, avatar_url, locale, email`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user statistics
router.get('/:userId/stats', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT 
        COUNT(DISTINCT r.id) as total_raffles_participated,
        COUNT(DISTINCT CASE WHEN r.winner_id = u.id THEN r.id END) as raffles_won,
        COUNT(DISTINCT b.id) as total_bingo_games,
        COUNT(DISTINCT CASE WHEN b.winner_id = u.id THEN b.id END) as bingo_won,
        COALESCE(SUM(rp.fires_spent), 0) as total_fires_in_raffles,
        COALESCE(SUM(rp.coins_spent), 0) as total_coins_in_raffles,
        COALESCE(SUM(bp.fires_spent), 0) as total_fires_in_bingo,
        COALESCE(SUM(bp.coins_spent), 0) as total_coins_in_bingo
      FROM users u
      LEFT JOIN raffle_participants rp ON rp.user_id = u.id
      LEFT JOIN raffles r ON r.id = rp.raffle_id
      LEFT JOIN bingo_players bp ON bp.user_id = u.id
      LEFT JOIN bingo_rooms b ON b.id = bp.room_id
      WHERE u.id = $1 OR u.tg_id = $1::bigint OR u.username = $1
      GROUP BY u.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = result.rows[0];

    // Get achievements
    const achievements = [];
    
    if (stats.raffles_won > 0) {
      achievements.push({
        name: 'Raffle Winner',
        description: `Won ${stats.raffles_won} raffle${stats.raffles_won > 1 ? 's' : ''}`,
        icon: '🎯'
      });
    }

    if (stats.bingo_won > 0) {
      achievements.push({
        name: 'Bingo Master',
        description: `Won ${stats.bingo_won} bingo game${stats.bingo_won > 1 ? 's' : ''}`,
        icon: '🎱'
      });
    }

    if (parseInt(stats.total_raffles_participated) >= 10) {
      achievements.push({
        name: 'Raffle Enthusiast',
        description: 'Participated in 10+ raffles',
        icon: '🎲'
      });
    }

    if (parseInt(stats.total_bingo_games) >= 10) {
      achievements.push({
        name: 'Bingo Regular',
        description: 'Played 10+ bingo games',
        icon: '📋'
      });
    }

    res.json({
      games: {
        raffles: {
          participated: parseInt(stats.total_raffles_participated),
          won: parseInt(stats.raffles_won),
          fires_spent: parseFloat(stats.total_fires_in_raffles),
          coins_spent: parseFloat(stats.total_coins_in_raffles)
        },
        bingo: {
          played: parseInt(stats.total_bingo_games),
          won: parseInt(stats.bingo_won),
          fires_spent: parseFloat(stats.total_fires_in_bingo),
          coins_spent: parseFloat(stats.total_coins_in_bingo)
        }
      },
      achievements
    });

  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get user's active games
router.get('/:userId/games', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check permissions
    const canView = 
      req.user.id === userId ||
      req.user.tg_id?.toString() === userId ||
      req.user.roles?.includes('admin') ||
      req.user.roles?.includes('tote');

    if (!canView) {
      return res.status(403).json({ error: 'Cannot view this user\'s games' });
    }

    // Get active raffles
    const raffles = await query(
      `SELECT 
        r.id,
        r.code,
        r.name,
        r.status,
        r.mode,
        r.visibility,
        r.ends_at,
        rp.numbers,
        rp.fires_spent,
        rp.coins_spent
      FROM raffle_participants rp
      JOIN raffles r ON r.id = rp.raffle_id
      WHERE rp.user_id = $1 AND r.status IN ('pending', 'active')
      ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    // Get active bingo rooms
    const bingo = await query(
      `SELECT 
        br.id,
        br.code,
        br.name,
        br.status,
        br.mode,
        br.visibility,
        bp.cards_count,
        bp.is_ready,
        bp.fires_spent,
        bp.coins_spent
      FROM bingo_players bp
      JOIN bingo_rooms br ON br.id = bp.room_id
      WHERE bp.user_id = $1 AND br.status IN ('waiting', 'ready', 'playing')
      ORDER BY br.created_at DESC`,
      [req.user.id]
    );

    res.json({
      raffles: raffles.rows,
      bingo: bingo.rows
    });

  } catch (error) {
    logger.error('Error fetching user games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

module.exports = router;
