const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { 
  isValidMove, 
  checkWinner, 
  distributePrizes,
  awardGameXP 
} = require('../utils/tictactoe');
const { 
  closeUserPreviousRooms,
  cleanupOrphanedRooms,
  cleanupOldFinishedRooms 
} = require('../utils/tictactoe-cleanup');
const RoomCodeService = require('../services/roomCodeService');
const { cleanupRoom } = require('../socket/tictactoe');

// Socket IO will be accessed through req.io

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
      
      // Registrar transacción (amount negativo para apuestas)
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_bet', $2, $3, $4, $5,
           'Apuesta La Vieja'
         )`,
        [userId, mode, -betAmount, balance, balance - betAmount]
      );
      
      // Cerrar salas anteriores del usuario
      await closeUserPreviousRooms(userId, client);
      
      // Crear sala primero para obtener ID
      const roomId = uuidv4();
      
      const roomResult = await client.query(
        `INSERT INTO tictactoe_rooms 
         (id, code, host_id, mode, bet_amount, visibility, player_x_id, 
          pot_coins, pot_fires, status, current_turn, player_x_ready)
         VALUES ($1, 'TEMP', $2, $3, $4, $5, $2, $6, $7, 'waiting', 'X', TRUE)
         RETURNING *`,
        [
          roomId,
          userId,
          mode,
          betAmount,
          visibility,
          mode === 'coins' ? betAmount : 0,
          mode === 'fires' ? betAmount : 0
        ]
      );
      
      const room = roomResult.rows[0];
      
      // Generar código único usando sistema unificado
      const code = await RoomCodeService.reserveCode('tictactoe', roomId, client);
      
      // Actualizar sala con código real
      await client.query(
        'UPDATE tictactoe_rooms SET code = $1 WHERE id = $2',
        [code, roomId]
      );
      
      room.code = code;
      
      logger.info('🎮 TicTacToe sala creada con código unificado', { 
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
      
      // Cerrar salas anteriores del usuario antes de unirse (excluyendo esta sala)
      await closeUserPreviousRooms(userId, client, room.id);
      
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

      // Registrar transacción (amount negativo para apuestas)
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_bet', $2, $3, $4, $5,
           'Apuesta La Vieja - Unirse',
           $6
         )`,
        [userId, room.mode, -betAmount, balance, balance - betAmount, code]
      );

      // Actualizar sala: agregar jugador O y pot, marcar como ready
      await client.query(
        `UPDATE tictactoe_rooms 
         SET player_o_id = $1,
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} = 
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} + $2,
             player_o_ready = TRUE,
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
      if (req.io) {
        req.io.to(`tictactoe:${code}`).emit('room:player-joined', {
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
      
      // Solo marcar como listo, no auto-iniciar
      // El host iniciará manualmente con el endpoint /start
      return { success: true };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error marking ready:', error);
    res.status(400).json({ error: error.message || 'Failed to mark ready' });
  }
});

// POST /api/tictactoe/room/:code/start - Iniciar partida (solo host)
router.post('/room/:code/start', verifyToken, async (req, res) => {
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
      
      // Verificar que el usuario es el host
      if (room.player_x_id !== userId) {
        throw new Error('Solo el host puede iniciar la partida');
      }
      
      // Verificar estado de la sala
      if (room.status !== 'ready') {
        throw new Error('La sala no está lista para comenzar');
      }
      
      // Verificar que ambos jugadores estén presentes
      if (!room.player_o_id) {
        throw new Error('Esperando al segundo jugador');
      }
      
      // Verificar que AMBOS jugadores estén listos
      if (!room.player_x_ready) {
        throw new Error('El host aún no está listo');
      }
      
      if (!room.player_o_ready) {
        throw new Error('El invitado aún no está listo');
      }
      
      // Iniciar juego - garantizar que ambos estén marcados como ready
      await client.query(
        `UPDATE tictactoe_rooms 
         SET status = 'playing', 
             player_x_ready = TRUE,
             player_o_ready = TRUE,
             started_at = NOW(),
             last_move_at = NOW()
         WHERE id = $1`,
        [room.id]
      );
      
      logger.info('Tictactoe game started by host', { 
        roomId: room.id, 
        code,
        host: req.user.username
      });
      
      // Emit socket event for game start
      if (req.io) {
        req.io.to(`tictactoe:${code}`).emit('room:game-started', {
          roomCode: code
        });
      }
      
      return { success: true };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error starting game:', error);
    res.status(400).json({ error: error.message || 'Failed to start game' });
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
      
      // Parsear board si es string (CRÍTICO para isValidMove)
      if (typeof room.board === 'string') {
        try {
          room.board = JSON.parse(room.board);
        } catch (e) {
          logger.error('Error parsing board JSON in move:', e);
          throw new Error('Error al procesar el tablero');
        }
      }
      
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
        
        // Otorgar XP
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
        if (req.io) {
          req.io.to(`tictactoe:${code}`).emit('room:game-over', {
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

// POST /api/tictactoe/room/:code/timeout - Procesar timeout automáticamente
router.post('/room/:code/timeout', verifyToken, async (req, res) => {
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
      
      // Parsear board
      if (typeof room.board === 'string') {
        try {
          room.board = JSON.parse(room.board);
        } catch (e) {
          logger.error('Error parsing board JSON:', e);
          // Fallback: tablero vacío 3x3
          room.board = [[null,null,null],[null,null,null],[null,null,null]];
        }
      }
      
      // Asegurar que board sea array (por si viene como JSONB desde migración)
      if (!Array.isArray(room.board)) {
        room.board = [[null,null,null],[null,null,null],[null,null,null]];
      }
      
      // Validar estado
      if (room.status !== 'playing') {
        return { alreadyFinished: true, status: room.status };
      }
      
      // Verificar si es participante
      const isPlayerX = userId === room.player_x_id;
      const isPlayerO = userId === room.player_o_id;
      
      if (!isPlayerX && !isPlayerO) {
        throw new Error('No eres parte de esta sala');
      }
      
      // Verificar si pasaron 15 segundos desde el último movimiento
      const timeSinceLastMove = Date.now() - new Date(room.last_move_at).getTime();
      
      if (timeSinceLastMove < 15000) {
        return { timeout: false, timeLeft: Math.ceil((15000 - timeSinceLastMove) / 1000) };
      }
      
      // Timeout confirmado - el jugador del turno actual pierde
      const currentTurnPlayerX = room.current_turn === 'X';
      const winnerId = currentTurnPlayerX ? room.player_o_id : room.player_x_id;
      const winnerSymbol = currentTurnPlayerX ? 'O' : 'X';
      
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
      
      // Otorgar XP
      const { awardXpBatch } = require('../utils/xp');
      await awardGameXP(finishedRoom, awardXpBatch);
      
      await client.query(
        'UPDATE tictactoe_rooms SET xp_awarded = TRUE WHERE id = $1',
        [room.id]
      );
      
      logger.info('Game ended by timeout', {
        roomCode: code,
        winnerId,
        winnerSymbol,
        loserTurn: room.current_turn
      });
      
      return {
        timeout: true,
        gameOver: true,
        winner: winnerSymbol,
        winnerId
      };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error processing timeout:', error);
    res.status(400).json({ error: error.message || 'Failed to process timeout' });
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
      
      // Emitir evento de solicitud de revancha al oponente
      const io = req.app.get('io');
      io.to(`tictactoe:${code}`).emit('room:rematch-request', {
        roomCode: code,
        playerId: userId
      });
      
      // Verificar si ambos solicitaron revancha
      const updatedResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE id = $1',
        [room.id]
      );
      
      const updatedRoom = updatedResult.rows[0];
      
      if (updatedRoom.rematch_requested_by_x && updatedRoom.rematch_requested_by_o) {
        // Reutilizar la misma sala para revancha
        const newRematchCount = updatedRoom.rematch_count + 1;
        
        // Alternar turno inicial: en revanchas impares empieza O, en pares empieza X
        const initialTurn = newRematchCount % 2 === 0 ? 'X' : 'O';
        
        // Deducir apuestas de ambos jugadores
        for (const playerId of [updatedRoom.player_x_id, updatedRoom.player_o_id]) {
          const betAmount = parseFloat(updatedRoom.bet_amount);
          const currency = updatedRoom.mode;
          
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
             (wallet_id, type, currency, amount, balance_before, balance_after, description)
             VALUES (
               (SELECT id FROM wallets WHERE user_id = $1),
               'game_bet', $2, $3, $4, $5,
               'Revancha La Vieja #' || $6 || ' - Sala ' || $7
             )`,
            [playerId, currency, -betAmount, balance, balance - betAmount, newRematchCount, code]
          );
        }
        
        // Actualizar pot con las nuevas apuestas
        // IMPORTANTE: el pote de cada partida debe depender solo de las apuestas
        // de esa partida, para evitar "crear" monedas/fuegos al acumular potes
        const newPotCoins = updatedRoom.mode === 'coins' 
          ? parseFloat(updatedRoom.bet_amount) * 2
          : 0;
        const newPotFires = updatedRoom.mode === 'fires'
          ? parseFloat(updatedRoom.bet_amount) * 2
          : 0;
        
        // CRÍTICO: Limpiar movimientos previos para evitar violación de unique constraint
        await client.query(
          'DELETE FROM tictactoe_moves WHERE room_id = $1',
          [updatedRoom.id]
        );
        
        logger.info('Tictactoe moves cleared for rematch', { 
          roomId: updatedRoom.id,
          roomCode: code
        });
        
        // Resetear sala para nueva partida (misma sala, nuevo juego)
        await client.query(
          `UPDATE tictactoe_rooms 
           SET status = 'playing',
               current_turn = $1,
               board = '[[null,null,null],[null,null,null],[null,null,null]]',
               winner_id = NULL,
               finished_at = NULL,
               rematch_requested_by_x = FALSE,
               rematch_requested_by_o = FALSE,
               player_x_left = FALSE,
               player_o_left = FALSE,
               player_x_ready = TRUE,
               player_o_ready = TRUE,
               rematch_count = $2,
               pot_coins = $3,
               pot_fires = $4,
               xp_awarded = FALSE,
               last_move_at = NOW()
           WHERE id = $5`,
          [initialTurn, newRematchCount, newPotCoins, newPotFires, updatedRoom.id]
        );
        
        logger.info('Tictactoe rematch started (same room)', { 
          roomId: room.id,
          roomCode: code,
          rematchCount: newRematchCount,
          initialTurn,
          newPotCoins,
          newPotFires
        });
        
        // Obtener estado completo actualizado de la sala
        const updatedRoomResult = await client.query(
          'SELECT * FROM tictactoe_rooms WHERE id = $1',
          [room.id]
        );
        const fullUpdatedRoom = updatedRoomResult.rows[0];
        
        // Emitir evento de revancha aceptada con estado completo
        const io = req.app.get('io');
        io.to(`tictactoe:${code}`).emit('room:rematch-accepted', {
          roomCode: code,
          sameRoom: true,
          rematchCount: newRematchCount,
          initialTurn,
          room: fullUpdatedRoom // Enviar estado completo de la sala
        });
        
        return {
          rematchAccepted: true,
          sameRoom: true,
          roomCode: code,
          rematchCount: newRematchCount,
          initialTurn
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

// POST /api/tictactoe/room/:code/leave - Abandonar sala (después de terminar)
router.post('/room/:code/leave', verifyToken, async (req, res) => {
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
      
      // Determinar qué jugador es
      const isPlayerX = userId === room.player_x_id;
      const isPlayerO = userId === room.player_o_id;
      
      if (!isPlayerX && !isPlayerO) {
        throw new Error('No eres parte de esta sala');
      }
      
      // Marcar que el jugador abandonó
      if (isPlayerX) {
        await client.query(
          'UPDATE tictactoe_rooms SET player_x_left = TRUE WHERE id = $1',
          [room.id]
        );
      } else {
        await client.query(
          'UPDATE tictactoe_rooms SET player_o_left = TRUE WHERE id = $1',
          [room.id]
        );
      }
      
      // Verificar si ambos jugadores ya abandonaron
      const updatedResult = await client.query(
        'SELECT player_x_left, player_o_left FROM tictactoe_rooms WHERE id = $1',
        [room.id]
      );
      
      const updatedRoom = updatedResult.rows[0];
      
      if (updatedRoom.player_x_left && updatedRoom.player_o_left) {
        // Ambos jugadores abandonaron - cancelar sala
        await client.query(
          `UPDATE tictactoe_rooms 
           SET status = 'cancelled' 
           WHERE id = $1`,
          [room.id]
        );
        
        logger.info('TicTacToe room cancelled (both players left)', {
          roomId: room.id,
          roomCode: code
        });
        
        return { cancelled: true, roomCode: code };
      }
      
      return { cancelled: false };
    });
    
    // Si la sala fue cancelada (ambos jugadores salieron), limpiar conexiones del socket
    if (result.cancelled && result.roomCode) {
      cleanupRoom(result.roomCode);
      logger.info('Room connections cleaned after manual leave', { roomCode: result.roomCode });
    }
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error('Error leaving room:', error);
    res.status(400).json({ error: error.message || 'Failed to leave room' });
  }
});

