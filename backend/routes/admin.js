const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { adminAuth, verifyToken, requireTote } = require('../middleware/auth');
const roleService = require('../services/roleService');
const logger = require('../utils/logger');
const fiatRateService = require('../services/fiatRateService');
const axios = require('axios');
const https = require('https');

// Welcome events management
router.get('/welcome/events', adminAuth, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    let queryStr = `
      SELECT 
        we.*,
        COUNT(wec.user_id) as total_claims,
        SUM(wec.coins_claimed) as total_coins_claimed,
        SUM(wec.fires_claimed) as total_fires_claimed,
        u.username as created_by_username
      FROM welcome_events we
      LEFT JOIN welcome_event_claims wec ON wec.event_id = we.id
      LEFT JOIN users u ON u.id = we.created_by
    `;
    
    if (!includeInactive) {
      queryStr += ' WHERE we.is_active = true';
    }
    
    queryStr += ' GROUP BY we.id, u.username ORDER BY we.created_at DESC';
    
    const result = await query(queryStr);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching welcome events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create welcome event
router.post('/welcome/events', adminAuth, async (req, res) => {
  try {
    const { 
      name, 
      message, 
      coins_amount, 
      fires_amount, 
      duration_hours, 
      max_claims, 
      priority,
      event_type,
      recurrence,
      target_segment,
      min_user_level,
      max_per_user,
      cooldown_hours,
      require_claim,
      auto_send,
      expires_hours
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }
    
    const result = await query(
      `INSERT INTO welcome_events 
       (name, message, coins_amount, fires_amount, duration_hours, max_claims, priority, created_by,
        event_type, recurrence, target_segment, min_user_level, max_per_user, cooldown_hours,
        require_claim, auto_send, expires_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        name,
        message || `Welcome to MUNDOXYZ! Enjoy your bonus of ${coins_amount || 0} coins and ${fires_amount || 0} fires!`,
        coins_amount || 0,
        fires_amount || 0,
        duration_hours || 72,
        max_claims || null,
        priority || 0,
        req.user?.id || null,
        event_type || 'manual',
        recurrence || null,
        JSON.stringify(target_segment || { type: 'all' }),
        min_user_level || 0,
        max_per_user || null,
        cooldown_hours || null,
        require_claim !== undefined ? require_claim : true,
        auto_send || false,
        expires_hours || 72
      ]
    );
    
    logger.info('Welcome event created', { 
      eventId: result.rows[0].id, 
      name,
      eventType: event_type,
      by: req.user?.username 
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating welcome event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update welcome event
router.patch('/welcome/events/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'name',
      'message',
      'coins_amount',
      'fires_amount',
      'duration_hours',
      'max_claims',
      'priority',
      'event_type',
      'recurrence',
      'target_segment',
      'min_user_level',
      'max_per_user',
      'cooldown_hours',
      'require_claim',
      'auto_send',
      'expires_hours'
    ];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(updates[field]);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE welcome_events 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Record in history
    await query(
      `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
       VALUES ($1, 'updated', $2, $3)`,
      [id, req.user?.id || null, updates]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating welcome event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Activate welcome event
router.post('/welcome/events/:id/activate', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { starts_at } = req.body;
    
    const result = await transaction(async (client) => {
      // Deactivate all other events
      await client.query('UPDATE welcome_events SET is_active = false WHERE is_active = true');
      
      // Activate this event
      const activateResult = await client.query(
        `UPDATE welcome_events 
         SET is_active = true, 
             starts_at = COALESCE($2, NOW()),
             ends_at = CASE 
               WHEN duration_hours IS NOT NULL 
               THEN COALESCE($2, NOW()) + (duration_hours || ' hours')::interval
               ELSE NULL 
             END
         WHERE id = $1
         RETURNING *`,
        [id, starts_at || null]
      );
      
      if (activateResult.rows.length === 0) {
        throw new Error('Event not found');
      }
      
      // Record in history
      await client.query(
        `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
         VALUES ($1, 'activated', $2, $3)`,
        [id, req.user?.id || null, { starts_at }]
      );
      
      return activateResult.rows[0];
    });
    
    logger.info('Welcome event activated', { 
      eventId: id, 
      by: req.user?.username 
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error activating welcome event:', error);
    res.status(500).json({ error: 'Failed to activate event' });
  }
});

// Deactivate welcome event
router.post('/welcome/events/:id/deactivate', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE welcome_events SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Record in history
    await query(
      `INSERT INTO welcome_event_history (event_id, action, actor_id)
       VALUES ($1, 'deactivated', $2)`,
      [id, req.user?.id || null]
    );
    
    logger.info('Welcome event deactivated', { 
      eventId: id, 
      by: req.user?.username 
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error deactivating welcome event:', error);
    res.status(500).json({ error: 'Failed to deactivate event' });
  }
});

// Delete welcome event
router.delete('/welcome/events/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el evento existe
    const checkResult = await query(
      'SELECT * FROM welcome_events WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Record in history antes de eliminar
    await query(
      `INSERT INTO welcome_event_history (event_id, action, actor_id, payload)
       VALUES ($1, 'deleted', $2, $3)`,
      [id, req.user?.id || null, checkResult.rows[0]]
    );
    
    // Eliminar el evento
    await query(
      'DELETE FROM welcome_events WHERE id = $1',
      [id]
    );
    
    logger.info('Welcome event deleted', { 
      eventId: id, 
      eventName: checkResult.rows[0].name,
      by: req.user?.username 
    });
    
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    logger.error('Error deleting welcome event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Get system statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = {};
    
    // User stats
    try {
      const userStats = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
          COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
          COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d
        FROM users
      `);
      stats.users = userStats.rows[0];
    } catch (userStatsError) {
      logger.warn('Error fetching user stats, using defaults:', userStatsError.message);
      stats.users = {
        total_users: 0,
        new_users_24h: 0,
        active_users_24h: 0,
        active_users_7d: 0
      };
    }
    
    // Economy stats
    try {
      const economyStats = await query(`
        SELECT 
          SUM(coins_balance) as total_coins_circulation,
          SUM(fires_balance) as total_fires_circulation,
          AVG(coins_balance) as avg_coins_balance,
          AVG(fires_balance) as avg_fires_balance
        FROM wallets
      `);

      const row = economyStats.rows[0] || {};
      stats.economy = {
        total_coins_circulation: parseFloat(row.total_coins_circulation) || 0,
        total_fires_circulation: parseFloat(row.total_fires_circulation) || 0,
        avg_coins_balance: parseFloat(row.avg_coins_balance) || 0,
        avg_fires_balance: parseFloat(row.avg_fires_balance) || 0
      };
    } catch (economyStatsError) {
      logger.warn('Error fetching economy stats, using defaults:', economyStatsError.message);
      stats.economy = {
        total_coins_circulation: 0,
        total_fires_circulation: 0,
        avg_coins_balance: 0,
        avg_fires_balance: 0
      };
    }
    
    // Supply stats - Crear tabla si no existe
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS fire_supply (
          id INTEGER PRIMARY KEY DEFAULT 1,
          total_max DECIMAL(20, 2) NOT NULL DEFAULT 1000000000,
          total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
          total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT single_row CHECK (id = 1)
        )
      `);
      
      // Insertar registro inicial si no existe
      await query(`
        INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_circulating, total_reserved)
        VALUES (1, 1000000000, 0, 0, 0, 0)
        ON CONFLICT (id) DO NOTHING
      `);
      
      // Calcular y actualizar valores reales
      await query(`
        UPDATE fire_supply 
        SET 
          total_circulating = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0),
          total_emitted = COALESCE((SELECT SUM(fires_balance) FROM wallets), 0) + COALESCE(total_burned, 0),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
    } catch (initError) {
      logger.error('Error initializing fire_supply:', initError);
    }
    
    const supplyStats = await query('SELECT * FROM fire_supply WHERE id = 1');
    stats.supply = supplyStats.rows[0] || {
      total_max: 1000000000,
      total_emitted: 0,
      total_burned: 0,
      total_circulating: 0,
      total_reserved: 0
    };
    
    // Game stats - Con manejo de errores para tablas que no existan
    try {
      const gameStats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM raffles WHERE status = 'active') as active_raffles,
          (SELECT COUNT(*) FROM bingo_v2_rooms) as total_bingo_rooms,
          (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status IN ('waiting', 'in_progress')) as active_bingo_rooms,
          (SELECT COALESCE(SUM(total_pot), 0) FROM bingo_v2_rooms WHERE status IN ('waiting', 'in_progress')) as total_bingo_pot_fires
      `);
      stats.games = gameStats.rows[0];
    } catch (gameStatsError) {
      logger.warn('Error fetching game stats, using defaults:', gameStatsError.message);
      stats.games = {
        active_raffles: 0,
        total_bingo_rooms: 0,
        active_bingo_rooms: 0,
        total_bingo_pot_fires: 0
      };
    }
    
    // Transaction volume (last 24h)
    try {
      const txVolume = await query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN currency = 'fires' THEN amount ELSE 0 END) as fires_volume,
          SUM(CASE WHEN currency = 'coins' THEN amount ELSE 0 END) as coins_volume
        FROM wallet_transactions
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      stats.transactions_24h = txVolume.rows[0];
    } catch (txError) {
      logger.warn('Error fetching transaction stats, using defaults:', txError.message);
      stats.transactions_24h = {
        total_transactions: 0,
        fires_volume: 0,
        coins_volume: 0
      };
    }
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// FIAT: list captured rates
router.get('/fiat/rates', adminAuth, async (req, res) => {
  try {
    const { source, pair, limit = 50, offset = 0 } = req.query;

    let queryStr = 'SELECT * FROM fiat_rates WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (source) {
      queryStr += ` AND source = $${++paramCount}`;
      params.push(source);
    }

    if (pair) {
      queryStr += ` AND pair = $${++paramCount}`;
      params.push(pair);
    }

    queryStr += ' ORDER BY captured_at DESC';
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);

    let countQuery = 'SELECT COUNT(*) AS total FROM fiat_rates WHERE 1=1';
    const countParams = [];
    paramCount = 0;

    if (source) {
      countQuery += ` AND source = $${++paramCount}`;
      countParams.push(source);
    }

    if (pair) {
      countQuery += ` AND pair = $${++paramCount}`;
      countParams.push(pair);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      rates: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching FIAT rates:', error);
    res.status(500).json({ error: 'Failed to fetch FIAT rates' });
  }
});

// FIAT: list operations
router.get('/fiat/operations', adminAuth, async (req, res) => {
  try {
    const { user_id, status, direction, limit = 50, offset = 0 } = req.query;

    let queryStr = `
      SELECT 
        fo.*,
        u.username,
        wt.type AS wallet_type,
        wt.currency AS wallet_currency,
        wt.amount AS wallet_amount,
        wt.created_at AS wallet_created_at
      FROM fiat_operations fo
      LEFT JOIN users u ON u.id = fo.user_id
      LEFT JOIN wallet_transactions wt ON wt.id = fo.wallet_transaction_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (user_id) {
      queryStr += ` AND fo.user_id = $${++paramCount}`;
      params.push(user_id);
    }

    if (status) {
      queryStr += ` AND fo.status = $${++paramCount}`;
      params.push(status);
    }

    if (direction) {
      queryStr += ` AND fo.direction = $${++paramCount}`;
      params.push(direction);
    }

    queryStr += ' ORDER BY fo.created_at DESC';
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryStr, params);

    let countQuery = 'SELECT COUNT(*) AS total FROM fiat_operations fo WHERE 1=1';
    const countParams = [];
    paramCount = 0;

    if (user_id) {
      countQuery += ` AND fo.user_id = $${++paramCount}`;
      countParams.push(user_id);
    }

    if (status) {
      countQuery += ` AND fo.status = $${++paramCount}`;
      countParams.push(status);
    }

    if (direction) {
      countQuery += ` AND fo.direction = $${++paramCount}`;
      countParams.push(direction);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      operations: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching FIAT operations:', error);
    res.status(500).json({ error: 'Failed to fetch FIAT operations' });
  }
});

