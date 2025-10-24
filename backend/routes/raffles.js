const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Generate raffle code
function generateRaffleCode() {
  return 'R' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Create raffle
router.post('/create', verifyToken, async (req, res) => {
  try {
    const {
      name,
      description,
      mode = 'free',
      entry_price = 0,
      numbers_range = 100,
      visibility = 'public',
      max_participants,
      prize_description,
      ends_in_hours = 24
    } = req.body;
    
    const hostId = req.user.id;
    
    // Validate inputs
    if (!name) {
      return res.status(400).json({ error: 'Raffle name is required' });
    }
    
    if (!['free', 'fires', 'coins'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    
    if (mode !== 'free' && entry_price <= 0) {
      return res.status(400).json({ error: 'Entry price must be positive for paid raffles' });
    }
    
    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateRaffleCode();
      const existing = await query('SELECT 1 FROM raffles WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
    } while (attempts < 10);
    
    // Create raffle
    const result = await query(
      `INSERT INTO raffles 
       (id, code, host_id, name, description, mode, 
        entry_price_fire, entry_price_coin, numbers_range, 
        visibility, max_participants, prize_meta, status, 
        starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', NOW(), $13)
       RETURNING *`,
      [
        uuidv4(),
        code,
        hostId,
        name,
        description,
        mode,
        mode === 'fires' ? entry_price : 0,
        mode === 'coins' ? entry_price : 0,
        numbers_range,
        visibility,
        max_participants || null,
        JSON.stringify({ description: prize_description }),
        new Date(Date.now() + ends_in_hours * 60 * 60 * 1000)
      ]
    );
    
    const raffle = result.rows[0];
    
    // Initialize numbers
    const numberInserts = [];
    for (let i = 1; i <= numbers_range; i++) {
      numberInserts.push(
        query(
          'INSERT INTO raffle_numbers (raffle_id, number_idx, state) VALUES ($1, $2, \'available\')',
          [raffle.id, i]
        )
      );
    }
    await Promise.all(numberInserts);
    
    logger.info('Raffle created', { 
      raffleId: raffle.id, 
      code: raffle.code,
      host: req.user.username 
    });
    
    res.json({
      success: true,
      raffle: {
        id: raffle.id,
        code: raffle.code,
        name: raffle.name,
        mode: raffle.mode,
        numbers_range: raffle.numbers_range,
        ends_at: raffle.ends_at
      }
    });
    
  } catch (error) {
    logger.error('Error creating raffle:', error);
    res.status(500).json({ error: 'Failed to create raffle' });
  }
});

// Buy raffle numbers
router.post('/:code/buy', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { numbers } = req.body; // Array of number indices to buy
    const userId = req.user.id;
    
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Numbers array is required' });
    }
    
    const result = await transaction(async (client) => {
      // Get raffle
      const raffleResult = await client.query(
        'SELECT * FROM raffles WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (raffleResult.rows.length === 0) {
        throw new Error('Raffle not found');
      }
      
      const raffle = raffleResult.rows[0];
      
      if (raffle.status !== 'active') {
        throw new Error('Raffle is not active');
      }
      
      if (new Date(raffle.ends_at) < new Date()) {
        throw new Error('Raffle has ended');
      }
      
      // Check numbers availability
      const numberCheck = await client.query(
        'SELECT * FROM raffle_numbers WHERE raffle_id = $1 AND number_idx = ANY($2) FOR UPDATE',
        [raffle.id, numbers]
      );
      
      const unavailable = numberCheck.rows.filter(n => n.state !== 'available');
      if (unavailable.length > 0) {
        throw new Error(`Numbers not available: ${unavailable.map(n => n.number_idx).join(', ')}`);
      }
      
      // Calculate cost
      const totalCost = numbers.length * (
        raffle.mode === 'fires' ? parseFloat(raffle.entry_price_fire) :
        raffle.mode === 'coins' ? parseFloat(raffle.entry_price_coin) : 0
      );
      
      let firesCost = 0, coinsCost = 0;
      
      if (raffle.mode === 'fires') {
        firesCost = totalCost;
      } else if (raffle.mode === 'coins') {
        coinsCost = totalCost;
      }
      
      // Check and deduct balance if not free
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
          `UPDATE raffles 
           SET pot_fires = pot_fires + $1,
               pot_coins = pot_coins + $2
           WHERE id = $3`,
          [firesCost, coinsCost, raffle.id]
        );
        
        // Record transaction
        if (firesCost > 0) {
          await client.query(
            `INSERT INTO wallet_transactions 
             (wallet_id, type, currency, amount, balance_before, balance_after, description)
             VALUES (
               (SELECT id FROM wallets WHERE user_id = $1),
               'raffle_entry', 'fires', $2, 
               $3, $4, $5
             )`,
            [userId, firesCost, wallet.fires_balance, 
             wallet.fires_balance - firesCost, `Raffle: ${raffle.name}`]
          );
        }
        
        if (coinsCost > 0) {
          await client.query(
            `INSERT INTO wallet_transactions 
             (wallet_id, type, currency, amount, balance_before, balance_after, description)
             VALUES (
               (SELECT id FROM wallets WHERE user_id = $1),
               'raffle_entry', 'coins', $2, 
               $3, $4, $5
             )`,
            [userId, coinsCost, wallet.coins_balance, 
             wallet.coins_balance - coinsCost, `Raffle: ${raffle.name}`]
          );
        }
      }
      
      // Mark numbers as sold
      await client.query(
        `UPDATE raffle_numbers 
         SET state = 'sold', 
             owner_id = $1, 
             owner_ext = $2, 
             sold_at = NOW()
         WHERE raffle_id = $3 AND number_idx = ANY($4)`,
        [userId, `db:${userId}`, raffle.id, numbers]
      );
      
      // Create/update participant record
      const participantResult = await client.query(
        `INSERT INTO raffle_participants 
         (raffle_id, user_id, user_ext, numbers, fires_spent, coins_spent)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (raffle_id, user_id) 
         DO UPDATE SET 
           numbers = array_cat(raffle_participants.numbers, $4),
           fires_spent = raffle_participants.fires_spent + $5,
           coins_spent = raffle_participants.coins_spent + $6
         RETURNING *`,
        [raffle.id, userId, `db:${userId}`, numbers, firesCost, coinsCost]
      );
      
      return {
        success: true,
        numbers_purchased: numbers,
        total_numbers: participantResult.rows[0].numbers,
        fires_spent: firesCost,
        coins_spent: coinsCost
      };
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error buying raffle numbers:', error);
    res.status(400).json({ error: error.message || 'Failed to buy numbers' });
  }
});

