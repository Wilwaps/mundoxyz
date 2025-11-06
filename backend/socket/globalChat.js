/**
 * Global Chat Socket Handler
 * Maneja mensajes del chat global visible en toda la plataforma
 */

const { query } = require('../db');
const logger = require('../utils/logger');

module.exports = (io, socket) => {
  /**
   * Enviar mensaje al chat global
   */
  socket.on('global:chat_message', async (data) => {
    try {
      const { userId, message } = data;
      
      if (!userId || !message || !message.trim()) {
        return socket.emit('global:error', { message: 'Datos inválidos' });
      }
      
      // Validar longitud del mensaje
      if (message.length > 500) {
        return socket.emit('global:error', { message: 'Mensaje muy largo (máximo 500 caracteres)' });
      }
      
      // Obtener username del usuario
      const userResult = await query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return socket.emit('global:error', { message: 'Usuario no encontrado' });
      }
      
      const username = userResult.rows[0].username;
      
      // Guardar mensaje en DB
      await query(
        `INSERT INTO global_chat_messages (user_id, username, message)
         VALUES ($1, $2, $3)`,
        [userId, username, message.trim()]
      );
      
      // Broadcast a TODOS los conectados
      const messageData = {
        userId,
        username,
        message: message.trim(),
        timestamp: new Date()
      };
      
      io.emit('global:chat_message', messageData);
      
      logger.info('🌍 Global chat message sent', {
        userId,
        username,
        messageLength: message.length
      });
      
    } catch (error) {
      logger.error('❌ Error sending global chat message', {
        error: error.message,
        userId: data.userId
      });
      socket.emit('global:error', { message: 'Error al enviar mensaje' });
    }
  });

  /**
   * Cargar historial del chat global
   */
  socket.on('global:load_history', async (data) => {
    try {
      const { limit = 50 } = data;
      
      // Validar límite
      const safeLimit = Math.min(Math.max(limit, 10), 100);
      
      // Obtener mensajes usando función SQL
      const result = await query(
        'SELECT * FROM get_global_chat_history($1)',
        [safeLimit]
      );
      
      // Enviar historial al cliente (orden cronológico)
      socket.emit('global:history', result.rows.reverse());
      
      logger.info('🌍 Global chat history loaded', {
        userId: socket.handshake.auth.userId,
        messagesCount: result.rows.length
      });
      
    } catch (error) {
      logger.error('❌ Error loading global chat history', {
        error: error.message,
        userId: socket.handshake.auth.userId
      });
      socket.emit('global:error', { message: 'Error al cargar historial' });
    }
  });
};
