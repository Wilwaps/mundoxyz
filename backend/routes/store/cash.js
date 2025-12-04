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

// GET /api/store/:storeId/wallet
// Devuelve el saldo de la billetera de Fuegos de la tienda y sus movimientos recientes
router.get('/:storeId/wallet', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    // Verificar permisos de gestión en la tienda
    const canManage = await userCanManageStoreOperations(req.user, storeId);
    if (!canManage) {
      return res.status(403).json({ error: 'No autorizado para ver la billetera de esta tienda' });
    }

    const storeResult = await query(
      `SELECT id, name, fires_wallet_balance
       FROM stores
       WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const store = storeResult.rows[0];
    const balanceRaw = store.fires_wallet_balance != null ? Number(store.fires_wallet_balance) : 0;
    const balance = Number.isFinite(balanceRaw) ? balanceRaw : 0;

    const txResult = await query(
      `SELECT
         id,
         user_id,
         order_id,
         type,
         amount_fires,
         balance_after,
         metadata,
         created_at
       FROM store_wallet_transactions
       WHERE store_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [storeId, limit, offset]
    );

    res.json({
      store: {
        id: store.id,
        name: store.name,
        fires_wallet_balance: balance
      },
      transactions: txResult.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        order_id: row.order_id,
        type: row.type,
        amount_fires: Number(row.amount_fires || 0),
        balance_after: row.balance_after != null ? Number(row.balance_after) : null,
        metadata: row.metadata || {},
        created_at: row.created_at
      })),
      pagination: {
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error('[Store][Wallet] Error obteniendo billetera de tienda', error);
    res.status(500).json({ error: 'Error al obtener billetera de tienda' });
  }
});

// POST /api/store/:storeId/wallet/withdraw-to-owner
// Retiro de Fuegos desde la billetera de la tienda hacia la wallet de un socio/dueño específico sin comisión
router.post('/:storeId/wallet/withdraw-to-owner', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { amount_fires, target_user_id } = req.body || {};

    const amountRaw = amount_fires != null ? Number(amount_fires) : NaN;
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      return res.status(400).json({ error: 'amount_fires debe ser un número positivo' });
    }

    if (!target_user_id) {
      return res.status(400).json({ error: 'target_user_id es requerido' });
    }

    // Verificar alquiler activo
    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    const userId = req.user.id;
    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isGlobalAdmin = roles.includes('tote') || roles.includes('admin');

    const result = await transaction(async (client) => {
      // Bloquear tienda y obtener saldo actual
      const storeRes = await client.query(
        `SELECT id, name, fires_wallet_balance
         FROM stores
         WHERE id = $1
         FOR UPDATE`,
        [storeId]
      );

      if (storeRes.rows.length === 0) {
        throw new Error('Tienda no encontrada');
      }

      const store = storeRes.rows[0];

      // Verificar que el usuario que ejecuta la acción tenga permisos altos en la tienda
      // (owner/admin/manager) o sea admin/tote global.
      const staffRes = await client.query(
        `SELECT role, user_id
         FROM store_staff
         WHERE store_id = $1 AND user_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [storeId, userId]
      );

      const callerStaff = staffRes.rows[0] || null;
      const highRoles = ['owner', 'admin', 'manager'];
      const callerHasHighRole = callerStaff && highRoles.includes(callerStaff.role);

      if (!callerHasHighRole && !isGlobalAdmin) {
        throw new Error('No autorizado para iniciar retiros de la billetera de la tienda');
      }

      // Validar que el destinatario (target_user_id) sea staff de la tienda, típicamente con rol owner
      const targetStaffRes = await client.query(
        `SELECT role, user_id
         FROM store_staff
         WHERE store_id = $1 AND user_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [storeId, target_user_id]
      );

      if (targetStaffRes.rows.length === 0) {
        throw new Error('El usuario destino no pertenece al staff activo de esta tienda');
      }

      const targetStaff = targetStaffRes.rows[0];
      const targetHighRoles = ['owner', 'admin'];
      if (!targetHighRoles.includes(targetStaff.role)) {
        throw new Error('Solo se pueden hacer retiros hacia usuarios con rol de dueño/admin de la tienda');
      }

      const currentBalanceRaw = store.fires_wallet_balance != null ? Number(store.fires_wallet_balance) : 0;
      const currentBalance = Number.isFinite(currentBalanceRaw) ? currentBalanceRaw : 0;

      if (currentBalance < amountRaw) {
        throw new Error('Saldo insuficiente en la billetera de la tienda');
      }

      const newStoreBalance = currentBalance - amountRaw;

      // Actualizar saldo de la tienda
      await client.query(
        `UPDATE stores
         SET fires_wallet_balance = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newStoreBalance, store.id]
      );

      // Registrar movimiento en billetera de tienda (monto negativo)
      await client.query(
        `INSERT INTO store_wallet_transactions
         (store_id, user_id, order_id, type, amount_fires, balance_after, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          store.id,
          userId,
          null,
          'owner_withdraw',
          -amountRaw,
          newStoreBalance,
          JSON.stringify({ reason: 'withdraw_to_owner', target_user_id })
        ]
      );

      // Asegurar wallet del destinatario y bloquearla
      let ownerWalletRes = await client.query(
        'SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [target_user_id]
      );

      if (ownerWalletRes.rows.length === 0) {
        await client.query(
          `INSERT INTO wallets (user_id, coins_balance, fires_balance, created_at, updated_at)
           VALUES ($1, 0, 0, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [target_user_id]
        );

        ownerWalletRes = await client.query(
          'SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE',
          [target_user_id]
        );
      }

      if (ownerWalletRes.rows.length === 0) {
        throw new Error('No se pudo crear o encontrar la wallet del dueño');
      }

      const ownerWallet = ownerWalletRes.rows[0];
      const ownerBalanceRaw = ownerWallet.fires_balance != null ? Number(ownerWallet.fires_balance) : 0;
      const ownerBalanceBefore = Number.isFinite(ownerBalanceRaw) ? ownerBalanceRaw : 0;
      const ownerBalanceAfter = ownerBalanceBefore + amountRaw;

      // Actualizar wallet del dueño (sin comisión)
      await client.query(
        `UPDATE wallets
         SET fires_balance = fires_balance + $1,
             total_fires_earned = total_fires_earned + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amountRaw, ownerWallet.id]
      );

      await client.query(
        `INSERT INTO wallet_transactions
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
         VALUES ($1, 'store_owner_withdraw', 'fires', $2, $3, $4, $5, $6)`,
        [
          ownerWallet.id,
          amountRaw,
          ownerBalanceBefore,
          ownerBalanceAfter,
          `Retiro de Fuegos desde tienda ${store.name}`,
          `store_${store.id}_withdraw`
        ]
      );

      return {
        store_id: store.id,
        store_name: store.name,
        store_balance_after: newStoreBalance,
        owner_user_id: target_user_id,
        owner_wallet_id: ownerWallet.id,
        owner_balance_after: ownerBalanceAfter,
        amount_fires: amountRaw
      };
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Store][Wallet] Error en withdraw-to-owner', error);
    res.status(400).json({ error: error.message || 'Error al retirar Fuegos de la tienda' });
  }
});

module.exports = router;
