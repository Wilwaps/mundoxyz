const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken } = require('../middleware/auth');
const BingoService = require('../services/bingoService');
const logger = require('../utils/logger');

// ============================================
// ENDPOINTS DE BINGO
// ============================================

/**
 * GET /api/bingo/rooms/public
 * Listar salas públicas disponibles
 */
router.get('/rooms/public', async (req, res) => {
  try {
    const { currency, mode, status = 'lobby' } = req.query;
    
    let queryStr = `
      SELECT 
        r.id,
        r.code,
        r.host_id,
        r.room_name,
        r.room_type,
        r.currency,
        r.numbers_mode,
        r.victory_mode,
        r.card_cost,
        r.max_players,
        r.max_cards_per_player,
        r.password,
        r.pot_total,
        r.status,
        r.created_at,
        r.last_activity,
        u.username as host_name,
        COUNT(DISTINCT p.user_id) as player_count,
        SUM(p.cards_owned) as total_cards
      FROM bingo_rooms r
      JOIN users u ON u.id = r.host_id
      LEFT JOIN bingo_room_players p ON p.room_id = r.id
      WHERE r.room_type = 'public' AND r.status = $1
    `;
    
    const params = [status];
    
    if (currency) {
      queryStr += ` AND r.currency = $${params.length + 1}`;
      params.push(currency);
    }
    
    if (mode) {
      queryStr += ` AND r.numbers_mode = $${params.length + 1}`;
      params.push(parseInt(mode));
    }
    
    queryStr += `
      GROUP BY r.id, u.username
      ORDER BY r.created_at DESC
      LIMIT 50
    `;
    
    const result = await query(queryStr, params);
    
    res.json({
      success: true,
      rooms: result.rows.map(room => ({
        ...room,
        player_count: parseInt(room.player_count || 0),
        total_cards: parseInt(room.total_cards || 0)
      }))
    });
    
  } catch (error) {
    logger.error('Error obteniendo salas de bingo:', error);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

/**
 * POST /api/bingo/rooms
 * Crear una nueva sala de bingo
 */
router.post('/rooms', verifyToken, async (req, res) => {
  try {
    const {
      roomName,
      roomType,
      currency,
      numbersMode,
      victoryMode,
      cardCost,
      maxPlayers,
      maxCardsPerPlayer,
      password
    } = req.body;
    
    // Validaciones
    if (!['public', 'private'].includes(roomType)) {
      return res.status(400).json({ error: 'Tipo de sala inválido' });
    }
    
    if (!['coins', 'fires'].includes(currency)) {
      return res.status(400).json({ error: 'Moneda inválida' });
    }
    
    if (![75, 90].includes(numbersMode)) {
      return res.status(400).json({ error: 'Modo de números inválido' });
    }
    
    if (!['line', 'corners', 'full'].includes(victoryMode)) {
      return res.status(400).json({ error: 'Modo de victoria inválido' });
    }
    
    if (cardCost <= 0) {
      return res.status(400).json({ error: 'El costo del cartón debe ser mayor a 0' });
    }
    
    const result = await BingoService.createRoom(req.user.id, {
      roomName,
      roomType,
      currency,
      numbersMode,
      victoryMode,
      cardCost,
      maxPlayers: maxPlayers || 30,
      maxCardsPerPlayer: maxCardsPerPlayer || 10,
      password: roomType === 'private' ? password : null
    });
    
    // Emitir evento a WebSocket si está disponible
    if (req.io) {
      req.io.to('bingo-lobby').emit('room:created', {
        room: result.room,
        code: result.code
      });
    }
    
    logger.info('Sala de bingo creada vía API', {
      userId: req.user.id,
      roomCode: result.code
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error creando sala de bingo:', error);
    res.status(error.message.includes('Saldo insuficiente') ? 400 : 500)
       .json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/join
 * Unirse a una sala y comprar cartones
 */
router.post('/rooms/:code/join', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { numberOfCards, password } = req.body;
    
    if (!numberOfCards || numberOfCards < 1) {
      return res.status(400).json({ error: 'Debes comprar al menos 1 cartón' });
    }
    
    const result = await BingoService.joinRoom(
      code,
      req.user.id,
      numberOfCards,
      password
    );
    
    // Obtener info de la sala para WebSocket
    const roomInfo = await query(
      `SELECT id, host_id FROM bingo_rooms WHERE bingo_rooms.code = $1`,
      [code]
    );
    
    if (req.io && roomInfo.rows.length) {
      req.io.to(`bingo:${code}`).emit('player:joined', {
        userId: req.user.id,
        username: req.user.username,
        cardsOwned: numberOfCards
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error uniéndose a sala de bingo:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/ready
 * Marcar como listo
 */
router.post('/rooms/:code/ready', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Obtener ID de la sala
    const roomResult = await query(
      `SELECT id FROM bingo_rooms WHERE bingo_rooms.code = $1`,
      [code]
    );
    
    if (!roomResult.rows.length) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const roomId = roomResult.rows[0].id;
    const result = await BingoService.markPlayerReady(roomId, req.user.id);
    
    // Emitir evento
    if (req.io) {
      req.io.to(`bingo:${code}`).emit('player:ready', {
        userId: req.user.id,
        username: req.user.username,
        allReady: result.allReady,
        readyCount: result.readyPlayers,
        totalCount: result.totalPlayers
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error marcando jugador como listo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/start
 * Iniciar partida (solo host)
 */
router.post('/rooms/:code/start', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Obtener info de la sala
    const roomResult = await query(
      `SELECT id, host_id FROM bingo_rooms WHERE bingo_rooms.code = $1`,
      [code]
    );
    
    if (!roomResult.rows.length) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const room = roomResult.rows[0];
    
    if (room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el host puede iniciar la partida' });
    }
    
    const result = await BingoService.startGame(room.id, req.user.id);
    
    // Emitir evento
    if (req.io) {
      req.io.to(`bingo:${code}`).emit('game:started', {
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error iniciando partida de bingo:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/draw
 * Cantar un número (solo host)
 */
router.post('/rooms/:code/draw', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Obtener info de la sala
    const roomResult = await query(
      `SELECT id, host_id FROM bingo_rooms WHERE bingo_rooms.code = $1`,
      [code]
    );
    
    if (!roomResult.rows.length) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const room = roomResult.rows[0];
    
    if (room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el host puede cantar números' });
    }
    
    const result = await BingoService.drawNumber(room.id, req.user.id);
    
    // Emitir evento
    if (req.io) {
      req.io.to(`bingo:${code}`).emit('number:drawn', {
        number: result.drawnNumber,
        sequence: result.sequenceNumber,
        totalDrawn: result.totalDrawn,
        remainingNumbers: result.remainingNumbers
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error cantando número:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/card/:cardId/mark
 * Marcar un número en el cartón
 */
router.post('/rooms/:code/card/:cardId/mark', verifyToken, async (req, res) => {
  try {
    const { code, cardId } = req.params;
    const { number } = req.body;
    
    if (!number) {
      return res.status(400).json({ error: 'Número requerido' });
    }
    
    const result = await BingoService.markNumber(cardId, number, req.user.id);
    
    // Si hay patrón ganador, notificar al jugador
    if (result.hasWinningPattern && req.io) {
      req.io.to(`user:${req.user.id}`).emit('pattern:complete', {
        cardId,
        markedNumbers: result.markedNumbers
      });
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error marcando número:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/card/:cardId/call-bingo
 * Cantar bingo (reclamar victoria)
 */
router.post('/rooms/:code/card/:cardId/call-bingo', verifyToken, async (req, res) => {
  try {
    const { code, cardId } = req.params;
    
    const result = await BingoService.callBingo(cardId, req.user.id);
    
    if (result.isWinner && req.io) {
      // Notificar a toda la sala
      req.io.to(`bingo:${code}`).emit('bingo:called', {
        userId: req.user.id,
        username: req.user.username,
        cardId,
        isFirstWinner: result.isFirstWinner
      });
      
      // Si la partida terminó, emitir evento de finalización
      const roomStatus = await query(
        `SELECT status FROM bingo_rooms WHERE bingo_rooms.code = $1`,
        [code]
      );
      
      if (roomStatus.rows[0].status === 'finished') {
        // Obtener información de ganadores y premios
        const winnersInfo = await query(`
          SELECT 
            w.user_id,
            u.username,
            w.prize_amount
          FROM bingo_winners w
          JOIN users u ON u.id = w.user_id
          JOIN bingo_rooms r ON r.id = w.room_id
          WHERE r.code = $1 AND w.validated = true
        `, [code]);
        
        req.io.to(`bingo:${code}`).emit('game:finished', {
          winners: winnersInfo.rows,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error cantando bingo:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/bingo/rooms/:code
 * Obtener estado completo de una sala
 */
router.get('/rooms/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Información de la sala
    const roomResult = await query(`
      SELECT 
        r.id,
        r.code,
        r.host_id,
        r.room_name,
        r.room_type,
        r.currency,
        r.numbers_mode,
        r.victory_mode,
        r.card_cost,
        r.max_players,
        r.max_cards_per_player,
        r.password,
        r.pot_total,
        r.status,
        r.created_at,
        r.last_activity,
        u.username as host_name
      FROM bingo_rooms r
      JOIN users u ON u.id = r.host_id
      WHERE r.code = $1
    `, [code]);
    
    if (!roomResult.rows.length) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const room = roomResult.rows[0];
    
    // Jugadores con información completa
    const playersResult = await query(`
      SELECT 
        p.user_id,
        p.cards_owned,
        p.is_host,
        p.joined_at,
        p.ready_at,
        u.username,
        u.avatar_url
      FROM bingo_room_players p
      JOIN users u ON u.id = p.user_id
      WHERE p.room_id = $1
      ORDER BY p.joined_at
    `, [room.id]);
    
    // Formatear jugadores con propiedades esperadas por el frontend
    const players = playersResult.rows.map(p => ({
      user_id: p.user_id,
      username: p.username,
      avatar_url: p.avatar_url,
      cards_count: p.cards_owned || 0,
      is_ready: p.ready_at !== null,
      is_host: p.is_host,
      joined_at: p.joined_at
    }));
    
    // Cartones del usuario actual
    const myCardsResult = await query(`
      SELECT 
        id,
        card_number,
        numbers,
        marked_numbers
      FROM bingo_cards 
      WHERE room_id = $1 AND owner_id = $2
      ORDER BY card_number
    `, [room.id, req.user.id]);
    
    // Formatear cartones
    const userCards = myCardsResult.rows.map(card => ({
      id: card.id,
      card_number: card.card_number,
      numbers: card.numbers,
      marked_numbers: card.marked_numbers || []
    }));
    
    // Números cantados
    const drawnNumbersResult = await query(`
      SELECT drawn_number, sequence_number
      FROM bingo_drawn_numbers 
      WHERE room_id = $1
      ORDER BY sequence_number
    `, [room.id]);
    
    // Ganadores (si hay)
    const winnersResult = await query(`
      SELECT 
        w.*,
        u.username
      FROM bingo_winners w
      JOIN users u ON u.id = w.user_id
      WHERE w.room_id = $1 AND w.validated = true
    `, [room.id]);
    
    // Calcular pozo total actualizado
    const totalPot = parseFloat(room.pot_total) || 0;
    
    // Calcular jugadores actuales
    const currentPlayers = players.length;
    
    res.json({
      success: true,
      room: {
        ...room,
        host_username: room.host_name,
        players: players,
        user_cards: userCards,  // Nombre correcto esperado por frontend
        myCards: userCards,     // Alias por compatibilidad
        cards: userCards,       // Otro alias
        current_players: currentPlayers,
        total_pot: totalPot,
        drawnNumbers: drawnNumbersResult.rows.map(r => r.drawn_number),
        drawnSequence: drawnNumbersResult.rows,
        winners: winnersResult.rows,
        isHost: room.host_id === req.user.id,
        amIReady: players.find(p => p.user_id === req.user.id)?.is_ready || false
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo estado de sala:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bingo/rooms/:code/leave
 * Salir de una sala (antes de iniciar)
 */
router.post('/rooms/:code/leave', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Verificar que la sala está en lobby
    const roomResult = await query(`
      SELECT id, status, currency, card_cost
      FROM bingo_rooms 
      WHERE bingo_rooms.code = $1 AND status = 'lobby'
    `, [code]);
    
    if (!roomResult.rows.length) {
      return res.status(400).json({ error: 'No puedes salir de esta sala' });
    }
    
    const room = roomResult.rows[0];
    
    // Obtener info del jugador
    const playerResult = await query(`
      SELECT cards_owned 
      FROM bingo_room_players 
      WHERE room_id = $1 AND user_id = $2
    `, [room.id, req.user.id]);
    
    if (!playerResult.rows.length) {
      return res.status(404).json({ error: 'No estás en esta sala' });
    }
    
    const player = playerResult.rows[0];
    const refundAmount = parseFloat(room.card_cost) * player.cards_owned;
    
    const client = await query.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Eliminar cartones
      await client.query(
        `DELETE FROM bingo_cards 
         WHERE room_id = $1 AND owner_id = $2`,
        [room.id, req.user.id]
      );
      
      // Eliminar jugador
      await client.query(
        `DELETE FROM bingo_room_players 
         WHERE room_id = $1 AND user_id = $2`,
        [room.id, req.user.id]
      );
      
      // Devolver dinero
      if (refundAmount > 0) {
        await client.query(
          `UPDATE wallets 
           SET ${room.currency}_balance = ${room.currency}_balance + $1 
           WHERE user_id = $2`,
          [refundAmount, req.user.id]
        );
        
        // Actualizar pozo
        await client.query(
          `UPDATE bingo_rooms 
           SET pot_total = pot_total - $1 
           WHERE id = $2`,
          [refundAmount, room.id]
        );
        
        // Registrar transacción
        await client.query(
          `INSERT INTO bingo_transactions (
            room_id, user_id, type, amount, currency, description
          ) VALUES ($1, $2, 'refund', $3, $4, $5)`,
          [
            room.id,
            req.user.id,
            refundAmount,
            room.currency,
            'Devolución por salir de la sala'
          ]
        );
      }
      
      await client.query('COMMIT');
      
      // Emitir evento
      if (req.io) {
        req.io.to(`bingo:${code}`).emit('player:left', {
          userId: req.user.id,
          username: req.user.username
        });
      }
      
      res.json({
        success: true,
        refunded: refundAmount
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error saliendo de sala:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bingo/my-active-room
 * Obtener sala activa del usuario
 */
router.get('/my-active-room', verifyToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        r.id,
        r.code,
        r.status,
        r.room_name,
        r.room_type,
        r.currency,
        r.numbers_mode,
        r.victory_mode,
        r.card_cost,
        r.max_players,
        r.max_cards_per_player,
        r.password,
        r.pot_total,
        r.created_at,
        r.last_activity
      FROM bingo_rooms r
      JOIN bingo_room_players p ON p.room_id = r.id
      WHERE p.user_id = $1 
      AND r.status IN ('lobby', 'ready', 'playing')
      LIMIT 1
    `, [req.user.id]);
    
    res.json({
      hasActiveRoom: result.rows.length > 0,
      room: result.rows[0] || null
    });
    
  } catch (error) {
    logger.error('Error obteniendo sala activa:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
