const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, adminAuth, requireWalletAccess } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config/config');
const telegramService = require('../services/telegramService');
const { calculateAndLogCommission } = require('../services/commissionService');

async function getStoreMarketConfig() {
  const defaults = {
    is_enabled: false,
    plans: {
      starter: { price_usd: 29 },
      professional: { price_usd: 79 },
      enterprise: { price_usd: 199 }
    }
  };

  try {
    const result = await query(
      'SELECT is_enabled, plans FROM store_market_config WHERE id = 1 LIMIT 1'
    );

    if (result.rows.length === 0) {
      return defaults;
    }

    const row = result.rows[0];
    const rawPlans = row.plans && typeof row.plans === 'object' ? row.plans : {};

    const normalizedPlans = {};
    const keys = ['starter', 'professional', 'enterprise'];
    for (const key of keys) {
      const plan = rawPlans[key] && typeof rawPlans[key] === 'object' ? rawPlans[key] : {};
      const rawPrice = Number(plan.price_usd);
      const price = Number.isFinite(rawPrice) && rawPrice >= 0
        ? rawPrice
        : defaults.plans[key].price_usd;
      normalizedPlans[key] = { price_usd: price };
    }

    return {
      is_enabled: !!row.is_enabled,
      plans: normalizedPlans
    };
  } catch (error) {
    logger.error('Error loading store_market_config:', error);
    return defaults;
  }
}

