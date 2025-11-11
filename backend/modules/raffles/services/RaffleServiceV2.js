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
            raffle_id, company_name, rif_number, brand_color, secondary_color,
            logo_url, website_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            raffle.id,
            companyConfig.companyName,
            companyConfig.rifNumber,
            companyConfig.primaryColor || null,
            companyConfig.secondaryColor || null,
            companyConfig.logoUrl || null,
            companyConfig.websiteUrl || null
          ]
        );
      }
      
      // Crear números disponibles (optimizado con batch)
      await this.createNumbersBatch(raffle.id, numbersRange, dbQuery);
      
      logger.info('[RaffleServiceV2] Rifa creada exitosamente', { 
        raffleId: raffle.id, 
        code,
        numbersRange 
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
          rc.secondary_color,
          rc.logo_url
         FROM raffles r
         JOIN users u ON r.host_id = u.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         ${whereClause}
         GROUP BY r.id, u.username, rc.company_name, rc.brand_color, rc.secondary_color, rc.logo_url
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
          rc.secondary_color,
          rc.logo_url,
          rc.website_url
         FROM raffles r
         JOIN users u ON r.host_id = u.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         WHERE r.code = $1
         GROUP BY r.id, u.username, rc.company_name, rc.rif_number, 
                  rc.brand_color, rc.secondary_color, rc.logo_url, rc.website_url`,
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
          reserved_by,
          reserved_until,
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
        reservedBy: n.reserved_by,
        reservedUntil: n.reserved_until,
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
        `SELECT state, owner_id, reserved_by, reserved_until
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
             SET reserved_until = $1
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
         SET state = $1, owner_id = $2, reserved_by = $3, 
             reserved_until = $4
         WHERE raffle_id = $5 AND number_idx = $6`,
        [NumberState.RESERVED, userId, userId, expiresAt, raffleId, numberIdx]
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
         SET state = $1, owner_id = NULL, reserved_by = NULL,
             reserved_until = NULL
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
   * Comprar número (convertir reserva a compra)
   */
  async purchaseNumber(raffleId, numberIdx, userId, paymentData = {}) {
    let transactionClient = null;
    const useTransaction = true; // Siempre usar transacción para compras
    
    try {
      // Iniciar transacción
      transactionClient = await getClient();
      await transactionClient.query('BEGIN');
      const dbQuery = transactionClient.query.bind(transactionClient);
      
      logger.info('[RaffleServiceV2] Comprando número', {
        raffleId,
        numberIdx,
        userId
      });
      
      // 1. Obtener detalles de la rifa
      const raffleResult = await dbQuery(
        `SELECT r.*, r.mode as raffle_mode, r.entry_price_fire, r.entry_price_coin
         FROM raffles r
         WHERE r.id = $1 AND r.status = 'active'
         FOR UPDATE`,
        [raffleId]
      );
      
      if (raffleResult.rows.length === 0) {
        throw { code: ErrorCodes.RAFFLE_NOT_FOUND, status: 404 };
      }
      
      const raffle = raffleResult.rows[0];
      
      // 2. Verificar estado del número (debe estar reservado por este usuario)
      const numberResult = await dbQuery(
        `SELECT state, owner_id, reserved_by, reserved_until
         FROM raffle_numbers
         WHERE raffle_id = $1 AND number_idx = $2
         FOR UPDATE`,
        [raffleId, numberIdx]
      );
      
      if (numberResult.rows.length === 0) {
        throw { code: ErrorCodes.NUMBER_NOT_FOUND, status: 404 };
      }
      
      const numberData = numberResult.rows[0];
      
      // Validar que esté reservado por este usuario
      if (numberData.state !== NumberState.RESERVED || numberData.reserved_by !== userId) {
        throw { 
          code: ErrorCodes.UNAUTHORIZED, 
          status: 403,
          message: 'Número no reservado por este usuario'
        };
      }
      
      // Validar que no haya expirado
      if (numberData.reserved_until && new Date(numberData.reserved_until) < new Date()) {
        throw {
          code: ErrorCodes.RESERVATION_EXPIRED,
          status: 400,
          message: 'Reserva expirada'
        };
      }
      
      // 3. Determinar costo según modo de rifa
      let cost = 0;
      let currency = '';
      
      if (raffle.raffle_mode === RaffleMode.FIRES) {
        cost = raffle.entry_price_fire || 10;
        currency = 'fires';
      } else if (raffle.raffle_mode === RaffleMode.COINS) {
        cost = raffle.entry_price_coin || 10;
        currency = 'coins';
      }
      // Modo PRIZE se maneja diferente (aprobación manual)
      
      // 4. Si es modo fires/coins, validar y cobrar
      if (raffle.raffle_mode !== RaffleMode.PRIZE) {
        // Obtener balance del usuario
        const walletResult = await dbQuery(
          `SELECT id, fires_balance, coins_balance
           FROM wallets
           WHERE user_id = $1
           FOR UPDATE`,
          [userId]
        );
        
        if (walletResult.rows.length === 0) {
          throw {
            code: ErrorCodes.WALLET_NOT_FOUND,
            status: 404,
            message: 'Wallet no encontrado'
          };
        }
        
        const wallet = walletResult.rows[0];
        const currentBalance = currency === 'fires' ? wallet.fires_balance : wallet.coins_balance;
        
        // VALIDACIÓN CRÍTICA: Verificar balance suficiente
        if (currentBalance < cost) {
          throw {
            code: ErrorCodes.INSUFFICIENT_BALANCE,
            status: 400,
            message: `Balance insuficiente. Necesitas ${cost} ${currency}, tienes ${currentBalance}`
          };
        }
        
        // 5. Cobrar del wallet
        const balanceField = currency === 'fires' ? 'fires_balance' : 'coins_balance';
        const spentField = currency === 'fires' ? 'total_fires_spent' : 'total_coins_spent';
        
        await dbQuery(
          `UPDATE wallets
           SET ${balanceField} = ${balanceField} - $1,
               ${spentField} = ${spentField} + $1
           WHERE user_id = $2`,
          [cost, userId]
        );
        
        // 6. Registrar transacción
        await dbQuery(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'debit', $2, $3, $4, $5, $6, $7)`,
          [
            wallet.id,  // ✅ FIX: usar wallet.id (INTEGER), no userId (UUID)
            currency,
            cost,
            currentBalance,
            currentBalance - cost,
            `Compra número ${numberIdx} en rifa ${raffle.code}`,
            `raffle_${raffle.code}_num_${numberIdx}`
          ]
        );
        
        // 7. Actualizar pot de la rifa
        const potField = currency === 'fires' ? 'pot_fires' : 'pot_coins';
        await dbQuery(
          `UPDATE raffles
           SET ${potField} = COALESCE(${potField}, 0) + $1
           WHERE id = $2`,
          [cost, raffleId]
        );
        
        logger.info('[RaffleServiceV2] Pago procesado', {
          userId,
          cost,
          currency,
          newBalance: currentBalance - cost
        });
      }
      
      // 8. Marcar número como SOLD
      await dbQuery(
        `UPDATE raffle_numbers
         SET state = $1,
             owner_id = $2,
             purchased_at = NOW(),
             reserved_by = NULL,
             reserved_until = NULL
         WHERE raffle_id = $3 AND number_idx = $4`,
        [NumberState.SOLD, userId, raffleId, numberIdx]
      );
      
      // Commit transacción
      await transactionClient.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Número comprado exitosamente', {
        raffleId,
        numberIdx,
        userId,
        cost,
        currency: raffle.raffle_mode
      });
      
      const result = {
        success: true,
        transaction: {
          amount: cost,
          currency: currency || raffle.raffle_mode,
          numberIdx
        }
      };
      
      // ✅ NUEVO: Verificar si la rifa debe finalizarse automáticamente
      setImmediate(async () => {
        try {
          await this.checkAndFinishRaffle(raffleId);
        } catch (err) {
          logger.error('[RaffleServiceV2] Error verificando finalización', err);
        }
      });
      
      return result;
      
    } catch (error) {
      // Rollback en caso de error
      if (transactionClient) {
        await transactionClient.query('ROLLBACK');
      }
      
      logger.error('[RaffleServiceV2] Error comprando número', error);
      throw error;
      
    } finally {
      // Liberar conexión
      if (transactionClient) {
        transactionClient.release();
      }
    }
  }
  
  /**
   * Verificar y finalizar rifa si todos los números están vendidos
   */
  async checkAndFinishRaffle(raffleId) {
    try {
      // PASO 1: LIMPIAR reservas expiradas ANTES de verificar
      logger.info('[RaffleServiceV2] Limpiando reservas expiradas antes de verificar finalización', { raffleId });
      
      const cleanResult = await query(
        `UPDATE raffle_numbers
         SET state = $1, owner_id = NULL, reserved_by = NULL, reserved_until = NULL
         WHERE raffle_id = $2 
           AND state = $3 
           AND reserved_until < NOW()
         RETURNING number_idx`,
        ['available', raffleId, 'reserved']
      );
      
      if (cleanResult.rows.length > 0) {
        logger.info('[RaffleServiceV2] Reservas expiradas liberadas', {
          raffleId,
          count: cleanResult.rows.length,
          numbers: cleanResult.rows.map(r => r.number_idx)
        });
      }
      
      // PASO 2: Verificar si todos los números están vendidos
      const checkResult = await query(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold,
           SUM(CASE WHEN state = 'reserved' THEN 1 ELSE 0 END) as reserved
         FROM raffle_numbers
         WHERE raffle_id = $1`,
        [raffleId]
      );
      
      const { total, sold, reserved } = checkResult.rows[0];
      
      logger.info('[RaffleServiceV2] Verificando finalización', {
        raffleId,
        total: parseInt(total),
        sold: parseInt(sold),
        reserved: parseInt(reserved)
      });
      
      // Solo finalizar si TODOS los números están vendidos Y NO hay reservas activas
      if (parseInt(total) === parseInt(sold) && parseInt(sold) > 0 && parseInt(reserved) === 0) {
        logger.info('[RaffleServiceV2] ✅ Todos los números vendidos y sin reservas - Programando finalización en 10 segundos', {
          raffleId
        });
        
        // Obtener código de rifa para socket
        const raffleCodeResult = await query(
          'SELECT code FROM raffles WHERE id = $1',
          [raffleId]
        );
        const raffleCode = raffleCodeResult.rows[0]?.code;
        
        // Emitir evento de sorteo programado
        if (raffleCode && global.io) {
          global.io.to(`raffle_${raffleCode}`).emit('raffle:drawing_scheduled', {
            code: raffleCode,
            drawInSeconds: 10,
            message: '¡Todos los números vendidos! Sorteo en 10 segundos...'
          });
        }
        
        // DELAY DE 10 SEGUNDOS antes de sorteo
        setTimeout(async () => {
          try {
            await this.finishRaffle(raffleId);
          } catch (err) {
            logger.error('[RaffleServiceV2] Error en finalización retrasada', err);
          }
        }, 10000); // 10 segundos
        
      } else {
        const disponibles = parseInt(total) - parseInt(sold) - parseInt(reserved);
        logger.info('[RaffleServiceV2] Rifa aún no completa', {
          raffleId,
          total: parseInt(total),
          vendidos: parseInt(sold),
          reservados: parseInt(reserved),
          disponibles: disponibles,
          razon: parseInt(reserved) > 0 ? 'Hay reservas activas pendientes' : 'Faltan números por vender'
        });
      }
    } catch (error) {
      logger.error('[RaffleServiceV2] Error verificando finalización', error);
      throw error;
    }
  }
  
  /**
   * Finalizar rifa y seleccionar ganador (modo FIRES/PRIZE)
   */
  async finishRaffle(raffleId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Obtener datos de la rifa
      const raffleResult = await client.query(
        `SELECT r.*, rc.company_name
         FROM raffles r
         LEFT JOIN raffle_companies rc ON r.company_id = rc.id
         WHERE r.id = $1`,
        [raffleId]
      );
      
      if (raffleResult.rows.length === 0) {
        throw new Error('Rifa no encontrada');
      }
      
      const raffle = raffleResult.rows[0];
      
      // Solo finalizar si está activa
      if (raffle.status !== RaffleStatus.ACTIVE) {
        logger.warn('[RaffleServiceV2] Rifa no está activa', {
          raffleId,
          status: raffle.status
        });
        await client.query('ROLLBACK');
        return;
      }
      
      // Obtener participantes únicos
      const participantsResult = await client.query(
        `SELECT DISTINCT rn.owner_id, u.telegram_username, u.display_name
         FROM raffle_numbers rn
         JOIN users u ON u.id = rn.owner_id
         WHERE rn.raffle_id = $1 AND rn.state = 'sold'`,
        [raffleId]
      );
      
      if (participantsResult.rows.length === 0) {
        throw new Error('No hay participantes en la rifa');
      }
      
      const participants = participantsResult.rows;
      
      // Seleccionar ganador aleatorio
      const randomIndex = Math.floor(Math.random() * participants.length);
      const winner = participants[randomIndex];
      
      logger.info('[RaffleServiceV2] Ganador seleccionado', {
        raffleId,
        winnerId: winner.owner_id,
        winnerUsername: winner.telegram_username,
        totalParticipants: participants.length
      });
      
      // Acreditar premio si es modo FIRES o COINS
      if (raffle.raffle_mode === RaffleMode.FIRES || raffle.raffle_mode === RaffleMode.COINS) {
        const prizeAmount = raffle.raffle_mode === RaffleMode.FIRES 
          ? (raffle.pot_fires || 0) 
          : (raffle.pot_coins || 0);
        const currency = raffle.raffle_mode === RaffleMode.FIRES ? 'fires' : 'coins';
        const balanceField = currency === 'fires' ? 'fires_balance' : 'coins_balance';
        
        if (prizeAmount > 0) {
          // Obtener wallet del ganador
          const walletResult = await client.query(
            `SELECT id, ${balanceField} FROM wallets WHERE user_id = $1`,
            [winner.owner_id]
          );
          
          if (walletResult.rows.length > 0) {
            const wallet = walletResult.rows[0];
            const balanceBefore = wallet[balanceField];
            
            // Acreditar premio
            await client.query(
              `UPDATE wallets
               SET ${balanceField} = ${balanceField} + $1
               WHERE user_id = $2`,
              [prizeAmount, winner.owner_id]
            );
            
            // Registrar transacción
            await client.query(
              `INSERT INTO wallet_transactions
               (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
               VALUES ($1, 'raffle_prize', $2, $3, $4, $5, $6, $7)`,
              [
                wallet.id,
                currency,
                prizeAmount,
                balanceBefore,
                balanceBefore + prizeAmount,
                `Premio ganado en rifa ${raffle.code}`,
                `raffle_win_${raffle.code}`
              ]
            );
            
            logger.info('[RaffleServiceV2] Premio acreditado', {
              raffleId,
              winnerId: winner.owner_id,
              prize: prizeAmount,
              currency
            });
          }
        }
      }
      
      // Actualizar estado de la rifa
      await client.query(
        `UPDATE raffles
         SET status = $1,
             winner_id = $2,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [RaffleStatus.FINISHED, winner.owner_id, raffleId]
      );
      
      await client.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Rifa finalizada exitosamente', {
        raffleId,
        code: raffle.code,
        winner: winner.telegram_username,
        prize: raffle.raffle_mode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins
      });
      
      // Emitir evento WebSocket (si está disponible)
      if (global.io) {
        global.io.to(`raffle_${raffle.code}`).emit('raffle:finished', {
          raffleCode: raffle.code,
          winner: {
            id: winner.owner_id,
            username: winner.telegram_username,
            displayName: winner.display_name
          },
          prize: raffle.raffle_mode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins,
          currency: raffle.raffle_mode === RaffleMode.FIRES ? 'fires' : 'coins'
        });
        
        // Notificar a cada participante individualmente
        for (const participant of participants) {
          const isWinner = participant.owner_id === winner.owner_id;
          global.io.to(`user_${participant.owner_id}`).emit('notification', {
            type: 'raffle_finished',
            raffleCode: raffle.code,
            isWinner,
            winner: winner.telegram_username,
            prize: raffle.raffle_mode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins,
            message: isWinner
              ? `🎉 ¡Felicidades! Ganaste la rifa ${raffle.code}. Premio: ${raffle.pot_fires || raffle.pot_coins} ${raffle.raffle_mode === RaffleMode.FIRES ? '🔥' : '🪙'}`
              : `La rifa ${raffle.code} finalizó. Ganador: @${winner.telegram_username}`
          });
        }
      }
      
      return {
        success: true,
        winner,
        prize: raffle.raffle_mode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[RaffleServiceV2] Error finalizando rifa', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Limpiar reservas expiradas (Job)
   */
  async cleanExpiredReservations() {
    try {
      const result = await query(
        `UPDATE raffle_numbers
         SET state = $1, owner_id = NULL, reserved_by = NULL,
             reserved_until = NULL
         WHERE state = $2 AND reserved_until < NOW()
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
  
  /**
   * Obtener datos para landing pública (sin auth)
   * Optimizado para empresas con branding
   */
  async getPublicLandingData(code) {
    try {
      // Obtener información básica de la rifa con empresa
      const result = await query(
        `SELECT 
          r.id, r.code, r.name, r.description, r.status, r.mode,
          r.numbers_range, r.entry_price_fire, r.entry_price_coin,
          r.pot_fires, r.pot_coins, r.created_at, r.starts_at, r.ends_at,
          u.username as host_username,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
          COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
          rc.company_name,
          rc.rif_number,
          rc.brand_color as primary_color,
          rc.secondary_color,
          rc.logo_url,
          rc.website_url
         FROM raffles r
         JOIN users u ON r.host_id = u.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         WHERE r.code = $1
         GROUP BY r.id, u.username, rc.company_name, rc.rif_number, 
                  rc.brand_color, rc.secondary_color, rc.logo_url, rc.website_url`,
        [code]
      );
      
      if (result.rows.length === 0) {
        throw {
          code: ErrorCodes.RAFFLE_NOT_FOUND,
          status: 404
        };
      }
      
      const raffle = result.rows[0];
      
      // Calcular estadísticas
      const totalNumbers = raffle.numbers_range;
      const soldNumbers = parseInt(raffle.numbers_sold || 0);
      const reservedNumbers = parseInt(raffle.numbers_reserved || 0);
      const availableNumbers = totalNumbers - soldNumbers - reservedNumbers;
      const progress = totalNumbers > 0 ? Math.round((soldNumbers / totalNumbers) * 100) : 0;
      
      // Formatear respuesta optimizada
      return {
        raffle: {
          code: raffle.code,
          name: raffle.name,
          description: raffle.description,
          status: raffle.status,
          mode: raffle.mode,
          hostUsername: raffle.host_username,
          entryPriceFire: raffle.entry_price_fire,
          entryPriceCoin: raffle.entry_price_coin,
          potFires: parseFloat(raffle.pot_fires || 0),
          potCoins: parseFloat(raffle.pot_coins || 0),
          createdAt: raffle.created_at,
          startsAt: raffle.starts_at,
          endsAt: raffle.ends_at
        },
        company: raffle.company_name ? {
          name: raffle.company_name,
          rif: raffle.rif_number,
          primaryColor: raffle.primary_color,
          secondaryColor: raffle.secondary_color,
          logoUrl: raffle.logo_url,
          websiteUrl: raffle.website_url
        } : null,
        stats: {
          totalNumbers,
          soldNumbers,
          reservedNumbers,
          availableNumbers,
          progress
        }
      };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error obteniendo landing pública', error);
      throw error;
    }
  }
  
  /**
   * Crear números en batch optimizado
   * Divide en chunks para evitar queries muy largos
   */
  async createNumbersBatch(raffleId, totalNumbers, dbQuery) {
    const CHUNK_SIZE = 1000;
    const chunks = Math.ceil(totalNumbers / CHUNK_SIZE);
    
    logger.info('[RaffleServiceV2] Iniciando creación de números en batch', {
      raffleId,
      totalNumbers,
      chunks
    });
    
    for (let chunk = 0; chunk < chunks; chunk++) {
      const start = chunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalNumbers);
      const numbers = [];
      
      for (let i = start; i < end; i++) {
        numbers.push(`(${raffleId}, ${i}, 'available')`);
      }
      
      if (numbers.length > 0) {
        await dbQuery(
          `INSERT INTO raffle_numbers (raffle_id, number_idx, state) 
           VALUES ${numbers.join(', ')}`
        );
        
        logger.debug(`[RaffleServiceV2] Chunk ${chunk + 1}/${chunks} insertado: ${numbers.length} números`);
      }
    }
    
    logger.info('[RaffleServiceV2] Números creados exitosamente', {
      raffleId,
      totalNumbers
    });
  }
  
  /**
   * Cancelar rifa y reembolsar compradores desde el pot
   */
  async cancelRaffle(code) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      logger.info('[RaffleServiceV2] Iniciando cancelación de rifa', { code });
      
      // Obtener rifa
      const raffleResult = await client.query(
        `SELECT r.id, r.code, r.status, r.mode, r.pot_fires, r.pot_coins
         FROM raffles r
         WHERE r.code = $1`,
        [code]
      );
      
      if (raffleResult.rows.length === 0) {
        const error = new Error('Rifa no encontrada');
        error.code = ErrorCodes.RAFFLE_NOT_FOUND;
        throw error;
      }
      
      const raffle = raffleResult.rows[0];
      
      if (raffle.status === RaffleStatus.CANCELLED) {
        const error = new Error('La rifa ya está cancelada');
        error.code = ErrorCodes.INVALID_OPERATION;
        throw error;
      }
      
      if (raffle.status === RaffleStatus.FINISHED) {
        const error = new Error('No se puede cancelar una rifa finalizada');
        error.code = ErrorCodes.INVALID_OPERATION;
        throw error;
      }
      
      // Obtener números vendidos agrupados por comprador
      const purchasesResult = await client.query(
        `SELECT 
           rn.owner_id,
           COUNT(*) as numbers_count,
           SUM(CASE 
             WHEN r.mode = 'fires' THEN r.entry_price_fire 
             ELSE r.entry_price_coin 
           END) as total_spent
         FROM raffle_numbers rn
         JOIN raffles r ON r.id = rn.raffle_id
         WHERE rn.raffle_id = $1 
           AND rn.state = 'sold'
           AND rn.owner_id IS NOT NULL
         GROUP BY rn.owner_id`,
        [raffle.id]
      );
      
      logger.info('[RaffleServiceV2] Números vendidos encontrados', {
        code,
        buyers: purchasesResult.rows.length,
        totalNumbers: purchasesResult.rows.reduce((sum, p) => sum + parseInt(p.numbers_count), 0)
      });
      
      // Reembolsar a cada comprador
      for (const purchase of purchasesResult.rows) {
        const refundAmount = parseFloat(purchase.total_spent);
        const currencyColumn = raffle.mode === RaffleMode.FIRES ? 'fires_balance' : 'coins_balance';
        const currency = raffle.mode === RaffleMode.FIRES ? 'fires' : 'coins';
        
        // Obtener wallet y balance ANTES del reembolso
        const walletResult = await client.query(
          `SELECT id, ${currencyColumn} FROM wallets WHERE user_id = $1`,
          [purchase.owner_id]
        );
        
        if (walletResult.rows.length === 0) {
          logger.warn('[RaffleServiceV2] Wallet no encontrado para reembolso', {
            userId: purchase.owner_id
          });
          continue;
        }
        
        const wallet = walletResult.rows[0];
        const balanceBefore = parseFloat(wallet[currencyColumn]);
        const balanceAfter = balanceBefore + refundAmount;
        
        // Acreditar reembolso a wallet del comprador
        await client.query(
          `UPDATE wallets 
           SET ${currencyColumn} = ${currencyColumn} + $1
           WHERE user_id = $2`,
          [refundAmount, purchase.owner_id]
        );
        
        // Registrar transacción de reembolso
        await client.query(
          `INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7)`,
          [
            wallet.id,
            currency,
            refundAmount,
            balanceBefore,
            balanceAfter,
            `Reembolso por cancelación de rifa ${raffle.code}`,
            `raffle_cancel_${raffle.code}`
          ]
        );
        
        logger.info('[RaffleServiceV2] Reembolso procesado', {
          code,
          userId: purchase.owner_id,
          amount: refundAmount,
          currency: raffle.mode
        });
      }
      
      // Actualizar estado de la rifa a CANCELLED
      await client.query(
        `UPDATE raffles 
         SET status = $1,
             pot_fires = 0,
             pot_coins = 0,
             updated_at = NOW()
         WHERE id = $2`,
        [RaffleStatus.CANCELLED, raffle.id]
      );
      
      // Liberar todos los números vendidos/reservados
      await client.query(
        `UPDATE raffle_numbers 
         SET state = 'available',
             owner_id = NULL,
             reserved_by = NULL,
             reserved_until = NULL
         WHERE raffle_id = $1`,
        [raffle.id]
      );
      
      await client.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Rifa cancelada exitosamente', {
        code,
        refundedUsers: purchasesResult.rows.length
      });
      
      return {
        success: true,
        refundedUsers: purchasesResult.rows.length,
        totalRefunded: purchasesResult.rows.reduce((sum, p) => sum + parseFloat(p.total_spent), 0)
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[RaffleServiceV2] Error cancelando rifa', { code, error: error.message });
      throw error;
    } finally {
      client.release();
    }
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
        secondaryColor: raffle.secondary_color,
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
