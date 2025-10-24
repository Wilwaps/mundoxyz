const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, requireAdmin, adminAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get supply overview
router.get('/supply', async (req, res) => {
  try {
    const result = await query(
      'SELECT total_max, total_emitted, total_burned, total_circulating, total_reserved FROM fire_supply WHERE id = 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supply data not found' });
    }

    const supply = result.rows[0];

    res.json({
      total: parseFloat(supply.total_max),
      emitted: parseFloat(supply.total_emitted),
      burned: parseFloat(supply.total_burned),
      circulating: parseFloat(supply.total_circulating),
      reserved: parseFloat(supply.total_reserved),
      available: parseFloat(supply.total_max) - parseFloat(supply.total_emitted)
    });

  } catch (error) {
    logger.error('Error fetching supply:', error);
    res.status(500).json({ error: 'Failed to fetch supply data' });
  }
});

// Get supply transactions
router.get('/supply/txs', async (req, res) => {
  try {
    const { 
      type, 
      user_id, 
      currency,
      from, 
      to, 
      limit = 50, 
      offset = 0,
      order = 'DESC'
    } = req.query;

    let queryStr = 'SELECT st.*, u.username, u.display_name FROM supply_txs st LEFT JOIN users u ON u.id = st.user_id WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (type) {
      queryStr += ` AND st.type = $${++paramCount}`;
      params.push(type);
    }

    if (user_id) {
      queryStr += ` AND st.user_id = $${++paramCount}`;
      params.push(user_id);
    }

    if (currency) {
      queryStr += ` AND st.currency = $${++paramCount}`;
      params.push(currency);
    }

    if (from) {
      queryStr += ` AND st.created_at >= $${++paramCount}`;
      params.push(from);
    }

    if (to) {
      queryStr += ` AND st.created_at <= $${++paramCount}`;
      params.push(to);
    }

    queryStr += ` ORDER BY st.created_at ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.json({
      transactions: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Error fetching supply transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Transfer between users
router.post('/transfer', verifyToken, async (req, res) => {
  try {
    const { to_user_id, currency, amount, description } = req.body;
    const from_user_id = req.user.id;

    // Validation
    if (!to_user_id || !currency || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['coins', 'fires'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    if (from_user_id === to_user_id) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    const result = await transaction(async (client) => {
      // Get sender wallet with lock
      const senderWallet = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [from_user_id]
      );

      if (senderWallet.rows.length === 0) {
        throw new Error('Sender wallet not found');
      }

      const balance = currency === 'fires' 
        ? parseFloat(senderWallet.rows[0].fires_balance)
        : parseFloat(senderWallet.rows[0].coins_balance);

      if (balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Get receiver wallet
      const receiverWallet = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [to_user_id]
      );

      if (receiverWallet.rows.length === 0) {
        throw new Error('Receiver wallet not found');
      }

      // Update sender balance
      const senderColumn = currency === 'fires' ? 'fires_balance' : 'coins_balance';
      const senderSpentColumn = currency === 'fires' ? 'total_fires_spent' : 'total_coins_spent';
      
      await client.query(
        `UPDATE wallets 
         SET ${senderColumn} = ${senderColumn} - $1,
             ${senderSpentColumn} = ${senderSpentColumn} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amount, from_user_id]
      );

      // Update receiver balance
      const receiverColumn = currency === 'fires' ? 'fires_balance' : 'coins_balance';
      const receiverEarnedColumn = currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned';
      
      await client.query(
        `UPDATE wallets 
         SET ${receiverColumn} = ${receiverColumn} + $1,
             ${receiverEarnedColumn} = ${receiverEarnedColumn} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amount, to_user_id]
      );

      // Record sender transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'transfer_out', $2, $3, $4, $5, $6, $7
         )`,
        [
          from_user_id, 
          currency, 
          amount,
          balance,
          balance - amount,
          description || 'Transfer to user',
          to_user_id
        ]
      );

      // Record receiver transaction
      const receiverBalance = currency === 'fires'
        ? parseFloat(receiverWallet.rows[0].fires_balance)
        : parseFloat(receiverWallet.rows[0].coins_balance);

      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'transfer_in', $2, $3, $4, $5, $6, $7
         )`,
        [
          to_user_id, 
          currency, 
          amount,
          receiverBalance,
          receiverBalance + amount,
          description || 'Transfer from user',
          from_user_id
        ]
      );

      return {
        success: true,
        transaction_id: result.rows[0]?.id,
        amount,
        currency,
        new_balance: balance - amount
      };
    });

    res.json(result);

  } catch (error) {
    logger.error('Transfer error:', error);
    res.status(400).json({ error: error.message || 'Transfer failed' });
  }
});

// Admin: Grant from supply
router.post('/grant-from-supply', adminAuth, async (req, res) => {
  try {
    const { user_id, currency, amount, reason } = req.body;

    if (!user_id || !currency || !amount || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['coins', 'fires'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const result = await transaction(async (client) => {
      // Check supply availability for fires
      if (currency === 'fires') {
        const supply = await client.query(
          'SELECT * FROM fire_supply WHERE id = 1 FOR UPDATE'
        );
        
        const available = parseFloat(supply.rows[0].total_max) - parseFloat(supply.rows[0].total_emitted);
        
        if (available < amount) {
          throw new Error('Insufficient supply available');
        }

        // Update supply
        await client.query(
          'UPDATE fire_supply SET total_emitted = total_emitted + $1 WHERE id = 1',
          [amount]
        );

        // Record supply transaction
        await client.query(
          `INSERT INTO supply_txs 
           (type, currency, amount, user_id, description, actor_id, ip_address)
           VALUES ('emission', 'fires', $1, $2, $3, $4, $5)`,
          [amount, user_id, reason, req.user?.id || null, req.ip]
        );
      }

      // Update user wallet
      const wallet = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [user_id]
      );

      if (wallet.rows.length === 0) {
        throw new Error('User wallet not found');
      }

      const column = currency === 'fires' ? 'fires_balance' : 'coins_balance';
      const earnedColumn = currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned';
      const oldBalance = parseFloat(wallet.rows[0][column]);

      await client.query(
        `UPDATE wallets 
         SET ${column} = ${column} + $1,
             ${earnedColumn} = ${earnedColumn} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amount, user_id]
      );

      // Record wallet transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'admin_grant', $2, $3, $4, $5, $6
         )`,
        [user_id, currency, amount, oldBalance, oldBalance + amount, reason]
      );

      return {
        success: true,
        amount,
        currency,
        new_balance: oldBalance + amount
      };
    });

    res.json(result);

  } catch (error) {
    logger.error('Grant from supply error:', error);
    res.status(400).json({ error: error.message || 'Grant failed' });
  }
});

// SSE endpoint for supply updates
router.get('/supply/stream', (req, res) => {
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial data
  query('SELECT * FROM fire_supply WHERE id = 1')
    .then(result => {
      const supply = result.rows[0];
      res.write(`data: ${JSON.stringify({
        type: 'supply_update',
        data: {
          total: parseFloat(supply.total_max),
          emitted: parseFloat(supply.total_emitted),
          burned: parseFloat(supply.total_burned),
          circulating: parseFloat(supply.total_circulating),
          reserved: parseFloat(supply.total_reserved)
        }
      })}\n\n`);
    });

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Send supply updates every 5 seconds
  const updateInterval = setInterval(() => {
    query('SELECT * FROM fire_supply WHERE id = 1')
      .then(result => {
        const supply = result.rows[0];
        res.write(`data: ${JSON.stringify({
          type: 'supply_update',
          data: {
            total: parseFloat(supply.total_max),
            emitted: parseFloat(supply.total_emitted),
            burned: parseFloat(supply.total_burned),
            circulating: parseFloat(supply.total_circulating),
            reserved: parseFloat(supply.total_reserved)
          }
        })}\n\n`);
      })
      .catch(error => {
        logger.error('SSE supply update error:', error);
      });
  }, 5000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(updateInterval);
  });
});

module.exports = router;
