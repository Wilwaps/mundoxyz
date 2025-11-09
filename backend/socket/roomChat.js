/**
 * Room Chat Socket Handler
 * Maneja mensajes de chat específicos de cada sala (TicTacToe, Bingo, Rifa)
 */

const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Validar que el usuario está en la sala
 */
async function validateUserInRoom(roomType, roomCode, userId) {
  try {
    let validationQuery;
    
    switch (roomType) {
      case 'tictactoe':
        validationQuery = `
          SELECT 1 FROM tictactoe_rooms 
          WHERE code = $1 
          AND (player_x_id = $2 OR player_o_id = $2)
          AND status IN ('waiting', 'playing')
        `;
        break;
        
      case 'bingo':
        validationQuery = `
          SELECT 1 FROM bingo_v2_room_players p
          JOIN bingo_v2_rooms r ON p.room_id = r.id
          WHERE r.code = $1 
          AND p.user_id = $2
        `;
        // REMOVED: AND p.is_connected = TRUE
        // Reason: Race condition - chat joins before bingo:join_room completes
        break;
        
      case 'raffle':
        validationQuery = `
          SELECT 1 FROM raffle_numbers
          WHERE raffle_id = (SELECT id FROM raffles WHERE code = $1)
          AND owner_id = $2
          AND state = 'sold'
        `;
        break;
        
      default:
        return false;
    }
    
    const result = await query(validationQuery, [roomCode, userId]);
    return result.rows.length > 0;
    
  } catch (error) {
    logger.error('❌ Error validating user in room', {
      error: error.message,
      roomType,
      roomCode,
      userId
    });
    return false;
  }
}

module.exports = (io, socket) => {
  /**
   * Unirse al chat de una sala
   */
  socket.on('room:join_chat', async (data) => {
    try {
      const { roomType, roomCode } = data;
      const userId = socket.handshake.auth.userId;
      
      if (!roomType || !roomCode) {
        return socket.emit('room:error', { message: 'Datos de sala inválidos' });
      }
      
      // Validar que el usuario está en la sala
      const isInRoom = await validateUserInRoom(roomType, roomCode, userId);
      
      if (!isInRoom) {
        return socket.emit('room:error', { message: 'No estás en esta sala' });
      }
      
      // Unirse al canal de socket de la sala
      const roomChannel = `${roomType}:${roomCode}`;
      socket.join(roomChannel);
      
      logger.info('🎮 User joined room chat', {
        userId,
        roomType,
        roomCode,
        roomChannel
      });
      
      // Cargar historial automáticamente
      const limit = 50;
      const result = await query(
        'SELECT * FROM get_room_chat_history($1, $2, $3)',
        [roomType, roomCode, limit]
      );
      
      socket.emit('room:history', result.rows.reverse());
      
    } catch (error) {
      logger.error('❌ Error joining room chat', {
        error: error.message,
        roomType: data.roomType,
        roomCode: data.roomCode
      });
      socket.emit('room:error', { message: 'Error al unirse al chat' });
    }
  });

  /**
   * Salir del chat de una sala
   */
  socket.on('room:leave_chat', async (data) => {
    try {
      const { roomType, roomCode } = data;
      
      if (!roomType || !roomCode) {
        return;
      }
      
      const roomChannel = `${roomType}:${roomCode}`;
      socket.leave(roomChannel);
      
      logger.info('🎮 User left room chat', {
        userId: socket.handshake.auth.userId,
        roomType,
        roomCode,
        roomChannel
      });
      
    } catch (error) {
      logger.error('❌ Error leaving room chat', {
        error: error.message,
        roomType: data.roomType,
        roomCode: data.roomCode
      });
    }
  });

  /**
   * Enviar mensaje al chat de sala
   */
  socket.on('room:chat_message', async (data) => {
    try {
      const { roomType, roomCode, userId, message } = data;
      
      if (!roomType || !roomCode || !userId || !message || !message.trim()) {
        return socket.emit('room:error', { message: 'Datos inválidos' });
      }
      
      // Validar longitud del mensaje
      if (message.length > 500) {
        return socket.emit('room:error', { message: 'Mensaje muy largo (máximo 500 caracteres)' });
      }
      
      // Validar que el usuario está en la sala
      const isInRoom = await validateUserInRoom(roomType, roomCode, userId);
      
      if (!isInRoom) {
        return socket.emit('room:error', { message: 'No estás en esta sala' });
      }
      
      // Obtener username del usuario
      const userResult = await query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return socket.emit('room:error', { message: 'Usuario no encontrado' });
      }
      
      const username = userResult.rows[0].username;
      
      // Guardar mensaje en DB
      await query(
        `INSERT INTO room_chat_messages (room_type, room_code, user_id, username, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [roomType, roomCode, userId, username, message.trim()]
      );
      
      // Broadcast solo a la sala específica
      const roomChannel = `${roomType}:${roomCode}`;
      const messageData = {
        userId,
        username,
        message: message.trim(),
        timestamp: new Date()
      };
      
      io.to(roomChannel).emit('room:chat_message', messageData);
      
      logger.info('🎮 Room chat message sent', {
        userId,
        username,
        roomType,
        roomCode,
        messageLength: message.length
      });
      
    } catch (error) {
      logger.error('❌ Error sending room chat message', {
        error: error.message,
        userId: data.userId,
        roomType: data.roomType,
        roomCode: data.roomCode
      });
      socket.emit('room:error', { message: 'Error al enviar mensaje' });
    }
  });
};
