/**
 * Sistema de Rifas V2 - Service Layer
 * Lógica de negocio centralizada
 */

const { query, getClient } = require('../../../db');
const logger = require('../../../utils/logger');
const { generateCode } = require('../../../utils/codeGenerator');
const {
  RaffleStatus,
  RaffleMode,
  NumberState,
  PaymentStatus,
  ErrorCodes,
  SystemLimits
} = require('../types');

class RaffleServiceV2 {
  /**
   * Crear nueva rifa
   */
  async createRaffle(hostId, data, client = null) {
    const dbQuery = client?.query || query;
    
    try {
      logger.info('[RaffleServiceV2] Creando nueva rifa', { hostId, data });
      
      // Generar código único
      const code = await this.generateUniqueCode(dbQuery);
      
      // Preparar datos para inserción
      const {
        name,
        description,
        mode,
        visibility,
        numbersRange,
        entryPrice,
        startsAt,
        endsAt,
        termsConditions,
        prizeMeta,
        companyConfig
      } = data;
      
      // Determinar estado inicial
      const status = startsAt && new Date(startsAt) > new Date() 
        ? RaffleStatus.PENDING 
        : RaffleStatus.ACTIVE;
      
      // Insertar rifa
      const result = await dbQuery(
        `INSERT INTO raffles (
          code, name, description, status, mode, visibility,
          host_id, numbers_range, entry_price_fire, entry_price_coin,
          starts_at, ends_at, terms_conditions, prize_meta,
          pot_fires, pot_coins
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0)
        RETURNING *`,
        [
          code,
          name,
          description || null,
          status,
          mode,
          visibility,
          hostId,
          numbersRange,
          mode === RaffleMode.FIRES ? entryPrice : null,
          mode === RaffleMode.COINS ? entryPrice : null,
          startsAt || null,
          endsAt || null,
          termsConditions || null,
          prizeMeta ? JSON.stringify(prizeMeta) : null
        ]
      );
      
      const raffle = result.rows[0];
      
      // Si es modo empresa, crear configuración
      if (visibility === 'company' && companyConfig) {
        await dbQuery(
          `INSERT INTO raffle_companies (
            raffle_id, company_name, rif_number, brand_color,
            logo_url, website_url
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            raffle.id,
            companyConfig.companyName,
            companyConfig.rifNumber,
            companyConfig.primaryColor || null,
            companyConfig.logoUrl || null,
            companyConfig.websiteUrl || null
          ]
        );
      }
      
      // Crear números disponibles
      const numbers = [];
      for (let i = 0; i < numbersRange; i++) {
        numbers.push(`(${raffle.id}, ${i}, 'available')`);
      }
      
      if (numbers.length > 0) {
        await dbQuery(
          `INSERT INTO raffle_numbers (raffle_id, number_idx, state) 
           VALUES ${numbers.join(', ')}`
        );
      }
      
      logger.info('[RaffleServiceV2] Rifa creada exitosamente', { 
        raffleId: raffle.id, 
        code 
      });
      
      return this.formatRaffleResponse(raffle);
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error creando rifa', error);
      throw error;
    }
  }
  
  /**
   * Obtener lista de rifas con filtros
   */
  async getRaffles(filters = {}, userId = null) {
    try {
      const {
        status,
        mode,
        visibility = ['public'],
        hostId,
        minPot,
        maxPot,
        search,
        sortBy = 'created',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;
      
      let conditions = [];
      let params = [];
      let paramIndex = 1;
      
      // Filtros de estado
      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        conditions.push(`r.status = ANY($${paramIndex})`);
        params.push(statuses);
        paramIndex++;
      }
      
      // Filtros de modo
      if (mode) {
        const modes = Array.isArray(mode) ? mode : [mode];
        conditions.push(`r.mode = ANY($${paramIndex})`);
        params.push(modes);
        paramIndex++;
      }
      
      // Filtros de visibilidad
      if (visibility) {
        const visibilities = Array.isArray(visibility) ? visibility : [visibility];
        conditions.push(`r.visibility = ANY($${paramIndex})`);
        params.push(visibilities);
        paramIndex++;
      }
      
      // Filtro de host
      if (hostId) {
        conditions.push(`r.host_id = $${paramIndex}`);
        params.push(hostId);
        paramIndex++;
      }
      
      // Filtros de pote
      if (minPot) {
        conditions.push(`(r.pot_fires >= $${paramIndex} OR r.pot_coins >= $${paramIndex})`);
        params.push(minPot);
        paramIndex++;
      }
      
      if (maxPot) {
        conditions.push(`(r.pot_fires <= $${paramIndex} OR r.pot_coins <= $${paramIndex})`);
        params.push(maxPot);
        paramIndex++;
      }
      
      // Búsqueda por texto
      if (search) {
        conditions.push(`(r.name ILIKE $${paramIndex} OR r.code = $${paramIndex + 1})`);
        params.push(`%${search}%`, search);
        paramIndex += 2;
      }
      
      // Construir WHERE clause
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Ordenamiento
      const orderMap = {
        created: 'r.created_at',
        ending: 'r.ends_at',
        pot: 'GREATEST(r.pot_fires, r.pot_coins)',
        sold: 'numbers_sold'
      };
      const orderBy = `${orderMap[sortBy] || 'r.created_at'} ${sortOrder}`;
      
      // Contar total
      const countResult = await query(
        `SELECT COUNT(DISTINCT r.id) as total
         FROM raffles r
         ${whereClause}`,
        params
      );
      
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      
      // Obtener rifas con estadísticas
      params.push(limit, offset);
      
      const result = await query(
        `SELECT 
          r.*,
          u.username as host_username,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
          COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
          rc.company_name,
          rc.brand_color as primary_color,
          rc.logo_url
         FROM raffles r
         JOIN users u ON r.host_id = u.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         ${whereClause}
         GROUP BY r.id, u.username, rc.company_name, rc.brand_color, rc.logo_url
         ORDER BY ${orderBy}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );
      
      const raffles = result.rows.map(r => this.formatRaffleResponse(r));
      
      return {
        raffles,
        total,
        page,
        totalPages
      };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error obteniendo rifas', error);
      throw error;
    }
  }
  
  /**
   * Obtener detalle de rifa por código
   */
  async getRaffleByCode(code, userId = null) {
    try {
      const result = await query(
        `SELECT 
          r.*,
          u.username as host_username,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
          COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
          rc.company_name,
          rc.rif_number,
          rc.brand_color as primary_color,
          rc.logo_url,
          rc.website_url
         FROM raffles r
         JOIN users u ON r.host_id = u.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         WHERE r.code = $1
         GROUP BY r.id, u.username, rc.company_name, rc.rif_number, 
                  rc.brand_color, rc.logo_url, rc.website_url`,
        [code]
      );
      
      if (result.rows.length === 0) {
        throw {
          code: ErrorCodes.RAFFLE_NOT_FOUND,
          status: 404
        };
      }
      
      const raffle = this.formatRaffleResponse(result.rows[0]);
      
      // Obtener números si el usuario es dueño o admin
      let numbers = [];
      let userNumbers = [];
      
      if (userId) {
        // Números del usuario
        const userNumsResult = await query(
          `SELECT number_idx 
           FROM raffle_numbers 
           WHERE raffle_id = $1 AND owner_id = $2 AND state = 'sold'
           ORDER BY number_idx`,
          [raffle.id, userId]
        );
        userNumbers = userNumsResult.rows.map(r => r.number_idx);
      }
      
      // Obtener estado de todos los números
      const numbersResult = await query(
        `SELECT 
          number_idx as idx,
          state,
          owner_id,
          u.username as owner_username,
          reserved_at,
          purchased_at
         FROM raffle_numbers rn
         LEFT JOIN users u ON rn.owner_id = u.id
         WHERE rn.raffle_id = $1
         ORDER BY rn.number_idx`,
        [raffle.id]
      );
      
      numbers = numbersResult.rows.map(n => ({
        idx: n.idx,
        state: n.state,
        ownerId: n.owner_id,
        ownerUsername: n.owner_username,
        reservedAt: n.reserved_at,
        purchasedAt: n.purchased_at
      }));
      
      // Obtener estadísticas
      const statsResult = await query(
        `SELECT 
          COUNT(DISTINCT owner_id) FILTER (WHERE state = 'sold') as total_participants,
          COUNT(*) FILTER (WHERE state = 'sold') as total_numbers_sold,
          COALESCE(SUM(CASE WHEN state = 'sold' THEN r.entry_price_fire END), 0) as total_revenue_fires,
          COALESCE(SUM(CASE WHEN state = 'sold' THEN r.entry_price_coin END), 0) as total_revenue_coins
         FROM raffle_numbers rn
         JOIN raffles r ON r.id = rn.raffle_id
         WHERE rn.raffle_id = $1`,
        [raffle.id]
      );
      
      const stats = {
        totalParticipants: parseInt(statsResult.rows[0].total_participants),
        totalNumbersSold: parseInt(statsResult.rows[0].total_numbers_sold),
        totalRevenueFires: parseFloat(statsResult.rows[0].total_revenue_fires),
        totalRevenueCoins: parseFloat(statsResult.rows[0].total_revenue_coins),
        averageNumbersPerUser: statsResult.rows[0].total_participants > 0 
          ? Math.round(statsResult.rows[0].total_numbers_sold / statsResult.rows[0].total_participants * 10) / 10
          : 0,
        completionRate: Math.round((statsResult.rows[0].total_numbers_sold / raffle.numbersRange) * 100)
      };
      
      return {
        raffle,
        numbers,
        userNumbers,
        stats
      };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error obteniendo rifa', error);
      throw error;
    }
  }
  
  /**
   * Reservar número
   */
  async reserveNumber(raffleId, numberIdx, userId, client = null) {
    const dbQuery = client?.query || query;
    
    try {
      // Verificar estado del número
      const checkResult = await dbQuery(
        `SELECT state, owner_id, reserved_at
         FROM raffle_numbers
         WHERE raffle_id = $1 AND number_idx = $2
         FOR UPDATE`,
        [raffleId, numberIdx]
      );
      
      if (checkResult.rows.length === 0) {
        throw { code: ErrorCodes.NOT_FOUND, status: 404 };
      }
      
      const number = checkResult.rows[0];
      
      // Validar disponibilidad
      if (number.state !== NumberState.AVAILABLE) {
        // Si está reservado por el mismo usuario, extender tiempo
        if (number.state === NumberState.RESERVED && number.owner_id === userId) {
          const newExpiry = new Date(Date.now() + SystemLimits.RESERVATION_TIMEOUT_MS);
          
          await dbQuery(
            `UPDATE raffle_numbers
             SET reserved_at = NOW(), reservation_expires_at = $1
             WHERE raffle_id = $2 AND number_idx = $3`,
            [newExpiry, raffleId, numberIdx]
          );
          
          return {
            success: true,
            extended: true,
            expiresAt: newExpiry
          };
        }
        
        throw { 
          code: ErrorCodes.NUMBER_NOT_AVAILABLE, 
          status: 400 
        };
      }
      
      // Reservar número
      const expiresAt = new Date(Date.now() + SystemLimits.RESERVATION_TIMEOUT_MS);
      
      await dbQuery(
        `UPDATE raffle_numbers
         SET state = $1, owner_id = $2, reserved_at = NOW(), 
             reservation_expires_at = $3
         WHERE raffle_id = $4 AND number_idx = $5`,
        [NumberState.RESERVED, userId, expiresAt, raffleId, numberIdx]
      );
      
      logger.info('[RaffleServiceV2] Número reservado', {
        raffleId,
        numberIdx,
        userId,
        expiresAt
      });
      
      return {
        success: true,
        expiresAt
      };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error reservando número', error);
      throw error;
    }
  }
  
  /**
   * Liberar reserva
   */
  async releaseNumber(raffleId, numberIdx, userId, client = null) {
    const dbQuery = client?.query || query;
    
    try {
      const result = await dbQuery(
        `UPDATE raffle_numbers
         SET state = $1, owner_id = NULL, reserved_at = NULL,
             reservation_expires_at = NULL
         WHERE raffle_id = $2 AND number_idx = $3 
               AND owner_id = $4 AND state = $5
         RETURNING *`,
        [NumberState.AVAILABLE, raffleId, numberIdx, userId, NumberState.RESERVED]
      );
      
      if (result.rows.length === 0) {
        throw { 
          code: ErrorCodes.UNAUTHORIZED, 
          status: 403 
        };
      }
      
      logger.info('[RaffleServiceV2] Reserva liberada', {
        raffleId,
        numberIdx,
        userId
      });
      
      return { success: true };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error liberando reserva', error);
      throw error;
    }
  }
  
  /**
   * Limpiar reservas expiradas (Job)
   */
  async cleanExpiredReservations() {
    try {
      const result = await query(
        `UPDATE raffle_numbers
         SET state = $1, owner_id = NULL, reserved_at = NULL,
             reservation_expires_at = NULL
         WHERE state = $2 AND reservation_expires_at < NOW()
         RETURNING raffle_id, number_idx`,
        [NumberState.AVAILABLE, NumberState.RESERVED]
      );
      
      const expiredCount = result.rows.length;
      
      if (expiredCount > 0) {
        logger.info('[RaffleServiceV2] Reservas expiradas limpiadas', {
          count: expiredCount
        });
        
        // Agrupar por rifa para emisión de eventos
        const byRaffle = result.rows.reduce((acc, row) => {
          if (!acc[row.raffle_id]) acc[row.raffle_id] = [];
          acc[row.raffle_id].push(row.number_idx);
          return acc;
        }, {});
        
        return byRaffle;
      }
      
      return {};
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error limpiando reservas', error);
      return {};
    }
  }
  
  /**
   * UTILIDADES PRIVADAS
   */
  
  async generateUniqueCode(dbQuery) {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const code = generateCode(6);
      
      const exists = await dbQuery(
        'SELECT 1 FROM raffles WHERE code = $1',
        [code]
      );
      
      if (exists.rows.length === 0) {
        return code;
      }
      
      attempts++;
    }
    
    throw new Error('No se pudo generar código único');
  }
  
