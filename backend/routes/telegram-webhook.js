const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Telegram webhook endpoint
router.post('/webhook/:token', async (req, res) => {
  try {
    const webhookToken = req.params.token;
    const expectedToken = process.env.TELEGRAM_BOT_TOKEN;

    // Verify token
    if (!expectedToken || webhookToken !== expectedToken.split(':')[1]) {
      logger.warn('Invalid Telegram webhook token attempt');
      return res.status(403).send('Forbidden');
    }

    // Get the bot instance
    const bot = require('../bot/telegram-bot');
    if (!bot) {
      logger.error('Telegram bot not initialized');
      return res.status(500).send('Bot not initialized');
    }

    // Process update
    await bot.processUpdate(req.body);
    res.sendStatus(200);

  } catch (error) {
    logger.error('Error processing Telegram webhook:', error);
    res.sendStatus(500);
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  const bot = require('../bot/telegram-bot');
  res.json({
    status: bot ? 'active' : 'inactive',
    mode: process.env.NODE_ENV === 'production' ? 'webhook' : 'polling'
  });
});

module.exports = router;
