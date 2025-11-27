const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const { isStoreRentalActive, userCanViewStoreReports } = require('../../helpers/storeHelpers');

function parseDateRange(fromRaw, toRaw) {
  const now = new Date();
  let from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let to = toRaw ? new Date(toRaw) : now;

  if (!Number.isFinite(from.getTime())) {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (!Number.isFinite(to.getTime())) {
    to = now;
  }

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  return { from, to };
}

// GET /api/store/:storeId/reports/sales/overview
// Serie temporal de ventas (total_usdt, órdenes, comisión) por intervalo
router.get('/:storeId/reports/sales/overview', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { from: fromRaw, to: toRaw, interval = 'day', type, seller_id } = req.query;

    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    const canView = await userCanViewStoreReports(req.user, storeId);
    if (!canView) {
      return res.status(403).json({ error: 'No autorizado para ver reportes de esta tienda' });
    }

    // Normalizar intervalo (soporta diario/semanal/quincenal/mensual)
    const raw = String(interval || '').toLowerCase();
    let intervalKey;
    if (['day', 'daily', 'dia', 'diario'].includes(raw)) {
      intervalKey = 'day';
    } else if (['week', 'weekly', 'semana', 'semanal'].includes(raw)) {
      intervalKey = 'week';
    } else if (['quincena', 'quincenal', 'biweekly', '15d', 'fortnight'].includes(raw)) {
      intervalKey = 'quincena';
    } else if (['month', 'monthly', 'mes', 'mensual'].includes(raw)) {
      intervalKey = 'month';
    } else {
      intervalKey = 'day';
    }

    const { from, to } = parseDateRange(fromRaw, toRaw);

    const params = [storeId, from.toISOString(), to.toISOString()];
    const whereClauses = [
      'o.store_id = $1',
      "o.status = 'completed'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let paramIndex = 3;

    if (type) {
      whereClauses.push(`o.type = $${++paramIndex}`);
      params.push(String(type));
    }

    if (seller_id) {
      whereClauses.push(`o.user_id = $${++paramIndex}`);
      params.push(String(seller_id));
    }

    const whereSql = whereClauses.join(' AND ');

    // Expresión de bucket según intervalo
    let bucketExpression;
    if (intervalKey === 'day') {
      bucketExpression = "date_trunc('day', o.created_at)";
    } else if (intervalKey === 'week') {
      bucketExpression = "date_trunc('week', o.created_at)";
    } else if (intervalKey === 'month') {
      bucketExpression = "date_trunc('month', o.created_at)";
    } else if (intervalKey === 'quincena') {
      bucketExpression = `(
        date_trunc('month', o.created_at) +
        CASE WHEN EXTRACT(DAY FROM o.created_at) <= 15 THEN interval '0 days' ELSE interval '15 days' END
      )`;
    } else {
      bucketExpression = "date_trunc('day', o.created_at)";
    }

    const sql = `
      SELECT
        ${bucketExpression} AS bucket,
        COUNT(*) AS order_count,
        SUM(o.total_usdt) AS total_usdt,
        SUM(o.platform_commission_usdt) AS commission_usdt
      FROM orders o
      WHERE ${whereSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = await query(sql, params);

    const series = result.rows.map((row) => ({
      bucket: row.bucket,
      order_count: Number(row.order_count || 0),
      total_usdt: Number(row.total_usdt || 0),
      commission_usdt: Number(row.commission_usdt || 0)
    }));

    const totals = series.reduce(
      (acc, point) => {
        acc.order_count += point.order_count;
        acc.total_usdt += point.total_usdt;
        acc.commission_usdt += point.commission_usdt;
        return acc;
      },
      { order_count: 0, total_usdt: 0, commission_usdt: 0 }
    );

    res.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      interval: intervalKey,
      series,
      totals
    });
  } catch (error) {
    logger.error('Error fetching store sales overview report:', error);
    res.status(500).json({ error: 'Error al obtener reporte de ventas' });
  }
});

// GET /api/store/:storeId/reports/sales/by-seller
// Agregados de ventas por vendedor (user_id)
router.get('/:storeId/reports/sales/by-seller', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { from: fromRaw, to: toRaw, type } = req.query;

    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    const canView = await userCanViewStoreReports(req.user, storeId);
    if (!canView) {
      return res.status(403).json({ error: 'No autorizado para ver reportes de esta tienda' });
    }

    const { from, to } = parseDateRange(fromRaw, toRaw);

    const params = [storeId, from.toISOString(), to.toISOString()];
    const whereClauses = [
      'o.store_id = $1',
      "o.status = 'completed'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let paramIndex = 3;

    if (type) {
      whereClauses.push(`o.type = $${++paramIndex}`);
      params.push(String(type));
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT
        o.user_id AS seller_id,
        su.username AS seller_username,
        su.display_name AS seller_display_name,
        COUNT(*) AS order_count,
        SUM(o.total_usdt) AS total_usdt,
        SUM(o.platform_commission_usdt) AS commission_usdt
      FROM orders o
      LEFT JOIN users su ON su.id = o.user_id
      WHERE ${whereSql}
      GROUP BY o.user_id, su.username, su.display_name
      ORDER BY total_usdt DESC NULLS LAST
    `;

    const result = await query(sql, params);

    const sellers = result.rows.map((row) => ({
      seller_id: row.seller_id || null,
      seller_username: row.seller_username || null,
      seller_display_name: row.seller_display_name || row.seller_username || null,
      order_count: Number(row.order_count || 0),
      total_usdt: Number(row.total_usdt || 0),
      commission_usdt: Number(row.commission_usdt || 0)
    }));

    res.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      sellers
    });
  } catch (error) {
    logger.error('Error fetching store sales by seller report:', error);
    res.status(500).json({ error: 'Error al obtener reporte de ventas por vendedor' });
  }
});

