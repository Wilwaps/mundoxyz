const logger = require('../utils/logger');
const { query, transaction } = require('../db');
const { processMove, calculateCanto } = require('../utils/caida');
const { refundBet } = require('../utils/tictactoe');

const roomConnections = new Map();
const socketRooms = new Map();
const ABANDONMENT_TIMEOUT = 15000;

function initCaidaSocket(io, socket) {

    socket.on('caida:join-room', (data) => {
        const { roomCode, userId } = data;
        if (!roomCode || !userId) return;

        socket.join(`caida:${roomCode}`);
        logger.info(`Socket ${socket.id} joined caida:${roomCode}`);

        registerCaidaConnection(roomCode, userId, socket.id);
    });

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

    socket.on('caida:announce-canto', async (data) => {
        const { roomCode, userId } = data;
        // ... Implement canto validation using calculateCanto(hand)
        // Update score and broadcast
    });

    socket.on('disconnect', () => {
        const state = socketRooms.get(socket.id);
        if (!state) return;

        const { userId, rooms } = state;
        for (const roomCode of rooms) {
            unregisterCaidaConnection(io, roomCode, userId, socket.id);
        }

        socketRooms.delete(socket.id);
    });
}

function getOrCreateCaidaRoom(roomCode) {
    if (!roomConnections.has(roomCode)) {
        roomConnections.set(roomCode, {
            users: new Map(),
            timeout: null
        });
    }
    return roomConnections.get(roomCode);
}

function registerCaidaConnection(roomCode, userId, socketId) {
    const state = socketRooms.get(socketId) || { userId, rooms: new Set() };
    state.userId = userId;
    state.rooms.add(roomCode);
    socketRooms.set(socketId, state);

    const roomState = getOrCreateCaidaRoom(roomCode);
    const users = roomState.users;
    const current = users.get(userId) || { count: 0 };
    current.count += 1;
    users.set(userId, current);

    if (roomState.timeout) {
        clearTimeout(roomState.timeout);
        roomState.timeout = null;
    }
}

function unregisterCaidaConnection(io, roomCode, userId, socketId) {
    const roomState = roomConnections.get(roomCode);
    if (!roomState) return;

    const users = roomState.users;
    const current = users.get(userId);
    if (!current) return;

    current.count = Math.max(0, current.count - 1);
    if (current.count === 0) {
        users.delete(userId);
    } else {
        users.set(userId, current);
    }

    const socketState = socketRooms.get(socketId);
    if (socketState) {
        socketState.rooms.delete(roomCode);
        if (socketState.rooms.size === 0) {
            socketRooms.delete(socketId);
        } else {
            socketRooms.set(socketId, socketState);
        }
    }

    if (users.size === 0 && !roomState.timeout) {
        roomState.timeout = setTimeout(() => {
            handleCaidaAbandonedRoom(io, roomCode).catch((error) => {
                logger.error('Error handling abandoned caida room:', error);
            });
        }, ABANDONMENT_TIMEOUT);
    }
}

async function handleCaidaAbandonedRoom(io, roomCode) {
    const roomState = roomConnections.get(roomCode);
    if (!roomState) return;

    if (roomState.users.size > 0) {
        if (roomState.timeout) {
            clearTimeout(roomState.timeout);
            roomState.timeout = null;
        }
        return;
    }

    const result = await transaction(async (client) => {
        const roomResult = await client.query(
            'SELECT * FROM caida_rooms WHERE code = $1 FOR UPDATE',
            [roomCode]
        );

        if (roomResult.rows.length === 0) {
            return { closed: false };
        }

        const room = roomResult.rows[0];

        if (!['waiting', 'playing'].includes(room.status)) {
            return { closed: false };
        }

        const isLobby = room.status === 'waiting';

        if (isLobby) {
            const betAmount = parseFloat(room.bet_amount);
            const mode = room.mode;
            const playerIds = Array.isArray(room.player_ids) ? room.player_ids : room.player_ids || [];

            for (const playerId of playerIds) {
                await refundBet(
                    client,
                    playerId,
                    mode,
                    betAmount,
                    room.code,
                    'Caida room auto-cancelled without participants'
                );
            }
        }

        await client.query(
            `UPDATE caida_rooms 
         SET status = 'cancelled', 
             finished_at = NOW()
         WHERE id = $1`,
            [room.id]
        );

        return { closed: true, isLobby };
    });

    if (!result.closed) {
        if (roomState.timeout) {
            clearTimeout(roomState.timeout);
            roomState.timeout = null;
        }
        return;
    }

    if (roomState.timeout) {
        clearTimeout(roomState.timeout);
    }
    roomConnections.delete(roomCode);

    io.to(`caida:${roomCode}`).emit('caida:room-abandoned', {
        roomCode,
        refunded: result.isLobby
    });

    logger.info('Caida room closed due to no participants', {
        roomCode,
        refunded: result.isLobby
    });
}

module.exports = { initCaidaSocket };
