/**
 * Routes API - Sistema Unificado de Salas
 * Endpoints para búsqueda y gestión cross-game de salas
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const RoomCodeService = require('../services/roomCodeService');
const logger = require('../utils/logger');

/**
 * GET /api/rooms/find/:code
 * Busca una sala por código y retorna detalles completos
 * Usado por Quick Join del lobby
 */
router.get('/find/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    logger.info('🔍 Quick Join - Buscando sala', { code });
    
    // Validar formato
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido. Debe ser numérico de 6 dígitos'
      });
    }
    
    // Buscar sala
    const roomDetails = await RoomCodeService.getRoomDetails(code);
    
    if (!roomDetails) {
      logger.warn('⚠️ Sala no encontrada', { code });
      return res.status(404).json({
        success: false,
        error: 'Sala no encontrada',
        code: 'ROOM_NOT_FOUND'
      });
    }
    
    // Verificar estado
    if (roomDetails.status === 'finished') {
      return res.status(400).json({
        success: false,
        error: 'Esta sala ya finalizó',
        code: 'ROOM_FINISHED',
        room: roomDetails
      });
    }
    
    if (roomDetails.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Esta sala fue cancelada',
        code: 'ROOM_CANCELLED',
        room: roomDetails
      });
    }
    
    // Construir URL de redirección según tipo de juego
    let redirectUrl = '';
    
    switch (roomDetails.game_type) {
      case 'tictactoe':
        redirectUrl = `/tictactoe/room/${code}`;
        break;
      case 'bingo':
        redirectUrl = `/bingo/v2/room/${code}`;
        break;
      default:
        throw new Error(`Tipo de juego no soportado: ${roomDetails.game_type}`);
    }
    
    logger.info('✅ Sala encontrada - Quick Join exitoso', {
      code,
      gameType: roomDetails.game_type,
      redirectUrl
    });
    
    res.json({
      success: true,
      room: roomDetails,
      redirect_url: redirectUrl,
      game_type: roomDetails.game_type
    });
    
  } catch (error) {
    logger.error('❌ Error en Quick Join', {
      error: error.message,
      code: req.params.code,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al buscar sala',
      details: error.message
    });
  }
});

/**
 * GET /api/rooms/active
 * Obtiene salas activas del usuario autenticado
 * Incluye todas las salas donde el usuario participa (TicTacToe, Bingo, Rifas)
 */
router.get('/active', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.info('📋 Obteniendo salas activas del usuario', { userId });
    
    const { query } = require('../db');
    
    // TicTacToe - salas donde el usuario es player_x o player_o
    const tictactoeRooms = await query(`
      SELECT 
        r.code,
        r.mode,
        r.bet_amount,
        r.status,
        r.created_at,
        'tictactoe' as game_type,
        u.username as host_username,
        CASE 
          WHEN r.player_x_id = $1 THEN 'X'
          WHEN r.player_o_id = $1 THEN 'O'
        END as player_role
      FROM tictactoe_rooms r
      LEFT JOIN users u ON r.host_id = u.id
      WHERE (r.player_x_id = $1 OR r.player_o_id = $1)
        AND r.status IN ('waiting', 'playing')
      ORDER BY r.created_at DESC
    `, [userId]);
    
    // Bingo - salas donde el usuario tiene cartones
    const bingoRooms = await query(`
      SELECT DISTINCT
        r.code,
        r.name,
        r.mode,
        r.card_cost,
        r.currency_type,
        r.status,
        r.created_at,
        'bingo' as game_type,
        u.username as host_username,
        p.cards_purchased
      FROM bingo_v2_rooms r
      LEFT JOIN users u ON r.host_id = u.id
      JOIN bingo_v2_room_players p ON r.id = p.room_id
      WHERE p.user_id = $1
        AND r.status IN ('waiting', 'in_progress')
      ORDER BY r.created_at DESC
    `, [userId]);
    
    // Rifas - donde el usuario es host o participante (números comprados/reservados)
    const raffleRooms = await query(`
      SELECT DISTINCT
        r.code,
        r.name,
        r.mode,
        r.status,
        r.created_at,
        'raffle' as game_type,
        u.username as host_username
      FROM raffles r
      JOIN users u ON r.host_id = u.id
      LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
      WHERE (r.host_id = $1 OR rn.owner_id = $1 OR rn.reserved_by = $1)
        AND r.status IN ('active', 'pending')
      ORDER BY r.created_at DESC
    `, [userId]);
    
    const allRooms = [
      ...tictactoeRooms.rows,
      ...bingoRooms.rows,
      ...raffleRooms.rows,
    ];
    
    logger.info('✅ Salas activas obtenidas', {
      userId,
      totalRooms: allRooms.length,
      tictactoe: tictactoeRooms.rows.length,
      bingo: bingoRooms.rows.length,
      raffle: raffleRooms.rows.length,
    });
    
    res.json({
      success: true,
      rooms: allRooms
    });
    
  } catch (error) {
    logger.error('❌ Error obteniendo salas activas', {
      error: error.message,
      userId: req.user?.id,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener salas activas'
    });
  }
});

/**
 * GET /api/rooms/stats
 * Estadísticas del sistema de códigos (admin/debug)
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const stats = await RoomCodeService.getStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Error getting room stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

module.exports = router;
