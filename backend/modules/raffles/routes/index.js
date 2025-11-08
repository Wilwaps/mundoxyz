/**
 * Sistema de Rifas V2 - Routes
 * Definición de endpoints HTTP
 */

const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/RaffleController');
const { verifyToken, optionalAuth } = require('../../../middleware/auth');
const {
  validate,
  validateParams,
  validateQuery,
  createRaffleSchema,
  updateRaffleSchema,
  purchaseNumberSchema,
  searchFiltersSchema,
  raffleCodeSchema,
  numberIndexSchema
} = require('../validators');

/**
 * RUTAS PÚBLICAS (sin autenticación)
 */

// Listar rifas públicas con filtros
router.get(
  '/',
  validateQuery(searchFiltersSchema),
  raffleController.listRaffles.bind(raffleController)
);

// Obtener detalle de rifa (público con info limitada)
router.get(
  '/:code',
  optionalAuth,
  raffleController.getRaffleDetail.bind(raffleController)
);

// Obtener números de rifa (público)
router.get(
  '/:code/numbers',
  optionalAuth,
  raffleController.getRaffleNumbers.bind(raffleController)
);

// Obtener estadísticas de rifa (público)
router.get(
  '/:code/stats',
  raffleController.getRaffleStats.bind(raffleController)
);

/**
 * RUTAS PROTEGIDAS (requieren autenticación)
 */

// Crear nueva rifa
router.post(
  '/',
  verifyToken,
  validate(createRaffleSchema),
  raffleController.createRaffle.bind(raffleController)
);

// Actualizar rifa (solo host o admin)
router.patch(
  '/:code',
  verifyToken,
  validate(updateRaffleSchema),
  raffleController.updateRaffle.bind(raffleController)
);

// Cancelar rifa (solo host o admin)
router.delete(
  '/:code',
  verifyToken,
  raffleController.cancelRaffle.bind(raffleController)
);

// Obtener rifas del usuario
router.get(
  '/user/my-raffles',
  verifyToken,
  raffleController.getUserRaffles.bind(raffleController)
);

/**
 * RUTAS DE NÚMEROS
 */

// Reservar número
router.post(
  '/:code/numbers/:idx/reserve',
  verifyToken,
  raffleController.reserveNumber.bind(raffleController)
);

// Liberar reserva
router.post(
  '/:code/numbers/:idx/release',
  verifyToken,
  raffleController.releaseNumber.bind(raffleController)
);

// Comprar número
router.post(
  '/:code/numbers/:idx/purchase',
  verifyToken,
  validate(purchaseNumberSchema),
  raffleController.purchaseNumber.bind(raffleController)
);

// Comprar múltiples números (batch)
router.post(
  '/:code/numbers/batch-purchase',
  verifyToken,
  validate(purchaseNumberSchema),
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Compra múltiple pendiente de implementación'
    });
  }
);

// Reservar múltiples números (batch)
router.post(
  '/:code/numbers/batch-reserve',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Reserva múltiple pendiente de implementación'
    });
  }
);

/**
 * RUTAS ADMINISTRATIVAS (solo host o admin)
 */

// Aprobar solicitud de pago
router.post(
  '/:code/requests/:requestId/approve',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Aprobación de pagos pendiente de implementación'
    });
  }
);

// Rechazar solicitud de pago
router.post(
  '/:code/requests/:requestId/reject',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Rechazo de pagos pendiente de implementación'
    });
  }
);

/**
 * RUTAS DE UPLOADS (archivos)
 */

// Subir imagen de premio
router.post(
  '/upload/prize',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Upload de imágenes pendiente de implementación'
    });
  }
);

// Subir logo de empresa
router.post(
  '/upload/logo',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 2
    res.status(501).json({
      success: false,
      message: 'Upload de logos pendiente de implementación'
    });
  }
);

/**
 * RUTAS DE REPORTES
 */

// Generar reporte de rifa
router.get(
  '/reports/:code',
  verifyToken,
  async (req, res) => {
    // TODO: Implementar en Fase 3
    res.status(501).json({
      success: false,
      message: 'Generación de reportes pendiente de implementación'
    });
  }
);

/**
 * Middleware de manejo de errores
 */
router.use((error, req, res, next) => {
  if (error.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(d => d.message)
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

module.exports = router;
