const { query } = require('../db');
const logger = require('../utils/logger');

/**
 * Servicio unificado para gestión de códigos de sala
 * Garantiza unicidad cross-game y proporciona búsqueda centralizada
 */
class RoomCodeService {
  
  /**
   * Genera y reserva un código único para una sala
   * @param {string} gameType - 'tictactoe', 'bingo'
   * @param {string} roomId - ID de la sala en su tabla específica
   * @param {object} client - Cliente de transacción opcional
   * @returns {Promise<string>} Código único de 6 dígitos
   */
  static async reserveCode(gameType, roomId, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;
    
    try {
      logger.info('🔐 Reservando código de sala', { gameType, roomId });
      
      // Validar game_type
      const validTypes = ['tictactoe', 'bingo', 'pool', 'caida', 'raffle'];
      if (!validTypes.includes(gameType)) {
        throw new Error(`Tipo de juego inválido: ${gameType}. Tipos válidos: ${validTypes.join(', ')}`);
      }
      
      // Usar función SQL para reservar código de forma atómica
      const result = await dbQuery(
        'SELECT reserve_room_code($1, $2) as code',
        [gameType, roomId]
      );
      
      const code = result.rows[0].code;
      
      logger.info('✅ Código reservado exitosamente', { 
        code, 
        gameType, 
        roomId 
      });
      
      return code;
      
    } catch (error) {
      logger.error('❌ Error al reservar código de sala', {
        error: error.message,
        gameType,
        roomId,
        stack: error.stack
      });
      throw new Error(`No se pudo reservar código: ${error.message}`);
    }
  }
  
  /**
   * Busca una sala por código
   * @param {string} code - Código de 6 dígitos
   * @returns {Promise<object|null>} {code, game_type, room_id, status} o null
   */
  static async findRoomByCode(code) {
    try {
      logger.info('🔍 Buscando sala por código', { code });
      
      // Validar formato de código
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Código inválido. Debe ser numérico de 6 dígitos');
      }
      
      const result = await query(
        'SELECT * FROM find_room_by_code($1)',
        [code]
      );
      
      if (result.rows.length === 0) {
        logger.warn('⚠️ Sala no encontrada', { code });
        return null;
      }
      
      const room = result.rows[0];
      
      logger.info('✅ Sala encontrada', { 
        code, 
        gameType: room.game_type, 
        roomId: room.room_id 
      });
      
      return room;
      
    } catch (error) {
      logger.error('❌ Error al buscar sala', {
        error: error.message,
        code,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Actualiza el estado de un código de sala
   * @param {string} code - Código de 6 dígitos
   * @param {string} status - 'active', 'finished', 'cancelled'
   * @param {object} client - Cliente de transacción opcional
   */
  static async updateStatus(code, status, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;
    
    try {
      logger.info('🔄 Actualizando estado de código', { code, status });
      
      // Validar status
      const validStatuses = ['active', 'finished', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Estado inválido: ${status}. Estados válidos: ${validStatuses.join(', ')}`);
      }
      
      await dbQuery(
        'SELECT update_room_code_status($1, $2)',
        [code, status]
      );
      
      logger.info('✅ Estado actualizado', { code, status });
      
    } catch (error) {
      logger.error('❌ Error al actualizar estado', {
        error: error.message,
        code,
        status,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Obtiene detalles completos de la sala según su tipo
   * @param {string} code - Código de 6 dígitos
   * @returns {Promise<object>} Detalles completos de la sala con info del juego
   */
  static async getRoomDetails(code) {
    try {
      const roomRef = await this.findRoomByCode(code);
      
      if (!roomRef) {
        return null;
      }
      
      const { game_type, room_id } = roomRef;
      
      logger.info('📋 Obteniendo detalles de sala', { code, game_type, room_id });
      
      let roomDetails = null;
      
      switch (game_type) {
        case 'tictactoe': {
          const tttResult = await query(
            `SELECT 
              r.*,
              u1.username as host_username,
              u2.username as player_o_username
             FROM tictactoe_rooms r
             LEFT JOIN users u1 ON r.host_id = u1.id
             LEFT JOIN users u2 ON r.player_o_id = u2.id
             WHERE r.code = $1`,
            [code]
          );
          roomDetails = tttResult.rows[0];
          break;
        }
        
        case 'bingo': {
          const bingoResult = await query(
            `SELECT 
              r.*,
              u.username as host_username,
              COUNT(DISTINCT p.user_id) as player_count
             FROM bingo_v2_rooms r
             LEFT JOIN users u ON r.host_id = u.id
             LEFT JOIN bingo_v2_room_players p ON r.id = p.room_id
             WHERE r.code = $1
             GROUP BY r.id, u.username`,
            [code]
          );
          roomDetails = bingoResult.rows[0];
          break;
        }

        case 'pool': {
          const poolResult = await query(
            `SELECT r.*, 
              h.username as host_username, 
              o.username as opponent_username 
             FROM pool_rooms r
             LEFT JOIN users h ON r.host_id = h.id
             LEFT JOIN users o ON r.player_opponent_id = o.id
             WHERE r.code = $1`,
            [code]
          );
          roomDetails = poolResult.rows[0];
          break;
        }

        case 'caida': {
          const caidaResult = await query(
            `SELECT r.*, 
              (SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
               FROM users u WHERE u.id::text = ANY(
                 SELECT jsonb_array_elements_text(r.player_ids)
               )) as players
             FROM caida_rooms r
             WHERE r.code = $1`,
            [code]
          );
          roomDetails = caidaResult.rows[0];
          break;
        }
        
        default:
          throw new Error(`Tipo de juego no soportado: ${game_type}`);
      }
      
      if (!roomDetails) {
        logger.warn('⚠️ Sala no encontrada en tabla específica', { code, game_type, room_id });
        return null;
      }
      
      logger.info('✅ Detalles de sala obtenidos', { 
        code, 
        game_type,
        status: roomDetails.status 
      });
      
      return {
        ...roomDetails,
        game_type
      };
      
    } catch (error) {
      logger.error('❌ Error al obtener detalles de sala', {
        error: error.message,
        code,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Verifica si un código está disponible
   * @param {string} code - Código a verificar
   * @returns {Promise<boolean>}
   */
  static async isCodeAvailable(code) {
    try {
      const result = await query(
        'SELECT EXISTS(SELECT 1 FROM room_codes WHERE code = $1) as exists',
        [code]
      );
      
      return !result.rows[0].exists;
      
    } catch (error) {
      logger.error('Error checking code availability', { error: error.message, code });
      throw error;
    }
  }
  
  /**
   * Obtiene estadísticas del sistema de códigos
   * @returns {Promise<object>}
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT 
          game_type,
          status,
          COUNT(*) as count
        FROM room_codes
        GROUP BY game_type, status
        ORDER BY game_type, status
      `);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting room code stats', { error: error.message });
      throw error;
    }
  }
}

module.exports = RoomCodeService;
