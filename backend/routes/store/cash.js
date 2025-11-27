const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { isStoreRentalActive, userCanManageStoreOperations } = require('../../helpers/storeHelpers');

// POST /api/store/:storeId/cash/open
// Abrir caja: requiere monto inicial por moneda (usdt, fires, bs, tron)
router.post('/:storeId/cash/open', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { opening_balance } = req.body || {};

    if (!opening_balance || typeof opening_balance !== 'object') {
      return res.status(400).json({ error: 'Se requiere opening_balance (objeto por moneda)' });
    }

    // Validar que opening_balance tenga las monedas permitidas
    const allowedCurrencies = ['usdt', 'fires', 'bs', 'tron'];
    const normalized = {};
    for (const cur of allowedCurrencies) {
      const val = Number(opening_balance[cur] || 0);
      normalized[cur] = val >= 0 ? val : 0;
    }

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    // Verificar permisos
    const canManage = await userCanManageStoreOperations(req.user, storeId);
    if (!canManage) {
      return res.status(403).json({ error: 'No autorizado para gestionar caja en esta tienda' });
    }

    // Verificar que no haya una sesión abierta
    const existingSession = await query(
      `SELECT id FROM cash_register_sessions WHERE store_id = $1 AND status = 'open' LIMIT 1`,
      [storeId]
    );

    if (existingSession.rows.length > 0) {
      return res.status(409).json({ error: 'Ya hay una sesión de caja abierta' });
    }

    // Crear nueva sesión
    const result = await query(
      `INSERT INTO cash_register_sessions
         (store_id, opened_by, opening_balance, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, opened_at, opening_balance, status`,
      [storeId, req.user.id, JSON.stringify(normalized)]
    );

    const session = result.rows[0];

    logger.info(`[Cash] Session opened`, {
      storeId,
      sessionId: session.id,
      openedBy: req.user.id,
      openingBalance: normalized
    });

    res.json({
      session: {
        id: session.id,
        opened_at: session.opened_at,
        opening_balance: normalized,
        status: session.status
      }
    });
  } catch (error) {
    logger.error('[Cash] Error opening cash session', error);
    res.status(500).json({ error: 'Error al abrir caja' });
  }
});

