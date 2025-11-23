const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const RoomCodeService = require('../services/roomCodeService');
const { createDeck } = require('../utils/caida');

// POST /api/caida/create
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { mode, bet_amount, visibility = 'public' } = req.body;
        const userId = req.user.id;

        if (!['coins', 'fires'].includes(mode)) {
            return res.status(400).json({ error: 'Modo inválido' });
        }

        let betAmount = parseFloat(bet_amount);
        if (mode === 'coins') {
            if (isNaN(betAmount) || betAmount < 1 || betAmount > 10000) {
                return res.status(400).json({ error: 'Apuesta inválida' });
            }
        } else {
            betAmount = 1;
        }

        const result = await transaction(async (client) => {
            // Check balance
            const walletResult = await client.query(
                'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
                [userId]
            );

            const balance = mode === 'fires'
                ? parseFloat(walletResult.rows[0].fires_balance)
                : parseFloat(walletResult.rows[0].coins_balance);

            if (balance < betAmount) {
                throw new Error('Balance insuficiente');
            }

            // Deduct bet
            await client.query(
                `UPDATE wallets 
         SET ${mode === 'fires' ? 'fires_balance' : 'coins_balance'} = 
             ${mode === 'fires' ? 'fires_balance' : 'coins_balance'} - $1,
             updated_at = NOW()
         WHERE user_id = $2`,
                [betAmount, userId]
            );

            // Create Room
            const roomId = uuidv4();
            const initialGameState = {
                deck: [],
                table_cards: [],
                hands: {},
                scores: {},
                collected_cards: {},
                cantos_history: []
            };

            const roomResult = await client.query(
                `INSERT INTO caida_rooms 
         (id, code, host_id, player_ids, mode, bet_amount, visibility, 
          pot_coins, pot_fires, status, game_state)
         VALUES ($1, 'TEMP', $2, $3, $4, $5, $6, $7, $8, 'waiting', $9)
         RETURNING *`,
                [
                    roomId, userId, JSON.stringify([userId]), mode, betAmount, visibility,
                    mode === 'coins' ? betAmount : 0,
                    mode === 'fires' ? betAmount : 0,
                    JSON.stringify(initialGameState)
                ]
            );

            const room = roomResult.rows[0];
            const code = await RoomCodeService.reserveCode('caida', roomId, client);
            await client.query('UPDATE caida_rooms SET code = $1 WHERE id = $2', [code, roomId]);
            room.code = code;

            return room;
        });

        res.json({ success: true, room: result });
    } catch (error) {
        logger.error('Error creating caida room:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/caida/join/:code
router.post('/join/:code', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            const roomResult = await client.query(
                'SELECT * FROM caida_rooms WHERE code = $1 FOR UPDATE',
                [code]
            );

            if (roomResult.rows.length === 0) throw new Error('Sala no encontrada');
            const room = roomResult.rows[0];

            if (room.status !== 'waiting') throw new Error('Sala no disponible');
            if (room.player_ids.includes(userId)) throw new Error('Ya estás en la sala');
            if (room.player_ids.length >= 4) throw new Error('Sala llena');

            // Check balance
            const walletResult = await client.query(
                'SELECT fires_balance, coins_balance FROM wallets WHERE user_id = $1',
                [userId]
            );

            const balance = room.mode === 'fires'
                ? parseFloat(walletResult.rows[0].fires_balance)
                : parseFloat(walletResult.rows[0].coins_balance);

            if (balance < parseFloat(room.bet_amount)) throw new Error('Balance insuficiente');

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
            const newPlayerIds = [...room.player_ids, userId];
            await client.query(
                `UPDATE caida_rooms 
         SET player_ids = $1,
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} = 
             ${room.mode === 'fires' ? 'pot_fires' : 'pot_coins'} + $2
         WHERE id = $3`,
                [JSON.stringify(newPlayerIds), room.bet_amount, room.id]
            );

            if (req.io) {
                req.io.to(`caida:${code}`).emit('caida:player-joined', {
                    roomCode: code,
                    playerId: userId,
                    username: req.user.username
                });
            }

            return { success: true };
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/caida/start/:code
router.post('/start/:code', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const userId = req.user.id;

        const result = await transaction(async (client) => {
            const roomResult = await client.query(
                'SELECT * FROM caida_rooms WHERE code = $1 FOR UPDATE',
                [code]
            );
            const room = roomResult.rows[0];

            if (room.host_id !== userId) throw new Error('Solo el host puede iniciar');
            if (room.player_ids.length < 2) throw new Error('Mínimo 2 jugadores');

            // Initialize Game
            const deck = createDeck();
            const gameState = room.game_state;

            // Deal 3 cards to each player
            room.player_ids.forEach(pid => {
                gameState.hands[pid] = deck.splice(0, 3);
                gameState.scores[pid] = 0;
                gameState.collected_cards[pid] = [];
            });

            // Deal 4 cards to table
            gameState.table_cards = deck.splice(0, 4);
            gameState.deck = deck;

            await client.query(
                `UPDATE caida_rooms 
         SET status = 'playing',
             started_at = NOW(),
             game_state = $1,
             current_turn_index = 0
         WHERE id = $2`,
                [JSON.stringify(gameState), room.id]
            );

            if (req.io) {
                req.io.to(`caida:${code}`).emit('caida:game-started', { roomCode: code });
            }

            return { success: true };
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/caida/room/:code
router.get('/room/:code', verifyToken, async (req, res) => {
    try {
        const { code } = req.params;
        const result = await query(
            `SELECT r.*, 
              (SELECT json_agg(json_build_object('id', u.id, 'username', u.username))
               FROM users u WHERE u.id::text = ANY(
                 SELECT jsonb_array_elements_text(r.player_ids)
               )
              ) as players
       FROM caida_rooms r
       WHERE r.code = $1`,
            [code]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
        res.json({ room: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
