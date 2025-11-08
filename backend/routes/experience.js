const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const telegramService = require('../services/telegramService');

/**
 * POST /api/experience/buy
 * Comprar experiencia con coins y fires
 * Costo: 50 coins + 1 fire = 1 XP
 */
router.post('/buy', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    // Validaciones
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Cantidad inválida. Mínimo 1 XP' });
    }

    if (!Number.isInteger(amount)) {
      return res.status(400).json({ error: 'La cantidad debe ser un número entero' });
    }

    // Calcular costos
    const coinsRequired = amount * 50;
    const firesRequired = amount * 1;

    logger.info('Buy experience request:', {
      userId,
      username: req.user.username,
      amount,
      coinsRequired,
      firesRequired
    });

    // Ejecutar transacción atómica
    const result = await transaction(async (client) => {
      // 1. Obtener wallet del usuario
      const walletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet no encontrado');
      }

      const wallet = walletResult.rows[0];
      const currentCoins = parseFloat(wallet.coins_balance);
      const currentFires = parseFloat(wallet.fires_balance);

      // 2. Verificar balance suficiente
      if (currentCoins < coinsRequired) {
        throw new Error(`Balance insuficiente. Necesitas ${coinsRequired} coins (tienes ${currentCoins})`);
      }

      if (currentFires < firesRequired) {
        throw new Error(`Balance insuficiente. Necesitas ${firesRequired} fires (tienes ${currentFires})`);
      }

      // 3. Obtener wallet del admin (tg_id 1417856820)
      const adminTgId = '1417856820';
      const adminResult = await client.query(
        'SELECT id, username FROM users WHERE tg_id = $1',
        [adminTgId]
      );

      if (adminResult.rows.length === 0) {
        throw new Error('Admin no encontrado');
      }

      const adminUserId = adminResult.rows[0].id;
      const adminUsername = adminResult.rows[0].username;

      const adminWalletResult = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [adminUserId]
      );

      if (adminWalletResult.rows.length === 0) {
        throw new Error('Wallet del admin no encontrado');
      }

      const adminWallet = adminWalletResult.rows[0];

      // 4. Descontar coins del usuario
      await client.query(
        `UPDATE wallets 
         SET coins_balance = coins_balance - $1,
             total_coins_spent = total_coins_spent + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [coinsRequired, userId]
      );

      // 5. Transferir coins al admin
      await client.query(
        `UPDATE wallets 
         SET coins_balance = coins_balance + $1,
             total_coins_earned = total_coins_earned + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [coinsRequired, adminUserId]
      );

      // 6. Descontar fires del usuario
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance - $1,
             total_fires_spent = total_fires_spent + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [firesRequired, userId]
      );

      // 7. Transferir fires al admin
      await client.query(
        `UPDATE wallets 
         SET fires_balance = fires_balance + $1,
             total_fires_earned = total_fires_earned + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [firesRequired, adminUserId]
      );

      // 8. Actualizar experiencia del usuario
      const userUpdateResult = await client.query(
        `UPDATE users 
         SET experience = experience + $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING experience`,
        [amount, userId]
      );

      const newExperience = userUpdateResult.rows[0].experience;

      // 9. Registrar transacción en wallet_transactions
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES 
         ($1, 'buy_experience', 'coins', $2, $3, $4, $5, $6),
         ($1, 'buy_experience', 'fires', $7, $8, $9, $5, $6)`,
        [
          wallet.id,
          -coinsRequired,
          currentCoins,
          currentCoins - coinsRequired,
          `Compra de experiencia: ${amount} XP`,
          `exp_purchase_${Date.now()}`,
          -firesRequired,
          currentFires,
          currentFires - firesRequired
        ]
      );

      // 10. Registrar transacciones del admin
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES 
         ($1, 'experience_sale', 'coins', $2, $3, $4, $5, $6),
         ($1, 'experience_sale', 'fires', $7, $8, $9, $5, $6)`,
        [
          adminWallet.id,
          coinsRequired,
          parseFloat(adminWallet.coins_balance),
          parseFloat(adminWallet.coins_balance) + coinsRequired,
          `Venta de experiencia a ${req.user.username}: ${amount} XP`,
          `exp_purchase_${Date.now()}`,
          firesRequired,
          parseFloat(adminWallet.fires_balance),
          parseFloat(adminWallet.fires_balance) + firesRequired
        ]
      );

      // 11. Notificar al admin por Telegram
      try {
        const message = `
🎓 *Compra de Experiencia*

👤 Usuario: ${req.user.username}
✨ XP Comprado: ${amount}
🪙 Coins: ${coinsRequired}
🔥 Fires: ${firesRequired}
📊 Nueva XP total: ${newExperience}
        `.trim();

        await telegramService.sendAdminMessage(message);
      } catch (telegramError) {
        logger.error('Error sending Telegram notification:', telegramError);
        // No fallar la transacción por error de Telegram
      }

      return {
        success: true,
        xpGained: amount,
        newExperience,
        coinsSpent: coinsRequired,
        firesSpent: firesRequired,
        newCoinsBalance: currentCoins - coinsRequired,
        newFiresBalance: currentFires - firesRequired
      };
    });

    logger.info('Experience purchased successfully:', result);

    res.json(result);

  } catch (error) {
    logger.error('Error buying experience:', error);
    res.status(500).json({ 
      error: error.message || 'Error al comprar experiencia' 
    });
  }
});

module.exports = router;