async function scrapeBcvRate(pair) {
  const url = process.env.FIAT_BCV_URL || 'https://www.bcv.org.ve';

  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = response.data || '';

    // Extraer específicamente el valor numérico del bloque del dólar oficial (div id="dolar" y div.centrado)
    const dolarMatch = html.match(
      /<div[^>]*id=["']dolar["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*centrado[^"']*["'][^>]*>\s*<strong>\s*([0-9.,]+)\s*<\\/strong>/i
    );

    if (!dolarMatch) {
      logger.warn('FIAT BCV scraping: no rate match in dolar block');
      return null;
    }

    const raw = dolarMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const rate = parseFloat(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      logger.warn('FIAT BCV scraping: invalid rate after parse', { raw });
      return null;
    }

    const capturedAt = new Date();
    const insertRes = await query(
      `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      ['bcv', pair, rate, null, false, capturedAt]
    );

    return insertRes.rows[0] || null;
  } catch (error) {
    logger.error('Error scraping BCV rate:', error);
    return null;
  }
}

async function scrapeBinanceAndMxyz(pair) {
  const url =
    process.env.FIAT_BINANCE_P2P_URL ||
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  const payload = {
    page: 1,
    rows: 10,
    payTypes: [],
    asset: 'USDT',
    tradeType: 'BUY',
    fiat: 'VES',
    publisherType: null
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 15000
    });

    const data = response.data && response.data.data;
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('FIAT Binance scraping: empty data array');
      return { binance: null, mundoxyz: null };
    }

    const adv = data[1] || data[0];
    const priceStr = adv && adv.adv && adv.adv.price;
    const rate = parseFloat(priceStr);

    if (!Number.isFinite(rate) || rate <= 0) {
      logger.warn('FIAT Binance scraping: invalid price', { priceStr });
      return { binance: null, mundoxyz: null };
    }

    const capturedAt = new Date();

    // Usar última tasa BCV para calcular spread
    let spreadVsBcv = null;
    try {
      const bcvRes = await query(
        'SELECT rate FROM fiat_rates WHERE source = $1 AND pair = $2 ORDER BY captured_at DESC LIMIT 1',
        ['bcv', pair]
      );
      if (bcvRes.rows.length > 0) {
        const bcvRate = parseFloat(bcvRes.rows[0].rate);
        if (Number.isFinite(bcvRate)) {
          spreadVsBcv = rate - bcvRate;
        }
      }
    } catch (spreadError) {
      logger.warn('FIAT Binance scraping: error computing spread vs BCV', spreadError);
    }

    const binInsert = await query(
      `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      ['binance', pair, rate, spreadVsBcv, false, capturedAt]
    );

    const binanceRow = binInsert.rows[0] || null;

    // Calcular tasa operativa MundoXYZ a partir de Binance y margen config
    let mxyzRow = null;
    try {
      const config = await fiatRateService.getOperationalConfig();
      const margin = config?.margin_percent != null ? parseFloat(config.margin_percent) : 5.0;
      const opRate = rate * (1 - margin / 100);

      let spreadMxyz = null;
      if (spreadVsBcv != null && Number.isFinite(spreadVsBcv)) {
        spreadMxyz = opRate - (rate - spreadVsBcv);
      }

      const mxyzInsert = await query(
        `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        ['mundoxyz', pair, opRate, spreadMxyz, false, capturedAt]
      );

      mxyzRow = mxyzInsert.rows[0] || null;
    } catch (mxyzError) {
      logger.error('Error computing MundoXYZ operational rate from Binance:', mxyzError);
    }

    return { binance: binanceRow, mundoxyz: mxyzRow };
  } catch (error) {
    logger.error('Error scraping Binance P2P rate:', error);
    return { binance: null, mundoxyz: null };
  }
}

router.post('/fiat/scrape', adminAuth, async (req, res) => {
  try {
    const { source } = req.body || {};
    const pair = 'USDVES';

    if (!source || !['bcv', 'binance'].includes(source)) {
      return res.status(400).json({ error: 'Invalid or missing source. Use "bcv" or "binance".' });
    }

    if (source === 'bcv') {
      const bcvRow = await scrapeBcvRate(pair);
      if (!bcvRow) {
        return res.status(500).json({ error: 'No se pudo obtener tasa BCV' });
      }

      return res.json({ success: true, source: 'bcv', updated: { bcv: bcvRow } });
    }

    const { binance, mundoxyz } = await scrapeBinanceAndMxyz(pair);
    if (!binance) {
      return res.status(500).json({ error: 'No se pudo obtener tasa Binance P2P' });
    }

    return res.json({ success: true, source: 'binance', updated: { binance, mundoxyz } });
  } catch (error) {
    logger.error('Error in FIAT scrape endpoint:', error);
    res.status(500).json({ error: 'Error al actualizar tasas FIAT' });
  }
});

// Get users list (paginated)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      role,
      order = 'created_at',
      direction = 'DESC' 
    } = req.query;
    
    let queryStr = `
      SELECT 
        u.id,
        u.tg_id,
        u.username,
        u.display_name,
        u.email,
        u.created_at,
        u.last_seen_at,
        u.is_active,
        u.is_verified,
        w.coins_balance,
        w.fires_balance,
        array_agg(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      queryStr += ` AND (
        u.username ILIKE $${++paramCount} OR 
        u.display_name ILIKE $${paramCount} OR
        u.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }
    
    if (role) {
      queryStr += ` AND EXISTS (
        SELECT 1 FROM user_roles ur2 
        JOIN roles r2 ON r2.id = ur2.role_id 
        WHERE ur2.user_id = u.id AND r2.name = $${++paramCount}
      )`;
      params.push(role);
    }
    
    queryStr += ` GROUP BY u.id, w.coins_balance, w.fires_balance`;
    
    // Sanitize order column
    const allowedOrderColumns = ['created_at', 'last_seen_at', 'username', 'coins_balance', 'fires_balance'];
    const orderColumn = allowedOrderColumns.includes(order) ? order : 'created_at';
    const orderDirection = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    queryStr += ` ORDER BY ${orderColumn} ${orderDirection}`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await query(queryStr, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(DISTINCT u.id) FROM users u WHERE 1=1';
    const countParams = [];
    
    if (search) {
      countQuery += ` AND (
        u.username ILIKE $1 OR 
        u.display_name ILIKE $1 OR
        u.email ILIKE $1
      )`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/users/:userId/reset-credentials
 * Reinicia la contraseña y la respuesta de seguridad de un usuario,
 * para que vuelva a pasar por el flujo de "primera contraseña + pregunta de seguridad".
 * Solo accesible por usuarios con rol 'tote' (o admin a través de requireTote).
 */
router.post('/users/:userId/reset-credentials', verifyToken, requireTote, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validar que el usuario existe
    const userResult = await query('SELECT id, username, tg_id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];

    await transaction(async (client) => {
      // 1) Limpiar hash de contraseña en auth_identities (provider = 'email')
      await client.query(
        "UPDATE auth_identities SET password_hash = NULL WHERE user_id = $1 AND provider = 'email'",
        [userId]
      );

      // 2) Limpiar respuesta de seguridad
      await client.query(
        'UPDATE users SET security_answer = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
    });

    logger.info('Admin reset user credentials', {
      targetUserId: userId,
      targetUsername: user.username,
      byUserId: req.user?.id,
      byUsername: req.user?.username
    });

    res.json({
      success: true,
      message: 'Credenciales reiniciadas. El usuario deberá establecer una nueva contraseña y pregunta de seguridad.'
    });
  } catch (error) {
    logger.error('Error resetting user credentials:', error);
    res.status(500).json({ error: 'Error al reiniciar credenciales' });
  }
});

// ============================================
// GESTIÓN DE ROLES (SOLO TOTE)
// ============================================

/**
 * GET /api/admin/roles/available
 * Obtener lista de roles disponibles en el sistema
 */
router.get('/roles/available', verifyToken, requireTote, async (req, res) => {
  try {
    const roles = await roleService.getAvailableRoles();
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    logger.error('Error getting available roles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener roles disponibles'
    });
  }
});

/**
 * GET /api/admin/users/:userId/roles
 * Obtener roles actuales de un usuario específico
 */
router.get('/users/:userId/roles', verifyToken, requireTote, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const roles = await roleService.getUserRoles(userId);
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    logger.error('Error getting user roles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener roles del usuario'
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/roles
 * Actualizar roles de un usuario (agregar/remover)
 * Solo accesible por usuarios con rol 'tote'
 */
router.patch('/users/:userId/roles', verifyToken, requireTote, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roles, reason } = req.body;
    
    // Validar que se envíe un array de roles
    if (!Array.isArray(roles)) {
      return res.status(400).json({
        success: false,
        error: 'El campo "roles" debe ser un array'
      });
    }

    // Validar que el usuario objetivo existe
    const userCheck = await query(
      'SELECT id, username, display_name FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Obtener metadata de la solicitud
    const metadata = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      reason: reason || null
    };

    // Actualizar roles
    const result = await roleService.updateUserRoles(
      req.user.id,  // tote user ID
      userId,       // target user ID
      roles,        // new roles array
      metadata
    );

    res.json({
      success: true,
      data: result,
      message: `Roles actualizados: ${result.changes} cambio(s) realizado(s)`
    });

  } catch (error) {
    logger.error('Error updating user roles:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al actualizar roles'
    });
  }
});

/**
 * GET /api/admin/users/:userId/role-history
 * Obtener historial de cambios de roles de un usuario
 */
router.get('/users/:userId/role-history', verifyToken, requireTote, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    
    const history = await roleService.getRoleChangeHistory(
      userId,
      limit ? parseInt(limit) : 50
    );
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error getting role history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener historial'
    });
  }
});

/**
 * GET /api/admin/role-changes
 * Obtener todos los cambios de roles recientes (auditoría global)
 */
router.get('/role-changes', verifyToken, requireTote, async (req, res) => {
  try {
    const { limit } = req.query;
    
    const changes = await roleService.getAllRoleChanges(
      limit ? parseInt(limit) : 100
    );
    
    res.json({
      success: true,
      data: changes
    });
  } catch (error) {
    logger.error('Error getting all role changes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener cambios de roles'
    });
  }
});

module.exports = router;
