/**
 * Ron Chat Socket Handler
 * Maneja conversaciones con el bot Ron (OpenAI)
 */

const openaiService = require('../services/openai');
const { query } = require('../db');
const logger = require('../utils/logger');

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

module.exports = (io, socket) => {
  /**
   * Enviar mensaje al bot Ron
   */
  socket.on('ron:chat_message', async (data) => {
    try {
      const { userId, message } = data;
      
      // Validaciones básicas
      if (!userId || !message || !message.trim()) {
        return socket.emit('ron:error', { message: 'Datos inválidos' });
      }
      
      // Validar longitud del mensaje
      if (message.length > 500) {
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
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return socket.emit('ron:error', { message: 'Usuario no encontrado' });
      }
      
      const username = userResult.rows[0].username;
      
      logger.info('🤖 Ron chat message received', {
        userId,
        username,
        messageLength: message.length
      });
      
      // Emitir mensaje del usuario de vuelta (confirmación)
      socket.emit('ron:user_message', {
        userId,
        username,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        isBot: false
      });
      
      // Guardar mensaje en historial (OpenAI Service)
      await openaiService.addMessage(userId, username, message.trim(), false);
      
      // Indicar que Ron está escribiendo
      socket.emit('ron:typing', { isTyping: true });
      
      // Obtener respuesta de OpenAI
      const response = await openaiService.chat(userId, message.trim());
      
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
