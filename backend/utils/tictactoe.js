const logger = require('./logger');

/**
 * Genera código único de 6 caracteres para sala
 */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Valida si un movimiento es válido
 */
function isValidMove(board, row, col) {
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    return false;
  }
  
  if (board[row][col] !== null) {
    return false;
  }
  
  return true;
}

/**
 * Verifica si hay un ganador o empate
 * @returns {object|null} { winner: 'X'|'O', line: {type, index} } o { isDraw: true } o null
 */
function checkWinner(board) {
  // Verificar filas
  for (let row = 0; row < 3; row++) {
    if (board[row][0] && 
        board[row][0] === board[row][1] && 
        board[row][1] === board[row][2]) {
      return { 
        winner: board[row][0], 
        line: { type: 'row', index: row } 
      };
    }
  }
  
  // Verificar columnas
  for (let col = 0; col < 3; col++) {
    if (board[0][col] && 
        board[0][col] === board[1][col] && 
        board[1][col] === board[2][col]) {
      return { 
        winner: board[0][col], 
        line: { type: 'col', index: col } 
      };
    }
  }
  
  // Verificar diagonal principal (\)
  if (board[0][0] && 
      board[0][0] === board[1][1] && 
      board[1][1] === board[2][2]) {
    return { 
      winner: board[0][0], 
      line: { type: 'diag', index: 0 } 
    };
  }
  
  // Verificar diagonal inversa (/)
  if (board[0][2] && 
      board[0][2] === board[1][1] && 
      board[1][1] === board[2][0]) {
    return { 
      winner: board[0][2], 
      line: { type: 'diag', index: 1 } 
    };
  }
  
  // Verificar empate (tablero lleno)
  const isFull = board.every(row => row.every(cell => cell !== null));
  if (isFull) {
    return { winner: null, isDraw: true };
  }
  
  return null; // Juego continúa
}

/**
 * Distribuye premios al finalizar partida
 */
async function distributePrizes(room, query) {
  const currency = room.mode; // 'coins' o 'fires'
  const potTotal = parseFloat(room.mode === 'coins' ? room.pot_coins : room.pot_fires);
  
  // Sin comisión - 100% al ganador o 50% c/u en empate
  if (room.winner_id) {
    // Victoria: ganador recibe 100%
    await query(
      `UPDATE wallets 
       SET ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} = 
           ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} + $1,
           ${currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned'} = 
           ${currency === 'fires' ? 'total_fires_earned' : 'total_coins_earned'} + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [potTotal, room.winner_id]
    );
    
    // Registrar transacción
    await query(
      `INSERT INTO wallet_transactions 
       (wallet_id, type, currency, amount, balance_before, balance_after, description, related_id)
       VALUES (
         (SELECT id FROM wallets WHERE user_id = $1),
         'game_win', $2, $3, 
         (SELECT ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} - $3 FROM wallets WHERE user_id = $1),
         (SELECT ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} FROM wallets WHERE user_id = $1),
         'Victoria en La Vieja - Sala ' || $4,
         $5
       )`,
      [room.winner_id, currency, potTotal, room.code, room.id]
    );
    
    // Actualizar prize en room
    await query(
      `UPDATE tictactoe_rooms 
       SET ${currency === 'fires' ? 'prize_fires' : 'prize_coins'} = $1
       WHERE id = $2`,
      [potTotal, room.id]
    );
    
    logger.info('Tictactoe prize distributed', { 
      roomId: room.id, 
      winnerId: room.winner_id, 
      amount: potTotal,
      currency 
    });
  } else if (room.is_draw) {
    // Empate: cada jugador recupera 50%
    const refund = potTotal / 2;
    
    for (const playerId of [room.player_x_id, room.player_o_id]) {
      await query(
        `UPDATE wallets 
         SET ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} = 
             ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [refund, playerId]
      );
      
      await query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, related_id)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_refund', $2, $3,
           (SELECT ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} - $3 FROM wallets WHERE user_id = $1),
           (SELECT ${currency === 'fires' ? 'fires_balance' : 'coins_balance'} FROM wallets WHERE user_id = $1),
           'Empate en La Vieja - Sala ' || $4,
           $5
         )`,
        [playerId, currency, refund, room.code, room.id]
      );
    }
    
    await query(
      `UPDATE tictactoe_rooms 
       SET ${currency === 'fires' ? 'prize_fires' : 'prize_coins'} = $1
       WHERE id = $2`,
      [potTotal, room.id]
    );
    
    logger.info('Tictactoe draw refund', { 
      roomId: room.id, 
      refundEach: refund,
      currency 
    });
  }
}

/**
 * Otorga XP a ambos jugadores
 */
async function awardGameXP(room, awardXpBatch) {
  if (room.xp_awarded) return;
  
  const awards = [
    {
      userId: room.player_x_id,
      xpAmount: 1,
      gameType: 'tictactoe',
      gameId: room.id,
      gameCode: room.code,
      metadata: { 
        won: room.winner_id === room.player_x_id,
        symbol: 'X',
        isDraw: room.is_draw,
        rematchCount: room.rematch_count
      }
    },
    {
      userId: room.player_o_id,
      xpAmount: 1,
      gameType: 'tictactoe',
      gameId: room.id,
      gameCode: room.code,
      metadata: { 
        won: room.winner_id === room.player_o_id,
        symbol: 'O',
        isDraw: room.is_draw,
        rematchCount: room.rematch_count
      }
    }
  ];
  
  const results = await awardXpBatch(awards);
  
  logger.info('Tictactoe XP awarded', { 
    roomId: room.id, 
    results 
  });
  
  return results;
}

module.exports = {
  generateRoomCode,
  isValidMove,
  checkWinner,
  distributePrizes,
  awardGameXP
};