// GET /api/tictactoe/rooms/:code/can-close - Verificar si usuario puede cerrar sala
router.get('/rooms/:code/can-close', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
    
    // Obtener sala
    const roomResult = await query(
      'SELECT * FROM tictactoe_rooms WHERE code = $1',
      [code]
    );
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    
    const room = roomResult.rows[0];
    
    // Admin/tote siempre puede cerrar salas en waiting, ready o playing
    if (isAdmin) {
      if (['waiting', 'ready', 'playing'].includes(room.status)) {
        return res.json({ allowed: true, isAdmin: true });
      }
      return res.json({ 
        allowed: false, 
        reason: 'Solo se pueden cerrar salas activas'
      });
    }
    
    // Host puede cerrar solo si está en waiting y no hay jugador O
    if (room.host_id === userId) {
      if (room.status === 'waiting' && !room.player_o_id) {
        return res.json({ allowed: true, isAdmin: false });
      }
      return res.json({ 
        allowed: false, 
        reason: 'Solo puedes cerrar salas en espera sin invitado'
      });
    }
    
    return res.json({ allowed: false, reason: 'No tienes permisos' });
    
  } catch (error) {
    logger.error('Error checking if can close room:', error);
    res.status(500).json({ error: 'Error checking permissions' });
  }
});

