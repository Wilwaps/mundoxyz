/**
 * Sistema de Rifas V2 - Controller
 * Manejo de requests HTTP y respuestas
 */

const raffleService = require('../services/RaffleServiceV2');
const logger = require('../../../utils/logger');
const { ErrorCodes, ErrorMessages } = require('../types');

class RaffleController {
  /**
   * Obtener participantes de una rifa
   */
  async getParticipants(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user?.id || null;
      
      const result = await raffleService.getParticipants(code, userId);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error obteniendo participantes', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error obteniendo participantes'
      });
    }
  }
  
  /**
   * Aprobar solicitud de pago
   */
  async approveRequest(req, res) {
    try {
      const { code, requestId } = req.params;
      const hostId = req.user.id;
      
      const result = await raffleService.approvePaymentRequest(parseInt(requestId), hostId);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error aprobando solicitud', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error aprobando solicitud'
      });
    }
  }
  
  /**
   * Rechazar solicitud de pago
   */
  async rejectRequest(req, res) {
    try {
      const { code, requestId } = req.params;
      const { reason } = req.body;
      const hostId = req.user.id;
      
      const result = await raffleService.rejectPaymentRequest(parseInt(requestId), hostId, reason);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error rechazando solicitud', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error rechazando solicitud'
      });
    }
  }
  /**
   * Listar rifas públicas con filtros
   */
  async listRaffles(req, res) {
    try {
      const filters = req.validatedQuery || req.query;
      const userId = req.user?.id || null;
      
      const result = await raffleService.getRaffles(filters, userId);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error listando rifas', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error obteniendo rifas'
      });
    }
  }
  
  /**
   * Crear nueva rifa
   */
  async createRaffle(req, res) {
    try {
      const data = req.validatedData || req.body;
      const hostId = req.user.id;
      
      const raffle = await raffleService.createRaffle(hostId, data);
      
      // Emitir evento de nueva rifa
      if (req.app.get('io')) {
        req.app.get('io').emit('raffle:created', {
          raffleId: raffle.id,
          code: raffle.code,
          name: raffle.name,
          host: raffle.hostUsername
        });
      }
      
      res.status(201).json({
        success: true,
        raffle,
        message: 'Rifa creada exitosamente'
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error creando rifa', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error creando rifa'
      });
    }
  }
  
  /**
   * Obtener detalle de rifa
   */
  async getRaffleDetail(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user?.id || null;
      
      const result = await raffleService.getRaffleByCode(code, userId);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error obteniendo rifa', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error obteniendo rifa'
      });
    }
  }
  
  /**
   * Actualizar rifa (solo host o admin)
   */
  async updateRaffle(req, res) {
    try {
      const { code } = req.params;
      const updates = req.validatedData || req.body;
      const userId = req.user.id;
      
      // Verificar permisos
      const raffle = await raffleService.getRaffleByCode(code);
      
      if (raffle.raffle.hostId !== userId && !req.user.roles?.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para editar esta rifa'
        });
      }
      
      const updatedRaffle = await raffleService.updateRaffle(code, updates);
      
      // Emitir evento de actualización
      if (req.app.get('io')) {
        req.app.get('io').to(`raffle-${code}`).emit('raffle:updated', {
          raffleId: updatedRaffle.id,
          changes: updates
        });
      }
      
      res.json({
        success: true,
        raffle: updatedRaffle,
        message: 'Rifa actualizada exitosamente'
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error actualizando rifa', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error actualizando rifa'
      });
    }
  }
  
  /**
   * Cancelar rifa (SOLO usuario con tg_id 1417856820)
   */
  async cancelRaffle(req, res) {
    try {
      const { code } = req.params;
      const userTgId = req.user.tg_id;
      
      // SEGURIDAD CRÍTICA: Solo el usuario con tg_id 1417856820 puede cancelar rifas
      if (userTgId !== '1417856820') {
        logger.warn('[RaffleController] Intento no autorizado de cancelar rifa', {
          code,
          userTgId,
          userId: req.user.id
        });
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cancelar rifas. Solo el administrador puede realizar esta acción.'
        });
      }
      
      // Verificar que la rifa existe
      const raffle = await raffleService.getRaffleByCode(code);
      
      if (!raffle) {
        return res.status(404).json({
          success: false,
          message: 'Rifa no encontrada'
        });
      }
      
      await raffleService.cancelRaffle(code);
      
      // Emitir evento de cancelación
      if (req.app.get('io')) {
        req.app.get('io').to(`raffle-${code}`).emit('raffle:cancelled', {
          code
        });
      }
      
      res.json({
        success: true,
        message: 'Rifa cancelada exitosamente'
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error cancelando rifa', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error cancelando rifa'
      });
    }
  }
  
  /**
   * Obtener números de una rifa
   */
  async getRaffleNumbers(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user?.id || null;
      
      const result = await raffleService.getRaffleByCode(code, userId);
      
      res.json({
        success: true,
        numbers: result.numbers,
        userNumbers: result.userNumbers
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error obteniendo números', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error obteniendo números'
      });
    }
  }
  
  /**
   * Reservar un número
   */
  async reserveNumber(req, res) {
    try {
      const { code, idx } = req.params;
      const userId = req.user.id;
      
      logger.info('[RaffleController] Intentando reservar número', { code, idx, userId });
      
      // Obtener rifa
      const raffleData = await raffleService.getRaffleByCode(code);
      
      if (!raffleData || !raffleData.raffle) {
        logger.error('[RaffleController] Rifa no encontrada', { code });
        return res.status(404).json({
          success: false,
          message: 'La rifa no existe o fue eliminada'
        });
      }
      
      const raffle = raffleData.raffle;
      
      // Verificar estado
      if (raffle.status !== 'active') {
        logger.warn('[RaffleController] Rifa no activa', { 
          code, 
          status: raffle.status,
          idx,
          userId
        });
        return res.status(400).json({
          success: false,
          code: 'RAFFLE_NOT_ACTIVE',
          message: raffle.status === 'finished' 
            ? 'Esta rifa ya finalizó' 
            : 'La rifa no está activa'
        });
      }
      
      const result = await raffleService.reserveNumber(
        raffle.id, 
        parseInt(idx), 
        userId
      );
      
      // Emitir evento de reserva
      if (req.app.get('io')) {
        req.app.get('io').to(`raffle-${code}`).emit('number:reserved', {
          raffleId: raffle.id,
          numberIdx: parseInt(idx),
          userId
        });
      }
      
      res.json({
        success: true,
        ...result,
        message: result.extended 
          ? 'Reserva extendida exitosamente' 
          : 'Número reservado exitosamente'
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error reservando número', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error reservando número'
      });
    }
  }
  
  /**
   * Liberar reserva de número
   */
  async releaseNumber(req, res) {
    try {
      const { code, idx } = req.params;
      const userId = req.user.id;
      
      // Obtener rifa
      const raffleData = await raffleService.getRaffleByCode(code);
      const raffle = raffleData.raffle;
      
      await raffleService.releaseNumber(
        raffle.id, 
        parseInt(idx), 
        userId
      );
      
      // Emitir evento de liberación
      if (req.app.get('io')) {
        req.app.get('io').to(`raffle-${code}`).emit('number:released', {
          raffleId: raffle.id,
          numberIdx: parseInt(idx)
        });
      }
      
      res.json({
        success: true,
        message: 'Reserva liberada exitosamente'
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error liberando número', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error liberando número'
      });
    }
  }
  
  /**
   * Comprar número
   */
  async purchaseNumber(req, res) {
    try {
      const { code, idx } = req.params;
      const userId = req.user.id;
      const purchaseData = req.validatedData || req.body;
      
      logger.info('[RaffleController] Iniciando compra', {
        code,
        idx,
        userId,
        paymentMethod: purchaseData?.paymentMethod
      });
      
      // Obtener raffleId desde el código
      const raffleData = await raffleService.getRaffleByCode(code);
      
      if (!raffleData || !raffleData.raffle) {
        logger.error('[RaffleController] Rifa no encontrada al comprar', { code });
        return res.status(404).json({
          success: false,
          message: 'La rifa no existe o fue eliminada'
        });
      }
      
      const raffle = raffleData.raffle;
      
      logger.info('[RaffleController] Rifa encontrada', {
        raffleId: raffle.id,
        mode: raffle.mode,
        status: raffle.status
      });
      
      // Llamar al servicio para procesar la compra
      const result = await raffleService.purchaseNumber(
        raffle.id,
        parseInt(idx),
        userId,
        purchaseData
      );
      
      logger.info('[RaffleController] Compra exitosa', {
        userId,
        numberIdx: idx,
        amount: result.transaction?.amount
      });
      
      res.json({
        success: true,
        message: 'Número comprado exitosamente',
        transaction: result.transaction
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error comprando número', {
        code: req.params.code,
        idx: req.params.idx,
        userId: req.user?.id,
        error: error.message,
        errorCode: error.code,
        stack: error.stack
      });
      res.status(error.status || 500).json({
        success: false,
        message: error.message || ErrorMessages[error.code] || 'Error comprando número'
      });
    }
  }
  
  /**
   * Obtener rifas del usuario
   */
  async getUserRaffles(req, res) {
    try {
      const userId = req.user.id;
      
      const filters = {
        hostId: userId,
        limit: 50
      };
      
      const result = await raffleService.getRaffles(filters, userId);
      
      res.json({
        success: true,
        raffles: result.raffles
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error obteniendo rifas del usuario', error);
      res.status(error.status || 500).json({
        success: false,
        message: 'Error obteniendo tus rifas'
      });
    }
  }
  
  /**
   * Obtener estadísticas de rifa
   */
  async getRaffleStats(req, res) {
    try {
      const { code } = req.params;
      
      const result = await raffleService.getRaffleByCode(code);
      
      res.json({
        success: true,
        stats: result.stats
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error obteniendo estadísticas', error);
      res.status(error.status || 500).json({
        success: false,
        message: ErrorMessages[error.code] || 'Error obteniendo estadísticas'
      });
    }
  }
  
  /**
   * Landing pública (sin auth) - Optimizado para empresas
   * GET /api/raffles/v2/public/:code
   */
  async getPublicLanding(req, res) {
    try {
      const { code } = req.params;
      
      logger.info('[RaffleController] Acceso a landing pública', { code });
      
      const result = await raffleService.getPublicLandingData(code);
      
      res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error en landing pública', { code: req.params.code, error: error.message });
      
      if (error.code === ErrorCodes.RAFFLE_NOT_FOUND) {
        return res.status(404).json({
          success: false,
          message: 'Rifa no encontrada'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error obteniendo información de la rifa'
      });
    }
  }
  
  /**
   * Elegir ganador manualmente (solo host, modo manual)
   * POST /api/raffles/v2/:code/draw-winner
   */
  async drawWinnerManually(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user.id;
      
      logger.info('[RaffleController] Solicitud de sorteo manual', { code, userId });
      
      // Obtener rifa y verificar permisos
      const raffle = await raffleService.getRaffleByCode(code);
      
      if (raffle.hostId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo el host puede elegir el ganador manualmente'
        });
      }
      
      if (raffle.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'La rifa no está activa'
        });
      }
      
      if (raffle.drawMode !== 'manual') {
        return res.status(400).json({
          success: false,
          message: 'Esta rifa no está en modo manual'
        });
      }
      
      // Verificar que todos los números estén vendidos
      const { query } = require('../../../db');
      const checkResult = await query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold
         FROM raffle_numbers
         WHERE raffle_id = $1`,
        [raffle.id]
      );
      
      const { total, sold } = checkResult.rows[0];
      
      if (parseInt(total) !== parseInt(sold)) {
        return res.status(400).json({
          success: false,
          message: `No se puede sortear aún. Faltan ${parseInt(total) - parseInt(sold)} números por vender`,
          stats: {
            total: parseInt(total),
            sold: parseInt(sold),
            remaining: parseInt(total) - parseInt(sold)
          }
        });
      }
      
      // Ejecutar finalización
      logger.info('[RaffleController] Ejecutando sorteo manual', { raffleId: raffle.id, code });
      
      await raffleService.finishRaffle(raffle.id);
      
      // Obtener datos actualizados
      const updatedRaffle = await raffleService.getRaffleByCode(code);
      
      res.json({
        success: true,
        message: '¡Ganador elegido exitosamente!',
        raffle: updatedRaffle,
        winner: {
          number: updatedRaffle.winnerNumber,
          userId: updatedRaffle.winnerId
        }
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error en sorteo manual', {
        code: req.params.code,
        userId: req.user?.id,
        error: error.message
      });
      
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error eligiendo ganador'
      });
    }
  }
  
  async forceFinishDebug(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user?.id;
      const raffle = await raffleService.getRaffleByCode(code);
      if (!raffle) {
        return res.status(404).json({ success: false, message: 'Rifa no encontrada' });
      }
      if (raffle.hostId !== userId) {
        return res.status(403).json({ success: false, message: 'Solo el host puede forzar el cierre (debug)' });
      }
      const { query } = require('../../../db');
      const rid = await query('SELECT id FROM raffles WHERE code = $1', [code]);
      await raffleService.finishRaffle(rid.rows[0].id);
      const updated = await raffleService.getRaffleByCode(code);
      res.json({ success: true, raffle: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new RaffleController();