  formatRaffleResponse(raffle) {
    return {
      id: raffle.id,
      code: raffle.code,
      name: raffle.name,
      description: raffle.description,
      status: raffle.status,
      mode: raffle.mode,
      visibility: raffle.visibility,
      hostId: raffle.host_id,
      hostUsername: raffle.host_username,
      numbersRange: raffle.numbers_range,
      numbersSold: parseInt(raffle.numbers_sold || 0),
      numbersReserved: parseInt(raffle.numbers_reserved || 0),
      entryPriceFire: raffle.entry_price_fire,
      entryPriceCoin: raffle.entry_price_coin,
      potFires: parseFloat(raffle.pot_fires || 0),
      potCoins: parseFloat(raffle.pot_coins || 0),
      createdAt: raffle.created_at,
      startsAt: raffle.starts_at,
      endsAt: raffle.ends_at,
      finishedAt: raffle.finished_at,
      companyConfig: raffle.company_name ? {
        companyName: raffle.company_name,
        rifNumber: raffle.rif_number,
        primaryColor: raffle.primary_color,
        logoUrl: raffle.logo_url,
        websiteUrl: raffle.website_url
      } : null,
      prizeMeta: raffle.prize_meta 
        ? (typeof raffle.prize_meta === 'string' ? JSON.parse(raffle.prize_meta) : raffle.prize_meta)
        : null,
      termsConditions: raffle.terms_conditions
    };
  }
}

module.exports = new RaffleServiceV2();