// Get raffle details
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Get raffle
    const raffleResult = await query(
      `SELECT 
        r.*,
        u.username as host_username,
        COUNT(DISTINCT rp.user_id) as participant_count,
        COUNT(DISTINCT rn.number_idx) FILTER (WHERE rn.state = 'sold') as numbers_sold
       FROM raffles r
       JOIN users u ON u.id = r.host_id
       LEFT JOIN raffle_participants rp ON rp.raffle_id = r.id
       LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
       WHERE r.code = $1
       GROUP BY r.id, u.username`,
      [code]
    );
    
    if (raffleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Raffle not found' });
    }
    
    const raffle = raffleResult.rows[0];
    
    // Get numbers status
    const numbersResult = await query(
      `SELECT 
        number_idx,
        state,
        owner_id,
        u.username as owner_username
       FROM raffle_numbers rn
       LEFT JOIN users u ON u.id = rn.owner_id
       WHERE rn.raffle_id = $1
       ORDER BY rn.number_idx`,
      [raffle.id]
    );
    
    // Get participants
    const participantsResult = await query(
      `SELECT 
        rp.user_id,
        u.username,
        u.display_name,
        array_length(rp.numbers, 1) as numbers_count,
        rp.fires_spent,
        rp.coins_spent
       FROM raffle_participants rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.raffle_id = $1
       ORDER BY array_length(rp.numbers, 1) DESC`,
      [raffle.id]
    );
    
    res.json({
      raffle: {
        id: raffle.id,
        code: raffle.code,
        name: raffle.name,
        description: raffle.description,
        mode: raffle.mode,
        status: raffle.status,
        entry_price_fire: parseFloat(raffle.entry_price_fire),
        entry_price_coin: parseFloat(raffle.entry_price_coin),
        pot_fires: parseFloat(raffle.pot_fires),
        pot_coins: parseFloat(raffle.pot_coins),
        numbers_range: raffle.numbers_range,
        numbers_sold: parseInt(raffle.numbers_sold),
        participant_count: parseInt(raffle.participant_count),
        host_username: raffle.host_username,
        starts_at: raffle.starts_at,
        ends_at: raffle.ends_at,
        winner_id: raffle.winner_id,
        winning_number: raffle.winning_number
      },
      numbers: numbersResult.rows,
      participants: participantsResult.rows
    });
    
  } catch (error) {
    logger.error('Error fetching raffle:', error);
    res.status(500).json({ error: 'Failed to fetch raffle' });
  }
});

