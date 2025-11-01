const { query } = require('../db');
const logger = require('../utils/logger');

class BingoV2Service {
  /**
   * Generate a unique room code
   */
  static async generateRoomCode() {
    const result = await query('SELECT generate_room_code() as code');
    return result.rows[0].code;
  }

  /**
   * Create a new bingo room
   */
  static async createRoom(hostId, config, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;
    
    try {
      const roomCode = await this.generateRoomCode();
      
      const result = await dbQuery(
        `INSERT INTO bingo_v2_rooms (
          code, name, host_id, mode, pattern_type, is_public,
          max_players, max_cards_per_player, currency_type, card_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          roomCode,
          config.name || `Sala de ${config.host_name}`,
          hostId,
          config.mode || '75',
          config.pattern_type || 'line',
          config.is_public !== false,
          config.max_players || 10,
          config.max_cards_per_player || 5,
          config.currency_type || 'coins',
          config.card_cost || 10
        ]
      );

      const room = result.rows[0];

      // Log the creation
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [room.id, hostId, 'room_created', { config }]
      );

      return room;
    } catch (error) {
      logger.error('Error creating room:', error);
      throw error;
    }
  }

  /**
   * Generate a 75-ball bingo card (5x5 grid)
   */
  static generate75BallCard() {
    const card = [];
    const ranges = [
      { min: 1, max: 15 },   // B
      { min: 16, max: 30 },  // I
      { min: 31, max: 45 },  // N
      { min: 46, max: 60 },  // G
      { min: 61, max: 75 }   // O
    ];

    for (let col = 0; col < 5; col++) {
      const column = [];
      const used = new Set();
      
      for (let row = 0; row < 5; row++) {
        // Center is FREE space
        if (col === 2 && row === 2) {
          column.push({ value: 'FREE', marked: false });
        } else {
          let num;
          do {
            num = Math.floor(Math.random() * (ranges[col].max - ranges[col].min + 1)) + ranges[col].min;
          } while (used.has(num));
          
          used.add(num);
          column.push({ value: num, marked: false });
        }
      }
      
      card.push(column);
    }

    // Convert to row-based grid for easier iteration
    const grid = [];
    for (let row = 0; row < 5; row++) {
      const gridRow = [];
      for (let col = 0; col < 5; col++) {
        gridRow.push(card[col][row]);
      }
      grid.push(gridRow);
    }

    return grid;
  }

  /**
   * Generate a 90-ball bingo card (9x3 grid with 15 numbers)
   */
  static generate90BallCard() {
    const grid = [];
    
    // Initialize empty grid
    for (let row = 0; row < 3; row++) {
      grid.push(new Array(9).fill(null));
    }

    // Each column has specific number ranges
    const columnRanges = [
      { min: 1, max: 9 },    // Column 0
      { min: 10, max: 19 },  // Column 1
      { min: 20, max: 29 },  // Column 2
      { min: 30, max: 39 },  // Column 3
      { min: 40, max: 49 },  // Column 4
      { min: 50, max: 59 },  // Column 5
      { min: 60, max: 69 },  // Column 6
      { min: 70, max: 79 },  // Column 7
      { min: 80, max: 90 }   // Column 8
    ];

    // Each row must have exactly 5 numbers
    for (let row = 0; row < 3; row++) {
      const columnsForRow = this.getRandomColumns();
      
      for (const col of columnsForRow) {
        let num;
        do {
          num = Math.floor(Math.random() * (columnRanges[col].max - columnRanges[col].min + 1)) + columnRanges[col].min;
        } while (this.numberExistsInColumn(grid, col, num));
        
        grid[row][col] = { value: num, marked: false };
      }
    }

    // Fill remaining cells with null (empty spaces)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === null) {
          grid[row][col] = { value: null, marked: false };
        }
      }
    }

    return grid;
  }

  /**
   * Get 5 random columns for a row in 90-ball
   */
  static getRandomColumns() {
    const columns = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const selected = [];
    
    while (selected.length < 5) {
      const index = Math.floor(Math.random() * columns.length);
      selected.push(columns[index]);
      columns.splice(index, 1);
    }
    
    return selected.sort((a, b) => a - b);
  }

  /**
   * Check if number exists in column (90-ball)
   */
  static numberExistsInColumn(grid, col, num) {
    for (let row = 0; row < 3; row++) {
      if (grid[row][col] && grid[row][col].value === num) {
        return true;
      }
    }
    return false;
  }
  /**
   * Join a room
   */
  static async joinRoom(roomCode, userId, cardsToBuy = 1, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get room details
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE code = $1 AND status = 'waiting'`,
        [roomCode]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found or already started');
      }

      const room = roomResult.rows[0];

      // Check if user already in room
      const existingPlayer = await dbQuery(
        `SELECT * FROM bingo_v2_room_players WHERE room_id = $1 AND user_id = $2`,
        [room.id, userId]
      );

      if (existingPlayer.rows.length > 0) {
        return { room, player: existingPlayer.rows[0], alreadyJoined: true };
      }

      // Check room capacity
      const playerCount = await dbQuery(
        `SELECT COUNT(*) as count FROM bingo_v2_room_players WHERE room_id = $1`,
        [room.id]
      );

      if (parseInt(playerCount.rows[0].count) >= room.max_players) {
        throw new Error('Room is full');
      }

      // Check user balance
      const totalCost = room.card_cost * cardsToBuy;
      const userResult = await dbQuery(
        `SELECT coins_balance, fires_balance FROM users WHERE id = $1`,
        [userId]
      );

      const user = userResult.rows[0];
      const userBalance = room.currency_type === 'coins' ? user.coins_balance : user.fires_balance;

      if (userBalance < totalCost) {
        throw new Error(`Insufficient ${room.currency_type}`);
      }

      // Deduct cost
      const columnName = room.currency_type === 'coins' ? 'coins_balance' : 'fires_balance';
      await dbQuery(
        `UPDATE users SET ${columnName} = ${columnName} - $1 WHERE id = $2`,
        [totalCost, userId]
      );

      // Add player to room
      const playerResult = await dbQuery(
        `INSERT INTO bingo_v2_room_players (room_id, user_id, cards_purchased, total_spent)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [room.id, userId, cardsToBuy, totalCost]
      );

      // Update room pot
      await dbQuery(
        `UPDATE bingo_v2_rooms SET total_pot = total_pot + $1 WHERE id = $2`,
        [totalCost, room.id]
      );

      // Generate cards for the player
      const player = playerResult.rows[0];
      await this.generateCardsForPlayer(room.id, player.id, cardsToBuy, room.mode, dbQuery);

      // Log the join
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [room.id, userId, 'player_joined', { cards_purchased: cardsToBuy, cost: totalCost }]
      );

      return { room, player, cardsGenerated: cardsToBuy };
    } catch (error) {
      logger.error('Error joining room:', error);
      throw error;
    }
  }

  /**
   * Generate cards for a player
   */
  static async generateCardsForPlayer(roomId, playerId, count, mode, dbQuery) {
    const cards = [];
    
    for (let i = 0; i < count; i++) {
      const grid = mode === '75' ? this.generate75BallCard() : this.generate90BallCard();
      
      const result = await dbQuery(
        `INSERT INTO bingo_v2_cards (room_id, player_id, card_number, grid)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [roomId, playerId, i + 1, JSON.stringify(grid)]
      );
      
      cards.push(result.rows[0]);
    }
    
    return cards;
  }

