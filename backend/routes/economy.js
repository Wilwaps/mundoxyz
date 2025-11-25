const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, requireAdmin, adminAuth, requireWalletAccess } = require('../middleware/auth');
const logger = require('../utils/logger');
const telegramService = require('../services/telegramService');
const fiatRateService = require('../services/fiatRateService');
const { calculateAndLogCommission } = require('../services/commissionService');

// Get user balance
router.get('/balance', verifyToken, requireWalletAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT 
        COALESCE(coins_balance, 0)::numeric as coins_balance,
        COALESCE(fires_balance, 0)::numeric as fires_balance,
        COALESCE(total_coins_earned, 0)::numeric as total_coins_earned,
        COALESCE(total_coins_spent, 0)::numeric as total_coins_spent,
        COALESCE(total_fires_earned, 0)::numeric as total_fires_earned,
        COALESCE(total_fires_spent, 0)::numeric as total_fires_spent
      FROM wallets 
      WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Create wallet if doesn't exist
      await query(
        `INSERT INTO wallets (user_id, coins_balance, fires_balance) 
         VALUES ($1, 0, 0) 
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      
      return res.json({
        coins_balance: 0,
        fires_balance: 0,
        total_coins_earned: 0,
        total_coins_spent: 0,
        total_fires_earned: 0,
        total_fires_spent: 0
      });
    }
    
    const wallet = result.rows[0];

    const coinsRaw = parseFloat(wallet.coins_balance);
    const firesRaw = parseFloat(wallet.fires_balance);
    const totalCoinsEarnedRaw = parseFloat(wallet.total_coins_earned);
    const totalCoinsSpentRaw = parseFloat(wallet.total_coins_spent);
    const totalFiresEarnedRaw = parseFloat(wallet.total_fires_earned);
    const totalFiresSpentRaw = parseFloat(wallet.total_fires_spent);

    const balanceData = {
      coins_balance: Number.isFinite(coinsRaw) ? coinsRaw : 0,
      fires_balance: Number.isFinite(firesRaw) ? firesRaw : 0,
      total_coins_earned: Number.isFinite(totalCoinsEarnedRaw) ? totalCoinsEarnedRaw : 0,
      total_coins_spent: Number.isFinite(totalCoinsSpentRaw) ? totalCoinsSpentRaw : 0,
      total_fires_earned: Number.isFinite(totalFiresEarnedRaw) ? totalFiresEarnedRaw : 0,
      total_fires_spent: Number.isFinite(totalFiresSpentRaw) ? totalFiresSpentRaw : 0
    };
    
    logger.info('Fetched user balance', { 
      userId, 
      username: req.user.username,
      balanceData 
    });
    
    res.json(balanceData);
    
  } catch (error) {
    logger.error('Error fetching user balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

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

// Get current FIAT context (BCV, Binance, MundoXYZ)
router.get('/fiat-context', async (req, res) => {
  try {
    const ctx = await fiatRateService.getOperationalContext();
    res.json(ctx);
  } catch (error) {
    logger.error('Error fetching FIAT context:', error);
    res.status(500).json({ error: 'Failed to fetch FIAT context' });
  }
});

// Transfer between users
router.post('/transfer', verifyToken, requireWalletAccess, async (req, res) => {
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

// Transfer fires between wallets
router.post('/transfer-fires', verifyToken, requireWalletAccess, async (req, res) => {
  try {
    const { to_wallet_id, amount } = req.body;
    const from_user_id = req.user.id;

    // Validaciones
    if (!to_wallet_id || !amount) {
      return res.status(400).json({ error: 'Wallet destino y monto son requeridos' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1) {
      return res.status(400).json({ error: 'El monto mínimo es 1 fuego' });
    }

    if (parsedAmount > 10000) {
      return res.status(400).json({ error: 'El monto máximo es 10,000 fuegos' });
    }

    const result = await transaction(async (client) => {
      // Obtener wallet del emisor
      const fromWallet = await client.query(
        'SELECT w.*, u.id as user_id FROM wallets w JOIN users u ON u.id = w.user_id WHERE w.user_id = $1 FOR UPDATE',
        [from_user_id]
      );

      if (fromWallet.rows.length === 0) {
        throw new Error('Wallet del emisor no encontrada');
      }

      // Obtener wallet del receptor
      const toWallet = await client.query(
        'SELECT w.*, u.id as user_id FROM wallets w JOIN users u ON u.id = w.user_id WHERE w.id = $1 FOR UPDATE',
        [to_wallet_id]
      );

      if (toWallet.rows.length === 0) {
        throw new Error('Wallet destino no encontrada');
      }

      // No puede enviarse a sí mismo
      if (fromWallet.rows[0].id === toWallet.rows[0].id) {
        throw new Error('No puedes enviarte fuegos a ti mismo');
      }

      const fromBalance = parseFloat(fromWallet.rows[0].fires_balance);

      // Calcular comisión 5% y distribución (Tito/Tote) + registrar en commissions_log
      const platformRate = 0.05;
      const operationId = `transfer_fires_${from_user_id}_${Date.now()}`;

      const split = await calculateAndLogCommission({
        client,
        operationId,
        operationType: 'transfer',
        actorUserId: fromWallet.rows[0].user_id,
        amountBase: parsedAmount,
        platformCommissionRate: platformRate,
        metadata: {
          toUserId: toWallet.rows[0].user_id
        }
      });

      const commission = split.platformCommissionTotal;
      const totalToDeduct = parsedAmount + commission;

      // Verificar balance suficiente
      if (fromBalance < totalToDeduct) {
        throw new Error(`Balance insuficiente. Necesitas ${totalToDeduct} fuegos (${parsedAmount} + ${commission.toFixed(2)} comisión)`);
      }

      // Obtener wallet de Tote para la parte de comisión que queda en plataforma
      const toteWallet = await client.query(
        `SELECT w.* FROM wallets w 
         JOIN users u ON u.id = w.user_id 
         JOIN user_roles ur ON ur.user_id = u.id 
         JOIN roles r ON r.id = ur.role_id 
         WHERE r.name = 'tote' 
         LIMIT 1 FOR UPDATE`
      );

      if (toteWallet.rows.length === 0) {
        throw new Error('Wallet de comisión no encontrada');
      }

      // Descontar del emisor (monto + comisión)
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance - $1,
             total_fires_spent = total_fires_spent + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [totalToDeduct, fromWallet.rows[0].id]
      );

      // Agregar al receptor
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance + $1,
             total_fires_earned = total_fires_earned + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [parsedAmount, toWallet.rows[0].id]
      );

      // Distribuir comisión entre Tito (si aplica) y Tote

      // 1) Tito
      if (split.titoUserId && split.titoCommissionAmount > 0) {
        const titoWalletRes = await client.query(
          'SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
          [split.titoUserId]
        );

        if (titoWalletRes.rows.length > 0) {
          const titoWallet = titoWalletRes.rows[0];
          const titoBefore = parseFloat(titoWallet.fires_balance || 0);
          const titoAmount = split.titoCommissionAmount;

          await client.query(
            `UPDATE wallets 
             SET fires_balance = fires_balance + $1,
                 total_fires_earned = total_fires_earned + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [titoAmount, titoWallet.id]
          );

          await client.query(
            `INSERT INTO wallet_transactions 
             (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
             VALUES ($1, 'tito_commission_transfer', 'fires', $2, $3, $4, $5, $6)`,
            [
              titoWallet.id,
              titoAmount,
              titoBefore,
              titoBefore + titoAmount,
              'Comisión Tito por transferencia (5%)',
              fromWallet.rows[0].user_id
            ]
          );
        }
      }

      // 2) Tote (resto de la comisión)
      const toteCommissionAmount = split.toteCommissionAmount;
      if (toteCommissionAmount > 0) {
        const toteBalance = parseFloat(toteWallet.rows[0].fires_balance);

        await client.query(
          `UPDATE wallets 
           SET fires_balance = fires_balance + $1,
               total_fires_earned = total_fires_earned + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [toteCommissionAmount, toteWallet.rows[0].id]
        );

        await client.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
           VALUES ($1, 'commission', 'fires', $2, $3, $4, $5, $6)`,
          [
            toteWallet.rows[0].id,
            toteCommissionAmount,
            toteBalance,
            toteBalance + toteCommissionAmount,
            'Comisión por transferencia (5%)',
            fromWallet.rows[0].user_id
          ]
        );
      }

      // Registrar transacción del emisor
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
         VALUES ($1, 'transfer_out', 'fires', $2, $3, $4, $5, $6)`,
        [
          fromWallet.rows[0].id,
          -totalToDeduct,
          fromBalance,
          fromBalance - totalToDeduct,
          `Transferencia a ${toWallet.rows[0].id.substring(0, 8)}... (comisión: ${commission.toFixed(2)})`,
          toWallet.rows[0].user_id
        ]
      );

      // Registrar transacción del receptor
      const toBalance = parseFloat(toWallet.rows[0].fires_balance);
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
         VALUES ($1, 'transfer_in', 'fires', $2, $3, $4, $5, $6)`,
        [
          toWallet.rows[0].id,
          parsedAmount,
          toBalance,
          toBalance + parsedAmount,
          `Transferencia recibida de ${fromWallet.rows[0].id.substring(0, 8)}...`,
          fromWallet.rows[0].user_id
        ]
      );

      // Registrar comisión para Tote
      const toteBalance = parseFloat(toteWallet.rows[0].fires_balance);
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_user_id)
         VALUES ($1, 'commission', 'fires', $2, $3, $4, $5, $6)`,
        [
          toteWallet.rows[0].id,
          commission,
          toteBalance,
          toteBalance + commission,
          `Comisión por transferencia (5%)`,
          fromWallet.rows[0].user_id
        ]
      );

      return {
        success: true,
        amount: parsedAmount,
        commission: commission,
        total_deducted: totalToDeduct,
        new_balance: fromBalance - totalToDeduct,
        to_wallet_id: toWallet.rows[0].id
      };
    });

    res.json(result);

  } catch (error) {
    logger.error('Transfer fires error:', error);
    res.status(400).json({ error: error.message || 'Error al transferir fuegos' });
  }
});

// Request fires purchase
router.post('/request-fires', verifyToken, requireWalletAccess, async (req, res) => {
  try {
    const { amount, bank_reference, payment_method, usdt_amount, tx_hash, network } = req.body || {};
    const user_id = req.user.id;

    // Determinar método de pago (Bs por defecto para compatibilidad)
    const method = payment_method === 'usdt_tron' ? 'usdt_tron' : 'bs';

    let parsedAmount = null;
    let parsedUsdtAmount = null;

    if (method === 'bs') {
      // Flujo tradicional en Bs: requiere monto de fuegos y referencia bancaria numérica
      if (!amount || !bank_reference) {
        return res.status(400).json({ error: 'Monto y referencia bancaria son requeridos' });
      }

      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Monto inválido' });
      }

      if (!/^\d+$/.test(bank_reference)) {
        return res.status(400).json({ error: 'La referencia bancaria debe contener solo números' });
      }
    } else {
      // Flujo USDT: requiere monto USDT y hash de transacción
      if (!usdt_amount || !tx_hash) {
        return res.status(400).json({ error: 'Monto en USDT y hash de transacción son requeridos' });
      }

      parsedUsdtAmount = parseFloat(usdt_amount);
      if (isNaN(parsedUsdtAmount) || parsedUsdtAmount <= 0) {
        return res.status(400).json({ error: 'Monto USDT inválido' });
      }
    }

    const operationalContext = await fiatRateService.getOperationalContext();
    const firesPerUsdt = operationalContext?.config?.fires_per_usdt || 300;
    const usdtNetwork = operationalContext?.config?.usdt_network || 'TRON';

    const txResult = await transaction(async (client) => {
      let request;
      let tokensAmount;
      let usdtAmountForValuation;

      if (method === 'usdt_tron') {
        // Calcular fuegos a partir del monto USDT y la tasa interna
        tokensAmount = parsedUsdtAmount * firesPerUsdt;
        usdtAmountForValuation = parsedUsdtAmount;

        const insertResult = await client.query(
          `INSERT INTO fire_requests 
           (user_id, amount, status, payment_method, usdt_amount, tx_hash, network, created_at, updated_at)
           VALUES ($1, $2, 'pending', $3, $4, $5, $6, NOW(), NOW())
           RETURNING id, amount, status, reference, payment_method, usdt_amount, tx_hash, network, created_at`,
          [
            user_id,
            tokensAmount,
            'usdt_tron',
            parsedUsdtAmount,
            tx_hash,
            network || usdtNetwork
          ]
        );

        request = insertResult.rows[0];
      } else {
        // Flujo Bs: tokens = monto ingresado, se marca payment_method = 'bs'
        tokensAmount = parsedAmount;
        usdtAmountForValuation = tokensAmount / firesPerUsdt;

        const insertResult = await client.query(
          `INSERT INTO fire_requests 
           (user_id, amount, status, reference, payment_method, created_at, updated_at)
           VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
           RETURNING id, amount, status, reference, payment_method, created_at`,
          [
            user_id,
            parsedAmount,
            bank_reference,
            'bs'
          ]
        );

        request = insertResult.rows[0];
      }

      // Registrar valuación FIAT si hay contexto operativo disponible
      if (
        operationalContext &&
        operationalContext.operationalRate &&
        tokensAmount &&
        usdtAmountForValuation
      ) {
        const op = operationalContext.operationalRate;
        const vesAmount = usdtAmountForValuation * op.rate;

        let rateSource = op.baseSource;
        if (!rateSource && operationalContext.binanceRate) {
          rateSource = operationalContext.binanceRate.source;
        }
        if (!rateSource && operationalContext.bcvRate) {
          rateSource = operationalContext.bcvRate.source;
        }
        if (!rateSource) {
          rateSource = 'mundoxyz';
        }

        await client.query(
          `INSERT INTO fiat_valuations 
           (operation_type, operation_id, tokens_amount, usdt_amount, ves_amount, rate_source, rate_value, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            'fire_request',
            request.id,
            tokensAmount,
            usdtAmountForValuation,
            vesAmount,
            rateSource,
            op.rate
          ]
        );
      }

      return { request, operationalContext, method, tokensAmount, usdtAmountForValuation };
    });

    const { request, operationalContext: ctx, method: resolvedMethod, tokensAmount, usdtAmountForValuation } = txResult;

    logger.info('Fire request created', {
      requestId: request.id,
      userId: user_id,
      amount: tokensAmount,
      method: resolvedMethod
    });

    try {
      const baseInfo =
        '🔥 <b>Nueva Solicitud de Compra de Fuegos</b>\n\n' +
        `👤 <b>Usuario:</b> ${req.user.username}\n` +
        `🔥 <b>Monto:</b> ${request.amount} fuegos\n`;

      const paymentInfo =
        resolvedMethod === 'usdt_tron'
          ?
            '💱 <b>Pago en:</b> USDT (TRON)\n' +
            `💵 <b>Monto USDT:</b> ${usdtAmountForValuation ? usdtAmountForValuation.toFixed(2) : 'N/A'}\n` +
            `🔗 <b>Tx Hash:</b> <code>${request.tx_hash}</code>\n`
          :
            '💱 <b>Pago en:</b> Bs (transferencia bancaria)\n' +
            `🧾 <b>Referencia:</b> <code>${request.reference}</code>\n`;

      const footer =
        '📅 <b>Fecha:</b> ' +
        new Date(request.created_at).toLocaleString('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short'
        });

      const message = `${baseInfo}${paymentInfo}\n${footer}`;

      await telegramService.sendAdminMessage(message.trim());
    } catch (notifyError) {
      logger.error('Error sending Telegram notification for fire request:', notifyError);
    }

    res.status(201).json({
      success: true,
      message: 'Solicitud de fuegos enviada. Será revisada por un administrador.',
      request,
      fiat: ctx && ctx.operationalRate
        ? {
            rate_source: ctx.operationalRate.baseSource,
            rate_mxyz: ctx.operationalRate.rate,
            margin_percent: ctx.operationalRate.marginPercent,
            age_minutes: ctx.operationalRate.ageMinutes,
            fires_per_usdt: ctx.config?.fires_per_usdt
          }
        : null
    });

  } catch (error) {
    logger.error('Request fires error:', error);
    res.status(500).json({ error: 'Error al solicitar fuegos' });
  }
});