// Draw winner (host only or automatic)
router.post('/:code/draw', verifyToken, async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user.id;
    
    const result = await transaction(async (client) => {
      // Get raffle
      const raffleResult = await client.query(
        'SELECT * FROM raffles WHERE code = $1 FOR UPDATE',
        [code]
      );
      
      if (raffleResult.rows.length === 0) {
        throw new Error('Raffle not found');
      }
      
      const raffle = raffleResult.rows[0];
      
      // Check if user is host or admin
      if (raffle.host_id !== userId && !req.user.roles?.includes('admin')) {
        throw new Error('Only host or admin can draw winner');
      }
      
      if (raffle.status !== 'active') {
        throw new Error('Raffle is not active');
      }
      
      // Get sold numbers
      const soldNumbers = await client.query(
        'SELECT * FROM raffle_numbers WHERE raffle_id = $1 AND state = \'sold\'',
        [raffle.id]
      );
      
      if (soldNumbers.rows.length === 0) {
        throw new Error('No numbers have been sold');
      }
      
      // Select random winner
      const winnerIndex = Math.floor(Math.random() * soldNumbers.rows.length);
      const winningNumber = soldNumbers.rows[winnerIndex];
      
      // Update raffle
      await client.query(
        `UPDATE raffles 
         SET status = 'finished',
             winner_id = $1,
             winning_number = $2,
             drawn_at = NOW()
         WHERE id = $3`,
        [winningNumber.owner_id, winningNumber.number_idx, raffle.id]
      );
      
      // Update participant status
      await client.query(
        `UPDATE raffle_participants 
         SET status = CASE 
           WHEN user_id = $1 THEN 'winner'
           ELSE 'loser'
         END
         WHERE raffle_id = $2`,
        [winningNumber.owner_id, raffle.id]
      );
      
      // Distribute prizes (70% winner, 20% host, 10% tote)
      const potFires = parseFloat(raffle.pot_fires);
      const potCoins = parseFloat(raffle.pot_coins);
      
      if (potFires > 0) {
        const winnerAmount = potFires * 0.7;
        const hostAmount = potFires * 0.2;
        const toteAmount = potFires * 0.1;
        
        // Winner
        await client.query(
          `UPDATE wallets 
           SET fires_balance = fires_balance + $1,
               total_fires_earned = total_fires_earned + $1
           WHERE user_id = $2`,
          [winnerAmount, winningNumber.owner_id]
        );
        
        // Host (if not winner)
        if (raffle.host_id !== winningNumber.owner_id) {
          await client.query(
            `UPDATE wallets 
             SET fires_balance = fires_balance + $1,
                 total_fires_earned = total_fires_earned + $1
             WHERE user_id = $2`,
            [hostAmount, raffle.host_id]
          );
        }
        
        // Tote
        const toteUser = await client.query(
          'SELECT id FROM users WHERE tg_id = $1',
          [config.telegram.toteId]
        );
        
        if (toteUser.rows.length > 0) {
          await client.query(
            `UPDATE wallets 
             SET fires_balance = fires_balance + $1,
                 total_fires_earned = total_fires_earned + $1
             WHERE user_id = $2`,
            [toteAmount, toteUser.rows[0].id]
          );
        }
      }
      
      // Similar distribution for coins
      if (potCoins > 0) {
        const winnerAmount = potCoins * 0.7;
        const hostAmount = potCoins * 0.2;
        const toteAmount = potCoins * 0.1;
        
        await client.query(
          `UPDATE wallets 
           SET coins_balance = coins_balance + $1,
               total_coins_earned = total_coins_earned + $1
           WHERE user_id = $2`,
          [winnerAmount, winningNumber.owner_id]
        );
        
        if (raffle.host_id !== winningNumber.owner_id) {
          await client.query(
            `UPDATE wallets 
             SET coins_balance = coins_balance + $1,
                 total_coins_earned = total_coins_earned + $1
             WHERE user_id = $2`,
            [hostAmount, raffle.host_id]
          );
        }
      }
      
      // Get winner info
      const winnerInfo = await client.query(
        'SELECT username, display_name FROM users WHERE id = $1',
        [winningNumber.owner_id]
      );
      
      return {
        success: true,
        winning_number: winningNumber.number_idx,
        winner: winnerInfo.rows[0],
        prizes: {
          fires: potFires * 0.7,
          coins: potCoins * 0.7
        }
      };
    });
    
    logger.info('Raffle winner drawn', { 
      code, 
      winner: result.winner.username,
      number: result.winning_number 
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error drawing raffle winner:', error);
    res.status(400).json({ error: error.message || 'Failed to draw winner' });
  }
});

// List active raffles
router.get('/', async (req, res) => {
  try {
    const { status = 'active', visibility = 'public' } = req.query;
    
    const result = await query(
      `SELECT 
        r.id,
        r.code,
        r.name,
        r.description,
        r.mode,
        r.status,
        r.entry_price_fire,
        r.entry_price_coin,
        r.pot_fires,
        r.pot_coins,
        r.numbers_range,
        r.ends_at,
        u.username as host_username,
        COUNT(DISTINCT rp.user_id) as participant_count,
        COUNT(DISTINCT rn.number_idx) FILTER (WHERE rn.state = 'sold') as numbers_sold
       FROM raffles r
       JOIN users u ON u.id = r.host_id
       LEFT JOIN raffle_participants rp ON rp.raffle_id = r.id
       LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
       WHERE r.status = $1 AND r.visibility = $2
       GROUP BY r.id, u.username
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [status, visibility]
    );
    
    res.json(result.rows);
    
  } catch (error) {
    logger.error('Error listing raffles:', error);
    res.status(500).json({ error: 'Failed to list raffles' });
  }
});

module.exports = router;