// GET /api/store/:storeId/reports/sales/by-product
// Agregados de ventas por producto (order_items)
router.get('/:storeId/reports/sales/by-product', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { from: fromRaw, to: toRaw, type } = req.query;

    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    const canView = await userCanViewStoreReports(req.user, storeId);
    if (!canView) {
      return res.status(403).json({ error: 'No autorizado para ver reportes de esta tienda' });
    }

    const { from, to } = parseDateRange(fromRaw, toRaw);

    const params = [storeId, from.toISOString(), to.toISOString()];
    const whereClauses = [
      'o.store_id = $1',
      "o.status = 'completed'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let paramIndex = 3;

    if (type) {
      whereClauses.push(`o.type = $${++paramIndex}`);
      params.push(String(type));
    }

    const whereSql = whereClauses.join(' AND ');

    const sql = `
      SELECT
        oi.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.price_at_time_usdt * oi.quantity) AS gross_usdt,
        SUM(COALESCE(oi.cost_at_time_usdt, 0) * oi.quantity) AS cost_usdt
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ${whereSql}
      GROUP BY oi.product_id, p.name, p.sku
      ORDER BY gross_usdt DESC NULLS LAST
    `;

    const result = await query(sql, params);

    const products = result.rows.map((row) => {
      const units = Number(row.units_sold || 0);
      const gross = Number(row.gross_usdt || 0);
      const cost = Number(row.cost_usdt || 0);
      const profit = gross - cost;
      const margin = gross > 0 ? profit / gross : 0;

      return {
        product_id: row.product_id || null,
        product_name: row.product_name || null,
        product_sku: row.product_sku || null,
        units_sold: units,
        gross_usdt: gross,
        cost_usdt: cost,
        profit_usdt: profit,
        profit_margin: margin
      };
    });

    res.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      products
    });
  } catch (error) {
    logger.error('Error fetching store sales by product report:', error);
    res.status(500).json({ error: 'Error al obtener reporte de ventas por producto' });
  }
});

