const { query, transaction } = require('../db');
const config = require('../config/config');
const logger = require('../utils/logger');

class TelegramGroupRewardsService {
  /**
   * Registrar un mensaje en el grupo oficial de Telegram
   * Aplica límite diario de coins por usuario.
   */
  async handleGroupMessage(msg) {
    try {
      const groupId = config.telegram.groupId;
      if (!groupId) return;

      // Solo procesar mensajes del grupo oficial
      if (!msg || !msg.chat || msg.chat.id !== groupId) return;

      // Ignorar mensajes de bots
      if (!msg.from || msg.from.is_bot) return;

      const tgId = msg.from.id;
      if (!tgId) return;

      const coinsPerMessage = config.telegram.groupCoinsPerMessage || 0;
      const maxCoinsPerDay = config.telegram.groupMaxCoinsPerDay || 0;

      // Si está deshabilitado por config, no hacemos nada
      if (coinsPerMessage <= 0 || maxCoinsPerDay <= 0) return;

      await query(
        `INSERT INTO telegram_group_daily_rewards 
           (tg_id, activity_date, messages_count, coins_earned, coins_claimed, last_message_at, created_at, updated_at)
         VALUES ($1, CURRENT_DATE, 1, LEAST($2, $3), 0, NOW(), NOW(), NOW())
         ON CONFLICT (tg_id, activity_date)
         DO UPDATE SET
           messages_count = telegram_group_daily_rewards.messages_count + 1,
           coins_earned = LEAST(telegram_group_daily_rewards.coins_earned + $2, $3),
           last_message_at = NOW(),
           updated_at = NOW()`,
        [tgId, coinsPerMessage, maxCoinsPerDay]
      );
    } catch (error) {
      logger.error('Error recording Telegram group message:', error);
    }
  }

  /**
   * Acreditar coins pendientes por mensajes en grupo al usuario de la plataforma.
   * Se llama al entrar a la plataforma (login).
   */
  async creditPendingRewardsForUser(userId) {
    return transaction(async (client) => {
      // Obtener tg_id vinculado
      const userRes = await client.query(
        'SELECT id, tg_id FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRes.rows.length === 0) {
        return { credited: 0 };
      }

      const tgId = userRes.rows[0].tg_id;
      if (!tgId) {
        // Usuario sin Telegram vinculado
        return { credited: 0 };
      }

      const rewardsRes = await client.query(
        `SELECT id, activity_date, messages_count, coins_earned, coins_claimed
         FROM telegram_group_daily_rewards
         WHERE tg_id = $1 AND coins_earned > coins_claimed
         FOR UPDATE`,
        [tgId]
      );

      if (rewardsRes.rows.length === 0) {
        return { credited: 0 };
      }

      let pendingTotal = 0;
      for (const row of rewardsRes.rows) {
        const earned = parseFloat(row.coins_earned) || 0;
        const claimed = parseFloat(row.coins_claimed) || 0;
        const pending = earned - claimed;
        if (pending > 0) pendingTotal += pending;
      }

      if (pendingTotal <= 0) {
        return { credited: 0 };
      }

      // Bloquear wallet del usuario
      const walletRes = await client.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRes.rows.length === 0) {
        logger.warn('Wallet not found for Telegram reward user', { userId });
        return { credited: 0 };
      }

      const wallet = walletRes.rows[0];
      const oldCoins = parseFloat(wallet.coins_balance) || 0;
      const newCoins = oldCoins + pendingTotal;

      // Actualizar wallet
      await client.query(
        `UPDATE wallets 
         SET coins_balance = coins_balance + $1,
             total_coins_earned = total_coins_earned + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [pendingTotal, userId]
      );

      // Registrar transacción de wallet (resumen de todos los días pendientes)
      const metadata = {
        type: 'telegram_group_reward',
        days: rewardsRes.rows.map((row) => ({
          activity_date: row.activity_date,
          messages_count: row.messages_count,
          coins_earned: row.coins_earned,
          coins_claimed: row.coins_claimed
        }))
      };

      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, metadata)
         VALUES ($1, 'telegram_group_reward', 'coins', $2, $3, $4, $5, $6)`,
        [
          wallet.id,
          pendingTotal,
          oldCoins,
          newCoins,
          'Recompensa por mensajes en grupo oficial de Telegram',
          JSON.stringify(metadata)
        ]
      );

      // Marcar rewards como reclamados
      await client.query(
        `UPDATE telegram_group_daily_rewards
         SET coins_claimed = coins_earned,
             last_claimed_at = NOW(),
             updated_at = NOW()
         WHERE tg_id = $1 AND coins_earned > coins_claimed`,
        [tgId]
      );

      // Crear mensaje en buzón
      await client.query(
        `INSERT INTO bingo_v2_messages 
         (user_id, category, title, content, metadata, is_read)
         VALUES ($1, 'system', $2, $3, $4, false)`,
        [
          userId,
          '🎁 Recompensa por mensajes en Telegram',
          `Has recibido ${pendingTotal.toFixed(2)} coins por tu participación en el grupo oficial de MundoXYZ.`,
          JSON.stringify({
            type: 'telegram_group_reward',
            total_coins: pendingTotal
          })
        ]
      );

      logger.info('Telegram group rewards credited', {
        userId,
        tgId,
        coins: pendingTotal
      });

      return { credited: pendingTotal };
    });
  }
}

module.exports = new TelegramGroupRewardsService();
