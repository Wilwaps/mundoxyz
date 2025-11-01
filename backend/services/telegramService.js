const logger = require('../utils/logger');

class TelegramService {
  constructor() {
    this.bot = null;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '1417856820';
  }

  async sendAdminMessage(message, options = {}) {
    try {
      if (!this.bot) {
        logger.warn('Telegram bot not initialized, skipping message');
        return false;
      }

      await this.bot.telegram.sendMessage(this.adminChatId, message, {
        parse_mode: 'HTML',
        ...options
      });

      logger.info('Admin message sent via Telegram');
      return true;
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      return false;
    }
  }

  async notifyHostDisconnection(roomCode, hostName) {
    const message = `
🚨 <b>Host Desconectado</b>

Sala: <code>${roomCode}</code>
Host: ${hostName}
Tiempo: ${new Date().toLocaleString('es-ES')}

La sala ha sido pausada esperando reconexión.
    `;

    return this.sendAdminMessage(message);
  }

  async notifyBingoWinner(roomCode, winnerName, prize) {
    const message = `
🎉 <b>¡BINGO!</b>

Sala: <code>${roomCode}</code>
Ganador: ${winnerName}
Premio: ${prize}
Tiempo: ${new Date().toLocaleString('es-ES')}
    `;

    return this.sendAdminMessage(message);
  }

  setBot(bot) {
    this.bot = bot;
    logger.info('Telegram bot configured for service');
  }
}

module.exports = new TelegramService();
