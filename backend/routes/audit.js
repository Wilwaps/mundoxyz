/**
 * RUTA TEMPORAL DE AUDITORÍA - EXPLOIT REEMBOLSOS
 * 
 * ELIMINAR DESPUÉS DE LA AUDITORÍA
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { query } = require('../db');

/**
 * GET /api/audit/raffle-refund-exploit
 * 
 * Auditoría completa del exploit de reembolsos
 * Solo accesible por admin/tote
 */
router.get('/raffle-refund-exploit', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar permisos de admin/tote
    const roleCheck = await query(`
      SELECT r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND r.name IN ('admin', 'tote')
    `, [userId]);
    
    if (roleCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Requiere permisos de administrador o tote'
      });
    }

    const report = {
      timestamp: new Date().toISOString(),
      auditor: req.user.username,
      sections: {}
    };

    // ========================================
    // QUERY 1: Rifas canceladas con pot > 0
    // ========================================
    const query1 = `
      SELECT 
        r.id,
        r.code,
        r.host_id,
        u.username as host_username,
        r.mode,
        r.status,
        r.pot_fires,
        r.pot_coins,
        r.cost_per_number,
        r.cancelled_at,
        r.ended_at,
        r.created_at,
        (SELECT COUNT(*) FROM raffle_numbers WHERE raffle_id = r.id AND state = 'sold') as sold_numbers
      FROM raffles r
      LEFT JOIN users u ON u.id = r.host_id
      WHERE r.status = 'cancelled'
        AND (r.pot_fires > 0 OR r.pot_coins > 0)
      ORDER BY r.cancelled_at DESC;
    `;
    
    const result1 = await query(query1);
    
    let totalExploitFires = 0;
    let totalExploitCoins = 0;
    
    result1.rows.forEach(row => {
      totalExploitFires += parseFloat(row.pot_fires) || 0;
      totalExploitCoins += parseFloat(row.pot_coins) || 0;
    });
    
    report.sections.cancelledRafflesWithPot = {
      count: result1.rows.length,
      totalExploitFires,
      totalExploitCoins,
      raffles: result1.rows.map(row => ({
        id: row.id,
        code: row.code,
        hostId: row.host_id,
        hostUsername: row.host_username,
        mode: row.mode,
        potFires: row.pot_fires,
        potCoins: row.pot_coins,
        soldNumbers: row.sold_numbers,
        cancelledAt: row.cancelled_at
      }))
    };

    // ========================================
    // QUERY 2: Transacciones de reembolso
    // ========================================
    const query2 = `
      SELECT 
        wt.id,
        wt.user_id,
        u.username,
        wt.type,
        wt.amount,
        wt.currency,
        wt.reference,
        wt.description,
        wt.created_at
      FROM wallet_transactions wt
      LEFT JOIN users u ON u.id = wt.user_id
      WHERE wt.type IN ('raffle_number_refund', 'raffle_refund_from_pot', 'raffle_refund_platform_fee')
      ORDER BY wt.created_at DESC
      LIMIT 100;
    `;
    
    const result2 = await query(query2);
    
    const refundTypes = {
      raffle_number_refund: 0,
      raffle_refund_from_pot: 0,
      raffle_refund_platform_fee: 0
    };
    
    result2.rows.forEach(row => {
      refundTypes[row.type] = (refundTypes[row.type] || 0) + 1;
    });
    
    report.sections.refundTransactions = {
      total: result2.rows.length,
      byType: refundTypes,
      hasNewFlow: refundTypes.raffle_refund_from_pot > 0,
      recentTransactions: result2.rows.slice(0, 20).map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        type: row.type,
        amount: row.amount,
        currency: row.currency,
        reference: row.reference,
        createdAt: row.created_at
      }))
    };

    // ========================================
    // QUERY 3: Hosts beneficiados
    // ========================================
    const query3 = `
      SELECT 
        u.id,
        u.username,
        u.tg_id,
        w.fires_balance,
        w.coins_balance,
        (
          SELECT COUNT(*) 
          FROM raffles r 
          WHERE r.host_id = u.id 
            AND r.status = 'cancelled' 
            AND (r.pot_fires > 0 OR r.pot_coins > 0)
        ) as cancelled_raffles_with_pot,
        (
          SELECT COALESCE(SUM(r.pot_fires), 0) 
          FROM raffles r 
          WHERE r.host_id = u.id 
            AND r.status = 'cancelled' 
            AND r.pot_fires > 0
        ) as total_kept_fires,
        (
          SELECT COALESCE(SUM(r.pot_coins), 0) 
          FROM raffles r 
          WHERE r.host_id = u.id 
            AND r.status = 'cancelled' 
            AND r.pot_coins > 0
        ) as total_kept_coins
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM raffles r 
        WHERE r.host_id = u.id 
          AND r.status = 'cancelled' 
          AND (r.pot_fires > 0 OR r.pot_coins > 0)
      )
      ORDER BY total_kept_fires DESC, total_kept_coins DESC;
    `;
    
    const result3 = await query(query3);
    
    report.sections.benefitedHosts = {
      count: result3.rows.length,
      hosts: result3.rows.map(row => ({
        id: row.id,
        username: row.username,
        tgId: row.tg_id,
        currentBalance: {
          fires: row.fires_balance,
          coins: row.coins_balance
        },
        cancelledRafflesWithPot: row.cancelled_raffles_with_pot,
        totalKeptFires: row.total_kept_fires,
        totalKeptCoins: row.total_kept_coins
      }))
    };

    // ========================================
    // RESUMEN Y RECOMENDACIONES
    // ========================================
    report.summary = {
      exploitDetected: result1.rows.length > 0,
      totalIndebidFires: totalExploitFires,
      totalIndebidCoins: totalExploitCoins,
      affectedRaffles: result1.rows.length,
      benefitedHosts: result3.rows.length,
      newFlowActive: refundTypes.raffle_refund_from_pot > 0
    };

    report.recommendations = [];
    
    if (result1.rows.length > 0) {
      report.recommendations.push({
        priority: 'CRÍTICA',
        action: 'Rollback manual de fuegos',
        description: 'Hosts mantuvieron pot_fires de rifas canceladas. Se requiere corrección.'
      });
    }
    
    if (refundTypes.raffle_refund_from_pot === 0 && result2.rows.length > 0) {
      report.recommendations.push({
        priority: 'ALTA',
        action: 'Todos los reembolsos anteriores usaron flujo incorrecto',
        description: 'NO hay transacciones raffle_refund_from_pot. El fix se aplicó pero no hay casos nuevos.'
      });
    }
    
    if (result1.rows.length === 0 && result2.rows.length === 0) {
      report.recommendations.push({
        priority: 'INFO',
        action: 'Sistema limpio',
        description: 'No se detectaron rifas canceladas con reembolso. Sistema no ha sido usado con esta funcionalidad.'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error en auditoría:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
