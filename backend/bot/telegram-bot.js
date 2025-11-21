const TelegramBot = require('node-telegram-bot-api');
const { query } = require('../db');
const logger = require('../utils/logger');
const config = require('../config/config');
const fiatRateService = require('../services/fiatRateService');
const telegramGroupRewardsService = require('../services/telegramGroupRewardsService');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN not found in environment variables');
  module.exports = null;
} else {
  // Use polling in development, webhook in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  let bot;
  if (isProduction) {
    // Webhook mode for Railway
    bot = new TelegramBot(token, { webHook: false });
    logger.info('Telegram bot initialized in WEBHOOK mode (manual setup required)');
  } else {
    // Polling mode for local development
    bot = new TelegramBot(token, { polling: true });
    logger.info('Telegram bot initialized in POLLING mode (development)');
  }

  // Handle /start command with link token
  bot.onText(/\/start (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const linkToken = match[1];
    const tgId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    logger.info(`Telegram link attempt: tg_id=${tgId}, token=${linkToken}`);

    try {
      // Find session
      const session = await query(
        `SELECT user_id, expires_at, used 
         FROM telegram_link_sessions 
         WHERE link_token = $1`,
        [linkToken]
      );

      if (session.rows.length === 0) {
        return bot.sendMessage(chatId, '❌ Código de vinculación inválido o expirado.');
      }

      const sessionData = session.rows[0];

      // Check expiration
      if (new Date() > new Date(sessionData.expires_at)) {
        return bot.sendMessage(chatId, '⏰ Este código ha expirado. Genera uno nuevo desde MundoXYZ.');
      }

      // Check if already used
      if (sessionData.used) {
        return bot.sendMessage(chatId, '✅ Este código ya fue utilizado anteriormente.');
      }

      // Check if tg_id already linked to different account
      const existing = await query(
        'SELECT id, username FROM users WHERE tg_id = $1 AND id != $2',
        [tgId, sessionData.user_id]
      );

      if (existing.rows.length > 0) {
        return bot.sendMessage(
          chatId, 
          `❌ Tu cuenta de Telegram ya está vinculada a @${existing.rows[0].username} en MundoXYZ.\n\n` +
          'Si quieres vincularla a otra cuenta, primero desvincúlala desde tu perfil.'
        );
      }

      // Link account
      await query(
        'UPDATE users SET tg_id = $1, updated_at = NOW() WHERE id = $2',
        [tgId, sessionData.user_id]
      );

      // Mark session as used
      await query(
        'UPDATE telegram_link_sessions SET used = TRUE WHERE link_token = $1',
        [linkToken]
      );

      // Get user info
      const userResult = await query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [sessionData.user_id]
      );

      const user = userResult.rows[0];

      // Send success message
      bot.sendMessage(
        chatId,
        `✅ ¡Cuenta vinculada exitosamente!\n\n` +
        `🎮 **MundoXYZ**: @${user.username}\n` +
        `👤 **Telegram**: ${firstName}${username ? ` (@${username})` : ''}\n\n` +
        `Ya puedes cerrar este chat y volver a MundoXYZ. ¡Diviértete!`
        , { parse_mode: 'Markdown' }
      );

      logger.info(`Telegram linked successfully: user_id=${sessionData.user_id}, tg_id=${tgId}`);

    } catch (error) {
      logger.error('Error linking Telegram:', error);
      bot.sendMessage(chatId, '❌ Ocurrió un error al vincular tu cuenta. Intenta de nuevo más tarde.');
    }
  });

  // Handle /start without parameters
  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name;

    bot.sendMessage(
      chatId,
      `👋 ¡Hola ${firstName}!\n\n` +
      `Soy el bot oficial de **MundoXYZ** 🎮\n\n` +
      `Para vincular tu cuenta de Telegram con MundoXYZ:\n` +
      `1️⃣ Ve a tu perfil en MundoXYZ\n` +
      `2️⃣ Click en "Mis Datos"\n` +
      `3️⃣ Ve a la pestaña "Telegram"\n` +
      `4️⃣ Click en "Vincular con Bot"\n\n` +
      `¡Nos vemos en el juego! 🔥`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle /bcv command (BCV reference rate)
  bot.onText(/\/bcv(?:@[^\s]+)?/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const ctx = await fiatRateService.getOperationalContext();
      const bcv = ctx?.bcvRate;

      if (!bcv || !bcv.rate) {
        return bot.sendMessage(
          chatId,
          '⚠️ No hay una tasa BCV disponible en este momento. Intenta de nuevo más tarde.'
        );
      }

      const rate = parseFloat(bcv.rate);
      const capturedAt = bcv.captured_at ? new Date(bcv.captured_at) : null;
      const now = new Date();
      let ageMinutes = null;

      if (capturedAt && Number.isFinite(capturedAt.getTime())) {
        ageMinutes = Math.round(Math.abs(now.getTime() - capturedAt.getTime()) / 60000);
      }

      const dateLabel = capturedAt
        ? capturedAt.toLocaleString('es-VE', {
            dateStyle: 'short',
            timeStyle: 'short'
          })
        : 'N/D';

      const staleWarning = ageMinutes !== null && ageMinutes > 60
        ? '\n\n⚠️ Esta tasa tiene más de 60 minutos. Puede estar desactualizada.'
        : '';

      const sourceLabel = bcv.source || 'bcv';

      const message =
        '💵 *Tasa BCV de Referencia*' +
        `\n\n1 USD ≈ *${rate.toFixed(2)} Bs*` +
        `\nFuente: *${sourceLabel.toUpperCase()}*` +
        `\nActualizada: _${dateLabel}_` +
        (ageMinutes !== null
          ? `\n(≈ ${ageMinutes} min atrás)`
          : '') +
        staleWarning;

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error handling /bcv command:', error);
      bot.sendMessage(
        chatId,
        '❌ Ocurrió un error al obtener la tasa BCV. Intenta de nuevo más tarde.'
      );
    }
  });

  // Handle /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
      chatId,
      `📖 **Ayuda - MundoXYZ Bot**\n\n` +
      `**Comandos disponibles:**\n` +
      `/start - Iniciar bot\n` +
      `/help - Ver esta ayuda\n` +
      `/myid - Ver tu Telegram ID\n\n` +
      `**¿Cómo vincular mi cuenta?**\n` +
      `1. Ve a MundoXYZ\n` +
      `2. Perfil → Mis Datos → Telegram\n` +
      `3. Sigue las instrucciones\n\n` +
      `¿Necesitas ayuda? Contacta a @tote`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle /myid command (useful for manual linking)
  bot.onText(/\/myid/, (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    bot.sendMessage(
      chatId,
      `👤 **Tu información de Telegram:**\n\n` +
      `**ID:** \`${tgId}\`\n` +
      `**Nombre:** ${firstName}\n` +
      `${username ? `**Username:** @${username}\n` : ''}\n` +
      `Puedes copiar tu ID para vinculación manual en MundoXYZ.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Track all messages in official Telegram group for daily rewards
  bot.on('message', async (msg) => {
    try {
      await telegramGroupRewardsService.handleGroupMessage(msg);
    } catch (error) {
      logger.error('Error handling Telegram group reward message:', error);
    }
  });

  // Error handling
  bot.on('polling_error', (error) => {
    logger.error('Telegram bot polling error:', error);
  });

  module.exports = bot;
}
