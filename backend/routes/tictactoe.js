const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { 
  generateRoomCode, 
  isValidMove, 
  checkWinner, 
  distributePrizes,
  awardGameXP 
} = require('../utils/tictactoe');

// Socket IO instance (will be set from server)
let io = null;

// Set socket IO instance
router.setIO = (socketIO) => {
  io = socketIO;
};

// POST /api/tictactoe/create - Crear nueva sala
router.post('/create', verifyToken, async (req, res) => {
  try {
    const {
      mode,
      bet_amount,
      visibility = 'public'
    } = req.body;
    
    const userId = req.user.id;
    
    // Validar modo
    if (!['coins', 'fires'].includes(mode)) {
      return res.status(400).json({ error: 'Modo debe ser "coins" o "fires"' });
    }
    
    // Validar apuesta según modo
    let betAmount = parseFloat(bet_amount);
    
    if (mode === 'coins') {
      if (isNaN(betAmount) || betAmount < 1 || betAmount > 1000) {
        return res.status(400).json({ error: 'Apuesta coins debe ser entre 1-1000' });
      }
    } else if (mode === 'fires') {
      betAmount = 1; // Fijo en 1
    }
    
    // Validar visibilidad
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibilidad debe ser "public" o "private"' });
    }
    
    const result = await transaction(async (client) => {
      // Verificar balance
      const walletResult = await client.query(
        'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet no encontrado');
      }
      
      const balance = mode === 'fires' 
        ? parseFloat(walletResult.rows[0].fires_balance)
        : parseFloat(walletResult.rows[0].coins_balance);
      
      if (balance < betAmount) {
        throw new Error(`Balance insuficiente. Tienes ${balance} ${mode}, necesitas ${betAmount}`);
      }
      
      // Deducir apuesta del host
      await client.query(
        `UPDATE wallets 
         SET ${mode === 'fires' ? 'fires_balance' : 'coins_balance'} = 
             ${mode === 'fires' ? 'fires_balance' : 'coins_balance'} - $1,
             ${mode === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} = 
             ${mode === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [betAmount, userId]
      );
      
      // Registrar transacción
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_bet', $2, $3, $4, $5,
           'Apuesta La Vieja'
         )`,
        [userId, mode, betAmount, balance, balance - betAmount]
      );
      
      // Generar código único
      let code;
      let attempts = 0;
      do {
        code = generateRoomCode();
        const existing = await client.query(
          'SELECT 1 FROM tictactoe_rooms WHERE code = $1',
          [code]
        );
        if (existing.rows.length === 0) break;
        attempts++;
      } while (attempts < 10);
      
      if (attempts >= 10) {
        throw new Error('No se pudo generar código único');
      }
      
      // Crear sala
      const roomResult = await client.query(
        `INSERT INTO tictactoe_rooms 
         (id, code, host_id, mode, bet_amount, visibility, player_x_id, 
          pot_coins, pot_fires, status, current_turn)
         VALUES ($1, $2, $3, $4, $5, $6, $3, $7, $8, 'waiting', 'X')
         RETURNING *`,
        [
          uuidv4(),
          code,
          userId,
          mode,
          betAmount,
          visibility,
          mode === 'coins' ? betAmount : 0,
          mode === 'fires' ? betAmount : 0
        ]
      );
      
      const room = roomResult.rows[0];
      
      logger.info('Tictactoe room created', { 
        roomId: room.id, 
        code: room.code,
        host: req.user.username,
        mode,
        betAmount
      });
      
      return room;
    });
    
    res.json({
      success: true,
      room: {
        id: result.id,
        code: result.code,
        mode: result.mode,
        bet_amount: result.bet_amount,
        visibility: result.visibility,
        status: result.status
      }
    });
    
  } catch (error) {
    logger.error('Error creating tictactoe room:', error);
    res.status(400).json({ error: error.message || 'Failed to create room' });
  }
});