// DELETE /api/tictactoe/rooms/:code - Cerrar sala y reembolsar (admin/host)
router.delete('/rooms/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
    
    const result = await transaction(async (client) => {
      // Obtener sala con lock
      const roomResult = await client.query(
        'SELECT * FROM tictactoe_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      // Verificar permisos
      const canClose = isAdmin || 
        (room.host_id === userId && room.status === 'waiting' && !room.player_o_id);
      
      if (!canClose) {
        throw new Error('No tienes permisos para cerrar esta sala');
      }
      
      // Verificar que sala esté en estado cerrable
      if (!['waiting', 'ready', 'playing'].includes(room.status)) {
        throw new Error('Esta sala no puede ser cerrada');
      }
      
      // Reembolsar a los jugadores SOLO del pot de la sala (no crear dinero nuevo)
      let refundedCount = 0;
      const currency = room.mode; // 'coins' o 'fires'
      const potTotal = parseFloat(room.mode === 'coins' ? room.pot_coins : room.pot_fires);
      
      if (potTotal > 0) {
        const currencyColumn = room.mode === 'coins' ? 'coins_balance' : 'fires_balance';
        
        // Calcular cuánto corresponde a cada jugador del pot
        const playersToRefund = [room.player_x_id, room.player_o_id].filter(Boolean);
        const refundPerPlayer = playersToRefund.length > 0 ? potTotal / playersToRefund.length : 0;
        
        // Reembolsar al host (player X) su parte del pot
        if (room.player_x_id && refundPerPlayer > 0) {
          // Obtener balance actual
          const walletResult = await client.query(
            `SELECT id, ${currencyColumn} as balance FROM wallets WHERE user_id = $1`,
            [room.player_x_id]
          );
          
          if (walletResult.rows.length > 0) {
            const wallet = walletResult.rows[0];
            const balanceBefore = parseFloat(wallet.balance);
            const balanceAfter = balanceBefore + refundPerPlayer;
            
            // Actualizar balance
            await client.query(
              `UPDATE wallets 
               SET ${currencyColumn} = $1,
                   updated_at = NOW()
               WHERE user_id = $2`,
              [balanceAfter, room.player_x_id]
            );
            
            // Registrar transacción SOLO si es fires
            if (room.mode === 'fires') {
              await client.query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, currency, amount, balance_before, balance_after, description, reference) 
                 VALUES ($1, 'game_refund', 'fires', $2, $3, $4, $5, $6)`,
                [wallet.id, refundPerPlayer, balanceBefore, balanceAfter, 
                 'Reembolso TicTacToe - Sala cerrada', `tictactoe:${room.code}`]
              );
            }
            
            refundedCount++;
          }
        }
        
        // Reembolsar al invitado (player O) su parte del pot
        if (room.player_o_id && refundPerPlayer > 0) {
          // Obtener balance actual
          const walletResult = await client.query(
            `SELECT id, ${currencyColumn} as balance FROM wallets WHERE user_id = $1`,
            [room.player_o_id]
          );
          
          if (walletResult.rows.length > 0) {
            const wallet = walletResult.rows[0];
            const balanceBefore = parseFloat(wallet.balance);
            const balanceAfter = balanceBefore + refundPerPlayer;
            
            // Actualizar balance
            await client.query(
              `UPDATE wallets 
               SET ${currencyColumn} = $1,
                   updated_at = NOW()
               WHERE user_id = $2`,
              [balanceAfter, room.player_o_id]
            );
            
            // Registrar transacción SOLO si es fires
            if (room.mode === 'fires') {
              await client.query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, currency, amount, balance_before, balance_after, description, reference) 
                 VALUES ($1, 'game_refund', 'fires', $2, $3, $4, $5, $6)`,
                [wallet.id, refundPerPlayer, balanceBefore, balanceAfter, 
                 'Reembolso TicTacToe - Sala cerrada', `tictactoe:${room.code}`]
              );
            }
            
            refundedCount++;
          }
        }
      }
      
      // Marcar sala como cancelada
      await client.query(
        `UPDATE tictactoe_rooms 
         SET status = 'cancelled' 
         WHERE id = $1`,
        [room.id]
      );
      
      const action = isAdmin ? 'Admin' : 'Host';
      logger.info(`${action} closed TicTacToe room`, {
        roomCode: code,
        userId,
        refundedPlayers: refundedCount,
        betAmount: room.bet_amount,
        mode: room.mode
      });
      
      return { 
        refundedCount,
        betAmount: room.bet_amount,
        mode: room.mode,
        roomCode: code
      };
    });
    
    // Limpiar conexiones del socket
    cleanupRoom(code);
    
    res.json({
      success: true,
      message: `Sala cerrada. ${result.refundedCount} jugador(es) reembolsados.`,
      ...result
    });
    
  } catch (error) {
    logger.error('Error closing room:', error);
    res.status(400).json({ error: error.message || 'Error cerrando sala' });
  }
});

