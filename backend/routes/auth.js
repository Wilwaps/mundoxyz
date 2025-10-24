const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../db');
const { verifyTelegramWebAppData, verifyTelegramWidgetData, formatUserIdentifier } = require('../services/telegramAuth');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');

// Login with Telegram WebApp
router.post('/login-telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData required' });
    }

    // Verify Telegram data
    const telegramData = verifyTelegramWebAppData(initData);
    
    if (!telegramData) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Find or create user
    const userId = await findOrCreateTelegramUser(telegramData);
    
    if (!userId) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    // Create session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
      'VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL \'7 days\')',
      [userId, token, refreshToken, req.ip, req.headers['user-agent']]
    );

    // Log connection
    await query(
      'INSERT INTO connection_logs (user_id, event_type, ip_address, user_agent, method, path, status_code) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, 'login', req.ip, req.headers['user-agent'], 'POST', '/api/auth/login-telegram', 200]
    );

    // Get user data
    const userResult = await query(
      'SELECT u.*, w.coins_balance, w.fires_balance, array_agg(r.name) as roles ' +
      'FROM users u ' +
      'LEFT JOIN wallets w ON w.user_id = u.id ' +
      'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
      'LEFT JOIN roles r ON r.id = ur.role_id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id, w.coins_balance, w.fires_balance',
      [userId]
    );

    const user = userResult.rows[0];

    // Set cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.security.cookieSecure,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        tg_id: user.tg_id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        coins_balance: user.coins_balance || 0,
        fires_balance: user.fires_balance || 0,
        roles: user.roles?.filter(Boolean) || []
      }
    });

  } catch (error) {
    logger.error('Telegram login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Login with Telegram Widget
router.post('/login-telegram-widget', async (req, res) => {
  try {
    const widgetData = req.body;
    
    if (!widgetData || !widgetData.id) {
      return res.status(400).json({ error: 'Invalid widget data' });
    }

    // Verify Telegram data
    const verifiedData = verifyTelegramWidgetData(widgetData);
    
    if (!verifiedData) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Find or create user
    const userId = await findOrCreateTelegramUser(verifiedData);
    
    if (!userId) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate tokens
    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    // Create session
    await query(
      'INSERT INTO user_sessions (user_id, session_token, refresh_token, ip_address, user_agent, expires_at) ' +
      'VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL \'7 days\')',
      [userId, token, refreshToken, req.ip, req.headers['user-agent']]
    );

    // Get user data
    const userResult = await query(
      'SELECT u.*, w.coins_balance, w.fires_balance, array_agg(r.name) as roles ' +
      'FROM users u ' +
      'LEFT JOIN wallets w ON w.user_id = u.id ' +
      'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
      'LEFT JOIN roles r ON r.id = ur.role_id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id, w.coins_balance, w.fires_balance',
      [userId]
    );

    const user = userResult.rows[0];

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        tg_id: user.tg_id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        coins_balance: user.coins_balance || 0,
        fires_balance: user.fires_balance || 0,
        roles: user.roles?.filter(Boolean) || []
      }
    });

  } catch (error) {
    logger.error('Telegram widget login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const jwt = require('jsonwebtoken');
    let decoded;
    
    try {
      decoded = jwt.verify(refreshToken, config.security.jwtSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Check if session exists
    const sessionResult = await query(
      'SELECT * FROM user_sessions WHERE refresh_token = $1 AND is_active = true',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Generate new tokens
    const newToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    // Update session
    await query(
      'UPDATE user_sessions SET session_token = $1, refresh_token = $2, last_activity_at = NOW() ' +
      'WHERE refresh_token = $3',
      [newToken, newRefreshToken, refreshToken]
    );

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.headers['x-session-id'];

    if (token) {
      // Invalidate session
      await query(
        'UPDATE user_sessions SET is_active = false WHERE session_token = $1',
        [token]
      );
    }

    // Clear cookie
    res.clearCookie('token');

    res.json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Helper function to find or create Telegram user
async function findOrCreateTelegramUser(telegramData) {
  try {
    return await transaction(async (client) => {
      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE tg_id = $1',
        [telegramData.id]
      );

      if (existingUser.rows.length > 0) {
        const userId = existingUser.rows[0].id;
        
        // Update user info
        await client.query(
          'UPDATE users SET ' +
          'username = COALESCE($2, username), ' +
          'display_name = COALESCE($3, display_name), ' +
          'avatar_url = COALESCE($4, avatar_url), ' +
          'last_seen_at = NOW() ' +
          'WHERE id = $1',
          [
            userId,
            telegramData.username,
            telegramData.first_name + (telegramData.last_name ? ' ' + telegramData.last_name : ''),
            telegramData.photo_url
          ]
        );

        return userId;
      }

      // Create new user
      const newUser = await client.query(
        'INSERT INTO users (id, tg_id, username, display_name, avatar_url, first_seen_at, last_seen_at) ' +
        'VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) ' +
        'RETURNING id',
        [
          uuidv4(),
          telegramData.id,
          telegramData.username,
          telegramData.first_name + (telegramData.last_name ? ' ' + telegramData.last_name : ''),
          telegramData.photo_url
        ]
      );

      const userId = newUser.rows[0].id;

      // Create auth identity
      await client.query(
        'INSERT INTO auth_identities (user_id, provider, provider_uid) ' +
        'VALUES ($1, $2, $3)',
        [userId, 'telegram', String(telegramData.id)]
      );

      // Create wallet with initial balance
      const initialCoins = config.features.economyDevAutoSeed ? config.features.economyDevSeedCoins : 0;
      const initialFires = config.features.economyDevAutoSeed ? config.features.economyDevSeedFires : 0;

      await client.query(
        'INSERT INTO wallets (user_id, coins_balance, fires_balance) ' +
        'VALUES ($1, $2, $3)',
        [userId, initialCoins, initialFires]
      );

      // Assign default role
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['user']
      );

      if (roleResult.rows.length > 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [userId, roleResult.rows[0].id]
        );
      }

      // Check if user is Tote and assign role
      if (String(telegramData.id) === config.telegram.toteId) {
        const toteRoleResult = await client.query(
          'SELECT id FROM roles WHERE name = $1',
          ['tote']
        );

        if (toteRoleResult.rows.length > 0) {
          await client.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, toteRoleResult.rows[0].id]
          );
        }
      }

      logger.info('New Telegram user created', { 
        userId, 
        tgId: telegramData.id, 
        username: telegramData.username 
      });

      return userId;
    });
  } catch (error) {
    logger.error('Error creating Telegram user:', error);
    return null;
  }
}

module.exports = router;