// GET /api/store/:storeId/reports/kpi
// KPIs globales para dashboard (ventas, tickets, ratios)
router.get('/:storeId/reports/kpi', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { from: fromRaw, to: toRaw, type, seller_id } = req.query;

    const rentalActive = await isStoreRentalActive(storeId);
    if (!rentalActive) {
      return res.status(403).json({ error: 'Store Rental Expired' });
    }

    const canView = await userCanViewStoreReports(req.user, storeId);
    if (!canView) {
      return res.status(403).json({ error: 'No autorizado para ver reportes de esta tienda' });
    }

    const { from, to } = parseDateRange(fromRaw, toRaw);

    // Completed orders
    const completedParams = [storeId, from.toISOString(), to.toISOString()];
    const completedWhere = [
      'o.store_id = $1',
      "o.status = 'completed'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let completedIndex = 3;

    if (type) {
      completedWhere.push(`o.type = $${++completedIndex}`);
      completedParams.push(String(type));
    }

    if (seller_id) {
      completedWhere.push(`o.user_id = $${++completedIndex}`);
      completedParams.push(String(seller_id));
    }

    const completedSql = `
      SELECT
        COUNT(*) AS order_count,
        SUM(o.total_usdt) AS total_usdt,
        SUM(o.platform_commission_usdt) AS commission_usdt
      FROM orders o
      WHERE ${completedWhere.join(' AND ')}
    `;

    const completedResult = await query(completedSql, completedParams);
    const completedRow = completedResult.rows[0] || {};

    const completedOrders = Number(completedRow.order_count || 0);
    const totalSales = Number(completedRow.total_usdt || 0);
    const totalCommission = Number(completedRow.commission_usdt || 0);

    // Cancelled orders
    const cancelledParams = [storeId, from.toISOString(), to.toISOString()];
    const cancelledWhere = [
      'o.store_id = $1',
      "o.status = 'cancelled'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let cancelledIndex = 3;

    if (type) {
      cancelledWhere.push(`o.type = $${++cancelledIndex}`);
      cancelledParams.push(String(type));
    }

    if (seller_id) {
      cancelledWhere.push(`o.user_id = $${++cancelledIndex}`);
      cancelledParams.push(String(seller_id));
    }

    const cancelledSql = `
      SELECT
        COUNT(*) AS order_count
      FROM orders o
      WHERE ${cancelledWhere.join(' AND ')}
    `;

    const cancelledResult = await query(cancelledSql, cancelledParams);
    const cancelledRow = cancelledResult.rows[0] || {};
    const cancelledOrders = Number(cancelledRow.order_count || 0);

    const totalOrders = completedOrders + cancelledOrders;
    const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 0;
    const avgTicket = completedOrders > 0 ? totalSales / completedOrders : 0;

    // Distribución por tipo (solo completadas)
    const byTypeParams = [storeId, from.toISOString(), to.toISOString()];
    const byTypeWhere = [
      'o.store_id = $1',
      "o.status = 'completed'",
      'o.created_at >= $2',
      'o.created_at <= $3'
    ];

    let byTypeIndex = 3;

    if (type) {
      byTypeWhere.push(`o.type = $${++byTypeIndex}`);
      byTypeParams.push(String(type));
    }

    if (seller_id) {
      byTypeWhere.push(`o.user_id = $${++byTypeIndex}`);
      byTypeParams.push(String(seller_id));
    }

    const byTypeSql = `
      SELECT
        o.type,
        COUNT(*) AS order_count,
        SUM(o.total_usdt) AS total_usdt
      FROM orders o
      WHERE ${byTypeWhere.join(' AND ')}
      GROUP BY o.type
    `;

    const byTypeResult = await query(byTypeSql, byTypeParams);

    const byType = byTypeResult.rows.map((row) => ({
      type: row.type,
      order_count: Number(row.order_count || 0),
      total_usdt: Number(row.total_usdt || 0)
    }));

    res.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      totals: {
        total_sales_usdt: totalSales,
        order_count_completed: completedOrders,
        order_count_cancelled: cancelledOrders,
        avg_ticket_usdt: avgTicket,
        completion_rate: completionRate,
        commission_usdt: totalCommission
      },
      by_type: byType
    });
  } catch (error) {
    logger.error('Error fetching store KPI report:', error);
    res.status(500).json({ error: 'Error al obtener KPIs de la tienda' });
  }
});

module.exports = router;