// Request to redeem fires for fiat (mínimo 100, con comisión 5%)
router.post('/redeem-100-fire', verifyToken, requireWalletAccess, async (req, res) => {
  try {
    const {
      cedula,
      telefono,
      bank_code,
      bank_name,
      bank_account,
      fires_amount = 100,
      payout_method,
      wallet_address,
      network
    } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!cedula || !telefono) {
      return res.status(400).json({ error: 'Cedula and telefono are required' });
    }
    
    const requestedAmount = parseFloat(fires_amount);
    const method = payout_method === 'usdt_tron' ? 'usdt_tron' : 'bank_transfer';

    // Validar cantidad mínima según método de pago
    const minAmount = method === 'usdt_tron' ? 300 : 100;
    if (requestedAmount < minAmount) {
      const errorMessage =
        method === 'usdt_tron'
          ? 'La cantidad mínima para canjear en USDT es 300 fuegos'
          : 'La cantidad mínima para canjear es 100 fuegos';
      return res.status(400).json({ error: errorMessage });
    }
    
    // Calcular comisión 5% (cantidad total que se reservará como comisión de plataforma)
    const commission = requestedAmount * 0.05;
    const totalRequired = requestedAmount + commission;

    if (!cedula || !telefono) {
      return res.status(400).json({ error: 'Cedula and telefono are required' });
    }

    if (method === 'usdt_tron' && !wallet_address) {
      return res.status(400).json({ error: 'Wallet address is required for USDT payouts' });
    }
    
    const result = await transaction(async (client) => {
      // Get wallet with lock
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      
      const wallet = walletResult.rows[0];
      const firesBalance = parseFloat(wallet.fires_balance);
      
      // Check balance (cantidad + comisión 5%)
      if (firesBalance < totalRequired) {
        throw new Error(`Balance insuficiente. Necesitas ${totalRequired.toFixed(2)} fuegos (${requestedAmount} + ${commission.toFixed(2)} comisión 5%)`);
      }
      
      // Check for pending redemptions
      const pendingCheck = await client.query(
        'SELECT COUNT(*) as count FROM market_redeems WHERE user_id = $1 AND status = \'pending\'',
        [userId]
      );
      
      if (parseInt(pendingCheck.rows[0].count) > 0) {
        throw new Error('You already have a pending redemption request');
      }
      
      // Deduct total amount from wallet (cantidad + comisión)
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance - $1,
             total_fires_spent = total_fires_spent + $1
         WHERE user_id = $2`,
        [totalRequired, userId]
      );
      
      // Create redemption request con comisión registrada
      const redeemResult = await client.query(
        `INSERT INTO market_redeems 
         (user_id, fires_amount, commission_amount, total_deducted, cedula, phone, bank_code, bank_name, bank_account, payout_method, wallet_address, network, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
         RETURNING id`,
        [
          userId,
          requestedAmount,
          commission,
          totalRequired,
          cedula,
          telefono,
          bank_code,
          bank_name,
          bank_account,
          method,
          method === 'usdt_tron' ? wallet_address : null,
          method === 'usdt_tron' ? (network || 'TRON') : null
        ]
      );

      // Registrar distribución de comisión (Tito / Tote) en commissions_log
      const platformRate = 0.05;
      const split = await calculateAndLogCommission({
        client,
        operationId: redeemResult.rows[0].id,
        operationType: 'withdraw',
        actorUserId: userId,
        amountBase: requestedAmount,
        platformCommissionRate: platformRate,
        metadata: {
          route: 'redeem-100-fire',
          payout_method: method
        }
      });
      
      // Record wallet transaction del usuario (canje + comisión)
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'market_redeem', 'fires', $2, $3, $4, 
           $5, $6
         )`,
        [userId, totalRequired, firesBalance, firesBalance - totalRequired,
         `Canje de ${requestedAmount} fuegos (comisión: ${commission.toFixed(2)})`,
         redeemResult.rows[0].id]
      );
      
      // Update fire supply (burn solo la cantidad solicitada, NO la comisión)
      await client.query(
        'UPDATE fire_supply SET total_burned = total_burned + $1 WHERE id = 1',
        [requestedAmount]
      );
      
      // Record supply transaction (burn)
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, description, ip_address)
         VALUES ('burn_market_redeem', 'fires', $1, $2, $3, $4)`,
        [requestedAmount, userId, `Canje de mercado: ${requestedAmount} fuegos`, req.ip]
      );
      
      // Transferir comisión al usuario admin/Tote (solo la parte que queda para plataforma)
      const adminTgId = '1417856820';
      const adminCheck = await client.query(
        'SELECT id FROM users WHERE tg_id = $1',
        [adminTgId]
      );
      
      // 1) Acreditar comisión a Tito si aplica
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
             SET fires_balance = fires_balance + $1
             WHERE id = $2`,
            [titoAmount, titoWallet.id]
          );

          await client.query(
            `INSERT INTO wallet_transactions 
             (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
             VALUES (
               $1,
               'tito_commission_withdraw', 'fires', $2,
               $3,
               $4,
               $5,
               $6
             )`,
            [
              titoWallet.id,
              titoAmount,
              titoBefore,
              titoBefore + titoAmount,
              `Comisión Tito canje mercado (5% de ${requestedAmount})`,
              redeemResult.rows[0].id
            ]
          );
        }
      }

      // 2) Acreditar comisión restante al admin/Tote
      const toteCommissionAmount = split.toteCommissionAmount;

      if (adminCheck.rows.length > 0 && toteCommissionAmount > 0) {
        const adminUserId = adminCheck.rows[0].id;
        
        // Acreditar comisión al admin
        await client.query(
          `UPDATE wallets 
           SET fires_balance = fires_balance + $1
           WHERE user_id = $2`,
          [toteCommissionAmount, adminUserId]
        );
        
        // Registrar transacción del admin
        await client.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES (
             (SELECT id FROM wallets WHERE user_id = $1),
             'platform_commission', 'fires', $2,
             (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
             (SELECT fires_balance FROM wallets WHERE user_id = $1),
             $3, $4
           )`,
          [adminUserId, toteCommissionAmount,
           `Comisión canje mercado (5% de ${requestedAmount})`,
           redeemResult.rows[0].id]
        );
        
        logger.info('Commission transferred to admin', {
          adminUserId,
          commission: toteCommissionAmount.toFixed(2),
          redemptionId: redeemResult.rows[0].id
        });
      } else if (adminCheck.rows.length === 0) {
        logger.warn('Admin user not found for commission transfer', { adminTgId });
      }
      
      return {
        success: true,
        redemption_id: redeemResult.rows[0].id,
        redemption: redeemResult.rows[0],
        message: 'Redemption request created. Waiting for Tote approval.'
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username, email FROM users WHERE id = $1',
      [userId]
    );
    
    // Send notification to Tote via Telegram
    try {
      await telegramService.notifyRedemptionRequest({
        redemption_id: result.redemption_id,
        username: userDetails.rows[0].username,
        email: userDetails.rows[0].email,
        fires_amount: requestedAmount,
        commission_amount: commission,
        total_deducted: totalRequired,
        cedula,
        phone: telefono,
        bank_code,
        bank_name,
        bank_account,
        payout_method: result.redemption?.payout_method || method,
        wallet_address: result.redemption?.wallet_address || (method === 'usdt_tron' ? wallet_address : null),
        network: result.redemption?.network || (method === 'usdt_tron' ? (network || 'TRON') : null)
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
      // No fallar la solicitud si falla la notificación
    }
    
    logger.info('Market redemption requested', { 
      userId, 
      redemptionId: result.redemption_id 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error creating redemption request:', error);
    res.status(400).json({ error: error.message || 'Failed to create redemption request' });
  }
});

// Get pending redemptions (tote/admin)
router.get('/redeems/pending', adminAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        mr.*,
        u.username,
        u.display_name,
        u.tg_id,
        u.email,
        w.fires_balance as current_fires_balance
       FROM market_redeems mr
       JOIN users u ON u.id = mr.user_id
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE mr.status = 'pending'
       ORDER BY mr.created_at ASC`
    );
    
    res.json(result.rows);
    
  } catch (error) {
    logger.error('Error fetching pending redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch pending redemptions' });
  }
});

