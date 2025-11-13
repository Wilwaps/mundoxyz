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

// ID de la plataforma (Telegram)
const PLATFORM_TELEGRAM_ID = '1417856820';

class RaffleServiceV2 {
  /**
   * Crear nueva rifa
   */
  async createRaffle(hostId, data, client = null) {
    const useExternalClient = !!client;
    const dbClient = client || await getClient();
    
    try {
      if (!useExternalClient) await dbClient.query('BEGIN');
      
      logger.info('[RaffleServiceV2] Creando nueva rifa', { hostId, data });
      
      // PASO 1: VALIDAR Y COBRAR COMISIONES ANTES DE CREAR LA RIFA
      const { mode, entryPrice, visibility } = data;
      const hostWalletResult = await dbClient.query(
        'SELECT id, fires_balance FROM wallets WHERE user_id = $1',
        [hostId]
      );
      
      if (hostWalletResult.rows.length === 0) {
        throw {
          code: ErrorCodes.WALLET_NOT_FOUND,
          status: 404,
          message: 'Wallet del host no encontrado'
        };
      }
      
      const hostWallet = hostWalletResult.rows[0];
      let totalCost = 0;
      let costDescription = '';
      
      // Calcular costo según modo
      if (mode === RaffleMode.FIRES) {
        // Modo FIRES: comisión = precio por número
        totalCost = entryPrice || 0;
        costDescription = `Comisión apertura rifa modo FIRES (${totalCost} fuegos)`;
        
        logger.info('[RaffleServiceV2] Comisión modo FIRES calculada', {
          hostId,
          entryPrice,
          totalCost
        });
        
      } else if (mode === RaffleMode.PRIZE || visibility === 'company') {
        // Modo PRIZE o EMPRESA: 500 fuegos fijos
        totalCost = SystemLimits.PRIZE_MODE_CREATION_COST; // 500
        costDescription = `Costo creación rifa modo ${mode === RaffleMode.PRIZE ? 'PREMIO' : 'EMPRESA'} (${totalCost} fuegos)`;
        
        logger.info('[RaffleServiceV2] Costo modo PRIZE/EMPRESA calculado', {
          hostId,
          mode,
          totalCost
        });
      }
      
      // Verificar balance
      if (totalCost > 0) {
        if (hostWallet.fires_balance < totalCost) {
          throw {
            code: ErrorCodes.INSUFFICIENT_BALANCE,
            status: 400,
            message: `Necesitas ${totalCost} fuegos para crear esta rifa. Balance actual: ${hostWallet.fires_balance}`
          };
        }
        
        // Descontar del host
        const hostBalanceBefore = hostWallet.fires_balance;
        await dbClient.query(
          'UPDATE wallets SET fires_balance = fires_balance - $1 WHERE user_id = $2',
          [totalCost, hostId]
        );
        
        // Obtener usuario de plataforma
        const platformUserResult = await dbClient.query(
          'SELECT id FROM users WHERE tg_id = $1',
          [PLATFORM_TELEGRAM_ID]
        );
        
        if (platformUserResult.rows.length > 0) {
          const platformUserId = platformUserResult.rows[0].id;
          
          // Obtener wallet de plataforma
          const platformWalletResult = await dbClient.query(
            'SELECT id, fires_balance FROM wallets WHERE user_id = $1',
            [platformUserId]
          );
          
          if (platformWalletResult.rows.length > 0) {
            const platformWallet = platformWalletResult.rows[0];
            const platformBalanceBefore = platformWallet.fires_balance;
            
            // Acreditar a plataforma
            await dbClient.query(
              'UPDATE wallets SET fires_balance = fires_balance + $1 WHERE user_id = $2',
              [totalCost, platformUserId]
            );
            
            // Registrar transacción del host
            await dbClient.query(
              `INSERT INTO wallet_transactions
               (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
               VALUES ($1, 'raffle_creation_fee', $2, $3, $4, $5, $6, $7)`,
              [
                hostWallet.id,
                'fires',
                -totalCost,
                hostBalanceBefore,
                hostBalanceBefore - totalCost,
                costDescription,
                `raffle_fee_pending`
              ]
            );
            
            // Registrar transacción de plataforma
            await dbClient.query(
              `INSERT INTO wallet_transactions
               (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
               VALUES ($1, 'raffle_platform_fee', $2, $3, $4, $5, $6, $7)`,
              [
                platformWallet.id,
                'fires',
                totalCost,
                platformBalanceBefore,
                platformBalanceBefore + totalCost,
                `Comisión recibida: ${costDescription}`,
                `raffle_fee_pending`
              ]
            );
            
            logger.info('[RaffleServiceV2] Comisión cobrada exitosamente', {
              hostId,
              platformUserId,
              amount: totalCost
            });
          }
        } else {
          logger.warn('[RaffleServiceV2] Usuario de plataforma no encontrado', {
            telegramId: PLATFORM_TELEGRAM_ID
          });
        }
      }
      
      // PASO 2: CREAR LA RIFA
      // Generar código único
      const code = await this.generateUniqueCode(dbClient.query.bind(dbClient));
      
      // Preparar datos para inserción (mode, entryPrice, visibility ya fueron extraídos arriba)
      const {
        name,
        description,
        numbersRange,
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
      
      // Insertar rifa (ahora con allow_fires_payment, prize_image_base64, draw_mode, scheduled_draw_at)
      const allowFiresPayment = data.allowFiresPayment || false;
      const prizeImageBase64 = data.prizeImageBase64 || null;
      const drawMode = data.drawMode || 'automatic';
      const scheduledDrawAt = data.scheduledDrawAt || null;
      
      const result = await dbClient.query(
        `INSERT INTO raffles (
          code, name, description, status, mode, visibility,
          host_id, numbers_range, entry_price_fire, entry_price_coin,
          starts_at, ends_at, terms_conditions, prize_meta,
          pot_fires, pot_coins, allow_fires_payment, prize_image_base64,
          draw_mode, scheduled_draw_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, $15, $16, $17, $18)
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
          prizeMeta ? JSON.stringify(prizeMeta) : null,
          allowFiresPayment,
          prizeImageBase64,
          drawMode,
          scheduledDrawAt
        ]
      );
      
      const raffle = result.rows[0];
      
      // Actualizar referencias con el código real
      if (totalCost > 0) {
        await dbClient.query(
          `UPDATE wallet_transactions
           SET reference = $1
           WHERE reference = 'raffle_fee_pending' AND created_at > NOW() - INTERVAL '1 minute'`,
          [`raffle_fee_${code}`]
        );
      }
      
      // Si es modo empresa, crear configuración
      if (visibility === 'company' && companyConfig) {
        const logoBase64 = companyConfig.logoBase64 || null;
        await dbClient.query(
          `INSERT INTO raffle_companies (
            raffle_id, company_name, rif_number, brand_color, secondary_color,
            logo_url, website_url, logo_base64
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            raffle.id,
            companyConfig.companyName,
            companyConfig.rifNumber,
            companyConfig.primaryColor || null,
            companyConfig.secondaryColor || null,
            companyConfig.logoUrl || null,
            companyConfig.websiteUrl || null,
            logoBase64
          ]
        );
      }
      
      // Crear números disponibles (optimizado con batch)
      await this.createNumbersBatch(raffle.id, numbersRange, dbClient.query.bind(dbClient));
      
      if (!useExternalClient) await dbClient.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Rifa creada exitosamente', { 
        raffleId: raffle.id, 
        code,
        numbersRange,
        costCharged: totalCost
      });
      
