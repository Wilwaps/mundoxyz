/**
 * Sistema de Rifas V2 - Controller
 * Manejo de requests HTTP y respuestas
 */

const raffleService = require('../services/RaffleServiceV2');
const logger = require('../../../utils/logger');
const { ErrorCodes, ErrorMessages } = require('../types');

class RaffleController {
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
   * Cancelar rifa (solo host o admin)
   */
  async cancelRaffle(req, res) {
    try {
      const { code } = req.params;
      const userId = req.user.id;
      
      // Verificar permisos
      const raffle = await raffleService.getRaffleByCode(code);
      
      if (raffle.raffle.hostId !== userId && !req.user.roles?.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cancelar esta rifa'
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
      
      // Obtener rifa
      const raffleData = await raffleService.getRaffleByCode(code);
      const raffle = raffleData.raffle;
      
      // Verificar estado
      if (raffle.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'La rifa no está activa'
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
      
      // Obtener raffleId desde el código
      const raffle = await raffleService.getRaffleByCode(code);
      
      if (!raffle) {
        return res.status(404).json({
          success: false,
          message: 'Rifa no encontrada'
        });
      }
      
      // Llamar al servicio para procesar la compra
      const result = await raffleService.purchaseNumber(
        raffle.id,
        parseInt(idx),
        userId,
        purchaseData
      );
      
      res.json({
        success: true,
        message: 'Número comprado exitosamente',
        transaction: result.transaction
      });
      
    } catch (error) {
      logger.error('[RaffleController] Error comprando número', error);
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
}

module.exports = new RaffleController();
