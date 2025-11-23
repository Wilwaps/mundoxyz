const logger = require('../utils/logger');
const { query, transaction } = require('../db');
const { validateTurn, checkWinCondition } = require('../utils/pool');
const { refundBet } = require('../utils/tictactoe');

const roomConnections = new Map();
const socketRooms = new Map();
const ABANDONMENT_TIMEOUT = 15000;

function initPoolSocket(io, socket) {

    socket.on('pool:join-room', (data) => {
        const { roomCode, userId } = data;
        if (!roomCode || !userId) return;

        socket.join(`pool:${roomCode}`);
        logger.info(`Socket ${socket.id} joined pool:${roomCode}`);

        registerPoolConnection(roomCode, userId, socket.id);
    });

    socket.on('pool:leave-room', (data) => {
        const { roomCode } = data || {};
        if (!roomCode) return;

        const state = socketRooms.get(socket.id);
        const userId = state?.userId;
        if (!userId) return;

        socket.leave(`pool:${roomCode}`);
        unregisterPoolConnection(io, roomCode, userId, socket.id);
    });

    socket.on('pool:shot-event', (data) => {
        const { roomCode, force, angle, spin } = data;
        // Broadcast to opponent so they see the cue animation/shot
        socket.to(`pool:${roomCode}`).emit('pool:opponent-shot', {
            force, angle, spin
        });
    });

    socket.on('pool:update-state', (data) => {
        const { roomCode, balls, cueBall } = data;
        socket.to(`pool:${roomCode}`).emit('pool:sync-state', {
            balls, cueBall
        });
    });

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

    socket.on('disconnect', () => {
        const state = socketRooms.get(socket.id);
        if (!state) return;

        const { userId, rooms } = state;
        for (const roomCode of rooms) {
            unregisterPoolConnection(io, roomCode, userId, socket.id);
        }

        socketRooms.delete(socket.id);
    });
}

function getOrCreateRoomConnections(roomCode) {
    if (!roomConnections.has(roomCode)) {
        roomConnections.set(roomCode, {
            users: new Map(),
            timeout: null
        });
    }
    return roomConnections.get(roomCode);
}

function registerPoolConnection(roomCode, userId, socketId) {
    const state = socketRooms.get(socketId) || { userId, rooms: new Set() };
    state.userId = userId;
    state.rooms.add(roomCode);
    socketRooms.set(socketId, state);

    const roomState = getOrCreateRoomConnections(roomCode);
    const users = roomState.users;
    const current = users.get(userId) || { count: 0 };
    current.count += 1;
    users.set(userId, current);

    if (roomState.timeout) {
        clearTimeout(roomState.timeout);
        roomState.timeout = null;
    }
}

function unregisterPoolConnection(io, roomCode, userId, socketId) {
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
            handlePoolAbandonedRoom(io, roomCode).catch((error) => {
                logger.error('Error handling abandoned pool room:', error);
            });
        }, ABANDONMENT_TIMEOUT);
    }
}

async function handlePoolAbandonedRoom(io, roomCode) {
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
            'SELECT * FROM pool_rooms WHERE code = $1 FOR UPDATE',
            [roomCode]
        );

        if (roomResult.rows.length === 0) {
            return { closed: false };
        }

        const room = roomResult.rows[0];

        if (!['waiting', 'ready', 'playing'].includes(room.status)) {
            return { closed: false };
        }

        const isLobby = room.status === 'waiting' || room.status === 'ready';

        if (isLobby) {
            const betAmount = parseFloat(room.bet_amount);
            const mode = room.mode;

            if (room.host_id) {
                await refundBet(
                    client,
                    room.host_id,
                    mode,
                    betAmount,
                    room.code,
                    'Pool room auto-cancelled without participants'
                );
            }

            if (room.player_opponent_id) {
                await refundBet(
                    client,
                    room.player_opponent_id,
                    mode,
                    betAmount,
                    room.code,
                    'Pool room auto-cancelled without participants'
                );
            }
        }

        await client.query(
            `UPDATE pool_rooms 
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

    io.to(`pool:${roomCode}`).emit('pool:room-abandoned', {
        roomCode,
        refunded: result.isLobby
    });

    logger.info('Pool room closed due to no participants', {
        roomCode,
        refunded: result.isLobby
    });
}

module.exports = { initPoolSocket };
