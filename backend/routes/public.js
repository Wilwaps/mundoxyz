/**
 * RUTAS PÚBLICAS - Sin autenticación requerida
 * Para landing page y datos públicos
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');

/**
 * GET /api/public/stats
 * Estadísticas públicas para landing page
 */
router.get('/stats', async (req, res) => {
  try {
    // Obtener estadísticas de economía
    const economyStats = await query(`
      SELECT 
        COALESCE(SUM(fires_balance), 0) as total_fires_circulation,
        COALESCE(SUM(coins_balance), 0) as total_coins_circulation,
        COUNT(DISTINCT user_id) as total_users_with_balance
      FROM wallets
    `);

    // Contar usuarios activos (que han hecho login en últimos 7 días)
    const activeUsers = await query(`
      SELECT COUNT(DISTINCT user_id) as active_users_7d
      FROM wallet_transactions
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    // Contar total de usuarios
    const totalUsers = await query(`
      SELECT COUNT(*) as total_users
      FROM users
    `);

    // Juegos jugados (últimos 30 días)
    const gamesPlayed = await query(`
      SELECT 
        (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status = 'finished' AND finished_at > NOW() - INTERVAL '30 days') as bingo_games,
        (SELECT COUNT(*) FROM raffles WHERE status = 'finished' AND ended_at > NOW() - INTERVAL '30 days') as raffles_finished,
        (SELECT COUNT(*) FROM tictactoe_rooms WHERE status = 'finished' AND created_at > NOW() - INTERVAL '30 days') as tictactoe_games
    `);

    // Premios distribuidos (últimos 30 días)
    const prizesDistributed = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_prizes_fires
      FROM wallet_transactions
      WHERE type IN ('bingo_prize', 'raffle_win', 'tictactoe_win')
        AND created_at > NOW() - INTERVAL '30 days'
        AND currency = 'fires'
    `);

    // Juegos activos ahora
    const activeGames = await query(`
      SELECT 
        (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status IN ('waiting', 'in_progress')) as active_bingo,
        (SELECT COUNT(*) FROM raffles WHERE status IN ('open', 'active')) as active_raffles,
        (SELECT COUNT(*) FROM tictactoe_rooms WHERE status = 'in_progress') as active_tictactoe
    `);

    // Construir respuesta
    const stats = {
      economy: {
        totalFiresCirculation: parseFloat(economyStats.rows[0].total_fires_circulation).toFixed(2),
        totalCoinsCirculation: parseFloat(economyStats.rows[0].total_coins_circulation).toFixed(2),
        usersWithBalance: parseInt(economyStats.rows[0].total_users_with_balance)
      },
      users: {
        total: parseInt(totalUsers.rows[0].total_users),
        active7Days: parseInt(activeUsers.rows[0].active_users_7d)
      },
      games: {
        playedLast30Days: {
          bingo: parseInt(gamesPlayed.rows[0].bingo_games),
          raffles: parseInt(gamesPlayed.rows[0].raffles_finished),
          tictactoe: parseInt(gamesPlayed.rows[0].tictactoe_games),
          total: parseInt(gamesPlayed.rows[0].bingo_games) + 
                 parseInt(gamesPlayed.rows[0].raffles_finished) + 
                 parseInt(gamesPlayed.rows[0].tictactoe_games)
        },
        activeNow: {
          bingo: parseInt(activeGames.rows[0].active_bingo),
          raffles: parseInt(activeGames.rows[0].active_raffles),
          tictactoe: parseInt(activeGames.rows[0].active_tictactoe),
          total: parseInt(activeGames.rows[0].active_bingo) + 
                 parseInt(activeGames.rows[0].active_raffles) + 
                 parseInt(activeGames.rows[0].active_tictactoe)
        }
      },
      prizes: {
        distributedLast30Days: parseFloat(prizesDistributed.rows[0].total_prizes_fires).toFixed(2)
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error obteniendo stats públicas:', error);
    
    // Devolver datos por defecto en caso de error
    res.json({
      success: true,
      data: {
        economy: {
          totalFiresCirculation: "0",
          totalCoinsCirculation: "0",
          usersWithBalance: 0
        },
        users: {
          total: 0,
          active7Days: 0
        },
        games: {
          playedLast30Days: {
            bingo: 0,
            raffles: 0,
            tictactoe: 0,
            total: 0
          },
          activeNow: {
            bingo: 0,
            raffles: 0,
            tictactoe: 0,
            total: 0
          }
        },
        prizes: {
          distributedLast30Days: "0"
        }
      },
      timestamp: new Date().toISOString(),
      note: 'Datos por defecto - error en servidor'
    });
  }
});

/**
 * GET /api/public/health
 * Health check público
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