// List all redemptions (tote/admin)
router.get('/redeems/list', adminAuth, async (req, res) => {
  try {
    const { status, user_id, limit = 50, offset = 0 } = req.query;
    
    let queryStr = `
      SELECT 
        mr.*,
        u.username,
        u.display_name,
        u.tg_id,
        processor.username as processor_username
       FROM market_redeems mr
       JOIN users u ON u.id = mr.user_id
       LEFT JOIN users processor ON processor.id = mr.processor_id
       WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      queryStr += ` AND mr.status = $${++paramCount}`;
      params.push(status);
    }
    
    if (user_id) {
      queryStr += ` AND mr.user_id = $${++paramCount}`;
      params.push(user_id);
    }
    
    queryStr += ` ORDER BY mr.created_at DESC`;
    queryStr += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await query(queryStr, params);
    
    res.json({
      redemptions: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    logger.error('Error listing redemptions:', error);
    res.status(500).json({ error: 'Failed to list redemptions' });
  }
});

// Accept redemption (tote/admin)
router.post('/redeems/:id/accept', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id, proof_url, notes } = req.body;
    
    const result = await transaction(async (client) => {
      // Get redemption
      const redeemResult = await client.query(
        'SELECT * FROM market_redeems WHERE id = $1 FOR UPDATE',
        [id]
      );
      
      if (redeemResult.rows.length === 0) {
        throw new Error('Redemption not found');
      }
      
      const redeem = redeemResult.rows[0];
      
      if (redeem.status !== 'pending') {
        throw new Error('Redemption is not pending');
      }
      
      // Update redemption
      await client.query(
        `UPDATE market_redeems 
         SET status = 'completed',
             transaction_id = $1,
             proof_url = $2,
             processor_notes = $3,
             processor_id = $4,
             processed_at = NOW()
         WHERE id = $5`,
        [transaction_id, proof_url, notes, req.user?.id || null, id]
      );
      
      return {
        success: true,
        message: 'Redemption accepted and marked as completed',
        redeem
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username FROM users WHERE id = $1',
      [result.redeem.user_id]
    );
    
    // Send notification to admin via Telegram
    try {
      await telegramService.notifyRedemptionCompleted({
        username: userDetails.rows[0].username,
        fires_amount: result.redeem.fires_amount,
        transaction_id
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
    }
    
    logger.info('Market redemption accepted', { 
      redemptionId: id, 
      processor: req.user?.username 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error accepting redemption:', error);
    res.status(400).json({ error: error.message || 'Failed to accept redemption' });
  }
});

// Reject redemption (tote/admin)
router.post('/redeems/:id/reject', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const result = await transaction(async (client) => {
      // Get redemption
      const redeemResult = await client.query(
        'SELECT * FROM market_redeems WHERE id = $1 FOR UPDATE',
        [id]
      );
      
      if (redeemResult.rows.length === 0) {
        throw new Error('Redemption not found');
      }
      
      const redeem = redeemResult.rows[0];
      
      if (redeem.status !== 'pending') {
        throw new Error('Redemption is not pending');
      }
      
      // Return fires to user
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance + $1,
             total_fires_spent = total_fires_spent - $1
         WHERE user_id = $2`,
        [redeem.fires_amount, redeem.user_id]
      );
      
      // Update redemption
      await client.query(
        `UPDATE market_redeems 
         SET status = 'rejected',
             processor_notes = $1,
             processor_id = $2,
             processed_at = NOW()
         WHERE id = $3`,
        [reason, req.user?.id || null, id]
      );
      
      // Reverse the burn in supply
      await client.query(
        'UPDATE fire_supply SET total_burned = total_burned - $1 WHERE id = 1',
        [redeem.fires_amount]
      );
      
      // Record reversal in supply transactions
      await client.query(
        `INSERT INTO supply_txs 
         (type, currency, amount, user_id, description, actor_id)
         VALUES ('reversal_market_redeem', 'fires', $1, $2, $3, $4)`,
        [redeem.fires_amount, redeem.user_id, 
         'Redemption rejected: ' + reason, req.user?.id || null]
      );
      
      // Record wallet transaction
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'market_redeem_reversal', 'fires', $2, 
           (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
           (SELECT fires_balance FROM wallets WHERE user_id = $1),
           $3, $4
         )`,
        [redeem.user_id, redeem.fires_amount, 
         'Redemption rejected: ' + reason, id]
      );
      
      return {
        success: true,
        message: 'Redemption rejected and fires returned to user',
        redeem
      };
    });
    
    // Get user details for notification
    const userDetails = await query(
      'SELECT username FROM users WHERE id = $1',
      [result.redeem.user_id]
    );
    
    // Send notification to admin via Telegram
    try {
      await telegramService.notifyRedemptionRejected({
        username: userDetails.rows[0].username,
        fires_amount: result.redeem.fires_amount,
        reason
      });
    } catch (notifyError) {
      logger.error('Error sending Telegram notification:', notifyError);
    }
    
    logger.info('Market redemption rejected', { 
      redemptionId: id, 
      processor: req.user?.username,
      reason 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error rejecting redemption:', error);
    res.status(400).json({ error: error.message || 'Failed to reject redemption' });
  }
});

// Get user's redemption history
router.get('/my-redeems', verifyToken, requireWalletAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT 
        mr.*,
        processor.username as processor_username
       FROM market_redeems mr
       LEFT JOIN users processor ON processor.id = mr.processor_id
       WHERE mr.user_id = $1
       ORDER BY mr.created_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    logger.error('Error fetching user redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch redemption history' });
  }
});

// Get market statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
        SUM(fires_amount) FILTER (WHERE status = 'completed') as total_fires_redeemed,
        AVG(fires_amount) FILTER (WHERE status = 'completed') as avg_redemption_amount,
        COUNT(DISTINCT user_id) as unique_users
       FROM market_redeems`
    );
    
    res.json(stats.rows[0]);
    
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    res.status(500).json({ error: 'Failed to fetch market statistics' });
  }
});

