/**
 * RaffleDrawScheduler - Scheduler para sorteos programados
 * Verifica cada minuto si hay rifas con fecha programada que deben finalizar
 */

const { query } = require('../../../db');
const logger = require('../../../utils/logger');

class RaffleDrawScheduler {
  constructor(raffleService) {
    this.raffleService = raffleService;
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Iniciar scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('[RaffleDrawScheduler] Ya está corriendo');
      return;
    }

    logger.info('[RaffleDrawScheduler] Iniciando scheduler de sorteos programados');
    this.isRunning = true;

    // Ejecutar cada minuto
    this.interval = setInterval(() => {
      this.checkScheduledDraws();
    }, 60000); // 60 segundos

    // Ejecutar inmediatamente la primera vez
    this.checkScheduledDraws();
  }

  /**
   * Detener scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      logger.info('[RaffleDrawScheduler] Scheduler detenido');
    }
  }

  /**
   * Verificar rifas con sorteo programado
   */
  async checkScheduledDraws() {
    try {
      logger.debug('[RaffleDrawScheduler] Verificando sorteos programados...');

      // Buscar rifas con draw_mode='scheduled' que ya pasaron su fecha y están activas
      const result = await query(
        `SELECT 
          r.id,
          r.code,
          r.name,
          r.scheduled_draw_at,
          COUNT(rn.id) as total_numbers,
          SUM(CASE WHEN rn.state = 'sold' THEN 1 ELSE 0 END) as sold_numbers
        FROM raffles r
        LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
        WHERE r.draw_mode = 'scheduled'
          AND r.status = 'active'
          AND r.scheduled_draw_at IS NOT NULL
          AND r.scheduled_draw_at <= NOW()
        GROUP BY r.id, r.code, r.name, r.scheduled_draw_at`
      );

      if (result.rows.length === 0) {
        logger.debug('[RaffleDrawScheduler] No hay sorteos programados pendientes');
        return;
      }

      logger.info(`[RaffleDrawScheduler] Encontradas ${result.rows.length} rifas con sorteo programado`, {
        raffles: result.rows.map(r => ({
          code: r.code,
          name: r.name,
          scheduledAt: r.scheduled_draw_at
        }))
      });

      // Procesar cada rifa
      for (const raffle of result.rows) {
        const totalNumbers = parseInt(raffle.total_numbers);
        const soldNumbers = parseInt(raffle.sold_numbers);

        logger.info(`[RaffleDrawScheduler] Procesando rifa programada: ${raffle.code}`, {
          total: totalNumbers,
          sold: soldNumbers,
          scheduledAt: raffle.scheduled_draw_at
        });

        // Verificar si todos los números están vendidos
        if (totalNumbers === soldNumbers && soldNumbers > 0) {
          logger.info(`[RaffleDrawScheduler] ✅ Todos los números vendidos - Finalizando rifa ${raffle.code}`);

          try {
            // Emitir socket antes de finalizar
            if (global.io) {
              global.io.to(`raffle_${raffle.code}`).emit('raffle:drawing_scheduled', {
                code: raffle.code,
                drawInSeconds: 0,
                message: '¡Hora del sorteo programado! Eligiendo ganador...'
              });
            }

            // Finalizar rifa
            await this.raffleService.finishRaffle(raffle.id);

            logger.info(`[RaffleDrawScheduler] ✅ Rifa ${raffle.code} finalizada exitosamente`);
          } catch (error) {
            logger.error(`[RaffleDrawScheduler] Error finalizando rifa ${raffle.code}`, error);
          }
        } else {
          logger.warn(`[RaffleDrawScheduler] ⚠️ Rifa ${raffle.code} llegó a fecha programada pero no todos los números están vendidos`, {
            sold: soldNumbers,
            total: totalNumbers,
            faltantes: totalNumbers - soldNumbers
          });

          // Emitir socket informando que no se puede sortear
          if (global.io) {
            global.io.to(`raffle_${raffle.code}`).emit('raffle:draw_cancelled', {
              code: raffle.code,
              reason: 'no_all_sold',
              message: `No se puede realizar el sorteo programado. Faltan ${totalNumbers - soldNumbers} números por vender.`
            });
          }

          // Opcional: Cancelar la rifa o extender la fecha
          // Por ahora solo log
        }
      }
    } catch (error) {
      logger.error('[RaffleDrawScheduler] Error en verificación de sorteos programados', error);
    }
  }
}

module.exports = RaffleDrawScheduler;