  /**
   * Get room details with players and cards
   */
  static async getRoomDetails(roomCode, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get room
      const roomResult = await dbQuery(
        `SELECT r.*, u.username as host_name 
         FROM bingo_v2_rooms r
         JOIN users u ON r.host_id = u.id
         WHERE r.code = $1`,
        [roomCode]
      );

      if (roomResult.rows.length === 0) {
        return null;
      }

      const room = roomResult.rows[0];

      // Get players
      const playersResult = await dbQuery(
        `SELECT p.*, u.username, u.experience
         FROM bingo_v2_room_players p
         JOIN users u ON p.user_id = u.id
         WHERE p.room_id = $1
         ORDER BY p.joined_at`,
        [room.id]
      );

      // Get cards for each player
      const players = [];
      for (const player of playersResult.rows) {
        const cardsResult = await dbQuery(
          `SELECT * FROM bingo_v2_cards 
           WHERE room_id = $1 AND player_id = $2
           ORDER BY card_number`,
          [room.id, player.id]
        );
        
        players.push({
          ...player,
          cards: cardsResult.rows
        });
      }

      return {
        ...room,
        players
      };
    } catch (error) {
      logger.error('Error getting room details:', error);
      throw error;
    }
  }

  /**
   * Start a game
   */
  static async startGame(roomId, hostId, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Verify host
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1 AND host_id = $2`,
        [roomId, hostId]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Unauthorized or room not found');
      }

      const room = roomResult.rows[0];

      if (room.status !== 'waiting') {
        throw new Error('Game already started');
      }

      // Check minimum players
      const playerCount = await dbQuery(
        `SELECT COUNT(*) as count FROM bingo_v2_room_players WHERE room_id = $1`,
        [roomId]
      );

      if (parseInt(playerCount.rows[0].count) < 1) {
        throw new Error('Need at least 1 player to start');
      }

      // Update room status
      await dbQuery(
        `UPDATE bingo_v2_rooms 
         SET status = 'in_progress', 
             started_at = NOW(),
             current_game_number = current_game_number + 1
         WHERE id = $1`,
        [roomId]
      );

      // Log start
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [roomId, hostId, 'game_started', { game_number: room.current_game_number + 1 }]
      );

      return { success: true, gameNumber: room.current_game_number + 1 };
    } catch (error) {
      logger.error('Error starting game:', error);
      throw error;
    }
  }

  /**
   * Call a number
   */
  static async callNumber(roomId, calledBy, isAuto = false, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get room
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1 AND status = 'in_progress'`,
        [roomId]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found or not in progress');
      }

      const room = roomResult.rows[0];

      // Generate next number
      const maxNumber = room.mode === '75' ? 75 : 90;
      const drawnNumbers = room.drawn_numbers || [];
      
      if (drawnNumbers.length >= maxNumber) {
        throw new Error('All numbers have been called');
      }

      let nextNumber;
      do {
        nextNumber = Math.floor(Math.random() * maxNumber) + 1;
      } while (drawnNumbers.includes(nextNumber));

      // Add to drawn numbers
      drawnNumbers.push(nextNumber);

      // Update room
      await dbQuery(
        `UPDATE bingo_v2_rooms 
         SET drawn_numbers = $1, last_called_number = $2
         WHERE id = $3`,
        [JSON.stringify(drawnNumbers), nextNumber, roomId]
      );

      // Record in draw history
      await dbQuery(
        `INSERT INTO bingo_v2_draws (room_id, number, draw_order, drawn_by)
         VALUES ($1, $2, $3, $4)`,
        [roomId, nextNumber, drawnNumbers.length, calledBy]
      );

      // Log the call
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [roomId, calledBy, isAuto ? 'auto_called_number' : 'called_number', { number: nextNumber }]
      );

      return {
        number: nextNumber,
        totalCalled: drawnNumbers.length,
        drawnNumbers
      };
    } catch (error) {
      logger.error('Error calling number:', error);
      throw error;
    }
  }

  /**
   * Mark a number on player's cards
   */
  static async markNumber(roomId, playerId, cardId, position, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get card
      const cardResult = await dbQuery(
        `SELECT * FROM bingo_v2_cards WHERE id = $1 AND room_id = $2 AND player_id = $3`,
        [cardId, roomId, playerId]
      );

      if (cardResult.rows.length === 0) {
        throw new Error('Card not found');
      }

      const card = cardResult.rows[0];
      const grid = card.grid;
      const markedNumbers = card.marked_numbers || [];
      const markedPositions = card.marked_positions || [];

      // Get the number at position
      const number = grid[position.row][position.col].value;

      // Check if number was called
      const roomResult = await dbQuery(
        `SELECT drawn_numbers FROM bingo_v2_rooms WHERE id = $1`,
        [roomId]
      );

      const drawnNumbers = roomResult.rows[0].drawn_numbers || [];

      if (number !== 'FREE' && !drawnNumbers.includes(number)) {
        throw new Error('Number not yet called');
      }

      // Mark the number
      if (!markedNumbers.includes(number)) {
        markedNumbers.push(number);
        markedPositions.push(position);

        await dbQuery(
          `UPDATE bingo_v2_cards 
           SET marked_numbers = $1, marked_positions = $2
           WHERE id = $3`,
          [JSON.stringify(markedNumbers), JSON.stringify(markedPositions), cardId]
        );
      }

      return { marked: true, number, position };
    } catch (error) {
      logger.error('Error marking number:', error);
      throw error;
    }
  }

  /**
   * Validate winning pattern
   */
  static async validateBingo(roomId, playerId, cardId, pattern, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get card
      const cardResult = await dbQuery(
        `SELECT * FROM bingo_v2_cards WHERE id = $1 AND room_id = $2 AND player_id = $3`,
        [cardId, roomId, playerId]
      );

      if (cardResult.rows.length === 0) {
        throw new Error('Card not found');
      }

      const card = cardResult.rows[0];
      const grid = card.grid;
      const markedPositions = card.marked_positions || [];

      // Get room mode
      const roomResult = await dbQuery(
        `SELECT mode FROM bingo_v2_rooms WHERE id = $1`,
        [roomId]
      );

      const mode = roomResult.rows[0].mode;

      // Validate pattern based on mode
      const isValid = mode === '75' 
        ? this.validatePattern75(grid, markedPositions, pattern)
        : this.validatePattern90(grid, markedPositions, pattern);

      if (isValid) {
        // Mark as winner
        await dbQuery(
          `UPDATE bingo_v2_cards 
           SET has_bingo = true, pattern_completed = $1, completed_at = NOW()
           WHERE id = $2`,
          [pattern, cardId]
        );

        // Update room with winner
        await dbQuery(
          `UPDATE bingo_v2_rooms 
           SET winner_id = $1, status = 'finished', finished_at = NOW()
           WHERE id = $2`,
          [playerId, roomId]
        );

        // Log the win
        await dbQuery(
          `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
           VALUES ($1, $2, $3, $4)`,
          [roomId, playerId, 'bingo_validated', { pattern, card_id: cardId }]
        );

        // Distribute prizes
        const prizes = await this.distributePrizes(roomId, playerId, dbQuery);

        return { valid: true, pattern, prizes };
      }

      return { valid: false };
    } catch (error) {
      logger.error('Error validating bingo:', error);
      throw error;
    }
  }

  /**
   * Validate 75-ball patterns
   */
  static validatePattern75(grid, markedPositions, pattern) {
    const marked = new Set(markedPositions.map(p => `${p.row},${p.col}`));

    switch (pattern) {
      case 'line':
        // Check horizontal lines
        for (let row = 0; row < 5; row++) {
          let complete = true;
          for (let col = 0; col < 5; col++) {
            if (grid[row][col].value === 'FREE') continue;
            if (!marked.has(`${row},${col}`)) {
              complete = false;
              break;
            }
          }
          if (complete) return true;
        }

        // Check vertical lines
        for (let col = 0; col < 5; col++) {
          let complete = true;
          for (let row = 0; row < 5; row++) {
            if (grid[row][col].value === 'FREE') continue;
            if (!marked.has(`${row},${col}`)) {
              complete = false;
              break;
            }
          }
          if (complete) return true;
        }

        // Check diagonals
        let diagonal1 = true;
        let diagonal2 = true;
        for (let i = 0; i < 5; i++) {
          if (grid[i][i].value !== 'FREE' && !marked.has(`${i},${i}`)) {
            diagonal1 = false;
          }
          if (grid[i][4-i].value !== 'FREE' && !marked.has(`${i},${4-i}`)) {
            diagonal2 = false;
          }
        }
        return diagonal1 || diagonal2;

      case 'corners':
        const corners = [
          [0, 0], [0, 4], [4, 0], [4, 4]
        ];
        return corners.every(([r, c]) => marked.has(`${r},${c}`));

      case 'fullcard':
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if (grid[row][col].value === 'FREE') continue;
            if (!marked.has(`${row},${col}`)) return false;
          }
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Validate 90-ball patterns
   */
  static validatePattern90(grid, markedPositions, pattern) {
    const marked = new Set(markedPositions.map(p => `${p.row},${p.col}`));

    switch (pattern) {
      case 'line':
        // Check horizontal lines (each row)
        for (let row = 0; row < 3; row++) {
          let complete = true;
          for (let col = 0; col < 9; col++) {
            if (grid[row][col].value === null) continue;
            if (!marked.has(`${row},${col}`)) {
              complete = false;
              break;
            }
          }
          if (complete) return true;
        }
        return false;

      case 'fullcard':
        // All 15 numbers must be marked
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 9; col++) {
            if (grid[row][col].value === null) continue;
            if (!marked.has(`${row},${col}`)) return false;
          }
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Distribute prizes
   */
  static async distributePrizes(roomId, winnerId, dbQuery) {
    try {
      // Get room and pot
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1`,
        [roomId]
      );

      const room = roomResult.rows[0];
      const totalPot = parseFloat(room.total_pot);

      // Calculate distribution (70% winner, 20% host, 10% platform)
      const winnerPrize = totalPot * 0.7;
      const hostPrize = totalPot * 0.2;
      const platformFee = totalPot * 0.1;

      // Get winner user ID (from players table)
      const winnerResult = await dbQuery(
        `SELECT user_id FROM bingo_v2_room_players WHERE id = $1`,
        [winnerId]
      );
      const winnerUserId = winnerResult.rows[0].user_id;

      // Award prizes
      const currencyColumn = room.currency_type === 'coins' ? 'coins_balance' : 'fires_balance';
      await dbQuery(
        `UPDATE users 
         SET ${currencyColumn} = ${currencyColumn} + $1,
             experience = experience + 1,
             total_games_played = total_games_played + 1,
             total_games_won = total_games_won + 1
         WHERE id = $2`,
        [winnerPrize, winnerUserId]
      );

      // Award host (if not the winner)
      if (room.host_id !== winnerUserId) {
        await dbQuery(
          `UPDATE users 
           SET ${currencyColumn} = ${currencyColumn} + $1,
               experience = experience + 1,
               total_games_played = total_games_played + 1
           WHERE id = $2`,
          [hostPrize, room.host_id]
        );
      } else {
        // If host is winner, they get both prizes
        await dbQuery(
          `UPDATE users 
           SET ${currencyColumn} = ${currencyColumn} + $1
           WHERE id = $2`,
          [hostPrize, winnerUserId]
        );
      }

      // Give experience to all other players
      await dbQuery(
        `UPDATE users 
         SET experience = experience + 1,
             total_games_played = total_games_played + 1
         WHERE id IN (
           SELECT user_id FROM bingo_v2_room_players 
           WHERE room_id = $1 AND user_id != $2
         )`,
        [roomId, winnerUserId]
      );

      // Update player winnings
      await dbQuery(
        `UPDATE bingo_v2_room_players 
         SET winnings = $1 
         WHERE room_id = $2 AND user_id = $3`,
        [winnerPrize, roomId, winnerUserId]
      );

      // Create system messages for all players
      const playersResult = await dbQuery(
        `SELECT user_id FROM bingo_v2_room_players WHERE room_id = $1`,
        [roomId]
      );

      for (const player of playersResult.rows) {
        const isWinner = player.user_id === winnerUserId;
        const message = isWinner
          ? `¡Felicidades! Has ganado ${winnerPrize.toFixed(2)} ${room.currency_type} en el Bingo (Sala #${room.code})`
          : `El juego ha terminado. El ganador fue anunciado (Sala #${room.code})`;

        await dbQuery(
          `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
           VALUES ($1, 'system', 'Resultado de Bingo', $2, $3)`,
          [
            player.user_id,
            message,
            JSON.stringify({
              room_code: room.code,
              winner_id: winnerUserId,
              prize: isWinner ? winnerPrize : 0,
              total_pot: totalPot
            })
          ]
        );
      }

      // Log prize distribution
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [
          roomId, 
          winnerId, 
          'prizes_distributed',
          {
            winner_prize: winnerPrize,
            host_prize: hostPrize,
            platform_fee: platformFee,
            total_pot: totalPot
          }
        ]
      );

      return {
        winnerPrize,
        hostPrize,
        platformFee,
        totalPot
      };
    } catch (error) {
      logger.error('Error distributing prizes:', error);
      throw error;
    }
  }

  /**
   * Cancel room and refund
   */
  static async cancelRoom(roomId, reason = 'Manual cancellation', client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get room details
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1`,
        [roomId]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }

      const room = roomResult.rows[0];

      if (room.status === 'finished' || room.status === 'cancelled') {
        return { alreadyCancelled: true };
      }

      // Get all players and refund
      const playersResult = await dbQuery(
        `SELECT * FROM bingo_v2_room_players WHERE room_id = $1`,
        [roomId]
      );

      for (const player of playersResult.rows) {
        // Refund the player
        await dbQuery(
          `UPDATE users 
           SET ${room.currency_type} = ${room.currency_type} + $1
           WHERE id = $2`,
          [player.total_spent, player.user_id]
        );

        // Send refund message
        await dbQuery(
          `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
           VALUES ($1, 'system', 'Reembolso de Bingo', $2, $3)`,
          [
            player.user_id,
            `La sala de Bingo #${room.code} fue cancelada. Se te han devuelto ${player.total_spent} ${room.currency_type}.`,
            JSON.stringify({
              room_code: room.code,
              refund: player.total_spent,
              reason
            })
          ]
        );
      }

      // Update room status
      await dbQuery(
        `UPDATE bingo_v2_rooms 
         SET status = 'cancelled', finished_at = NOW()
         WHERE id = $1`,
        [roomId]
      );

      // Log cancellation
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, action, details)
         VALUES ($1, 'room_cancelled', $2)`,
        [roomId, { reason }]
      );

      return { success: true, refunded: playersResult.rows.length };
    } catch (error) {
      logger.error('Error cancelling room:', error);
      throw error;
    }
  }
}

module.exports = BingoV2Service;
