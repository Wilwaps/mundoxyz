const logger = require('../utils/logger');
const { query, transaction } = require('../db');
const { processMove, calculateCanto } = require('../utils/caida');

function initCaidaSocket(io, socket) {

    // Join Room
    socket.on('caida:join-room', (data) => {
        const { roomCode, userId } = data;
        socket.join(`caida:${roomCode}`);
        logger.info(`Socket ${socket.id} joined caida:${roomCode}`);
    });

    // Play Card
    socket.on('caida:play-card', async (data) => {
        const { roomCode, card, userId } = data;

        try {
            // 1. Fetch Room
            const roomResult = await query('SELECT * FROM caida_rooms WHERE code = $1', [roomCode]);
            if (roomResult.rows.length === 0) return;
            const room = roomResult.rows[0];

            // 2. Validate Turn
            const currentPlayerId = room.player_ids[room.current_turn_index];
            if (currentPlayerId !== userId) {
                socket.emit('caida:error', { message: 'No es tu turno' });
                return;
            }

            // 3. Process Move
            const gameState = room.game_state;

            logger.info('[Caida] Processing move', {
                roomCode,
                userId,
                card,
                scoresBefore: gameState.scores
            });

            // Remove card from hand
            const handIndex = gameState.hands[userId].findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (handIndex === -1) return; // Card not in hand
            gameState.hands[userId].splice(handIndex, 1);

            // Execute Logic
            const moveResult = processMove(gameState, { playerId: userId, card });

            logger.info('[Caida] Move result', {
                roomCode,
                userId,
                points: moveResult?.points,
                message: moveResult?.message,
                scoresAfter: gameState.scores
            });

            // 4. Update Turn
            let nextTurnIndex = (room.current_turn_index + 1) % room.player_ids.length;

            // Check if round ended (all hands empty)
            const allHandsEmpty = room.player_ids.every(pid => gameState.hands[pid].length === 0);

            if (allHandsEmpty) {
                if (gameState.deck.length > 0) {
                    // Deal next round
                    room.player_ids.forEach(pid => {
                        gameState.hands[pid] = gameState.deck.splice(0, 3);
                    });
                    // Turn usually stays with next player or dealer? 
                    // Standard: Next player after dealer. 
                    // For simplicity, continue rotation.
                } else {
                    // Game Over logic (count cards)
                    // ... (Implement card counting logic here or trigger finished status)
                    // For now, just mark finished if deck empty
                    room.status = 'finished';
                }
            }

            // 5. Update DB
            await query(
                `UPDATE caida_rooms 
         SET game_state = $1, 
             current_turn_index = $2,
             status = $3,
             last_move_at = NOW()
         WHERE id = $4`,
                [JSON.stringify(gameState), nextTurnIndex, room.status, room.id]
            );

            // 6. Broadcast
            io.to(`caida:${roomCode}`).emit('caida:game-update', {
                gameState,
                lastMove: {
                    playerId: userId,
                    card,
                    result: moveResult
                },
                nextTurn: room.player_ids[nextTurnIndex]
            });

        } catch (error) {
            logger.error('Error processing caida move:', error);
        }
    });

    // Announce Canto
    socket.on('caida:announce-canto', async (data) => {
        const { roomCode, userId } = data;
        // ... Implement canto validation using calculateCanto(hand)
        // Update score and broadcast
    });
}

module.exports = { initCaidaSocket };
