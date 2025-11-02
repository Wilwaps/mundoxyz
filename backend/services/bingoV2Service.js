const { query, getClient } = require('../db');
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
   * Check room creation limits based on user XP
   * Returns: { allowed: boolean, reason: string, currentRooms: number, maxRooms: number }
   */
  static async checkRoomLimits(hostId, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;
    
    try {
      // Get user XP
      const userResult = await dbQuery(
        `SELECT experience FROM users WHERE id = $1`,
        [hostId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userXP = userResult.rows[0].experience || 0;
      const maxRooms = userXP >= 500 ? 3 : 1;

      // Count active rooms (waiting status only)
      const roomsResult = await dbQuery(
        `SELECT COUNT(*) as count 
         FROM bingo_v2_rooms 
         WHERE host_id = $1 AND status = 'waiting'`,
        [hostId]
      );

      const currentRooms = parseInt(roomsResult.rows[0].count);

      const allowed = currentRooms < maxRooms;
      const reason = allowed 
        ? 'OK' 
        : `Has alcanzado el límite de ${maxRooms} sala(s) activa(s). ${userXP < 500 ? 'Alcanza 500 XP para crear hasta 3 salas.' : ''}`;

      return {
        allowed,
        reason,
        currentRooms,
        maxRooms,
        userXP
      };
    } catch (error) {
      logger.error('Error checking room limits:', error);
      throw error;
    }
  }

  /**
   * Create a new bingo room
   */
  static async createRoom(hostId, config, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;
    
    try {
      // Check room limits
      const limits = await this.checkRoomLimits(hostId, client);
      if (!limits.allowed) {
        throw new Error(limits.reason);
      }

      const roomCode = await this.generateRoomCode();
      
      // Determine if auto-call should be enabled based on XP
      const autoCallEnabled = limits.userXP >= 500;
      
      const result = await dbQuery(
        `INSERT INTO bingo_v2_rooms (
          code, name, host_id, mode, pattern_type, is_public,
          max_players, max_cards_per_player, currency_type, card_cost,
          auto_call_enabled, auto_call_interval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          config.card_cost || 10,
          autoCallEnabled,
          config.auto_call_interval || 5
        ]
      );

      const room = result.rows[0];

      // Log the creation
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [room.id, hostId, 'room_created', { config, autoCallEnabled, userXP: limits.userXP }]
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
      const walletResult = await dbQuery(
        `SELECT coins_balance, fires_balance FROM wallets WHERE user_id = $1`,
        [userId]
      );

      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = walletResult.rows[0];
      const userBalance = room.currency_type === 'coins' ? wallet.coins_balance : wallet.fires_balance;

      if (userBalance < totalCost) {
        throw new Error(`Insufficient ${room.currency_type}`);
      }

      // Deduct cost
      const columnName = room.currency_type === 'coins' ? 'coins_balance' : 'fires_balance';
      await dbQuery(
        `UPDATE wallets SET ${columnName} = ${columnName} - $1 WHERE user_id = $2`,
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
    let dbQuery = client ? client.query.bind(client) : query;
    let transactionClient = null;
    const useTransaction = !client; // If no client provided, use transaction

    try {
      // Start transaction if needed
      if (useTransaction) {
        transactionClient = await getClient();
        await transactionClient.query('BEGIN');
        dbQuery = transactionClient.query.bind(transactionClient);
      }

      // Get room with lock to prevent race conditions
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1 AND status = 'in_progress' FOR UPDATE`,
        [roomId]
      );

      if (roomResult.rows.length === 0) {
        throw new Error('Room not found or not in progress');
      }

      const room = roomResult.rows[0];
      
      // Rate limiting: verificar último número cantado (solo si la columna existe)
      if (room.hasOwnProperty('last_called_at') && room.last_called_at && !isAuto) {
        const timeSinceLastCall = Date.now() - new Date(room.last_called_at).getTime();
        if (timeSinceLastCall < 1500) { // 1.5 segundos mínimo entre cantos manuales
          throw new Error('Por favor espera un momento antes de cantar otro número');
        }
      }

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

      // Update room (incluye last_called_at solo si existe la columna)
      try {
        await dbQuery(
          `UPDATE bingo_v2_rooms 
           SET drawn_numbers = $1, last_called_number = $2, last_called_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(drawnNumbers), nextNumber, roomId]
        );
      } catch (err) {
        // Si falla por last_called_at, intentar sin esa columna
        if (err.message.includes('last_called_at')) {
          await dbQuery(
            `UPDATE bingo_v2_rooms 
             SET drawn_numbers = $1, last_called_number = $2
             WHERE id = $3`,
            [JSON.stringify(drawnNumbers), nextNumber, roomId]
          );
        } else {
          throw err;
        }
      }

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

      // Commit transaction if used
      if (useTransaction && transactionClient) {
        await transactionClient.query('COMMIT');
      }

      return {
        number: nextNumber,
        totalCalled: drawnNumbers.length,
        drawnNumbers
      };
    } catch (error) {
      // Rollback transaction on error
      if (useTransaction && transactionClient) {
        try {
          await transactionClient.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Error rolling back transaction:', rollbackError);
        }
      }
      logger.error('Error calling number:', error);
      throw error;
    } finally {
      // Release client if used
      if (transactionClient) {
        transactionClient.release();
      }
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
        `UPDATE wallets 
         SET ${currencyColumn} = ${currencyColumn} + $1
         WHERE user_id = $2`,
        [winnerPrize, winnerUserId]
      );

      // Update user stats
      await dbQuery(
        `UPDATE users 
         SET experience = experience + 1,
             total_games_played = total_games_played + 1,
             total_games_won = total_games_won + 1
         WHERE id = $1`,
        [winnerUserId]
      );

      // Award host (if not the winner)
      if (room.host_id !== winnerUserId) {
        await dbQuery(
          `UPDATE wallets 
           SET ${currencyColumn} = ${currencyColumn} + $1
           WHERE user_id = $2`,
          [hostPrize, room.host_id]
        );

        await dbQuery(
          `UPDATE users 
           SET experience = experience + 1,
               total_games_played = total_games_played + 1
           WHERE id = $1`,
          [room.host_id]
        );
      } else {
        // If host is winner, they get both prizes
        await dbQuery(
          `UPDATE wallets 
           SET ${currencyColumn} = ${currencyColumn} + $1
           WHERE user_id = $2`,
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
   * Check if host can close a room
   * Rules: Room must be in 'waiting' status AND (no players joined OR all players left)
   */
  static async canCloseRoom(roomId, hostId, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get room details
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1 AND host_id = $2`,
        [roomId, hostId]
      );

      if (roomResult.rows.length === 0) {
        return { allowed: false, reason: 'Room not found or you are not the host' };
      }

      const room = roomResult.rows[0];

      if (room.status !== 'waiting') {
        return { 
          allowed: false, 
          reason: 'No puedes cerrar una sala que ya está en progreso. Contacta a un administrador si hay problemas.'
        };
      }

      // Count non-host players who have purchased cards
      const playersResult = await dbQuery(
        `SELECT COUNT(*) as count 
         FROM bingo_v2_room_players 
         WHERE room_id = $1 AND user_id != $2 AND cards_purchased > 0`,
        [roomId, hostId]
      );

      const otherPlayersCount = parseInt(playersResult.rows[0].count);

      if (otherPlayersCount > 0) {
        return {
          allowed: false,
          reason: `Hay ${otherPlayersCount} jugador(es) con cartones comprados. No puedes cerrar la sala.`
        };
      }

      return { allowed: true, reason: 'OK' };
    } catch (error) {
      logger.error('Error checking if can close room:', error);
      throw error;
    }
  }

  /**
   * Cancel room and refund all players
   * @param {number} roomId - Room ID
   * @param {string} reason - Reason code: 'host_closed', 'system_failure', 'admin_forced', 'timeout'
   * @param {UUID} refundedBy - User ID of who initiated the refund (host or admin)
   */
  static async cancelRoom(roomId, reason = 'host_closed', refundedBy = null, client = null) {
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
        `SELECT rp.*, u.username 
         FROM bingo_v2_room_players rp
         JOIN users u ON u.id = rp.user_id
         WHERE rp.room_id = $1 AND rp.cards_purchased > 0`,
        [roomId]
      );

      const currencyColumn = room.currency_type === 'coins' ? 'coins_balance' : 'fires_balance';
      let totalRefunded = 0;

      for (const player of playersResult.rows) {
        if (player.total_spent <= 0) continue;

        // Refund to wallet
        await dbQuery(
          `UPDATE wallets 
           SET ${currencyColumn} = ${currencyColumn} + $1
           WHERE user_id = $2`,
          [player.total_spent, player.user_id]
        );

        // Register refund in history
        await dbQuery(
          `INSERT INTO bingo_v2_refunds (room_id, player_id, user_id, amount, currency_type, reason, refunded_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            roomId,
            player.id,
            player.user_id,
            player.total_spent,
            room.currency_type,
            reason,
            refundedBy,
            `Sala #${room.code} cancelada. Motivo: ${reason}`
          ]
        );

        // Send notification message
        const reasonText = {
          'host_closed': 'El anfitrión cerró la sala',
          'system_failure': 'Falla del sistema',
          'admin_forced': 'Acción administrativa',
          'timeout': 'Sala inactiva por tiempo prolongado'
        }[reason] || reason;

        await dbQuery(
          `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
           VALUES ($1, 'system', 'Reembolso de Bingo', $2, $3)`,
          [
            player.user_id,
            `La sala de Bingo #${room.code} fue cancelada. Motivo: ${reasonText}. Se te han devuelto ${player.total_spent} ${room.currency_type}.`,
            JSON.stringify({
              room_code: room.code,
              room_id: roomId,
              refund_amount: player.total_spent,
              currency: room.currency_type,
              reason
            })
          ]
        );

        totalRefunded += parseFloat(player.total_spent);
      }

      // Update room status
      await dbQuery(
        `UPDATE bingo_v2_rooms 
         SET status = 'cancelled', finished_at = NOW(), total_pot = 0
         WHERE id = $1`,
        [roomId]
      );

      // Log cancellation
      await dbQuery(
        `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
         VALUES ($1, $2, 'room_cancelled', $3)`,
        [roomId, refundedBy, { reason, refunded_players: playersResult.rows.length, total_refunded: totalRefunded }]
      );

      logger.info(`Room #${room.code} cancelled. Reason: ${reason}. Refunded ${playersResult.rows.length} players totaling ${totalRefunded} ${room.currency_type}`);

      return { 
        success: true, 
        refunded: playersResult.rows.length,
        totalRefunded,
        roomCode: room.code
      };
    } catch (error) {
      logger.error('Error cancelling room:', error);
      throw error;
    }
  }

  /**
   * Force auto-call when host with >=500 XP leaves the room
   */
  static async forceAutoCallOnHostLeave(roomId, hostId, client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Get user XP and room status
      const userResult = await dbQuery(
        `SELECT experience FROM users WHERE id = $1`,
        [hostId]
      );

      if (userResult.rows.length === 0) {
        return { activated: false, reason: 'User not found' };
      }

      const userXP = userResult.rows[0].experience || 0;

      if (userXP < 500) {
        return { activated: false, reason: 'User XP below 500' };
      }

      // Get room details
      const roomResult = await dbQuery(
        `SELECT * FROM bingo_v2_rooms WHERE id = $1 AND host_id = $2 AND status = 'in_progress'`,
        [roomId, hostId]
      );

      if (roomResult.rows.length === 0) {
        return { activated: false, reason: 'Room not found or not in progress' };
      }

      const room = roomResult.rows[0];

      // Activate auto-call if not already active
      if (!room.auto_call_enabled) {
        await dbQuery(
          `UPDATE bingo_v2_rooms 
           SET auto_call_enabled = TRUE, auto_call_forced = TRUE
           WHERE id = $1`,
          [roomId]
        );

        // Send notification to host
        await dbQuery(
          `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
           VALUES ($1, 'system', 'Autocanto Activado', $2, $3)`,
          [
            hostId,
            `El autocanto se ha activado automáticamente en la sala #${room.code} al salir. Seguirás recibiendo el 20% del pozo.`,
            JSON.stringify({
              room_code: room.code,
              room_id: roomId,
              auto_call_forced: true
            })
          ]
        );

        // Log action
        await dbQuery(
          `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
           VALUES ($1, $2, 'auto_call_forced', $3)`,
          [roomId, hostId, { reason: 'host_left_with_xp_500', userXP }]
        );

        logger.info(`Auto-call forced for room #${room.code}. Host ${hostId} left with ${userXP} XP`);

        return { 
          activated: true, 
          roomCode: room.code,
          message: `Autocanto activado en sala #${room.code}`
        };
      }

      return { activated: false, reason: 'Auto-call already enabled' };
    } catch (error) {
      logger.error('Error forcing auto-call on host leave:', error);
      throw error;
    }
  }

  /**
   * Detect system failures that warrant automatic refund
   * Returns rooms that should be refunded
   */
  static async detectSystemFailures(client = null) {
    const dbQuery = client ? client.query.bind(client) : query;

    try {
      const failedRooms = [];

      // Scenario A: Inactivity for 15+ minutes
      const inactiveResult = await dbQuery(
        `SELECT r.*, u.username as host_name
         FROM bingo_v2_rooms r
         JOIN users u ON u.id = r.host_id
         WHERE r.status = 'in_progress' 
           AND r.last_activity_at < NOW() - INTERVAL '15 minutes'
           AND r.is_stalled = FALSE`,
        []
      );

      for (const room of inactiveResult.rows) {
        // Mark as stalled
        await dbQuery(
          `UPDATE bingo_v2_rooms SET is_stalled = TRUE WHERE id = $1`,
          [room.id]
        );

        failedRooms.push({
          ...room,
          failure_type: 'timeout',
          failure_reason: 'Inactivity for 15+ minutes'
        });

        logger.warn(`Room #${room.code} marked as stalled due to inactivity`);
      }

      // Scenario B: Host disconnected >10 min without auto-call
      const disconnectedHostResult = await dbQuery(
        `SELECT r.*, u.username as host_name, u.experience
         FROM bingo_v2_rooms r
         JOIN users u ON u.id = r.host_id
         WHERE r.status = 'in_progress'
           AND r.auto_call_enabled = FALSE
           AND r.last_activity_at < NOW() - INTERVAL '10 minutes'
           AND r.is_stalled = FALSE`,
        []
      );

      for (const room of disconnectedHostResult.rows) {
        await dbQuery(
          `UPDATE bingo_v2_rooms SET is_stalled = TRUE WHERE id = $1`,
          [room.id]
        );

        failedRooms.push({
          ...room,
          failure_type: 'timeout',
          failure_reason: 'Host disconnected >10 min without auto-call'
        });

        logger.warn(`Room #${room.code} marked as stalled due to host disconnection`);
      }

      return failedRooms;
    } catch (error) {
      logger.error('Error detecting system failures:', error);
      throw error;
    }
  }
}

module.exports = BingoV2Service;
