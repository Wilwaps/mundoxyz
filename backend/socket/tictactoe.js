const logger = require('../utils/logger');

/**
 * Initialize TicTacToe WebSocket handlers
 */
function initTicTacToeSocket(io, socket) {
  // Join room
  socket.on('tictactoe:join-room', (data) => {
    const { roomCode } = data;
    if (roomCode) {
      socket.join(`tictactoe:${roomCode}`);
      logger.info('Socket joined tictactoe room', { 
        socketId: socket.id, 
        roomCode 
      });
    }
  });
  
  // Leave room
  socket.on('tictactoe:leave-room', (data) => {
    const { roomCode } = data;
    if (roomCode) {
      socket.leave(`tictactoe:${roomCode}`);
      logger.info('Socket left tictactoe room', { 
        socketId: socket.id, 
        roomCode 
      });
    }
  });
  
  // Player joined notification
  socket.on('tictactoe:player-joined', (data) => {
    const { roomCode, playerId, username } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:player-joined', {
      roomCode,
      playerId,
      username
    });
  });
  
  // Player ready notification
  socket.on('tictactoe:player-ready', (data) => {
    const { roomCode, playerId, symbol } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:player-ready', {
      roomCode,
      playerId,
      symbol
    });
  });
  
  // Game started notification
  socket.on('tictactoe:game-started', (data) => {
    const { roomCode } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:game-started', {
      roomCode
    });
  });
  
  // Move made notification
  socket.on('tictactoe:move-made', (data) => {
    const { roomCode, playerId, symbol, row, col, nextTurn, board } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:move-made', {
      roomCode,
      playerId,
      symbol,
      row,
      col,
      nextTurn,
      board
    });
  });
  
  // Timer tick notification (cada segundo)
  socket.on('tictactoe:timer-tick', (data) => {
    const { roomCode, timeLeft, currentTurn } = data;
    socket.to(`tictactoe:${roomCode}`).emit('room:timer-tick', {
      roomCode,
      timeLeft,
      currentTurn
    });
  });
  
  // Timeout notification
  socket.on('tictactoe:timeout', (data) => {
    const { roomCode, loserId, winnerId } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:timeout', {
      roomCode,
      loserId,
      winnerId
    });
  });
  
  // Game over notification
  socket.on('tictactoe:game-over', (data) => {
    const { roomCode, winner, isDraw, winnerId, winningLine } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:game-over', {
      roomCode,
      winner,
      isDraw,
      winnerId,
      winningLine
    });
  });
  
  // Rematch request notification
  socket.on('tictactoe:rematch-request', (data) => {
    const { roomCode, playerId } = data;
    socket.to(`tictactoe:${roomCode}`).emit('room:rematch-request', {
      roomCode,
      playerId
    });
  });
  
  // Rematch accepted notification
  socket.on('tictactoe:rematch-accepted', (data) => {
    const { roomCode, newRoomCode, rematchCount } = data;
    io.to(`tictactoe:${roomCode}`).emit('room:rematch-accepted', {
      roomCode,
      newRoomCode,
      rematchCount
    });
  });
}

/**
 * Emit event to specific room
 */
function emitToRoom(io, roomCode, event, data) {
  io.to(`tictactoe:${roomCode}`).emit(event, data);
}

/**
 * Handle disconnection
 */
function handleDisconnect(socket) {
  logger.info('TicTacToe socket disconnected', { socketId: socket.id });
}

module.exports = {
  initTicTacToeSocket,
  emitToRoom,
  handleDisconnect
};
