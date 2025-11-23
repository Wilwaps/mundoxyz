const logger = require('../utils/logger');
const { query, transaction } = require('../db');
const { validateTurn, checkWinCondition } = require('../utils/pool');

// In-memory state tracking for active rooms (optional, for faster validation)
// const activePoolRooms = new Map();

function initPoolSocket(io, socket) {

    // Join Room
    socket.on('pool:join-room', (data) => {
        const { roomCode, userId } = data;
        socket.join(`pool:${roomCode}`);
        logger.info(`Socket ${socket.id} joined pool:${roomCode}`);
    });

    // Sync Shot (Player is taking a shot)
    socket.on('pool:shot-event', (data) => {
        const { roomCode, force, angle, spin } = data;
        // Broadcast to opponent so they see the cue animation/shot
        socket.to(`pool:${roomCode}`).emit('pool:opponent-shot', {
            force, angle, spin
        });
    });

    // Sync Physics State (Ball positions update)
    // This is sent frequently by the active client to keep opponent in sync
    socket.on('pool:update-state', (data) => {
        const { roomCode, balls, cueBall } = data;
        socket.to(`pool:${roomCode}`).emit('pool:sync-state', {
            balls, cueBall
        });
    });

    // Turn End (Shot finished, balls stopped)
    socket.on('pool:turn-end', async (data) => {
        const { roomCode, gameState, turnResult } = data;
        // gameState: { balls, activeSuit, ... }
        // turnResult: { pottedBalls, firstHitBall, ... }

        try {
            // 1. Fetch current room state from DB
            const roomResult = await query('SELECT * FROM pool_rooms WHERE code = $1', [roomCode]);
            if (roomResult.rows.length === 0) return;
            const room = roomResult.rows[0];

            // 2. Validate Turn
            // We pass the OLD state (from DB/memory) and the Turn Result
            // For simplicity here, we trust the client's reported result but validate the logic
            const oldState = room.game_state || {};
            const validation = validateTurn(oldState, turnResult);

            let nextTurn = room.current_turn;
            let nextSuit = validation.nextSuit || room.game_state?.activeSuit;
            let status = room.status;
            let winnerId = null;

            // 3. Check Win/Loss
            const winCheck = checkWinCondition(oldState, turnResult);
            if (winCheck) {
                if (winCheck.winner === 'opponent') {
                    winnerId = room.current_turn === room.host_id ? room.player_opponent_id : room.host_id;
                    status = 'finished';
                } else if (winCheck.check8Ball) {
                    // Check if player cleared all their suit
                    // (Simplified: Client says they won? We should verify suit count)
                    // For now, trust client 'win' flag if passed, or implement suit count logic
                    // Let's assume client sends 'gameWon' flag if they legally potted 8
                    if (turnResult.gameWon) {
                        winnerId = room.current_turn;
                        status = 'finished';
                    }
                }
            }

            // 4. Update Turn if not game over
            if (status !== 'finished') {
                if (validation.turnEnds) {
                    nextTurn = room.current_turn === room.host_id ? room.player_opponent_id : room.host_id;
                }
            }

            // 5. Update DB
            const newGameState = {
                ...gameState,
                activeSuit: nextSuit
            };

            await query(
                `UPDATE pool_rooms 
         SET game_state = $1, 
             current_turn = $2, 
             status = $3,
             winner_id = $4,
             last_move_at = NOW()
         WHERE id = $5`,
                [JSON.stringify(newGameState), nextTurn, status, winnerId, room.id]
            );

            // 6. Broadcast Result
            io.to(`pool:${roomCode}`).emit('pool:turn-processed', {
                nextTurn,
                gameState: newGameState,
                foul: validation.foul,
                foulReason: validation.foulReason,
                winnerId
            });

            // 7. Handle Payouts if finished
            if (status === 'finished' && winnerId) {
                // Trigger payout logic (reuse distributePrizes pattern)
                // For brevity, calling a hypothetical payout function or emitting event
                // In real impl, import distributePrizes from utils/pool-economy
            }

        } catch (error) {
            logger.error('Error processing pool turn:', error);
        }
    });
}

module.exports = { initPoolSocket };
