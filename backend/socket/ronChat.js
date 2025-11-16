/**
 * Ron Chat Socket Handler
 * Maneja conversaciones con el bot Ron (OpenAI)
 */

const openaiService = require('../services/openai');
const { query } = require('../db');
const logger = require('../utils/logger');
const telegramService = require('../services/telegramService');

// Rate limiting simple en memoria (por usuario)
const userRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_MESSAGES_PER_WINDOW = 20;

/**
 * Verificar rate limit de un usuario
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = userRateLimits.get(userId);
  
  if (!userLimit) {
    // Primera vez del usuario
    userRateLimits.set(userId, {
      count: 1,
      windowStart: now
    });
    return true;
  }
  
  // Resetear ventana si pasó 1 minuto
  if (now - userLimit.windowStart > RATE_LIMIT_WINDOW) {
    userRateLimits.set(userId, {
      count: 1,
      windowStart: now
    });
    return true;
  }
  
  // Verificar si excedió límite
  if (userLimit.count >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }
  
  // Incrementar contador
  userLimit.count++;
  return true;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = (io, socket) => {
  /**
   * Enviar mensaje al bot Ron
   */
  socket.on('ron:chat_message', async (data) => {
    try {
      const { userId, message } = data;
      const trimmedMessage = message ? message.trim() : '';
      
      // Validaciones básicas
      if (!userId || !trimmedMessage) {
        return socket.emit('ron:error', { message: 'Datos inválidos' });
      }
      
      // Validar longitud del mensaje
      if (trimmedMessage.length > 500) {
        return socket.emit('ron:error', { 
          message: 'Mensaje muy largo (máximo 500 caracteres)' 
        });
      }
      
      // Verificar rate limit
      if (!checkRateLimit(userId)) {
        return socket.emit('ron:error', { 
          message: 'Demasiados mensajes. Por favor espera un momento.' 
        });
      }
      
      // Obtener username del usuario
      const userResult = await query(
        'SELECT id, username, tg_id, email FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return socket.emit('ron:error', { message: 'Usuario no encontrado' });
      }
      
      const user = userResult.rows[0];
      const username = user.username;
      const tgId = user.tg_id;
      const email = user.email;
      
      logger.info('🤖 Ron chat message received', {
        userId,
        username,
        messageLength: trimmedMessage.length
      });
      
      // Emitir mensaje del usuario de vuelta (confirmación)
      socket.emit('ron:user_message', {
        userId,
        username,
        message: trimmedMessage,
        timestamp: new Date().toISOString(),
        isBot: false
      });
      
      // Comando /queja: enviar queja vía Telegram y responder sin usar OpenAI
      if (trimmedMessage.toLowerCase().startsWith('/queja')) {
        const complaintText = trimmedMessage.slice('/queja'.length).trim();
        
        if (!complaintText) {
          return socket.emit('ron:error', { 
            message: 'Escribe tu queja después de /queja, por ejemplo: /queja No pude entrar a la sala de Bingo.' 
          });
        }
        
        const now = new Date();
        const complaintMessage = [
          '⚠️ <b>Nueva queja desde Ron</b>',
          '',
          `<b>Usuario:</b> ${escapeHtml(username)} (ID: ${userId})`,
          `<b>Telegram ID:</b> ${tgId ? `<code>${tgId}</code>` : 'no vinculado'}`,
          email ? `<b>Email:</b> ${escapeHtml(email)}` : null,
          `<b>Fecha:</b> ${now.toLocaleString('es-ES')}`,
          '',
          '<b>Mensaje:</b>',
          escapeHtml(complaintText)
        ]
          .filter(Boolean)
          .join('\n');

        try {
          const sent = await telegramService.sendAdminMessage(complaintMessage);
          if (!sent) {
            logger.warn('Failed to send complaint via Telegram', { userId, username });
          }
        } catch (err) {
          logger.error('Error sending complaint via Telegram', {
            error: err.message,
            userId,
            username
          });
        }

        socket.emit('ron:bot_response', {
          username: 'Ron',
          message: 'He enviado tu queja al equipo de MundoXYZ. Gracias por avisar, la revisarán lo antes posible.',
          timestamp: new Date().toISOString(),
          isBot: true,
          tokensUsed: 0
        });

        return;
      }
      
      // Guardar mensaje en historial (OpenAI Service)
      await openaiService.addMessage(userId, username, trimmedMessage, false);
      
      // Indicar que Ron está escribiendo
      socket.emit('ron:typing', { isTyping: true });
      
      // Obtener respuesta de OpenAI
      const response = await openaiService.chat(userId, trimmedMessage);
      
      // Ron terminó de escribir
      socket.emit('ron:typing', { isTyping: false });
      
      if (!response.success) {
        // Error de OpenAI
        return socket.emit('ron:error', { 
          message: response.error || 'Error al procesar mensaje' 
        });
      }
      
      // Enviar respuesta del bot al usuario
      socket.emit('ron:bot_response', {
        username: 'Ron',
        message: response.message,
        timestamp: new Date().toISOString(),
        isBot: true,
        tokensUsed: response.tokensUsed
      });
      
      logger.info('✅ Ron response sent', {
        userId,
        responseLength: response.message.length,
        tokensUsed: response.tokensUsed
      });
      
    } catch (error) {
      logger.error('❌ Error in Ron chat message handler', {
        error: error.message,
        userId: data.userId
      });
      socket.emit('ron:typing', { isTyping: false });
      socket.emit('ron:error', { 
        message: 'Error al procesar tu mensaje. Por favor intenta nuevamente.' 
      });
    }
  });
  
  /**
   * Cargar historial de conversación con Ron
   */
  socket.on('ron:load_history', async (data) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        return socket.emit('ron:error', { message: 'Usuario no especificado' });
      }
      
      // Cargar historial del usuario
      const history = await openaiService.loadUserHistory(userId);
      
      // Formatear mensajes para el frontend
      const formattedHistory = history.map(msg => ({
        username: msg.role === 'assistant' ? 'Ron' : msg.username || 'Usuario',
        message: msg.content,
        timestamp: msg.timestamp,
        isBot: msg.role === 'assistant'
      }));
      
      // Enviar historial al cliente
      socket.emit('ron:history', formattedHistory);
      
      logger.info('🤖 Ron chat history loaded', {
        userId,
        messagesCount: formattedHistory.length
      });
      
    } catch (error) {
      logger.error('❌ Error loading Ron chat history', {
        error: error.message,
        userId: data.userId
      });
      socket.emit('ron:error', { 
        message: 'Error al cargar historial' 
      });
    }
  });
  
  /**
   * Limpiar historial de conversación con Ron
   */
  socket.on('ron:clear_history', async (data) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        return socket.emit('ron:error', { message: 'Usuario no especificado' });
      }
      
      // Limpiar historial
      await openaiService.clearUserHistory(userId);
      
      // Confirmar al cliente
      socket.emit('ron:history_cleared', { success: true });
      
      logger.info('🗑️ Ron chat history cleared', { userId });
      
    } catch (error) {
      logger.error('❌ Error clearing Ron chat history', {
        error: error.message,
        userId: data.userId
      });
      socket.emit('ron:error', { 
        message: 'Error al limpiar historial' 
      });
    }
  });
  
  /**
   * Obtener estadísticas de uso de Ron
   */
  socket.on('ron:get_stats', async (data) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        return socket.emit('ron:error', { message: 'Usuario no especificado' });
      }
      
      const stats = await openaiService.getUserStats(userId);
      
      socket.emit('ron:stats', stats);
      
      logger.info('📊 Ron stats retrieved', { userId, stats });
      
    } catch (error) {
      logger.error('❌ Error getting Ron stats', {
        error: error.message,
        userId: data.userId
      });
      socket.emit('ron:error', { 
        message: 'Error al obtener estadísticas' 
      });
    }
  });
};