      return this.formatRaffleResponse(raffle);
      
    } catch (error) {
      if (!useExternalClient) {
        try {
          await dbClient.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('[RaffleServiceV2] Error en rollback', rollbackError);
        }
      }
      logger.error('[RaffleServiceV2] Error creando rifa', error);
      throw error;
    } finally {
      if (!useExternalClient) {
        dbClient.release();
      }
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
          wu.username as winner_username,
          wu.display_name as winner_display_name,
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
         LEFT JOIN users wu ON r.winner_id = wu.id
         LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         WHERE r.code = $1
         GROUP BY r.id, u.username, wu.username, wu.display_name, rc.company_name, rc.rif_number, 
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
      
      // Construir objeto de ganador si existe
      let winner = undefined;
      if (raffle.winnerId) {
        const currency = raffle.mode === RaffleMode.FIRES ? 'fires' : (raffle.mode === RaffleMode.COINS ? 'coins' : undefined);
        const prizeAmount = raffle.mode === RaffleMode.FIRES ? raffle.potFires : (raffle.mode === RaffleMode.COINS ? raffle.potCoins : undefined);
        winner = {
          userId: raffle.winnerId,
          username: raffle.winnerUsername,
          displayName: raffle.winnerDisplayName,
          winningNumber: raffle.winnerNumber,
          prizeAmount,
          currency
        };
      }

      return {
        raffle,
        numbers,
        userNumbers,
        stats,
        ...(winner ? { winner } : {})
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
      // Log estado actual antes de intentar liberar (para diagnóstico)
      const currentResult = await dbQuery(
        `SELECT state, owner_id, reserved_by, reserved_until
         FROM raffle_numbers
         WHERE raffle_id = $1 AND number_idx = $2`,
        [raffleId, numberIdx]
      );

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
        const snapshot = currentResult.rows[0] || null;
        logger.warn('[RaffleServiceV2] No se pudo liberar número (sin filas afectadas)', {
          raffleId,
          numberIdx,
          userId,
          currentState: snapshot?.state,
          currentOwner: snapshot?.owner_id,
          currentReservedBy: snapshot?.reserved_by,
          currentReservedUntil: snapshot?.reserved_until
        });
        throw { 
          code: ErrorCodes.UNAUTHORIZED, 
          status: 403,
          message: 'No autorizado para liberar este número o ya no está reservado' 
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
      // Modo PRIZE se maneja diferente (aprobación manual o pago con fuegos al host)
      
      // 4. Procesamiento de pago
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
        
        // Marcar número como SOLD
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
      } else {
        // PRIZE MODE: dos variantes
        const allowFiresPayment = !!raffle.allow_fires_payment;
        const method = paymentData?.paymentMethod;
        const reference = paymentData?.paymentReference || paymentData?.reference;
        const buyerProfile = {
          displayName: paymentData?.buyerName || null,
          fullName: paymentData?.buyerName || null,
          phone: paymentData?.buyerPhone || null,
          email: paymentData?.buyerEmail || null,
          idNumber: paymentData?.buyerDocument || null
        };

        if (allowFiresPayment && method === 'fires') {
          // Transferencia directa de fuegos del comprador al host
          const walletsResult = await dbQuery(
            `SELECT w.id, w.fires_balance, u.id as uid
             FROM wallets w JOIN users u ON u.id = w.user_id
             WHERE w.user_id = ANY($1::uuid[]) FOR UPDATE`,
            [[userId, raffle.host_id]]
          );
          const buyerWallet = walletsResult.rows.find(r => r.uid === userId);
          const hostWallet = walletsResult.rows.find(r => r.uid === raffle.host_id);
          if (!buyerWallet || !hostWallet) {
            throw { code: ErrorCodes.WALLET_NOT_FOUND, status: 404, message: 'Wallet no encontrado (comprador u host)' };
          }
          const price = raffle.entry_price_fire || 0;
          if (buyerWallet.fires_balance < price) {
            throw { code: ErrorCodes.INSUFFICIENT_BALANCE, status: 400, message: 'Saldo de fuegos insuficiente' };
          }
          // Debitar comprador, acreditar host
          await dbQuery(
            `UPDATE wallets SET fires_balance = fires_balance - $1, total_fires_spent = total_fires_spent + $1 WHERE id = $2`,
            [price, buyerWallet.id]
          );
          await dbQuery(
            `UPDATE wallets SET fires_balance = fires_balance + $1, total_fires_earned = total_fires_earned + $1 WHERE id = $2`,
            [price, hostWallet.id]
          );
          // Transacciones
          await dbQuery(
            `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference, related_user_id)
             VALUES ($1, 'raffle_prize_fire_payment_out', 'fires', $2, $3, $4, $5, $6, $7)`,
            [
              buyerWallet.id,
              price,
              buyerWallet.fires_balance,
              buyerWallet.fires_balance - price,
              `Pago de número ${numberIdx} en rifa ${raffle.code} (PRIZE → host)`,
              `raffle_${raffle.code}_num_${numberIdx}_fires_out`,
              raffle.host_id
            ]
          );
          await dbQuery(
            `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference, related_user_id)
             VALUES ($1, 'raffle_prize_fire_payment_in', 'fires', $2, $3, $4, $5, $6, $7)`,
            [
              hostWallet.id,
              price,
              hostWallet.fires_balance,
              hostWallet.fires_balance + price,
              `Ingreso por número ${numberIdx} en rifa ${raffle.code} (PRIZE de comprador)`,
              `raffle_${raffle.code}_num_${numberIdx}_fires_in`,
              userId
            ]
          );
          // Marcar número como SOLD
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
          logger.info('[RaffleServiceV2] PRIZE con fuegos: transferido al host y vendido', {
            raffleId,
            numberIdx,
            userId,
            hostId: raffle.host_id,
            price
          });
        } else {
          // Crear solicitud de compra (PENDING) y mantener reserva hasta decisión del host
          const requestData = {
            paymentMethod: method || null,
            reference: reference || null,
            paymentProofBase64: paymentData?.paymentProofBase64 || null
          };
          await dbQuery(
            `INSERT INTO raffle_requests (raffle_id, buyer_id, user_id, number_idx, status, request_type, request_data, buyer_profile)
             VALUES ($1, $2, $2, $3, 'pending', 'approval', $4, $5)`,
            [raffleId, userId, numberIdx, JSON.stringify(requestData), JSON.stringify(buyerProfile)]
          );
          // Congelar reserva sin expiración automática (reserved_until = NULL)
          await dbQuery(
            `UPDATE raffle_numbers
             SET state = $1, owner_id = $2, reserved_by = $2, reserved_until = NULL
             WHERE raffle_id = $3 AND number_idx = $4`,
            [NumberState.RESERVED, userId, raffleId, numberIdx]
          );
          logger.info('[RaffleServiceV2] PRIZE: solicitud de compra creada y número reservado hasta decisión del host', {
            raffleId,
            numberIdx,
            userId,
            method,
            reference
          });
          // No marcar sold; no finalizar rifa aún
        }
      }
      
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
      
      // ✅ Verificar finalización solo si no es PRIZE con solicitud pendiente
      if (raffle.raffle_mode !== RaffleMode.PRIZE) {
        setImmediate(async () => {
          try {
            await this.checkAndFinishRaffle(raffleId);
          } catch (err) {
            logger.error('[RaffleServiceV2] Error verificando finalización', err);
          }
        });
      }
      
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
        // Verificar el modo de sorteo
        const drawModeResult = await query(
          'SELECT code, draw_mode, scheduled_draw_at FROM raffles WHERE id = $1',
          [raffleId]
        );
        const raffleCode = drawModeResult.rows[0]?.code;
        const drawMode = drawModeResult.rows[0]?.draw_mode || 'automatic';
        const scheduledDrawAt = drawModeResult.rows[0]?.scheduled_draw_at;
        
        logger.info('[RaffleServiceV2] ✅ Todos los números vendidos y sin reservas', {
          raffleId,
          drawMode,
          scheduledDrawAt
        });
        
        // Comportamiento según modo de sorteo
        if (drawMode === 'manual') {
          // MODO MANUAL: No finalizar automáticamente
          logger.info('[RaffleServiceV2] 🛑 Modo MANUAL - Host debe elegir ganador manualmente', {
            raffleId,
            code: raffleCode
          });
          
          // Solo notificar que todos los números están vendidos
          if (raffleCode && global.io) {
            global.io.to(`raffle:${raffleCode}`).emit('raffle:all_sold', {
              code: raffleCode,
              message: '¡Todos los números vendidos! El host puede elegir el ganador cuando desee.'
            });
          }
          
        } else if (drawMode === 'scheduled') {
          // MODO PROGRAMADO: Verificar si llegó la fecha
          const now = new Date();
          const scheduledDate = scheduledDrawAt ? new Date(scheduledDrawAt) : null;
          
          if (scheduledDate && scheduledDate > now) {
            logger.info('[RaffleServiceV2] ⏰ Modo PROGRAMADO - Esperando fecha programada', {
              raffleId,
              code: raffleCode,
              scheduledDrawAt,
              minutosRestantes: Math.floor((scheduledDate - now) / 60000)
            });
            
            if (raffleCode && global.io) {
              global.io.to(`raffle:${raffleCode}`).emit('raffle:all_sold', {
                code: raffleCode,
                scheduledDrawAt,
                message: `¡Todos los números vendidos! Sorteo programado para ${scheduledDate.toLocaleString('es-VE')}`
              });
            }
          } else {
            // Ya llegó la fecha programada, finalizar
            logger.info('[RaffleServiceV2] ⏰ Fecha programada alcanzada - Finalizando ahora', {
              raffleId,
              code: raffleCode
            });
            
            if (raffleCode && global.io) {
              global.io.to(`raffle:${raffleCode}`).emit('raffle:drawing_scheduled', {
                code: raffleCode,
                drawInSeconds: 0,
                message: '¡Hora del sorteo! Eligiendo ganador...'
              });
            }
            
            // Finalizar inmediatamente
            await this.finishRaffle(raffleId);
          }
          
        } else {
          logger.info('[RaffleServiceV2] ⚡ Modo AUTOMÁTICO - Finalizando inmediatamente (sin delay)', {
            raffleId,
            code: raffleCode
          });
          
          if (raffleCode && global.io) {
            global.io.to(`raffle:${raffleCode}`).emit('raffle:drawing_scheduled', {
              code: raffleCode,
              drawInSeconds: 0,
              message: '¡Todos los números vendidos! Eligiendo ganador...'
            });
          }
          
          // Finalizar inmediatamente
          await this.finishRaffle(raffleId);
        }
        
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
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Obtener datos de la rifa
      const raffleResult = await client.query(
        `SELECT r.*, r.mode as raffle_mode, rc.company_name
         FROM raffles r
         LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
         WHERE r.id = $1`,
        [raffleId]
      );
      
      if (raffleResult.rows.length === 0) {
        throw new Error('Rifa no encontrada');
      }
      
      const raffle = raffleResult.rows[0];
      
      // Soporte retrocompatible: usar raffle.mode si raffle_mode no existe en BD
      const effectiveMode = raffle.raffle_mode || raffle.mode;
      
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
        `SELECT rn.owner_id,
                COALESCE(u.display_name, u.username) AS display_name,
                u.username,
                array_agg(rn.number_idx ORDER BY rn.number_idx) AS numbers
         FROM raffle_numbers rn
         JOIN users u ON u.id = rn.owner_id
         WHERE rn.raffle_id = $1 AND rn.state = 'sold'
         GROUP BY rn.owner_id, u.display_name, u.username`,
        [raffleId]
      );
      
      if (participantsResult.rows.length === 0) {
        throw new Error('No hay participantes en la rifa');
      }
      
      const participants = participantsResult.rows;
      
      // Seleccionar ganador aleatorio
      const randomIndex = Math.floor(Math.random() * participants.length);
      const winner = participants[randomIndex];
      const winnerNumbers = winner.numbers || [];
      const winningNumber = winnerNumbers.length > 0
        ? winnerNumbers[Math.floor(Math.random() * winnerNumbers.length)]
        : null;
      
      const winnerDisplayName = winner.display_name || winner.username;

      logger.info('[RaffleServiceV2] Ganador seleccionado', {
        raffleId,
        winnerId: winner.owner_id,
        winnerUsername: winner.username,
        winnerDisplayName,
        totalParticipants: participants.length,
        winningNumber
      });
      
      // Calcular distribución según modo
      let winnerPrize = 0;
      let hostReward = 0;
      let platformCommission = 0;
      
      if (effectiveMode === RaffleMode.FIRES) {
        // Modo FIRES: Split 70% ganador, 20% host, 10% plataforma
        const totalPot = raffle.pot_fires || 0;
        winnerPrize = Math.floor(totalPot * 0.7);
        hostReward = Math.floor(totalPot * 0.2);
        platformCommission = totalPot - winnerPrize - hostReward; // El resto para evitar pérdidas por redondeo
        
        logger.info('[RaffleServiceV2] Distribución calculada (modo FIRES)', {
          totalPot,
          winnerPrize,
          hostReward,
          platformCommission
        });
      } else if (effectiveMode === RaffleMode.COINS) {
        // Modo COINS: 100% al ganador (sin split)
        winnerPrize = raffle.pot_coins || 0;
      } else if (effectiveMode === RaffleMode.PRIZE) {
        // Modo PRIZE: No hay premio en moneda virtual
        logger.info('[RaffleServiceV2] Modo PRIZE - Sin premio en moneda virtual');
      }
      
      const currency = effectiveMode === RaffleMode.FIRES ? 'fires' : 'coins';
      const balanceField = currency === 'fires' ? 'fires_balance' : 'coins_balance';
        
      // Acreditar premios y comisiones
      if (winnerPrize > 0) {
        // 1. PREMIO AL GANADOR
        const winnerWalletResult = await client.query(
          `SELECT id, ${balanceField} FROM wallets WHERE user_id = $1`,
          [winner.owner_id]
        );
        
        if (winnerWalletResult.rows.length > 0) {
          const winnerWallet = winnerWalletResult.rows[0];
          const winnerBalanceBefore = winnerWallet[balanceField];
          
          await client.query(
            `UPDATE wallets
             SET ${balanceField} = ${balanceField} + $1
             WHERE user_id = $2`,
            [winnerPrize, winner.owner_id]
          );
          
          await client.query(
            `INSERT INTO wallet_transactions
             (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
             VALUES ($1, 'raffle_prize', $2, $3, $4, $5, $6, $7)`,
            [
              winnerWallet.id,
              currency,
              winnerPrize,
              winnerBalanceBefore,
              winnerBalanceBefore + winnerPrize,
              `Premio ganado en rifa ${raffle.code} (70% del pot)`,
              `raffle_win_${raffle.code}`
            ]
          );
          
          logger.info('[RaffleServiceV2] Premio acreditado al ganador', {
            winnerId: winner.owner_id,
            prize: winnerPrize,
            currency
          });
        }
        
        // 2. RECOMPENSA AL HOST (solo modo FIRES)
        if (hostReward > 0 && effectiveMode === RaffleMode.FIRES) {
          const hostWalletResult = await client.query(
            `SELECT id, fires_balance FROM wallets WHERE user_id = $1`,
            [raffle.host_id]
          );
          
          if (hostWalletResult.rows.length > 0) {
            const hostWallet = hostWalletResult.rows[0];
            const hostBalanceBefore = hostWallet.fires_balance;
            
            await client.query(
              `UPDATE wallets
               SET fires_balance = fires_balance + $1
               WHERE user_id = $2`,
              [hostReward, raffle.host_id]
            );
            
            await client.query(
              `INSERT INTO wallet_transactions
               (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
               VALUES ($1, 'raffle_host_reward', $2, $3, $4, $5, $6, $7)`,
              [
                hostWallet.id,
                'fires',
                hostReward,
                hostBalanceBefore,
                hostBalanceBefore + hostReward,
                `Recompensa como host de rifa ${raffle.code} (20% del pot)`,
                `raffle_host_${raffle.code}`
              ]
            );
            
            logger.info('[RaffleServiceV2] Recompensa acreditada al host', {
              hostId: raffle.host_id,
              reward: hostReward
            });
          }
        }
        
        // 3. COMISIÓN A LA PLATAFORMA (solo modo FIRES)
        if (platformCommission > 0 && effectiveMode === RaffleMode.FIRES) {
          // Obtener o crear usuario de la plataforma
          const platformUserResult = await client.query(
            `SELECT id FROM users WHERE tg_id = $1`,
            [PLATFORM_TELEGRAM_ID]
          );
          
          if (platformUserResult.rows.length > 0) {
            const platformUserId = platformUserResult.rows[0].id;
            const platformWalletResult = await client.query(
              `SELECT id, fires_balance FROM wallets WHERE user_id = $1`,
              [platformUserId]
            );
            
            if (platformWalletResult.rows.length > 0) {
              const platformWallet = platformWalletResult.rows[0];
              const platformBalanceBefore = platformWallet.fires_balance;
              
              await client.query(
                `UPDATE wallets
                 SET fires_balance = fires_balance + $1
                 WHERE user_id = $2`,
                [platformCommission, platformUserId]
              );
              
              await client.query(
                `INSERT INTO wallet_transactions
                 (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
                 VALUES ($1, 'raffle_platform_commission', $2, $3, $4, $5, $6, $7)`,
                [
                  platformWallet.id,
                  'fires',
                  platformCommission,
                  platformBalanceBefore,
                  platformBalanceBefore + platformCommission,
                  `Comisión de rifa ${raffle.code} (10% del pot)`,
                  `raffle_commission_${raffle.code}`
                ]
              );
              
              logger.info('[RaffleServiceV2] Comisión acreditada a la plataforma', {
                platformUserId,
                commission: platformCommission
              });
            }
          } else {
            logger.warn('[RaffleServiceV2] Usuario de plataforma no encontrado', {
              telegramId: PLATFORM_TELEGRAM_ID
            });
          }
        }
      }
      
      // Guardar mensajes en buzón para todos los participantes
      try {
        const prizeAmountTotal = effectiveMode === RaffleMode.FIRES 
          ? (raffle.pot_fires || 0) 
          : (effectiveMode === RaffleMode.COINS ? (raffle.pot_coins || 0) : 0);
        for (const participant of participants) {
          const isWinner = participant.owner_id === winner.owner_id;
          const title = `Resultado de rifa ${raffle.code}`;
          const content = isWinner
            ? `🎉 ¡Felicidades! Ganaste la rifa ${raffle.code}. Número ganador: #${winningNumber}. Premio total del pote: ${prizeAmountTotal} ${effectiveMode === RaffleMode.FIRES ? '🔥' : effectiveMode === RaffleMode.COINS ? '🪙' : ''}`
            : `La rifa ${raffle.code} finalizó. Ganador: @${winner.username} con el número #${winningNumber}. Pote: ${prizeAmountTotal} ${effectiveMode === RaffleMode.FIRES ? '🔥' : effectiveMode === RaffleMode.COINS ? '🪙' : ''}`;
          const metadata = {
            type: 'raffle_finished',
            raffleCode: raffle.code,
            winningNumber,
            isWinner,
            prizeAmount: prizeAmountTotal,
            currency
          };
          await client.query(
            `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
             VALUES ($1, 'system', $2, $3, $4)`,
            [participant.owner_id, title, content, JSON.stringify(metadata)]
          );
        }
      } catch (msgErr) {
        logger.error('[RaffleServiceV2] Error guardando mensajes de rifa', msgErr);
      }
      
      // Actualizar estado de la rifa
      await client.query(
        `UPDATE raffles
         SET status = $1,
             winner_id = $2,
             winner_number = $3,
             finished_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [RaffleStatus.FINISHED, winner.owner_id, winningNumber, raffleId]
      );
      
      await client.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Rifa finalizada exitosamente', {
        raffleId,
        code: raffle.code,
        winnerUsername: winner.username,
        winnerDisplayName,
        winningNumber,
        prize: effectiveMode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins
      });
      
      // Emitir evento WebSocket (si está disponible)
      if (global.io) {
        const roomName = `raffle:${raffle.code}`;
        const winnerPayload = {
          raffleCode: raffle.code,
          winner: {
            id: winner.owner_id,
            username: winner.username,
            displayName: winnerDisplayName
          },
          winningNumber,
          prize: effectiveMode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins,
          currency: effectiveMode === RaffleMode.FIRES ? 'fires' : 'coins'
        };

        global.io.to(roomName).emit('raffle:finished', winnerPayload);
        // Compatibilidad hacia atrás con listeners antiguos
        global.io.to(roomName).emit('raffle:winner_drawn', {
          raffleCode: raffle.code,
          winnerId: winner.owner_id,
          winnerUsername: winner.username,
          winnerDisplayName,
          winningNumber,
          prize: effectiveMode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins,
          currency: effectiveMode === RaffleMode.FIRES ? 'fires' : 'coins'
        });
        
        // Notificar a cada participante individualmente
        for (const participant of participants) {
          const isWinner = participant.owner_id === winner.owner_id;
          global.io.to(`user_${participant.owner_id}`).emit('notification', {
            type: 'raffle_finished',
            raffleCode: raffle.code,
            isWinner,
            winner: winner.username,
            winningNumber,
            prize: effectiveMode === RaffleMode.FIRES ? raffle.pot_fires : raffle.pot_coins,
            currency: effectiveMode === RaffleMode.FIRES ? 'fires' : 'coins',
            message: isWinner
              ? `🎉 ¡Felicidades! Ganaste la rifa ${raffle.code}. Premio: ${raffle.pot_fires || raffle.pot_coins} ${effectiveMode === RaffleMode.FIRES ? '🔥' : '🪙'}`
              : `La rifa ${raffle.code} finalizó. Ganador: @${winner.username}`
          });
        }
      }
      
      return {
        success: true,
        winner: {
          id: winner.owner_id,
          username: winner.username,
          displayName: winnerDisplayName,
          winningNumber
        },
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
      
      // IMPORTANTE: Números 1-based (1, 2, 3, ..., N) para coincidir con frontend
      for (let i = start; i < end; i++) {
        numbers.push(`(${raffleId}, ${i + 1}, 'available')`);
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
      winnerId: raffle.winner_id,
      winnerNumber: raffle.winner_number,
      winnerUsername: raffle.winner_username,
      winnerDisplayName: raffle.winner_display_name,
      createdAt: raffle.created_at,
      startsAt: raffle.starts_at,
      endsAt: raffle.ends_at,
      finishedAt: raffle.finished_at,
      allowFiresPayment: raffle.allow_fires_payment,
      prizeImageBase64: raffle.prize_image_base64,
      drawMode: raffle.draw_mode,
      scheduledDrawAt: raffle.scheduled_draw_at,
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
  
  /**
   * Obtener participantes de una rifa
   */
  async getParticipants(raffleCode, userId = null) {
    try {
      // Obtener rifa
      const raffleResult = await query(
        `SELECT r.id, r.mode, r.host_id 
         FROM raffles r 
         WHERE r.code = $1`,
        [raffleCode]
      );
      
      if (raffleResult.rows.length === 0) {
        throw { code: ErrorCodes.RAFFLE_NOT_FOUND, status: 404 };
      }
      
      const raffle = raffleResult.rows[0];
      const isHost = raffle.host_id === userId;
      
      if (raffle.mode === RaffleMode.FIRES || raffle.mode === RaffleMode.COINS) {
        // Modo FIRES/COINS: mostrar participantes públicos
        const result = await query(
          `SELECT 
             COALESCE(u.display_name, u.username) as display_name,
             u.username,
             array_agg(rn.number_idx ORDER BY rn.number_idx) as numbers
           FROM raffle_numbers rn
           JOIN users u ON rn.owner_id = u.id
           WHERE rn.raffle_id = $1 AND rn.state = 'sold'
           GROUP BY u.id, u.display_name, u.username
           ORDER BY display_name`,
          [raffle.id]
        );
        
        return {
          participants: result.rows,
          totalParticipants: result.rows.length
        };
        
      } else if (raffle.mode === RaffleMode.PRIZE) {
        // Modo PREMIO
        if (isHost) {
          // Host ve solicitudes completas con botones de acción
          const result = await query(
            `SELECT 
             rr.id,
             rr.buyer_profile,
             rr.request_data,
             rr.status,
             rr.created_at,
             array_agg(rr.number_idx ORDER BY rr.number_idx) as numbers,
             u.username,
             u.display_name
           FROM raffle_requests rr
           LEFT JOIN users u ON rr.buyer_id = u.id
           WHERE rr.raffle_id = $1
           GROUP BY rr.id, rr.buyer_profile, rr.request_data, rr.status, rr.created_at, u.username, u.display_name
           ORDER BY rr.created_at DESC`,
          [raffle.id]
        );

        return {
          requests: result.rows.map(row => ({
              requestId: row.id,
              buyerProfile: row.buyer_profile,
              requestData: row.request_data,
              status: row.status,
              username: row.username,
              displayName: row.display_name,
              createdAt: row.created_at
            })),
            totalRequests: result.rows.length
          };
        }
 else {
          // Usuario normal ve solo nombres públicos aprobados
          const result = await query(
            `SELECT 
               (rr.buyer_profile->>'displayName') as display_name,
               array_agg(rr.number_idx ORDER BY rr.number_idx) as numbers
             FROM raffle_requests rr
             WHERE rr.raffle_id = $1 AND rr.status = 'approved'
             GROUP BY rr.buyer_profile->>'displayName'
             ORDER BY display_name`,
            [raffle.id]
          );
          
          return {
            participants: result.rows,
            totalParticipants: result.rows.length
          };
        }
      }
      
      return { participants: [], totalParticipants: 0 };
      
    } catch (error) {
      logger.error('[RaffleServiceV2] Error obteniendo participantes', error);
      throw error;
    }
  }
  
  /**
   * Aprobar solicitud de pago (solo host)
   */
  async approvePaymentRequest(requestId, hostId) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Obtener solicitud
      const requestResult = await client.query(
        `SELECT rr.*, r.host_id, r.code as raffle_code
         FROM raffle_requests rr
         JOIN raffles r ON rr.raffle_id = r.id
         WHERE rr.id = $1
         FOR UPDATE`,
        [requestId]
      );
      
      if (requestResult.rows.length === 0) {
        throw { code: ErrorCodes.NOT_FOUND, status: 404, message: 'Solicitud no encontrada' };
      }
      
      const request = requestResult.rows[0];
      
      // Verificar que el usuario es el host
      if (request.host_id !== hostId) {
        throw { code: ErrorCodes.UNAUTHORIZED, status: 403, message: 'Solo el host puede aprobar solicitudes' };
      }
      
      // Verificar estado
      if (request.status !== 'pending') {
        throw { code: ErrorCodes.INVALID_INPUT, status: 400, message: 'La solicitud ya fue procesada' };
      }
      
      // Marcar número como vendido
      await client.query(
        `UPDATE raffle_numbers
         SET state = 'sold', owner_id = $1, reserved_by = NULL, reserved_until = NULL
         WHERE raffle_id = $2 AND number_idx = $3`,
        [request.buyer_id, request.raffle_id, request.number_idx]
      );
      
      // Actualizar estado de solicitud
      await client.query(
        `UPDATE raffle_requests
         SET status = 'approved', updated_at = NOW()
         WHERE id = $1`,
        [requestId]
      );
      
      await client.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Solicitud aprobada', {
        requestId,
        hostId,
        buyerId: request.buyer_id,
        numberIdx: request.number_idx
      });
      
      // Notificar al comprador
      if (global.io) {
        global.io.to(`user_${request.buyer_id}`).emit('request_approved', {
          requestId,
          raffleCode: request.raffle_code,
          numberIdx: request.number_idx
        });
      }
      
      // Verificar si la rifa debe finalizarse
      setImmediate(() => {
        this.checkAndFinishRaffle(request.raffle_id).catch(err => {
          logger.error('[RaffleServiceV2] Error verificando finalización tras aprobación', err);
        });
      });
      
      return {
        success: true,
        message: 'Solicitud aprobada exitosamente',
        numberIdx: request.number_idx
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[RaffleServiceV2] Error aprobando solicitud', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Rechazar solicitud de pago (solo host)
   */
  async rejectPaymentRequest(requestId, hostId, reason = null) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Obtener solicitud
      const requestResult = await client.query(
        `SELECT rr.*, r.host_id, r.code as raffle_code
         FROM raffle_requests rr
         JOIN raffles r ON rr.raffle_id = r.id
         WHERE rr.id = $1
         FOR UPDATE`,
        [requestId]
      );
      
      if (requestResult.rows.length === 0) {
        throw { code: ErrorCodes.NOT_FOUND, status: 404, message: 'Solicitud no encontrada' };
      }
      
      const request = requestResult.rows[0];
      
      // Verificar que el usuario es el host
      if (request.host_id !== hostId) {
        throw { code: ErrorCodes.UNAUTHORIZED, status: 403, message: 'Solo el host puede rechazar solicitudes' };
      }
      
      // Verificar estado
      if (request.status !== 'pending') {
        throw { code: ErrorCodes.INVALID_INPUT, status: 400, message: 'La solicitud ya fue procesada' };
      }
      
      // Liberar número (volver a disponible)
      await client.query(
        `UPDATE raffle_numbers
         SET state = 'available', owner_id = NULL, reserved_by = NULL, reserved_until = NULL
         WHERE raffle_id = $1 AND number_idx = $2`,
        [request.raffle_id, request.number_idx]
      );
      
      // Actualizar estado de solicitud
      await client.query(
        `UPDATE raffle_requests
         SET status = 'rejected', 
             request_data = jsonb_set(COALESCE(request_data, '{}'::jsonb), '{rejection_reason}', to_jsonb($2::text)),
             updated_at = NOW()
         WHERE id = $1`,
        [requestId, reason || 'Sin razón especificada']
      );
      
      await client.query('COMMIT');
      
      logger.info('[RaffleServiceV2] Solicitud rechazada', {
        requestId,
        hostId,
        buyerId: request.buyer_id,
        numberIdx: request.number_idx,
        reason
      });
      
      // Notificar al comprador
      if (global.io) {
        global.io.to(`user_${request.buyer_id}`).emit('request_rejected', {
          requestId,
          raffleCode: request.raffle_code,
          numberIdx: request.number_idx,
          reason
        });
      }
      
      return {
        success: true,
        message: 'Solicitud rechazada',
        numberIdx: request.number_idx
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[RaffleServiceV2] Error rechazando solicitud', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new RaffleServiceV2();
