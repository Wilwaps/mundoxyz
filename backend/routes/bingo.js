const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Generate room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate bingo card
function generateBingoCard(ballCount = 75) {
  const card = [];
  
  if (ballCount === 75) {
    // 5x5 card for 75-ball bingo
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
        if (col === 2 && row === 2) {
          column.push('FREE'); // Center free space
        } else {
          let num;
          do {
            num = Math.floor(Math.random() * (ranges[col].max - ranges[col].min + 1)) + ranges[col].min;
          } while (used.has(num));
          used.add(num);
          column.push(num);
        }
      }
      card.push(column);
    }
  } else {
    // 3x9 card for 90-ball bingo
    for (let row = 0; row < 3; row++) {
      const rowData = [];
      for (let col = 0; col < 9; col++) {
        const min = col * 10 + 1;
        const max = col === 8 ? 90 : (col + 1) * 10;
        if (Math.random() < 0.55) { // ~5 numbers per row
          const num = Math.floor(Math.random() * (max - min + 1)) + min;
          rowData.push(num);
        } else {
          rowData.push(null);
        }
      }
      card.push(rowData);
    }
  }
  
  return card;
}

// Create bingo room
router.post('/create', verifyToken, async (req, res) => {
  try {
    const {
      name,
      mode = 'friendly',
      victory_mode = 'line',
      ball_count = 75,
      entry_price = 0,
      max_players = 20,
      max_cards_per_player = 3,
      visibility = 'public'
    } = req.body;
    
    const hostId = req.user.id;
    
    // Validate inputs
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    
    if (!['friendly', 'fires', 'coins'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    
    if (!['line', 'corners', 'full'].includes(victory_mode)) {
      return res.status(400).json({ error: 'Invalid victory mode' });
    }
    
    if (![75, 90].includes(ball_count)) {
      return res.status(400).json({ error: 'Ball count must be 75 or 90' });
    }
    
    if (mode !== 'friendly' && entry_price < 10) {
      return res.status(400).json({ error: 'Minimum entry price is 10' });
    }
    
    // Generate unique room code
    let code;
    let attempts = 0;
    do {
      code = generateRoomCode();
      const existing = await query('SELECT 1 FROM bingo_rooms WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);
    
    // Create room
    const result = await query(
      `INSERT INTO bingo_rooms 
       (id, code, host_id, name, mode, victory_mode, ball_count, 
        entry_price_fire, entry_price_coin, max_players, 
        max_cards_per_player, visibility, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'waiting')
       RETURNING *`,
      [
        uuidv4(),
        code,
        hostId,
        name,
        mode,
        victory_mode,
        ball_count,
        mode === 'fires' ? entry_price : 0,
        mode === 'coins' ? entry_price : 0,
        max_players,
        max_cards_per_player,
        visibility
      ]
    );
    
    const room = result.rows[0];
    
    // Host automatically joins
    await query(
      `INSERT INTO bingo_players (room_id, user_id, user_ext, cards_count)
       VALUES ($1, $2, $3, 1)`,
      [room.id, hostId, `db:${hostId}`]
    );
    
    logger.info('Bingo room created', { 
      roomId: room.id, 
      code: room.code,
      host: req.user.username 
    });
    
    res.json({
      success: true,
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        mode: room.mode,
        victory_mode: room.victory_mode,
        ball_count: room.ball_count,
        entry_price: entry_price
      }
    });
    
  } catch (error) {
    logger.error('Error creating bingo room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join bingo room
router.post('/join/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { cards_count = 1 } = req.body;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      // Get room
      const roomResult = await client.query(
        'SELECT * FROM bingo_rooms WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Room not found');
      }
      
      const room = roomResult.rows[0];
      
      if (room.status !== 'waiting') {
        throw new Error('Room is not accepting players');
      }
      
      // Check if already joined
      const existingPlayer = await client.query(
        'SELECT * FROM bingo_players WHERE room_id = $1 AND user_id = $2',
        [room.id, userId]
      );
      
      if (existingPlayer.rows.length > 0) {
        throw new Error('Already in this room');
      }
      
      // Check max players
      const playerCount = await client.query(
        'SELECT COUNT(*) as count FROM bingo_players WHERE room_id = $1',
        [room.id]
      );
      
      if (parseInt(playerCount.rows[0].count) >= room.max_players) {
        throw new Error('Room is full');
      }
      
      // Validate cards count
      if (cards_count < 1 || cards_count > room.max_cards_per_player) {
        throw new Error(`Cards must be between 1 and ${room.max_cards_per_player}`);
      }
      
      // Calculate cost
      let firesCost = 0, coinsCost = 0;
      
      if (room.mode === 'fires') {
        firesCost = parseFloat(room.entry_price_fire) * cards_count;
      } else if (room.mode === 'coins') {
        coinsCost = parseFloat(room.entry_price_coin) * cards_count;
      }
      
      // Check and deduct balance if not free mode
      if (firesCost > 0 || coinsCost > 0) {
        const walletResult = await client.query(
          'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        
        if (walletResult.rows.length === 0) {
          throw new Error('Wallet not found');
        }
        
        const wallet = walletResult.rows[0];
        
        if (firesCost > 0 && parseFloat(wallet.fires_balance) < firesCost) {
          throw new Error('Insufficient fires balance');
        }
        
        if (coinsCost > 0 && parseFloat(wallet.coins_balance) < coinsCost) {
          throw new Error('Insufficient coins balance');
        }
        
        // Deduct balance
        await client.query(
          `UPDATE wallets 
           SET fires_balance = fires_balance - $1,
               coins_balance = coins_balance - $2,
               total_fires_spent = total_fires_spent + $1,
               total_coins_spent = total_coins_spent + $2
           WHERE user_id = $3`,
          [firesCost, coinsCost, userId]
        );
        
        // Add to pot
        await client.query(
          `UPDATE bingo_rooms 
           SET pot_fires = pot_fires + $1,
               pot_coins = pot_coins + $2
           WHERE id = $3`,
          [firesCost, coinsCost, room.id]
        );
      }
      
      // Join room
      await client.query(
        `INSERT INTO bingo_players 
         (room_id, user_id, user_ext, cards_count, fires_spent, coins_spent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [room.id, userId, `db:${userId}`, cards_count, firesCost, coinsCost]
      );
      
      return {
        room_id: room.id,
        room_code: room.code,
        room_name: room.name,
        cards_count,
        fires_spent: firesCost,
        coins_spent: coinsCost
      };
    });
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error('Error joining bingo room:', error);
    res.status(400).json({ error: error.message || 'Failed to join room' });
  }
});

// Get room details
router.get('/room/:code', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    
    // Get room
    const roomResult = await query(
      `SELECT 
        br.*,
        u.username as host_username,
        COUNT(bp.id) as player_count
       FROM bingo_rooms br
       JOIN users u ON u.id = br.host_id
       LEFT JOIN bingo_players bp ON bp.room_id = br.id
       WHERE br.code = $1
       GROUP BY br.id, u.username`,
      [code]
    );
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = roomResult.rows[0];
    
    // Get players
    const playersResult = await query(
      `SELECT 
        bp.*,
        u.username,
        u.display_name,
        u.avatar_url
       FROM bingo_players bp
       JOIN users u ON u.id = bp.user_id
       WHERE bp.room_id = $1
       ORDER BY bp.joined_at`,
      [room.id]
    );
    
    // Get user's cards if they're in the room
    let myCards = [];
    const myPlayer = playersResult.rows.find(p => p.user_id === req.user.id);
    
    if (myPlayer && room.status !== 'waiting') {
      const cardsResult = await query(
        'SELECT * FROM bingo_cards WHERE player_id = $1',
        [myPlayer.id]
      );
      myCards = cardsResult.rows;
    }
    
    res.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        mode: room.mode,
        victory_mode: room.victory_mode,
        ball_count: room.ball_count,
        status: room.status,
        pot_fires: parseFloat(room.pot_fires),
        pot_coins: parseFloat(room.pot_coins),
        max_players: room.max_players,
        current_players: room.player_count,
        host_username: room.host_username,
        numbers_drawn: room.numbers_drawn || [],
        current_number: room.current_number
      },
      players: playersResult.rows.map(p => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        cards_count: p.cards_count,
        is_ready: p.is_ready,
        is_host: p.user_id === room.host_id
      })),
      my_cards: myCards,
      is_host: req.user.id === room.host_id
    });
    
  } catch (error) {
    logger.error('Error fetching bingo room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Mark ready
router.post('/room/:code/ready', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      `UPDATE bingo_players 
       SET is_ready = true 
       WHERE user_id = $1 AND room_id = (
         SELECT id FROM bingo_rooms WHERE code = $2 AND status = 'waiting'
       )
       RETURNING *`,
      [userId, code]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot mark ready' });
    }
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Error marking ready:', error);
    res.status(500).json({ error: 'Failed to mark ready' });
  }
});

// Start game (host only)
router.post('/room/:code/start', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      // Get room and verify host
      const roomResult = await client.query(
        'SELECT * FROM bingo_rooms WHERE code = $1 AND host_id = $2 FOR UPDATE',
        [code, userId]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Room not found or you are not the host');
      }
      
      const room = roomResult.rows[0];
      
      if (room.status !== 'waiting') {
        throw new Error('Game already started');
      }
      
      // Get ready players
      const playersResult = await client.query(
        'SELECT * FROM bingo_players WHERE room_id = $1 AND is_ready = true',
        [room.id]
      );
      
      if (playersResult.rows.length < 2) {
        throw new Error('Not enough ready players');
      }
      
      // Generate cards for each player
      for (const player of playersResult.rows) {
        for (let i = 0; i < player.cards_count; i++) {
          const card = generateBingoCard(room.ball_count);
          
          await client.query(
            'INSERT INTO bingo_cards (room_id, player_id, card_number, card_data) VALUES ($1, $2, $3, $4)',
            [room.id, player.id, i + 1, JSON.stringify(card)]
          );
        }
      }
      
      // Update room status
      await client.query(
        'UPDATE bingo_rooms SET status = \'playing\', starts_at = NOW() WHERE id = $1',
        [room.id]
      );
      
      // Update players status
      await client.query(
        'UPDATE bingo_players SET status = \'playing\' WHERE room_id = $1 AND is_ready = true',
        [room.id]
      );
      
      return { success: true };
    });
    
    logger.info('Bingo game started', { code, host: req.user.username });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error starting bingo game:', error);
    res.status(400).json({ error: error.message || 'Failed to start game' });
  }
});

// Draw number (host only)
router.post('/room/:code/draw', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      // Get room and verify host
      const roomResult = await client.query(
        'SELECT * FROM bingo_rooms WHERE code = $1 AND host_id = $2 FOR UPDATE',
        [code, userId]
      );
      
      if (roomResult.rows.length === 0) {
        throw new Error('Room not found or you are not the host');
      }
      
      const room = roomResult.rows[0];
      
      if (room.status !== 'playing') {
        throw new Error('Game is not in playing state');
      }
      
      const drawnNumbers = room.numbers_drawn || [];
      const maxNumber = room.ball_count;
      
      if (drawnNumbers.length >= maxNumber) {
        throw new Error('All numbers have been drawn');
      }
      
      // Generate new number
      let newNumber;
      do {
        newNumber = Math.floor(Math.random() * maxNumber) + 1;
      } while (drawnNumbers.includes(newNumber));
      
      drawnNumbers.push(newNumber);
      
      // Update room
      await client.query(
        'UPDATE bingo_rooms SET numbers_drawn = $1, current_number = $2 WHERE id = $3',
        [drawnNumbers, newNumber, room.id]
      );
      
      // Record draw
      await client.query(
        'INSERT INTO bingo_draws (room_id, number, draw_order, drawn_by) VALUES ($1, $2, $3, $4)',
        [room.id, newNumber, drawnNumbers.length, userId]
      );
      
      return {
        number: newNumber,
        total_drawn: drawnNumbers.length,
        all_numbers: drawnNumbers
      };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error drawing number:', error);
    res.status(400).json({ error: error.message || 'Failed to draw number' });
  }
});

module.exports = router;
