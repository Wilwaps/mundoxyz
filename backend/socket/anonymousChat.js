/**
 * Anonymous Chat Socket Handler
 * Maneja mensajes del chat anónimo sin revelar identidad
 */

const { query } = require('../db');
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  /**
   * Enviar mensaje al chat anónimo
   */
  socket.on('anonymous:chat_message', async (data) => {
    try {
      const { message } = data;
      
      if (!message || !message.trim()) {
        return socket.emit('anonymous:error', { message: 'Mensaje vacío' });
      }
      
      // Validar longitud del mensaje
      if (message.length > 500) {
        return socket.emit('anonymous:error', { message: 'Mensaje muy largo (máximo 500 caracteres)' });
      }
      
      // Guardar mensaje en DB (sin user_id)
      await query(
        `INSERT INTO anonymous_chat_messages (message)
         VALUES ($1)`,
        [message.trim()]
      );
      
      // Broadcast a TODOS los conectados (sin username)
      const messageData = {
        message: message.trim(),
        timestamp: new Date()
      };
      
      io.emit('anonymous:chat_message', messageData);
      
      logger.info('👤 Anonymous chat message sent', {
        messageLength: message.length
      });
      
    } catch (error) {
      logger.error('❌ Error sending anonymous chat message', {
        error: error.message
      });
      socket.emit('anonymous:error', { message: 'Error al enviar mensaje' });
    }
  });

  /**
   * Cargar historial del chat anónimo
   */
  socket.on('anonymous:load_history', async (data) => {
    try {
      const { limit = 50 } = data;
      
      // Validar límite
      const safeLimit = Math.min(Math.max(limit, 10), 100);
      
      // Obtener mensajes usando función SQL
      const result = await query(
        'SELECT * FROM get_anonymous_chat_history($1)',
        [safeLimit]
      );
      
      // Enviar historial al cliente (orden cronológico)
      socket.emit('anonymous:history', result.rows.reverse());
      
      logger.info('👤 Anonymous chat history loaded', {
        messagesCount: result.rows.length
      });
      
    } catch (error) {
      logger.error('❌ Error loading anonymous chat history', {
        error: error.message
      });
      socket.emit('anonymous:error', { message: 'Error al cargar historial' });
    }
  });
};
