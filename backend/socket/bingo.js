const logger = require('../utils/logger');
const bingoService = require('../services/bingoService');

const handleBingoSocket = (io, socket) => {
  logger.info(`Bingo socket connected: ${socket.userId}`);

  // Unirse a una sala de Bingo
  socket.on('bingo:join', async (data) => {
    const { code } = data;
    
    try {
      socket.join(`bingo:${code}`);
      socket.bingoRoom = code;
      
      // Obtener estado actual de la sala
      const room = await bingoService.getRoomDetails(code);
      
      // Notificar a todos en la sala
      io.to(`bingo:${code}`).emit('bingo:player_update', {
        players: room.players,
        totalPlayers: room.players.length,
        pot: room.pot_total
      });
      
      logger.info(`User ${socket.userId} joined bingo room ${code}`);
    } catch (error) {
      logger.error('Error joining bingo room:', error);
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Host marca jugador como listo
  socket.on('bingo:player_ready', async (data) => {
    const { code, playerId } = data;
    
    try {
      const result = await bingoService.markPlayerReady(code, playerId, socket.userId);
      
      io.to(`bingo:${code}`).emit('bingo:player_ready_update', {
        playerId,
        isReady: true,
        readyCount: result.readyCount,
        totalPlayers: result.totalPlayers
      });
      
      // Si todos están listos, iniciar el juego
      if (result.allReady && result.canStart) {
        const gameStarted = await bingoService.startGame(code, socket.userId);
        if (gameStarted.success) {
          io.to(`bingo:${code}`).emit('bingo:game_started', {
            status: 'playing',
            firstNumber: gameStarted.firstNumber
          });
        }
      }
    } catch (error) {
      logger.error('Error marking player ready:', error);
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Host canta un número
  socket.on('bingo:draw_number', async (data) => {
    const { code } = data;
    
    try {
      const result = await bingoService.drawNumber(code, socket.userId);
      
      if (result.success) {
        io.to(`bingo:${code}`).emit('bingo:number_drawn', {
          number: result.number,
          drawnNumbers: result.drawnNumbers,
          totalDrawn: result.drawnNumbers.length,
          ballSound: true
        });
        
        logger.info(`Number ${result.number} drawn in room ${code}`);
      }
    } catch (error) {
      logger.error('Error drawing number:', error);
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Jugador marca un número en su cartón
  socket.on('bingo:mark_number', async (data) => {
    const { code, cardId, number } = data;
    
    try {
      logger.info('🔵 [SOCKET] Marcar número - Evento recibido', {
        code,
        cardId,
        number,
        userId: socket.userId
      });

      const result = await bingoService.markNumber(cardId, number, socket.userId);
      
      logger.info('✅ [SOCKET] Número marcado exitosamente', {
        cardId,
        number,
        markedNumbers: result.markedNumbers,
        markedCount: result.markedNumbers.length,
        hasWinningPattern: result.hasWinningPattern
      });

      io.to(`bingo:${code}`).emit('bingo:number_marked', {
        userId: socket.userId,
        cardId,
        number,
        markedNumbers: result.markedNumbers,
        hasWinningPattern: result.hasWinningPattern
      });
      
    } catch (error) {
      logger.error('💥 [SOCKET] Error marcando número', {
        error: error.message,
        code,
        cardId,
        number,
        userId: socket.userId
      });
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Jugador canta BINGO
  socket.on('bingo:call_bingo', async (data) => {
    const { code, cardId } = data;
    
    try {
      logger.info('🎲 [SOCKET] BINGO cantado - Evento recibido', {
        code,
        cardId,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

      // Notificar a todos que alguien cantó bingo
      io.to(`bingo:${code}`).emit('bingo:claim_in_progress', {
        playerId: socket.userId,
        cardId,
        message: 'Validando bingo...'
      });
      
      logger.info('📢 [SOCKET] Emitido bingo:claim_in_progress', { code, userId: socket.userId });

      // Validar el bingo
      const result = await bingoService.callBingo(code, cardId, socket.userId);
      
      logger.info('📊 [SOCKET] Resultado de callBingo', {
        success: result.success,
        isValid: result.isValid,
        winnerName: result.winnerName,
        pattern: result.pattern,
        totalPot: result.totalPot,
        message: result.message
      });

      if (result.success && result.isValid) {
        // BINGO válido! (distributePrizes ya se ejecutó dentro de callBingo)
        
        const gameOverData = {
          winnerId: socket.userId,
          winnerName: result.winnerName,
          cardId,
          pattern: result.pattern,
          totalPot: result.totalPot,
          celebration: true
        };

        logger.info('🏆 [SOCKET] Emitiendo bingo:game_over', gameOverData);

        io.to(`bingo:${code}`).emit('bingo:game_over', gameOverData);
        
        logger.info(`✅ BINGO VÁLIDO! User ${socket.userId} ganó sala ${code}`, {
          totalPot: result.totalPot,
          pattern: result.pattern,
          winnerName: result.winnerName
        });
      } else {
        // Bingo inválido
        const invalidData = {
          playerId: socket.userId,
          message: result.message || 'Bingo inválido, continúa el juego'
        };

        logger.warn('❌ [SOCKET] BINGO INVÁLIDO - Emitiendo bingo:claim_invalid', invalidData);

        io.to(`bingo:${code}`).emit('bingo:claim_invalid', invalidData);
      }
    } catch (error) {
      logger.error('💥 [SOCKET] Error crítico en call_bingo', {
        error: error.message,
        stack: error.stack,
        code,
        cardId,
        userId: socket.userId
      });
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Auto-draw para modo automático
  socket.on('bingo:start_auto_draw', async (data) => {
    const { code, interval = 5000 } = data; // Intervalo en ms
    
    try {
      // Verificar que es el host
      const room = await bingoService.getRoomDetails(code);
      if (room.host_id !== socket.userId) {
        throw new Error('Solo el host puede iniciar el auto-draw');
      }
      
      // Iniciar auto-draw
      const autoDrawInterval = setInterval(async () => {
        try {
          const result = await bingoService.drawNumber(code, socket.userId);
          
          if (result.success) {
            io.to(`bingo:${code}`).emit('bingo:number_drawn', {
              number: result.number,
              drawnNumbers: result.drawnNumbers,
              totalDrawn: result.drawnNumbers.length,
              ballSound: true,
              isAuto: true
            });
          } else if (result.allNumbersDrawn) {
            // Todos los números ya fueron cantados
            clearInterval(autoDrawInterval);
            io.to(`bingo:${code}`).emit('bingo:all_numbers_drawn', {
              message: 'Todos los números han sido cantados'
            });
          }
        } catch (error) {
          clearInterval(autoDrawInterval);
          logger.error('Error in auto-draw:', error);
        }
      }, interval);
      
      // Guardar referencia del intervalo
      socket.autoDrawInterval = autoDrawInterval;
      
      io.to(`bingo:${code}`).emit('bingo:auto_draw_started', {
        interval,
        message: 'Auto-draw iniciado'
      });
    } catch (error) {
      logger.error('Error starting auto-draw:', error);
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Detener auto-draw
  socket.on('bingo:stop_auto_draw', async (data) => {
    const { code } = data;
    
    try {
      if (socket.autoDrawInterval) {
        clearInterval(socket.autoDrawInterval);
        socket.autoDrawInterval = null;
        
        io.to(`bingo:${code}`).emit('bingo:auto_draw_stopped', {
          message: 'Auto-draw detenido'
        });
      }
    } catch (error) {
      logger.error('Error stopping auto-draw:', error);
      socket.emit('bingo:error', { message: error.message });
    }
  });

  // Salir de la sala
  socket.on('bingo:leave', async (data) => {
    const { code } = data;
    
    try {
      // Limpiar auto-draw si existe
      if (socket.autoDrawInterval) {
        clearInterval(socket.autoDrawInterval);
      }
      
      socket.leave(`bingo:${code}`);
      
      // Notificar a otros jugadores
      socket.to(`bingo:${code}`).emit('bingo:player_left', {
        playerId: socket.userId
      });
      
      logger.info(`User ${socket.userId} left bingo room ${code}`);
    } catch (error) {
      logger.error('Error leaving bingo room:', error);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    if (socket.bingoRoom) {
      // Limpiar auto-draw si existe
      if (socket.autoDrawInterval) {
        clearInterval(socket.autoDrawInterval);
      }
      
      socket.to(`bingo:${socket.bingoRoom}`).emit('bingo:player_disconnected', {
        playerId: socket.userId
      });
    }
    logger.info(`Bingo socket disconnected: ${socket.userId}`);
  });
};

module.exports = handleBingoSocket;
