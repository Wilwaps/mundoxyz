const logger = require('../utils/logger');
const BingoRefundService = require('../services/bingoRefundService');
const { cleanupOldRooms } = require('../utils/bingo-recovery');

/**
 * Jobs periódicos para limpieza de salas de Bingo
 * - Reembolsa salas abandonadas cada 10 minutos
 * - Limpia salas antiguas cada hora
 */

class BingoCleanupJob {
  
  static intervals = [];
  
  static start() {
    // Job 1: Refund de salas abandonadas (cada 10 minutos)
    const refundInterval = setInterval(async () => {
      try {
        logger.info('🧹 Ejecutando cleanup de salas abandonadas...');
        const result = await BingoRefundService.refundAbandonedRooms();
        
        if (result.refunded > 0) {
          logger.info(`✅ Cleanup completado: ${result.refunded} salas reembolsadas`);
        }
      } catch (error) {
        logger.error('❌ Error en cleanup job:', error);
      }
    }, 10 * 60 * 1000); // 10 minutos
    
    // Job 2: Limpieza de salas antiguas (cada hora)
    const cleanupInterval = setInterval(async () => {
      try {
        logger.info('🗑️  Limpiando salas antiguas...');
        const result = await cleanupOldRooms();
        
        if (result.deleted > 0) {
          logger.info(`✅ ${result.deleted} salas antiguas eliminadas`);
        }
      } catch (error) {
        logger.error('❌ Error en cleanup de salas antiguas:', error);
      }
    }, 60 * 60 * 1000); // 1 hora
    
    this.intervals.push(refundInterval, cleanupInterval);
    
    logger.info('✅ Bingo cleanup jobs iniciados');
    logger.info('   - Refund abandonadas: cada 10 minutos');
    logger.info('   - Cleanup antiguas: cada hora');
  }
  
  static stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('🛑 Bingo cleanup jobs detenidos');
  }
}

module.exports = BingoCleanupJob;