// Get fire requests (admin only)
router.get('/fire-requests', adminAuth, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    let queryStr = `
      SELECT 
        fr.id,
        fr.user_id,
        fr.amount,
        fr.status,
        fr.reference,
        fr.proof_url,
        fr.notes,
        fr.reviewer_id,
        fr.reviewed_at,
        fr.review_notes,
        fr.created_at,
        fr.updated_at,
        u.username,
        u.email,
        u.display_name,
        reviewer.username as reviewer_username
      FROM fire_requests fr
      JOIN users u ON u.id = fr.user_id
      LEFT JOIN users reviewer ON reviewer.id = fr.reviewer_id
    `;

    const params = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      queryStr += ` WHERE fr.status = $${++paramCount}`;
      params.push(status);
    }

    queryStr += ` ORDER BY fr.created_at DESC`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM fire_requests';
    if (status && status !== 'all') {
      countQuery += ' WHERE status = $1';
    }
    const countResult = await query(
      countQuery, 
      status && status !== 'all' ? [status] : []
    );

    res.json({
      requests: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Get fire requests error:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Approve fire request (admin only)
router.put('/fire-requests/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewer_id = req.user?.id;

    const result = await transaction(async (client) => {
      // Obtener la solicitud
      const requestResult = await client.query(
        'SELECT * FROM fire_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('Solicitud no encontrada');
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        throw new Error(`Solicitud ya fue ${request.status}`);
      }

      // Verificar supply disponible
      const supplyResult = await client.query(
        'SELECT * FROM fire_supply WHERE id = 1 FOR UPDATE'
      );

      const supply = supplyResult.rows[0];
      const available = parseFloat(supply.total_max) - parseFloat(supply.total_emitted);

      if (available < request.amount) {
        throw new Error(`Supply insuficiente. Disponible: ${available}, Solicitado: ${request.amount}`);
      }

      // Actualizar supply
      await client.query(
        'UPDATE fire_supply SET total_emitted = total_emitted + $1, updated_at = NOW() WHERE id = 1',
        [request.amount]
      );

      // Obtener wallet del usuario
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [request.user_id]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet del usuario no encontrada');
      }

      const wallet = walletResult.rows[0];
      const oldBalance = parseFloat(wallet.fires_balance);

      // Agregar fuegos al wallet
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance + $1,
             total_fires_earned = total_fires_earned + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [request.amount, wallet.id]
      );

      const walletTxResult = await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES ($1, 'fire_purchase', 'fires', $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          wallet.id,
          request.amount,
          oldBalance,
          oldBalance + parseFloat(request.amount),
          `Compra de fuegos aprobada`,
          request.reference
        ]
      );

      const walletTransactionId = walletTxResult.rows[0]?.id || null;

      let valuation = null;

      try {
        const valuationRes = await client.query(
          `SELECT * FROM fiat_valuations 
           WHERE operation_type = $1 AND operation_id = $2 
           ORDER BY id DESC LIMIT 1`,
          ['fire_request', id]
        );
        valuation = valuationRes.rows[0] || null;
      } catch (valuationError) {
        logger.error('Error fetching fiat valuation for fire_request:', valuationError);
      }

      if (!valuation) {
        try {
          const ctx = await fiatRateService.getOperationalContext(client);
          if (ctx && ctx.operationalRate) {
            const op = ctx.operationalRate;
            const tokensAmount = parseFloat(request.amount);
            const usdtAmount = tokensAmount / 300;
            const vesAmount = usdtAmount * op.rate;

            let rateSource = op.baseSource;
            if (!rateSource && ctx.binanceRate) {
              rateSource = ctx.binanceRate.source;
            }
            if (!rateSource && ctx.bcvRate) {
              rateSource = ctx.bcvRate.source;
            }
            if (!rateSource) {
              rateSource = 'mundoxyz';
            }

            const insertValRes = await client.query(
              `INSERT INTO fiat_valuations 
               (operation_type, operation_id, tokens_amount, usdt_amount, ves_amount, rate_source, rate_value, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               RETURNING *`,
              [
                'fire_request',
                id,
                tokensAmount,
                usdtAmount,
                vesAmount,
                rateSource,
                op.rate
              ]
            );
            valuation = insertValRes.rows[0] || null;
          }
        } catch (fallbackError) {
          logger.error('Error creating fallback fiat valuation for fire_request:', fallbackError);
        }
      }

      if (walletTransactionId && valuation) {
        const tokensAmount = valuation.tokens_amount;
        const usdtAmount = valuation.usdt_amount;
        const vesAmount = valuation.ves_amount;

        const metadata = {
          operation_type: 'fire_request',
          fire_request_id: id,
          reference: request.reference
        };

        await client.query(
          `INSERT INTO fiat_operations 
           (wallet_transaction_id, user_id, direction, fiat_amount_ves, usdt_equivalent, tokens_amount, status, metadata, created_by, created_at, updated_at)
           VALUES ($1, $2, 'in', $3, $4, $5, 'approved', $6, $7, NOW(), NOW())`,
          [
            walletTransactionId,
            request.user_id,
            vesAmount,
            usdtAmount,
            tokensAmount,
            JSON.stringify(metadata),
            reviewer_id
          ]
        );
      }

      // Registrar en supply_txs
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, reference, description, actor_id, ip_address)
         VALUES ('emission', 'fires', $1, $2, $3, $4, $5, $6)`,
        [
          request.amount,
          request.user_id,
          request.reference,
          'Compra de fuegos aprobada por admin',
          reviewer_id,
          null
        ]
      );

      // Actualizar solicitud
      await client.query(
        `UPDATE fire_requests 
         SET status = 'approved',
             reviewer_id = $1,
             reviewed_at = NOW(),
             review_notes = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [reviewer_id, review_notes || 'Aprobado', id]
      );

      logger.info('Fire request approved', { 
        requestId: id, 
        userId: request.user_id, 
        amount: request.amount,
        reviewerId: reviewer_id
      });

      return {
        success: true,
        message: 'Solicitud aprobada exitosamente',
        amount: request.amount,
        user_id: request.user_id
      };
    });

    res.json(result);

  } catch (error) {
    logger.error('Approve fire request error:', error);
    res.status(400).json({ error: error.message || 'Error al aprobar solicitud' });
  }
});

// Reject fire request (admin only)
router.put('/fire-requests/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { review_notes } = req.body;
    const reviewer_id = req.user?.id;

    const result = await query(
      `UPDATE fire_requests 
       SET status = 'rejected',
           reviewer_id = $1,
           reviewed_at = NOW(),
           review_notes = $2,
           updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [reviewer_id, review_notes || 'Rechazado', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya fue procesada' });
    }

    logger.info('Fire request rejected', { 
      requestId: id, 
      userId: result.rows[0].user_id,
      reviewerId: reviewer_id
    });

    res.json({
      success: true,
      message: 'Solicitud rechazada',
      request: result.rows[0]
    });

  } catch (error) {
    logger.error('Reject fire request error:', error);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

module.exports = router;
