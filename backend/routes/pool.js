const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const RoomCodeService = require('../services/roomCodeService');
const { closeUserPreviousRooms } = require('../utils/tictactoe-cleanup'); // Reuse cleanup logic

// POST /api/pool/create - Create new room
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { mode, bet_amount, visibility = 'public' } = req.body;
        const userId = req.user.id;

        // Validate inputs
        if (!['coins', 'fires'].includes(mode)) {
            return res.status(400).json({ error: 'Modo debe ser "coins" o "fires"' });
        }

        let betAmount = parseFloat(bet_amount);
        if (mode === 'coins') {
            if (isNaN(betAmount) || betAmount < 1 || betAmount > 10000) {
                return res.status(400).json({ error: 'Apuesta coins debe ser entre 1-10000' });
            }
        } else {
            betAmount = 1; // Fixed for fires
        }

        const result = await transaction(async (client) => {
            // Check balance
            const walletResult = await client.query(
                'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
                [userId]
            );

            if (walletResult.rows.length === 0) throw new Error('Wallet no encontrado');

            const balance = mode === 'fires'
                ? parseFloat(walletResult.rows[0].fires_balance)
                : parseFloat(walletResult.rows[0].coins_balance);

            if (balance < betAmount) {
                throw new Error(`Balance insuficiente. Tienes ${balance} ${mode}, necesitas ${betAmount}`);
            }

            // Deduct bet
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

            // Log transaction
            await client.query(
                `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description)
         VALUES (
           (SELECT id FROM wallets WHERE user_id = $1),
           'game_bet', $2, $3, $4, $5,
           'Apuesta Pool 8-Ball'
         )`,
                [userId, mode, -betAmount, balance, balance - betAmount]
            );

            // Cleanup old rooms
            // Note: We might need a specific cleanup for pool, but generic cleanup works for now if we extend it
            // For now, let's just create the room

            const roomId = uuidv4();

            const roomResult = await client.query(
                `INSERT INTO pool_rooms 
         (id, code, host_id, mode, bet_amount, visibility, current_turn, 
          pot_coins, pot_fires, status, player_host_ready)
         VALUES ($1, 'TEMP', $2, $3, $4, $5, $2, $6, $7, 'waiting', TRUE)
         RETURNING *`,
                [
                    roomId, userId, mode, betAmount, visibility,
                    mode === 'coins' ? betAmount : 0,
                    mode === 'fires' ? betAmount : 0
                ]
            );

            const room = roomResult.rows[0];

            // Generate Code
            const code = await RoomCodeService.reserveCode('pool', roomId, client);

            await client.query('UPDATE pool_rooms SET code = $1 WHERE id = $2', [code, roomId]);
            room.code = code;

            return room;
        });

        res.json({ success: true, room: result });

    } catch (error) {
        logger.error('Error creating pool room:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/pool/join/:code
router.post('/join/:code', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            const roomResult = await client.query(
                'SELECT * FROM pool_rooms WHERE code = $1 FOR UPDATE',
                [code]
            );

            if (roomResult.rows.length === 0) throw new Error('Sala no encontrada');
            const room = roomResult.rows[0];

            if (room.status !== 'waiting') throw new Error('Sala no disponible');
            if (room.player_opponent_id) throw new Error('Sala llena');
            if (room.host_id === userId) throw new Error('Ya eres el host');

            // Check balance
            const walletResult = await client.query(
                'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
                [userId]
            );

            const balance = room.mode === 'fires'
                ? parseFloat(walletResult.rows[0].fires_balance)
                : parseFloat(walletResult.rows[0].coins_balance);

            if (balance < parseFloat(room.bet_amount)) {
                throw new Error('Balance insuficiente');
            }

            // Deduct bet
            await client.query(
                `UPDATE wallets 
         SET ${room.mode === 'fires' ? 'fires_balance' : 'coins_balance'} = 
             ${room.mode === 'fires' ? 'fires_balance' : 'coins_balance'} - $1,
             updated_at = NOW()
         WHERE user_id = $2`,
                [room.bet_amount, userId]
            );

            // Update room
            await client.query(
                `UPDATE pool_rooms 
         SET player_opponent_id = $1,
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} = 
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} + $2,
             player_opponent_ready = TRUE,
             status = 'ready'
         WHERE id = $3`,
                [userId, room.bet_amount, room.id]
            );

            // Socket notify
            if (req.io) {
                req.io.to(`pool:${code}`).emit('pool:player-joined', {
                    roomCode: code,
                    playerId: userId,
                    username: req.user.username
                });
            }

            return { success: true };
        });

        res.json(result);

    } catch (error) {
        logger.error('Error joining pool room:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/pool/room/:code
router.get('/room/:code', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const result = await query(
            `SELECT r.*, 
              h.username as host_username, 
              o.username as opponent_username 
       FROM pool_rooms r
       LEFT JOIN users h ON r.host_id = h.id
       LEFT JOIN users o ON r.player_opponent_id = o.id
       WHERE r.code = $1`,
            [code]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });

        res.json({ room: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/pool/room/:code/start
router.post('/room/:code/start', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            const roomResult = await client.query(
                'SELECT * FROM pool_rooms WHERE code = $1 FOR UPDATE',
                [code]
            );

            if (roomResult.rows.length === 0) throw new Error('Sala no encontrada');
            const room = roomResult.rows[0];

            if (room.host_id !== userId) throw new Error('Solo el host puede iniciar');
            if (room.status !== 'ready') throw new Error('Sala no lista');

            await client.query(
                `UPDATE pool_rooms 
         SET status = 'playing',
             started_at = NOW(),
             last_move_at = NOW()
         WHERE id = $1`,
                [room.id]
            );

            if (req.io) {
                req.io.to(`pool:${code}`).emit('pool:game-started', { roomCode: code });
            }

            return { success: true };
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
