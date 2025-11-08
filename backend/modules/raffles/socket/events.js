/**
 * Sistema de Rifas V2 - WebSocket Events Handler
 * Manejo de eventos en tiempo real para rifas
 */

const { query } = require('../../../db/db');
const logger = require('../../../config/logger');

class RaffleSocketHandler {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // Map<raffleCode, Set<userId>>
  }

  /**
   * Inicializar handler de eventos para un socket
   */
  handleConnection(socket, userId) {
    logger.info(`[RaffleSocket] User ${userId} connected`);

    // Unirse a sala de rifa
    socket.on('raffle:join', async (data) => {
      await this.handleJoinRaffle(socket, userId, data);
    });

    // Salir de sala de rifa
    socket.on('raffle:leave', async (data) => {
      await this.handleLeaveRaffle(socket, userId, data);
    });

    // Reservar número
    socket.on('raffle:reserve_number', async (data) => {
      await this.handleReserveNumber(socket, userId, data);
    });

    // Comprar número
    socket.on('raffle:purchase_number', async (data) => {
      await this.handlePurchaseNumber(socket, userId, data);
    });

    // Liberar número
    socket.on('raffle:release_number', async (data) => {
      await this.handleReleaseNumber(socket, userId, data);
    });

    // Solicitar actualización de estado
    socket.on('raffle:request_update', async (data) => {
      await this.handleRequestUpdate(socket, userId, data);
    });

    // Desconexión
    socket.on('disconnect', () => {
      this.handleDisconnect(socket, userId);
    });
  }

  /**
   * Manejar unión a sala de rifa
   */
  async handleJoinRaffle(socket, userId, { raffleCode }) {
    try {
      if (!raffleCode) {
        socket.emit('raffle:error', { message: 'Código de rifa requerido' });
        return;
      }

      // Verificar que la rifa existe
      const raffleResult = await query(
        'SELECT id, status FROM raffles WHERE code = $1',
        [raffleCode]
      );

      if (raffleResult.rows.length === 0) {
        socket.emit('raffle:error', { message: 'Rifa no encontrada' });
        return;
      }

      const raffle = raffleResult.rows[0];
      
      // Unir socket a sala
      const roomName = `raffle:${raffleCode}`;
      socket.join(roomName);
      
      // Registrar usuario en sala
      if (!this.rooms.has(raffleCode)) {
        this.rooms.set(raffleCode, new Set());
      }
      this.rooms.get(raffleCode).add(userId);

      logger.info(`[RaffleSocket] User ${userId} joined raffle ${raffleCode}`);

      // Notificar a la sala
      this.io.to(roomName).emit('raffle:user_joined', {
        userId,
        raffleCode,
        totalUsers: this.rooms.get(raffleCode).size
      });

      // Enviar estado actual al usuario
      await this.sendRaffleState(socket, raffleCode);

    } catch (error) {
      logger.error('[RaffleSocket] Error joining raffle:', error);
      socket.emit('raffle:error', { message: 'Error al unirse a la rifa' });
    }
  }

  /**
   * Manejar salida de sala de rifa
   */
  async handleLeaveRaffle(socket, userId, { raffleCode }) {
    try {
      const roomName = `raffle:${raffleCode}`;
      socket.leave(roomName);

      // Remover usuario de sala
      if (this.rooms.has(raffleCode)) {
        this.rooms.get(raffleCode).delete(userId);
        
        if (this.rooms.get(raffleCode).size === 0) {
          this.rooms.delete(raffleCode);
        }
      }

      logger.info(`[RaffleSocket] User ${userId} left raffle ${raffleCode}`);

      // Notificar a la sala
      this.io.to(roomName).emit('raffle:user_left', {
        userId,
        raffleCode,
        totalUsers: this.rooms.get(raffleCode)?.size || 0
      });

    } catch (error) {
      logger.error('[RaffleSocket] Error leaving raffle:', error);
    }
  }

  /**
   * Manejar reserva de número
   */
  async handleReserveNumber(socket, userId, { raffleCode, numberIdx }) {
    try {
      const roomName = `raffle:${raffleCode}`;
      
      // Emitir actualización a todos en la sala
      this.io.to(roomName).emit('raffle:number_reserved', {
        raffleCode,
        numberIdx,
        userId,
        timestamp: new Date().toISOString()
      });

      logger.info(`[RaffleSocket] Number ${numberIdx} reserved by ${userId} in raffle ${raffleCode}`);

    } catch (error) {
      logger.error('[RaffleSocket] Error reserving number:', error);
      socket.emit('raffle:error', { message: 'Error al reservar número' });
    }
  }

  /**
   * Manejar compra de número
   */
  async handlePurchaseNumber(socket, userId, { raffleCode, numberIdx }) {
    try {
      const roomName = `raffle:${raffleCode}`;
      
      // Obtener información actualizada de la rifa
      const statsResult = await query(`
        SELECT 
          COUNT(DISTINCT rn.owner_id) as participants,
          r.pot_fires,
          r.pot_coins,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as sold_numbers
        FROM raffles r
        LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
        WHERE r.code = $1
        GROUP BY r.id, r.pot_fires, r.pot_coins
      `, [raffleCode]);

      const stats = statsResult.rows[0] || {
        participants: 0,
        pot_fires: 0,
        pot_coins: 0,
        sold_numbers: 0
      };

      // Emitir actualización a todos en la sala
      this.io.to(roomName).emit('raffle:number_purchased', {
        raffleCode,
        numberIdx,
        userId,
        stats,
        timestamp: new Date().toISOString()
      });

      logger.info(`[RaffleSocket] Number ${numberIdx} purchased by ${userId} in raffle ${raffleCode}`);

    } catch (error) {
      logger.error('[RaffleSocket] Error purchasing number:', error);
      socket.emit('raffle:error', { message: 'Error al comprar número' });
    }
  }

  /**
   * Manejar liberación de número
   */
  async handleReleaseNumber(socket, userId, { raffleCode, numberIdx }) {
    try {
      const roomName = `raffle:${raffleCode}`;
      
      // Emitir actualización a todos en la sala
      this.io.to(roomName).emit('raffle:number_released', {
        raffleCode,
        numberIdx,
        timestamp: new Date().toISOString()
      });

      logger.info(`[RaffleSocket] Number ${numberIdx} released in raffle ${raffleCode}`);

    } catch (error) {
      logger.error('[RaffleSocket] Error releasing number:', error);
      socket.emit('raffle:error', { message: 'Error al liberar número' });
    }
  }

  /**
   * Manejar solicitud de actualización
   */
  async handleRequestUpdate(socket, userId, { raffleCode }) {
    try {
      await this.sendRaffleState(socket, raffleCode);
    } catch (error) {
      logger.error('[RaffleSocket] Error sending update:', error);
      socket.emit('raffle:error', { message: 'Error al obtener actualización' });
    }
  }

  /**
   * Enviar estado actual de la rifa
   */
  async sendRaffleState(socket, raffleCode) {
    try {
      // Obtener información de la rifa
      const raffleResult = await query(`
        SELECT 
          r.*,
          COUNT(DISTINCT rn.owner_id) as participants,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as sold_numbers,
          COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as reserved_numbers
        FROM raffles r
        LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
        WHERE r.code = $1
        GROUP BY r.id
      `, [raffleCode]);

      if (raffleResult.rows.length === 0) {
        socket.emit('raffle:error', { message: 'Rifa no encontrada' });
        return;
      }

      const raffle = raffleResult.rows[0];

      // Obtener números
      const numbersResult = await query(`
        SELECT 
          rn.idx,
          rn.state,
          rn.owner_id,
          u.username as owner_username
        FROM raffle_numbers rn
        LEFT JOIN users u ON rn.owner_id = u.id
        WHERE rn.raffle_id = $1
        ORDER BY rn.idx
      `, [raffle.id]);

      socket.emit('raffle:state_update', {
        raffle: {
          ...raffle,
          participants: parseInt(raffle.participants),
          soldNumbers: parseInt(raffle.sold_numbers),
          reservedNumbers: parseInt(raffle.reserved_numbers)
        },
        numbers: numbersResult.rows,
        connectedUsers: this.rooms.get(raffleCode)?.size || 1
      });

    } catch (error) {
      logger.error('[RaffleSocket] Error sending raffle state:', error);
      throw error;
    }
  }

  /**
   * Manejar desconexión
   */
  handleDisconnect(socket, userId) {
    // Limpiar usuario de todas las salas
    for (const [raffleCode, users] of this.rooms) {
      if (users.has(userId)) {
        users.delete(userId);
        
        const roomName = `raffle:${raffleCode}`;
        this.io.to(roomName).emit('raffle:user_left', {
          userId,
          raffleCode,
          totalUsers: users.size
        });

        if (users.size === 0) {
          this.rooms.delete(raffleCode);
        }
      }
    }

    logger.info(`[RaffleSocket] User ${userId} disconnected`);
  }

  /**
   * Notificar cambio de estado de rifa
   */
  notifyRaffleStatusChange(raffleCode, newStatus) {
    const roomName = `raffle:${raffleCode}`;
    this.io.to(roomName).emit('raffle:status_changed', {
      raffleCode,
      newStatus,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notificar ganador de rifa
   */
  notifyRaffleWinner(raffleCode, winnerId, winningNumber) {
    const roomName = `raffle:${raffleCode}`;
    this.io.to(roomName).emit('raffle:winner_drawn', {
      raffleCode,
      winnerId,
      winningNumber,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = RaffleSocketHandler;