// GET /api/tictactoe/rooms/admin - Listar salas activas para admin/tote
router.get('/rooms/admin', verifyToken, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.includes('admin') || roles.includes('tote');
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado. Solo admin/tote.' });
    }
    
    const result = await query(
      `SELECT 
        r.*,
        u.username as host_username,
        u.display_name as host_display_name,
        u.avatar_url as host_avatar
      FROM tictactoe_rooms r
      JOIN users u ON u.id = r.host_id
      WHERE r.status IN ('waiting', 'ready', 'playing')
      ORDER BY r.created_at DESC`
    );
    
    const rooms = result.rows.map((room) => {
      if (typeof room.board === 'string') {
        try {
          room.board = JSON.parse(room.board);
        } catch (e) {
          room.board = [[null,null,null],[null,null,null],[null,null,null]];
        }
      }
      if (typeof room.moves_history === 'string') {
        try {
          room.moves_history = JSON.parse(room.moves_history);
        } catch (e) {
          room.moves_history = [];
        }
      }
      return room;
    });
    
    res.json({ rooms });
  } catch (error) {
    logger.error('Error fetching admin tictactoe rooms:', error);
    res.status(500).json({ error: 'Failed to fetch admin rooms' });
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
    
    // Parsear JSONB fields en cada sala
    const rooms = result.rows.map(room => {
      // Parsear board si es string
      if (typeof room.board === 'string') {
        try {
          room.board = JSON.parse(room.board);
        } catch (e) {
          room.board = [[null,null,null],[null,null,null],[null,null,null]];
        }
      }
      // Parsear moves_history si es string
      if (typeof room.moves_history === 'string') {
        try {
          room.moves_history = JSON.parse(room.moves_history);
        } catch (e) {
          room.moves_history = [];
        }
      }
      return room;
    });
    
    res.json({
      rooms,
      total: rooms.length
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
    const userId = req.user?.id;
    
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
    
    const room = result.rows[0];
    
    // Parsear board si es string (garantizar que sea array)
    if (typeof room.board === 'string') {
      try {
        room.board = JSON.parse(room.board);
      } catch (e) {
        logger.error('Error parsing board JSON:', e);
        room.board = [[null,null,null],[null,null,null],[null,null,null]];
      }
    }
    
    // Asegurar que board sea array (por si viene como JSONB desde migración)
    if (!Array.isArray(room.board)) {
      room.board = [[null,null,null],[null,null,null],[null,null,null]];
    }
    
    // Parsear moves_history si es string
    if (typeof room.moves_history === 'string') {
      try {
        room.moves_history = JSON.parse(room.moves_history);
      } catch (e) {
        logger.error('Error parsing moves_history JSON:', e);
        room.moves_history = [];
      }
    }
    
    // Verificar si el usuario es parte de la sala (para reconexión)
    if (userId) {
      const isPlayerX = room.player_x_id === userId;
      const isPlayerO = room.player_o_id === userId;
      
      // Si el usuario es parte de la sala, permitir acceso incluso si salió
      if (isPlayerX || isPlayerO) {
        logger.info('Player reconnecting to room', { 
          roomCode: code, 
          userId, 
          role: isPlayerX ? 'X' : 'O',
          status: room.status 
        });
      }
      
      // Agregar flag de pertenencia
      room.is_participant = isPlayerX || isPlayerO;
      room.user_role = isPlayerX ? 'X' : (isPlayerO ? 'O' : null);
    }
    
    res.json({ room });
    
  } catch (error) {
    logger.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// GET /api/tictactoe/my-active-room - Obtener sala activa del usuario (para reconexión)
router.get('/my-active-room', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar salas activas donde el usuario es participante
    const result = await query(
      `SELECT 
        r.*,
        ux.username as player_x_username,
        uo.username as player_o_username
      FROM tictactoe_rooms r
      LEFT JOIN users ux ON ux.id = r.player_x_id
      LEFT JOIN users uo ON uo.id = r.player_o_id
      WHERE (r.player_x_id = $1 OR r.player_o_id = $1)
        AND r.status IN ('waiting', 'ready', 'playing')
      ORDER BY r.created_at DESC
      LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ activeRoom: null });
    }
    
    const room = result.rows[0];
    
    logger.info('Active room found for user', {
      userId,
      roomCode: room.code,
      status: room.status
    });
    
    res.json({ 
      activeRoom: {
        code: room.code,
        status: room.status,
        mode: room.mode,
        bet_amount: room.bet_amount,
        is_host: room.player_x_id === userId,
        opponent: room.player_x_id === userId ? room.player_o_username : room.player_x_username
      }
    });
    
  } catch (error) {
    logger.error('Error fetching active room:', error);
    res.status(500).json({ error: 'Failed to fetch active room' });
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

// POST /api/tictactoe/cleanup/orphaned - Limpiar salas huérfanas (Admin)
router.post('/cleanup/orphaned', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    const rolesResult = await query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [req.user.id]
    );
    
    const roles = rolesResult.rows.map(r => r.name);
    if (!roles.includes('admin')) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    
    const maxAgeHours = parseInt(req.body.maxAgeHours) || 24;
    const cleaned = await cleanupOrphanedRooms(maxAgeHours);
    
    res.json({
      success: true,
      message: `Se limpiaron ${cleaned} salas huérfanas`,
      cleaned
    });
    
  } catch (error) {
    logger.error('Error cleaning orphaned rooms:', error);
    res.status(500).json({ error: 'Failed to cleanup orphaned rooms' });
  }
});

// POST /api/tictactoe/cleanup/old-finished - Limpiar salas finalizadas antiguas (Admin)
router.post('/cleanup/old-finished', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    const rolesResult = await query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [req.user.id]
    );
    
    const roles = rolesResult.rows.map(r => r.name);
    if (!roles.includes('admin')) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    
    const maxAgeDays = parseInt(req.body.maxAgeDays) || 30;
    const deleted = await cleanupOldFinishedRooms(maxAgeDays);
    
    res.json({
      success: true,
      message: `Se eliminaron ${deleted} salas antiguas`,
      deleted
    });
    
  } catch (error) {
    logger.error('Error deleting old finished rooms:', error);
    res.status(500).json({ error: 'Failed to delete old finished rooms' });
  }
});

module.exports = router;