// Store marketplace configuration (plans & toggle). This controls whether
// selling stores is active on the Market and the base USD prices per plan.

// GET /api/market/store-plans (public)
router.get('/store-plans', async (req, res) => {
  try {
    const config = await getStoreMarketConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching store market plans:', error);
    res.status(500).json({ error: 'Failed to fetch store plans' });
  }
});

// PATCH /api/market/store-plans (admin only)
router.patch('/store-plans', adminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const enabledFlag = !!body.is_enabled;

    const defaults = {
      starter: { price_usd: 29 },
      professional: { price_usd: 79 },
      enterprise: { price_usd: 199 }
    };

    const incomingPlans = body.plans && typeof body.plans === 'object' ? body.plans : {};
    const normalizedPlans = {};
    const keys = ['starter', 'professional', 'enterprise'];

    for (const key of keys) {
      const plan = incomingPlans[key] && typeof incomingPlans[key] === 'object'
        ? incomingPlans[key]
        : {};
      const rawPrice = Number(plan.price_usd);
      let price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : defaults[key].price_usd;
      if (price > 9999) price = 9999; // small sanity cap
      normalizedPlans[key] = { price_usd: price };
    }

    await query(
      `INSERT INTO store_market_config (id, is_enabled, plans, updated_at)
       VALUES (1, $1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
       SET is_enabled = EXCLUDED.is_enabled,
           plans = EXCLUDED.plans,
           updated_at = EXCLUDED.updated_at`,
      [enabledFlag, JSON.stringify(normalizedPlans)]
    );

    res.json({
      is_enabled: enabledFlag,
      plans: normalizedPlans
    });
  } catch (error) {
    logger.error('Error updating store market plans:', error);
    res.status(400).json({ error: error.message || 'Failed to update store plans' });
  }
});

module.exports = router;