// POST /api/store/:storeId/cash/close
// Cerrar caja: calcula totales del turno, acepta desglose físico y notas
router.post('/:storeId/cash/close', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { payment_breakdown, cash_breakdown, notes } = req.body || {};

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    // Verificar permisos
    const canManage = await userCanManageStoreOperations(req.user, storeId);
    if (!canManage) {
      return res.status(403).json({ error: 'No autorizado para gestionar caja en esta tienda' });
    }

    // Obtener sesión abierta
    const sessionResult = await query(
      `SELECT id, opened_at, opening_balance FROM cash_register_sessions
       WHERE store_id = $1 AND status = 'open' LIMIT 1`,
      [storeId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hay una sesión de caja abierta' });
    }

    const session = sessionResult.rows[0];

    // Calcular totales de ventas en el rango [opened_at, NOW]
    const salesResult = await query(
      `SELECT 
         SUM(total_usdt) AS total_usdt,
         COUNT(*) AS order_count,
         SUM(platform_commission_usdt) AS commission_usdt
       FROM orders
       WHERE store_id = $1
         AND status IN ('confirmed', 'completed', 'preparing', 'ready')
         AND created_at >= $2
         AND created_at <= NOW()`,
      [storeId, session.opened_at]
    );

    const sales = salesResult.rows[0];
    const closing_totals = {
      usdt: Number(sales.total_usdt || 0),
      fires: 0,
      bs: 0,
      tron: 0
    };

    // Normalizar payment_breakdown (opcional)
    let normalizedPaymentBreakdown = {};
    if (payment_breakdown && typeof payment_breakdown === 'object') {
      const allowed = ['cash_bs', 'cash_usdt', 'zelle', 'transfer', 'mobile_payment', 'fires'];
      for (const key of allowed) {
        const val = Number(payment_breakdown[key] || 0);
        normalizedPaymentBreakdown[key] = val >= 0 ? val : 0;
      }
    }

    // Normalizar cash_breakdown (opcional)
    let normalizedCashBreakdown = {};
    if (cash_breakdown && typeof cash_breakdown === 'object') {
      normalizedCashBreakdown = cash_breakdown;
    }

    // Calcular expected_cash_total si hay cash_breakdown
    let expectedCashTotal = null;
    let actualCashTotal = null;
    let discrepancy = 0;

    if (Object.keys(normalizedCashBreakdown).length > 0) {
      // Sumar desglose físico
      expectedCashTotal = 0;
      for (const [currency, details] of Object.entries(normalizedCashBreakdown)) {
        if (typeof details === 'number') {
          expectedCashTotal += details;
        } else if (typeof details === 'object') {
          for (const [denom, qty] of Object.entries(details)) {
            expectedCashTotal += Number(denom || 0) * Number(qty || 0);
          }
        }
      }
      // Aquí podrías comparar con lo contado si lo pasas en el request
      actualCashTotal = expectedCashTotal; // por ahora igual
      discrepancy = actualCashTotal - expectedCashTotal;
    }

    // Actualizar sesión
    const updateResult = await query(
      `UPDATE cash_register_sessions
       SET closed_by = $1,
           closed_at = NOW(),
           closing_totals = $2,
           payment_breakdown = $3,
           cash_breakdown = $4,
           expected_cash_total = $5,
           actual_cash_total = $6,
           discrepancy = $7,
           notes = $8,
           status = 'closed',
           version = version + 1
       WHERE id = $9
       RETURNING id, closed_at, closing_totals, payment_breakdown, cash_breakdown,
                expected_cash_total, actual_cash_total, discrepancy, notes, status`,
      [
        req.user.id,
        JSON.stringify(closing_totals),
        JSON.stringify(normalizedPaymentBreakdown),
        JSON.stringify(normalizedCashBreakdown),
        expectedCashTotal,
        actualCashTotal,
        discrepancy,
        notes || null,
        session.id
      ]
    );

    const updatedSession = updateResult.rows[0];

    logger.info(`[Cash] Session closed`, {
      storeId,
      sessionId: session.id,
      closedBy: req.user.id,
      closingTotals: closing_totals,
      orderCount: Number(sales.order_count || 0)
    });

    res.json({
      session: {
        id: updatedSession.id,
        opened_at: session.opened_at,
        closed_at: updatedSession.closed_at,
        opening_balance: session.opening_balance,
        closing_totals,
        payment_breakdown: normalizedPaymentBreakdown,
        cash_breakdown: normalizedCashBreakdown,
        expected_cash_total: expectedCashTotal,
        actual_cash_total: actualCashTotal,
        discrepancy,
        notes: updatedSession.notes,
        status: updatedSession.status
      },
      summary: {
        order_count: Number(sales.order_count || 0),
        commission_usdt: Number(sales.commission_usdt || 0)
      }
    });
  } catch (error) {
    logger.error('[Cash] Error closing cash session', error);
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
});

// GET /api/store/:storeId/cash/status
// Consultar estado: devuelve la sesión abierta si existe, o null
router.get('/:storeId/cash/status', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    // Verificar permisos (lectura)
    const canManage = await userCanManageStoreOperations(req.user, storeId);
    if (!canManage) {
      return res.status(403).json({ error: 'No autorizado para ver estado de caja en esta tienda' });
    }

    // Buscar sesión abierta
    const result = await query(
      `SELECT id, opened_at, opened_by, opening_balance
       FROM cash_register_sessions
       WHERE store_id = $1 AND status = 'open' LIMIT 1`,
      [storeId]
    );

    if (result.rows.length === 0) {
      return res.json({ session: null });
    }

    const session = result.rows[0];
    res.json({
      session: {
        id: session.id,
        opened_at: session.opened_at,
        opened_by: session.opened_by,
        opening_balance: session.opening_balance,
        status: 'open'
      }
    });
  } catch (error) {
    logger.error('[Cash] Error fetching cash status', error);
    res.status(500).json({ error: 'Error al obtener estado de caja' });
  }
});

// GET /api/store/:storeId/cash/sessions
// Listar sesiones (paginado)
router.get('/:storeId/cash/sessions', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    // Verificar permisos
    const canManage = await userCanManageStoreOperations(req.user, storeId);
    if (!canManage) {
      return res.status(403).json({ error: 'No autorizado para ver sesiones de caja en esta tienda' });
    }

    const result = await query(
      `SELECT 
         id, opened_at, opened_by, closed_at, closed_by,
         opening_balance, closing_totals, payment_breakdown,
         cash_breakdown, expected_cash_total, actual_cash_total,
         discrepancy, notes, status, created_at, updated_at
       FROM cash_register_sessions
       WHERE store_id = $1
       ORDER BY opened_at DESC
       LIMIT $2 OFFSET $3`,
      [storeId, limit, offset]
    );

    res.json({
      sessions: result.rows,
      limit,
      offset
    });
  } catch (error) {
    logger.error('[Cash] Error fetching cash sessions', error);
    res.status(500).json({ error: 'Error al obtener sesiones de caja' });
  }
});

module.exports = router;