// POST /api/tictactoe/join/:code - Unirse a sala
router.post('/join/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      // Obtener sala
      const roomResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      // Validaciones
      if (room.status !== 'waiting') {
        throw new Error('Sala no está aceptando jugadores');
      }
      
      if (room.player_o_id) {
        throw new Error('Sala ya está llena');
      }
      
      if (room.player_x_id === userId) {
        throw new Error('Ya eres el host de esta sala');
      }
      
      // Verificar balance
      const walletResult = await client.query(
        'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
        [userId]
      );
      
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet no encontrado');
      }
      
      const balance = room.mode === 'fires'
        ? parseFloat(walletResult.rows[0].fires_balance)
        : parseFloat(walletResult.rows[0].coins_balance);
      
      const betAmount = parseFloat(room.bet_amount);
      
      if (balance < betAmount) {
        throw new Error(`Balance insuficiente. Tienes ${balance} ${room.mode}, necesitas ${betAmount}`);
      }
      
      // Deducir apuesta
      await client.query(
        `UPDATE wallets 
         SET ${room.mode === 'fires' ? 'fires_balance' : 'coins_balance'} = 
             ${room.mode === 'fires' ? 'fires_balance' : 'coins_balance'} - $1,
             ${room.mode === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} = 
             ${room.mode === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [betAmount, userId]
      );
      
      // Registrar transacción
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_id)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_bet', $2, $3, $4, $5,
           'Apuesta La Vieja - Sala ' || $6,
           $7
         )`,
        [userId, room.mode, betAmount, balance, balance - betAmount, code, room.id]
      );
      
      // Actualizar sala: agregar jugador O y pot
      await client.query(
        `UPDATE tictactoe_rooms 
         SET player_o_id = $1,
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} = 
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} + $2,
             status = 'ready'
         WHERE id = $3`,
        [userId, betAmount, room.id]
      );
      
      logger.info('Player joined tictactoe room', { 
        roomId: room.id, 
        code,
        player: req.user.username
      });
      
      // Emit socket event
      if (io) {
        io.to(`tictactoe:${code}`).emit('room:player-joined', {
          roomCode: code,
          playerId: userId,
          username: req.user.username
        });
      }
      
      return { success: true };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error joining tictactoe room:', error);
    res.status(400).json({ error: error.message || 'Failed to join room' });
  }
});

// POST /api/tictactoe/room/:code/ready - Marcar como listo
router.post('/room/:code/ready', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      const roomResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      if (room.status !== 'ready') {
        throw new Error('Sala no está lista para comenzar');
      }
      
      // Marcar jugador como listo
      const isPlayerX = userId === room.player_x_id;
      const isPlayerO = userId === room.player_o_id;
      
      if (!isPlayerX && !isPlayerO) {
        throw new Error('No eres parte de esta sala');
      }
      
      if (isPlayerX) {
        await client.query(
          'UPDATE tictactoe_rooms SET player_x_ready = TRUE WHERE id = $1',
          [room.id]
        );
      } else {
        await client.query(
          'UPDATE tictactoe_rooms SET player_o_ready = TRUE WHERE id = $1',
          [room.id]
        );
      }
      
      // Verificar si ambos están listos
      const updatedResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE id = $1',
        [room.id]
      );
      
      const updatedRoom = updatedResult.rows[0];
      
      if (updatedRoom.player_x_ready && updatedRoom.player_o_ready) {
        // Iniciar juego
        await client.query(
          `UPDATE tictactoe_rooms 
           SET status = 'playing', 
               started_at = NOW(),
               last_move_at = NOW()
           WHERE id = $1`,
          [room.id]
        );
        
        logger.info('Tictactoe game started', { roomId: room.id, code });
        
        // Emit socket event for game start
        if (io) {
          io.to(`tictactoe:${code}`).emit('room:game-started', {
            roomCode: code
          });
        }
        
        return { success: true, gameStarted: true };
      }
      
      return { success: true, gameStarted: false };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error marking ready:', error);
    res.status(400).json({ error: error.message || 'Failed to mark ready' });
  }
});

