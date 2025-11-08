const logger = require('../utils/logger');

/**
 * Handler de WebSocket para rifas
 * Sincronización en tiempo real de eventos
 */
class RaffleSocketHandler {
    constructor(io) {
        this.io = io;
    }

    /**
     * Emitir evento cuando un número es reservado temporalmente
     */
    emitNumberReserved(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:number-reserved', {
            raffleId,
            numberIdx: data.numberIdx,
            userId: data.userId,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Número ${data.numberIdx} reservado en rifa ${raffleId}`);
    }

    /**
     * Emitir evento cuando un número es liberado
     */
    emitNumberReleased(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:number-released', {
            raffleId,
            numberIdx: data.numberIdx,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Número ${data.numberIdx} liberado en rifa ${raffleId}`);
    }

    /**
     * Emitir evento cuando un número es comprado (solicitud aprobada)
     */
    emitNumberPurchased(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:number-purchased', {
            raffleId,
            numberIdx: data.numberIdx,
            buyerId: data.buyerId,
            buyerUsername: data.buyerUsername,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Número ${data.numberIdx} comprado en rifa ${raffleId}`);
    }

    /**
     * Emitir evento cuando hay una nueva solicitud de compra
     */
    emitNewRequest(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:new-request', {
            raffleId,
            requestId: data.requestId,
            numberIdx: data.numberIdx,
            buyerUsername: data.buyerUsername,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Nueva solicitud de compra en rifa ${raffleId}`);
    }

    /**
     * Emitir evento cuando la rifa es actualizada
     */
    emitRaffleUpdated(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:updated', {
            raffleId,
            status: data.status,
            progress: data.progress,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Rifa ${raffleId} actualizada: ${data.status}`);
    }

    /**
     * Emitir evento cuando la rifa es completada/sorteada
     */
    emitRaffleCompleted(raffleId, data) {
        const room = `raffle-${raffleId}`;
        this.io.to(room).emit('raffle:completed', {
            raffleId,
            winners: data.winners,
            timestamp: new Date()
        });
        logger.info(`[RaffleSocket] Rifa ${raffleId} completada con ${data.winners?.length || 0} ganadores`);
    }

    /**
     * Inicializar listeners de socket
     */
    setupListeners(socket) {
        // Usuario se une a una sala de rifa
        socket.on('join-raffle', (raffleId) => {
            const room = `raffle-${raffleId}`;
            socket.join(room);
            logger.info(`[RaffleSocket] Usuario ${socket.id} se unió a rifa ${raffleId}`);
        });

        // Usuario sale de una sala de rifa
        socket.on('leave-raffle', (raffleId) => {
            const room = `raffle-${raffleId}`;
            socket.leave(room);
            logger.info(`[RaffleSocket] Usuario ${socket.id} salió de rifa ${raffleId}`);
        });
    }
}

module.exports = RaffleSocketHandler;
