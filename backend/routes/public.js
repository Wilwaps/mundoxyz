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

    // Contar usuarios activos (con transacciones en últimos 7 días)
    const activeUsers = await query(`
      SELECT COUNT(DISTINCT w.user_id) as active_users_7d
      FROM wallet_transactions wt
      INNER JOIN wallets w ON w.id = wt.wallet_id
      WHERE wt.created_at > NOW() - INTERVAL '7 days'
    `);

    // Contar total de usuarios
    const totalUsers = await query(`
      SELECT COUNT(*) as total_users
      FROM users
    `);

    // Contar usuarios "online" recientes según last_seen_at
    const onlineUsers = await query(`
      SELECT COUNT(*) as online_users
      FROM users
      WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
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

    // Normalizar y proteger contra valores NaN o nulos
    const ecoRow = economyStats.rows[0] || {};
    const totalFiresRaw = parseFloat(ecoRow.total_fires_circulation);
    const totalCoinsRaw = parseFloat(ecoRow.total_coins_circulation);
    const usersWithBalanceRaw = parseInt(ecoRow.total_users_with_balance);

    const totalFires = Number.isFinite(totalFiresRaw) ? totalFiresRaw : 0;
    const totalCoins = Number.isFinite(totalCoinsRaw) ? totalCoinsRaw : 0;
    const usersWithBalance = Number.isFinite(usersWithBalanceRaw) ? usersWithBalanceRaw : 0;

    const totalUsersRaw = parseInt(totalUsers.rows[0]?.total_users);
    const activeUsersRaw = parseInt(activeUsers.rows[0]?.active_users_7d);
    const onlineUsersRaw = parseInt(onlineUsers.rows[0]?.online_users);
    const totalUsersCount = Number.isFinite(totalUsersRaw) ? totalUsersRaw : 0;
    const activeUsersCount = Number.isFinite(activeUsersRaw) ? activeUsersRaw : 0;
    const onlineUsersCount = Number.isFinite(onlineUsersRaw) ? onlineUsersRaw : 0;

    const gamesRow = gamesPlayed.rows[0] || {};
    const bingoGamesRaw = parseInt(gamesRow.bingo_games);
    const rafflesGamesRaw = parseInt(gamesRow.raffles_finished);
    const tictactoeGamesRaw = parseInt(gamesRow.tictactoe_games);
    const bingoGames = Number.isFinite(bingoGamesRaw) ? bingoGamesRaw : 0;
    const rafflesGames = Number.isFinite(rafflesGamesRaw) ? rafflesGamesRaw : 0;
    const tictactoeGames = Number.isFinite(tictactoeGamesRaw) ? tictactoeGamesRaw : 0;

    const activeGamesRow = activeGames.rows[0] || {};
    const activeBingoRaw = parseInt(activeGamesRow.active_bingo);
    const activeRafflesRaw = parseInt(activeGamesRow.active_raffles);
    const activeTictactoeRaw = parseInt(activeGamesRow.active_tictactoe);
    const activeBingo = Number.isFinite(activeBingoRaw) ? activeBingoRaw : 0;
    const activeRaffles = Number.isFinite(activeRafflesRaw) ? activeRafflesRaw : 0;
    const activeTictactoe = Number.isFinite(activeTictactoeRaw) ? activeTictactoeRaw : 0;

    const prizesRow = prizesDistributed.rows[0] || {};
    const totalPrizesRaw = parseFloat(prizesRow.total_prizes_fires);
    const totalPrizes = Number.isFinite(totalPrizesRaw) ? totalPrizesRaw : 0;

    // Construir respuesta con valores ya normalizados
    const stats = {
      economy: {
        totalFiresCirculation: totalFires.toFixed(2),
        totalCoinsCirculation: totalCoins.toFixed(2),
        usersWithBalance
      },
      users: {
        total: totalUsersCount,
        active7Days: activeUsersCount,
        onlineNow: onlineUsersCount
      },
      games: {
        playedLast30Days: {
          bingo: bingoGames,
          raffles: rafflesGames,
          tictactoe: tictactoeGames,
          total: bingoGames + rafflesGames + tictactoeGames
        },
        activeNow: {
          bingo: activeBingo,
          raffles: activeRaffles,
          tictactoe: activeTictactoe,
          total: activeBingo + activeRaffles + activeTictactoe
        }
      },
      prizes: {
        distributedLast30Days: totalPrizes.toFixed(2)
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