// POST /api/tictactoe/room/:code/move - Hacer movimiento
router.post('/room/:code/move', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { row, col } = req.body;
    const userId = req.user.id;
    
    if (row === undefined || col === undefined) {
      return res.status(400).json({ error: 'row y col requeridos' });
    }
    
    const result = await transaction(async (client) => {
      const roomResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      // Validar estado
      if (room.status !== 'playing') {
        throw new Error('El juego no está en curso');
      }
      
      // Determinar símbolo del jugador
      const isPlayerX = userId === room.player_x_id;
      const isPlayerO = userId === room.player_o_id;
      
      if (!isPlayerX && !isPlayerO) {
        throw new Error('No eres parte de esta sala');
      }
      
      const playerSymbol = isPlayerX ? 'X' : 'O';
      
      // Verificar turno
      if (room.current_turn !== playerSymbol) {
        throw new Error('No es tu turno');
      }
      
      // Verificar timer (15 segundos)
      const timeSinceLastMove = Date.now() - new Date(room.last_move_at).getTime();
      if (timeSinceLastMove > 15000) {
        // Timeout - el jugador actual pierde
        const winnerId = isPlayerX ? room.player_o_id : room.player_x_id;
        const winnerSymbol = isPlayerX ? 'O' : 'X';
        
        await client.query(
          `UPDATE tictactoe_rooms 
           SET status = 'finished',
               winner_id = $1,
               winner_symbol = $2,
               finished_at = NOW()
           WHERE id = $3`,
          [winnerId, winnerSymbol, room.id]
        );
        
        // Distribuir premios y XP
        const finishedRoom = (await client.query('SELECT * FROM tictactoe_rooms WHERE id = $1', [room.id])).rows[0];
        await distributePrizes(finishedRoom, client.query.bind(client));
        
        const { awardXpBatch } = require('../utils/xp');
        await awardGameXP(finishedRoom, awardXpBatch);
        
        await client.query(
          'UPDATE tictactoe_rooms SET xp_awarded = TRUE WHERE id = $1',
          [room.id]
        );
        
        return {
          gameOver: true,
          reason: 'timeout',
          winner: winnerSymbol,
          winnerId
        };
      }
      
      // Validar movimiento
      const board = room.board;
      
      if (!isValidMove(board, row, col)) {
        throw new Error('Movimiento inválido');
      }
      
      // Aplicar movimiento
      board[row][col] = playerSymbol;
      
      // Obtener número de movimiento
      const moveCount = (await client.query(
        'SELECT COUNT(*) as count FROM tictactoe_moves WHERE room_id = $1',
        [room.id]
      )).rows[0].count;
      
      const moveNumber = parseInt(moveCount) + 1;
      
      // Registrar movimiento
      await client.query(
        `INSERT INTO tictactoe_moves 
         (room_id, player_id, symbol, row, col, move_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [room.id, userId, playerSymbol, row, col, moveNumber]
      );
      
      // Verificar ganador o empate
      const winResult = checkWinner(board);
      
      if (winResult) {
        // Juego terminado
        const isWin = winResult.winner !== null;
        const winnerId = isWin ? (winResult.winner === 'X' ? room.player_x_id : room.player_o_id) : null;
        
        await client.query(
          `UPDATE tictactoe_rooms 
           SET board = $1,
               status = 'finished',
               winner_id = $2,
               winner_symbol = $3,
               winning_line = $4,
               is_draw = $5,
               finished_at = NOW()
           WHERE id = $6`,
          [
            JSON.stringify(board),
            winnerId,
            winResult.winner,
            winResult.line ? JSON.stringify(winResult.line) : null,
            winResult.isDraw || false,
            room.id
          ]
        );
        
        // Obtener sala actualizada
        const finishedRoom = (await client.query('SELECT * FROM tictactoe_rooms WHERE id = $1', [room.id])).rows[0];
        
        // Distribuir premios
        await distributePrizes(finishedRoom, client.query.bind(client));
        
        // Otorgar XP
        const { awardXpBatch } = require('../utils/xp');
        await awardGameXP(finishedRoom, awardXpBatch);
        
        await client.query(
          'UPDATE tictactoe_rooms SET xp_awarded = TRUE WHERE id = $1',
          [room.id]
        );
        
        logger.info('Tictactoe game finished', { 
          roomId: room.id, 
          winner: winResult.winner,
          isDraw: winResult.isDraw
        });
        
        // Emit socket event for game over
        if (io) {
          io.to(`tictactoe:${code}`).emit('room:game-over', {
            roomCode: code,
            winner: winResult.winner,
            winnerId,
            isDraw: winResult.isDraw,
            winningLine: winResult.line
          });
        }
        
        return {
          gameOver: true,
          winner: winResult.winner,
          winnerId,
          isDraw: winResult.isDraw,
          winningLine: winResult.line,
          board
        };
      }
      
      // Cambiar turno
      const nextTurn = playerSymbol === 'X' ? 'O' : 'X';
      
      await client.query(
        `UPDATE tictactoe_rooms 
         SET board = $1,
             current_turn = $2,
             last_move_at = NOW(),
             time_left_seconds = 15
         WHERE id = $3`,
        [JSON.stringify(board), nextTurn, room.id]
      );
      
      return {
        success: true,
        board,
        nextTurn,
        moveNumber
      };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error making move:', error);
    res.status(400).json({ error: error.message || 'Failed to make move' });
  }
});

// POST /api/tictactoe/room/:code/rematch - Solicitar revancha
router.post('/room/:code/rematch', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      const roomResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      // Validar que el juego haya terminado
      if (room.status !== 'finished') {
        throw new Error('El juego aún no ha terminado');
      }
      
      // Determinar jugador
      const isPlayerX = userId === room.player_x_id;
      const isPlayerO = userId === room.player_o_id;
      
      if (!isPlayerX && !isPlayerO) {
        throw new Error('No eres parte de esta sala');
      }
      
      // Marcar solicitud de revancha
      if (isPlayerX) {
        await client.query(
          'UPDATE tictactoe_rooms SET rematch_requested_by_x = TRUE WHERE id = $1',
          [room.id]
        );
      } else {
        await client.query(
          'UPDATE tictactoe_rooms SET rematch_requested_by_o = TRUE WHERE id = $1',
          [room.id]
        );
      }
      
      // Verificar si ambos solicitaron revancha
      const updatedResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE id = $1',
        [room.id]
      );
      
      const updatedRoom = updatedResult.rows[0];
      
      if (updatedRoom.rematch_requested_by_x && updatedRoom.rematch_requested_by_o) {
        // Crear nueva sala de revancha
        const newCode = generateRoomCode();
        const newRematchCount = updatedRoom.rematch_count + 1;
        const originalRoomId = updatedRoom.is_rematch ? updatedRoom.original_room_id : updatedRoom.id;
        
        const newRoomResult = await client.query(
          `INSERT INTO tictactoe_rooms 
           (id, code, host_id, mode, bet_amount, visibility, 
            player_x_id, player_o_id, status, current_turn,
            pot_coins, pot_fires, rematch_count, is_rematch, original_room_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready', 'X', $9, $10, $11, TRUE, $12)
           RETURNING *`,
          [
            uuidv4(),
            newCode,
            updatedRoom.host_id,
            updatedRoom.mode,
            updatedRoom.bet_amount,
            updatedRoom.visibility,
            updatedRoom.player_x_id,
            updatedRoom.player_o_id,
            updatedRoom.mode === 'coins' ? updatedRoom.bet_amount * 2 : 0,
            updatedRoom.mode === 'fires' ? updatedRoom.bet_amount * 2 : 0,
            newRematchCount,
            originalRoomId
          ]
        );
        
        const newRoom = newRoomResult.rows[0];
        
        // Deducir apuestas de ambos jugadores
        for (const playerId of [newRoom.player_x_id, newRoom.player_o_id]) {
          const betAmount = parseFloat(newRoom.bet_amount);
          const currency = newRoom.mode;
          
          const walletResult = await client.query(
            'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
            [playerId]
          );
          
          const balance = currency === 'fires'
            ? parseFloat(walletResult.rows[0].fires_balance)
            : parseFloat(walletResult.rows[0].coins_balance);
          
          if (balance < betAmount) {
            throw new Error(`Jugador ${playerId} no tiene balance suficiente para revancha`);
          }
          
          await client.query(
            `UPDATE wallets 
             SET ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} = 
                 ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} - $1,
                 ${currency === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} = 
                 ${currency === 'fires' ? 'total_fires_spent' : 'total_coins_spent'} + $1,
                 updated_at = NOW()
             WHERE user_id = $2`,
            [betAmount, playerId]
          );
          
          await client.query(
            `INSERT INTO wallet_transactions 
             (wallet_id, type, currency, amount, balance_before, balance_after, description, related_id)
             VALUES (
               (SELECT id FROM wallets WHERE user_id = $1),
               'game_bet', $2, $3, $4, $5,
               'Revancha La Vieja #' || $6 || ' - Sala ' || $7,
               $8
             )`,
            [playerId, currency, betAmount, balance, balance - betAmount, newRematchCount, newCode, newRoom.id]
          );
        }
        
        logger.info('Tictactoe rematch created', { 
          oldRoomId: room.id,
          newRoomId: newRoom.id,
          newCode,
          rematchCount: newRematchCount
        });
        
        return {
          rematchAccepted: true,
          newRoomCode: newCode,
          rematchCount: newRematchCount
        };
      }
      
      return {
        rematchRequested: true,
        waitingForOther: true
      };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error requesting rematch:', error);
    res.status(400).json({ error: error.message || 'Failed to request rematch' });
  }
});

// GET /api/tictactoe/rooms/public - Listar salas públicas
router.get('/rooms/public', optionalAuth, async (req, res) => {
  try {
    const { mode, limit = 50, offset = 0 } = req.query;
    
    let queryStr = `
      SELECT 
        r.*,
        u.username as host_username,
        u.display_name as host_display_name,
        u.avatar_url as host_avatar
      FROM tictactoe_rooms r
      JOIN users u ON u.id = r.host_id
      WHERE r.status = 'waiting'
        AND r.visibility = 'public'
        AND r.player_o_id IS NULL
        AND r.expires_at > NOW()
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (mode) {
      queryStr += ` AND r.mode = $${++paramCount}`;
      params.push(mode);
    }
    
    queryStr += ` ORDER BY r.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(queryStr, params);
    
    res.json({
      rooms: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    logger.error('Error fetching public rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/tictactoe/room/:code - Obtener detalles de sala
router.get('/room/:code', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    
    const result = await query(
      `SELECT 
        r.*,
        ux.username as player_x_username,
        ux.display_name as player_x_display_name,
        ux.avatar_url as player_x_avatar,
        uo.username as player_o_username,
        uo.display_name as player_o_display_name,
        uo.avatar_url as player_o_avatar
      FROM tictactoe_rooms r
      LEFT JOIN users ux ON ux.id = r.player_x_id
      LEFT JOIN users uo ON uo.id = r.player_o_id
      WHERE r.code = $1`,
      [code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    res.json({ room: result.rows[0] });
    
  } catch (error) {
    logger.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// GET /api/tictactoe/stats/:userId - Estadísticas de jugador
router.get('/stats/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(
      'SELECT * FROM tictactoe_stats WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        user_id: userId,
        games_played: 0,
        games_won: 0,
        games_lost: 0,
        games_draw: 0,
        current_streak: 0,
        best_streak: 0
      });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
