const { query, getClient } = require('../db');
const logger = require('../utils/logger');
const BingoCardGenerator = require('../utils/bingoCardGenerator');

class BingoService {
  static async updateRoomActivity(roomId, dbClient = null) {
    try {
      const runQuery = dbClient
        ? (text, params) => dbClient.query(text, params)
        : query;

      await runQuery(
        `UPDATE bingo_rooms 
         SET last_activity = NOW() 
         WHERE id = $1`,
        [roomId]
      );
    } catch (error) {
      logger.error('Error actualizando last_activity de sala:', { roomId, error });
    }
  }

  static async detectAndRefundInactiveRooms(roomId, dbClient = null) {
    try {
      const runQuery = dbClient
        ? (text, params) => dbClient.query(text, params)
        : query;

      const result = await runQuery(
        `SELECT status, host_id FROM bingo_rooms WHERE id = $1`,
        [roomId]
      );

      if (!result.rows.length) {
        return;
      }

      const room = result.rows[0];

      if (room.status === 'lobby') {
        const readyStats = await runQuery(
          `SELECT 
             COUNT(*)::int AS total_players,
             COUNT(ready_at)::int AS ready_players
           FROM bingo_room_players
           WHERE room_id = $1`,
          [roomId]
        );

        const { total_players, ready_players } = readyStats.rows[0];

        if (total_players === 1 && ready_players === 0) {
          await BingoRefundService.refundRoom(roomId, 'force_refund_single_player');
        }
      }
    } catch (error) {
      logger.error('Error evaluando refund automático:', { roomId, error });
    }
  }

  /**
   * Crea una nueva sala de bingo
   */
  static async createRoom(hostId, roomData, client = null) {
    const shouldCommit = !client;
    client = client || await getClient();

    try {
      await client.query('BEGIN');

      // Generar código único
      const codeResult = await client.query(
        'SELECT generate_unique_bingo_room_code() as code'
      );
      const roomCode = codeResult.rows[0].code;

      // Verificar saldo del host
      const walletResult = await client.query(
        `SELECT ${roomData.currency}_balance as balance 
         FROM wallets 
         WHERE user_id = $1`,
        [hostId]
      );

      if (!walletResult.rows.length) {
        throw new Error('Wallet no encontrada');
      }

      const currentBalance = parseFloat(walletResult.rows[0].balance);
      const cardCost = parseFloat(roomData.cardCost);

      if (currentBalance < cardCost) {
        throw new Error(`Saldo insuficiente. Necesitas ${cardCost} ${roomData.currency}`);
      }

      // Crear la sala
      const roomResult = await client.query(
        `INSERT INTO bingo_rooms (
          code, host_id, room_name, room_type, currency, 
          numbers_mode, victory_mode, card_cost, max_players, 
          max_cards_per_player, password, pot_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING 
          id, code, host_id, room_name, room_type, currency, 
          numbers_mode, victory_mode, card_cost, max_players, 
          max_cards_per_player, password, pot_total, status, 
          created_at, last_activity`,
        [
          roomCode,
          hostId,
          roomData.roomName || `Sala Bingo ${roomCode}`,
          roomData.roomType,
          roomData.currency,
          roomData.numbersMode,
          roomData.victoryMode,
          cardCost,
          roomData.maxPlayers || 30,
          roomData.maxCardsPerPlayer || 10,
          roomData.password || null,
          cardCost // Pozo inicial = 1 cartón del host
        ]
      );

      const room = roomResult.rows[0];

      // Registrar al host como jugador (marcado como listo automáticamente)
      await client.query(
        `INSERT INTO bingo_room_players (
          room_id, user_id, is_host, cards_owned, ready_at
        ) VALUES ($1, $2, true, 1, CURRENT_TIMESTAMP)`,
        [room.id, hostId]
      );

      // Generar cartón para el host
      const hostCard = BingoCardGenerator.generateCard(roomData.numbersMode);
      await client.query(
        `INSERT INTO bingo_cards (
          room_id, owner_id, card_number, numbers
        ) VALUES ($1, $2, 1, $3)`,
        [room.id, hostId, JSON.stringify(hostCard)]
      );

      // Descontar del wallet del host
      const newBalance = currentBalance - cardCost;
      await client.query(
        `UPDATE wallets 
         SET ${roomData.currency}_balance = $1 
         WHERE user_id = $2`,
        [newBalance, hostId]
      );

      // Registrar transacción wallet
      await client.query(
        `INSERT INTO wallet_transactions (
          wallet_id, type, currency, amount, 
          balance_before, balance_after, description, reference
        ) VALUES (
          (SELECT id FROM wallets WHERE user_id = $1),
          'game_bet', $2, $3, $4, $5, $6, $7
        )`,
        [
          hostId, 
          roomData.currency, 
          -cardCost, 
          currentBalance, 
          newBalance,
          'Creación sala Bingo - 1 cartón inicial',
          roomCode
        ]
      );

      // Registrar transacción bingo
      await client.query(
        `INSERT INTO bingo_transactions (
          room_id, user_id, type, amount, currency, description
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          room.id,
          hostId,
          'room_creation',
          cardCost,
          roomData.currency,
          'Host crea sala y compra 1 cartón'
        ]
      );

      // Log de auditoría
      await client.query(
        `INSERT INTO bingo_audit_logs (
          room_id, user_id, action, details
        ) VALUES ($1, $2, $3, $4)`,
        [
          room.id,
          hostId,
          'room_created',
          JSON.stringify({ 
            roomCode, 
            currency: roomData.currency,
            cardCost,
            mode: roomData.numbersMode
          })
        ]
      );

      if (shouldCommit) {
        await client.query('COMMIT');
      }

      await this.updateRoomActivity(room.id, client);

      logger.info('Sala de bingo creada', {
        roomId: room.id,
        code: roomCode,
        hostId,
        currency: roomData.currency,
        potInitial: cardCost
      });

      return {
        success: true,
        room,
        code: roomCode
      };

    } catch (error) {
      if (shouldCommit) {
        await client.query('ROLLBACK');
      }
      logger.error('Error creando sala de bingo:', error);
      throw error;
    } finally {
      if (shouldCommit) {
        client.release();
      }
    }
  }

  /**
   * Unirse a una sala y comprar cartones
   */
  static async joinRoom(roomCode, userId, numberOfCards, password = null) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Obtener sala (permitir compra solo en lobby, waiting o ready)
      const roomResult = await client.query(
        `SELECT * FROM bingo_rooms 
         WHERE bingo_rooms.code = $1 AND status IN ('lobby', 'waiting', 'ready')`,
        [roomCode]
      );

      if (!roomResult.rows.length) {
        throw new Error('Sala no encontrada o ya comenzó el juego');
      }

      const room = roomResult.rows[0];

      // Verificar contraseña si es privada
      if (room.room_type === 'private' && room.password !== password) {
        throw new Error('Contraseña incorrecta');
      }

      // Verificar si ya está en la sala
      const existingPlayer = await client.query(
        `SELECT * FROM bingo_room_players 
         WHERE room_id = $1 AND user_id = $2`,
        [room.id, userId]
      );

      const isAlreadyInRoom = existingPlayer.rows.length > 0;
      let currentCards = 0;

      if (isAlreadyInRoom) {
        // Si ya está en la sala, verificar cuántos cartones tiene
        currentCards = parseInt(existingPlayer.rows[0].cards_owned);
        
        // Verificar que no exceda el máximo total de cartones
        if (currentCards + numberOfCards > room.max_cards_per_player) {
          throw new Error(`No puedes tener más de ${room.max_cards_per_player} cartones. Actualmente tienes ${currentCards}`);
        }
      } else {
        // Si es nuevo jugador, verificar capacidad de la sala
        const playerCount = await client.query(
          `SELECT COUNT(*) as count FROM bingo_room_players 
           WHERE room_id = $1`,
          [room.id]
        );

        if (parseInt(playerCount.rows[0].count) >= room.max_players) {
          throw new Error('Sala llena');
        }
      }

      // Validar número de cartones a comprar
      if (numberOfCards < 1 || numberOfCards > room.max_cards_per_player) {
        throw new Error(`Debes comprar entre 1 y ${room.max_cards_per_player} cartones`);
      }

      const totalCost = parseFloat(room.card_cost) * numberOfCards;

      // Verificar saldo
      const walletResult = await client.query(
        `SELECT ${room.currency}_balance as balance 
         FROM wallets 
         WHERE user_id = $1`,
        [userId]
      );

      const currentBalance = parseFloat(walletResult.rows[0].balance);

      if (currentBalance < totalCost) {
        throw new Error(`Saldo insuficiente. Necesitas ${totalCost} ${room.currency}`);
      }

      // Registrar jugador o actualizar cartones
      if (isAlreadyInRoom) {
        // Actualizar cantidad de cartones del jugador existente
        await client.query(
          `UPDATE bingo_room_players 
           SET cards_owned = cards_owned + $1 
           WHERE room_id = $2 AND user_id = $3`,
          [numberOfCards, room.id, userId]
        );
      } else {
        // Registrar nuevo jugador
        await client.query(
          `INSERT INTO bingo_room_players (
            room_id, user_id, cards_owned
          ) VALUES ($1, $2, $3)`,
          [room.id, userId, numberOfCards]
        );
      }

      // Generar cartones
      const cards = BingoCardGenerator.generateMultipleCards(room.numbers_mode, numberOfCards);
      
      // Obtener el número de cartones existentes del jugador para numeración correcta
      const existingCardsCount = await client.query(
        `SELECT COUNT(*) as count FROM bingo_cards 
         WHERE room_id = $1 AND owner_id = $2`,
        [room.id, userId]
      );
      
      const startCardNumber = parseInt(existingCardsCount.rows[0].count) + 1;
      
      for (let i = 0; i < cards.length; i++) {
        await client.query(
          `INSERT INTO bingo_cards (
            room_id, owner_id, card_number, numbers
          ) VALUES ($1, $2, $3, $4)`,
          [room.id, userId, startCardNumber + i, JSON.stringify(cards[i])]
        );
      }

      // Actualizar pozo
      const newPot = parseFloat(room.pot_total) + totalCost;
      await client.query(
        `UPDATE bingo_rooms 
         SET pot_total = $1 
         WHERE id = $2`,
        [newPot, room.id]
      );

      // Descontar del wallet
      const newBalance = currentBalance - totalCost;
      await client.query(
        `UPDATE wallets 
         SET ${room.currency}_balance = $1 
         WHERE user_id = $2`,
        [newBalance, userId]
      );

      // Registrar transacción wallet
      await client.query(
        `INSERT INTO wallet_transactions (
          wallet_id, type, currency, amount, 
          balance_before, balance_after, description, reference
        ) VALUES (
          (SELECT id FROM wallets WHERE user_id = $1),
          'game_bet', $2, $3, $4, $5, $6, $7
        )`,
        [
          userId,
          room.currency,
          -totalCost,
          currentBalance,
          newBalance,
          `Compra ${numberOfCards} cartón(es) Bingo`,
          roomCode
        ]
      );

      // Registrar transacción bingo
      await client.query(
        `INSERT INTO bingo_transactions (
          room_id, user_id, type, amount, currency, description
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          room.id,
          userId,
          'card_purchase',
          totalCost,
          room.currency,
          `Compra de ${numberOfCards} cartón(es)`
        ]
      );

      await client.query('COMMIT');

      await this.updateRoomActivity(room.id, client);

      const totalCardsOwned = currentCards + numberOfCards;

      logger.info(isAlreadyInRoom ? 'Jugador compró cartones adicionales' : 'Jugador unido a sala de bingo', {
        roomId: room.id,
        userId,
        cardsPurchased: numberOfCards,
        totalCardsOwned,
        totalCost,
        newPot
      });

      return {
        success: true,
        cardsPurchased: numberOfCards,
        totalCardsOwned,
        totalCost,
        cards,
        isAdditionalPurchase: isAlreadyInRoom
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error uniéndose a sala de bingo:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Marcar jugador como listo
   */
  static async markPlayerReady(roomId, userId) {
    try {
      await query(
        `UPDATE bingo_room_players 
         SET ready_at = CURRENT_TIMESTAMP 
         WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );

      // Verificar si todos están listos
      const playersResult = await query(
        `SELECT COUNT(*) as total,
                COUNT(ready_at) as ready
         FROM bingo_room_players 
         WHERE room_id = $1`,
        [roomId]
      );

      const { total, ready } = playersResult.rows[0];

      logger.info('Jugador marcado como listo', {
        roomId,
        userId,
        totalPlayers: total,
        readyPlayers: ready
      });

      await this.updateRoomActivity(roomId);

      return {
        success: true,
        allReady: total === ready,
        totalPlayers: parseInt(total),
        readyPlayers: parseInt(ready)
      };

    } catch (error) {
      logger.error('Error marcando jugador como listo:', error);
      throw error;
    }
  }

  /**
   * Iniciar partida (solo host)
   */
  static async startGame(roomId, hostId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verificar que es el host y todos están listos
      const checkResult = await client.query(
        `SELECT 
          r.host_id,
          r.status,
          COUNT(p.user_id) as total_players,
          COUNT(p.ready_at) as ready_players
         FROM bingo_rooms r
         LEFT JOIN bingo_room_players p ON p.room_id = r.id
         WHERE r.id = $1
         GROUP BY r.host_id, r.status`,
        [roomId]
      );

      const check = checkResult.rows[0];

      if (check.host_id !== hostId) {
        throw new Error('Solo el host puede iniciar la partida');
      }

      if (check.status !== 'lobby') {
        throw new Error('La partida ya ha comenzado o terminado');
      }

      if (check.total_players !== check.ready_players) {
        throw new Error('No todos los jugadores están listos');
      }

      // Cambiar estado a jugando
      await client.query(
        `UPDATE bingo_rooms 
         SET status = 'playing', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [roomId]
      );

      await this.updateRoomActivity(roomId, client);

      await client.query('COMMIT');

      logger.info('Partida de bingo iniciada', {
        roomId,
        hostId,
        totalPlayers: check.total_players
      });

      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error iniciando partida de bingo:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cantar un número (host o Admin/Tote en sala abandonada)
   */
  static async drawNumber(roomId, hostId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verificar que es el host y la partida está en curso
      // NOTA: substitute_host_id requiere migración 006, temporalmente solo host
      // SELECT FOR UPDATE bloquea la fila para prevenir race conditions
      const roomResult = await client.query(
        `SELECT * FROM bingo_rooms 
         WHERE id = $1 
         AND status = 'playing'
         AND host_id = $2
         FOR UPDATE`,
        [roomId, hostId]
      );

      if (!roomResult.rows.length) {
        throw new Error('No autorizado o partida no en curso');
      }

      const room = roomResult.rows[0];
      
      // Actualizar host_last_activity si el campo existe (retrocompatible)
      try {
        await client.query(
          `UPDATE bingo_rooms 
           SET host_last_activity = NOW() 
           WHERE id = $1`,
          [roomId]
        );
      } catch (error) {
        // Campo no existe aún, ignorar silenciosamente
        logger.debug('host_last_activity field not available yet');
      }

      // Obtener números ya cantados (con lock para consistencia)
      const drawnResult = await client.query(
        `SELECT drawn_number FROM bingo_drawn_numbers 
         WHERE room_id = $1
         FOR UPDATE`,
        [roomId]
      );

      const drawnNumbers = drawnResult.rows.map(r => r.drawn_number);
      
      // Generar pool de números disponibles
      const maxNumber = room.numbers_mode;
      const availableNumbers = [];
      
      for (let i = 1; i <= maxNumber; i++) {
        if (!drawnNumbers.includes(i)) {
          availableNumbers.push(i);
        }
      }

      if (availableNumbers.length === 0) {
        throw new Error('No quedan números por cantar');
      }

      // Seleccionar número aleatorio
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const drawnNumber = availableNumbers[randomIndex];
      const sequenceNumber = drawnNumbers.length + 1;

      // Registrar número cantado
      await client.query(
        `INSERT INTO bingo_drawn_numbers (
          room_id, sequence_number, drawn_number, drawn_by
        ) VALUES ($1, $2, $3, $4)`,
        [roomId, sequenceNumber, drawnNumber, hostId]
      );

      // Auto-marcar en todos los cartones (señalización)
      await client.query(
        `UPDATE bingo_cards 
         SET auto_marked = auto_marked || $1::jsonb
         WHERE room_id = $2 
         AND numbers::jsonb @> $1::jsonb`,
        [JSON.stringify([drawnNumber]), roomId]
      );

      await this.updateRoomActivity(roomId, client);

      await client.query('COMMIT');

      logger.info('Número cantado en bingo', {
        roomId,
        drawnNumber,
        sequenceNumber,
        remainingNumbers: availableNumbers.length - 1
      });

      return {
        success: true,
        drawnNumber,
        sequenceNumber,
        totalDrawn: drawnNumbers.length + 1,
        remainingNumbers: availableNumbers.length - 1
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cantando número:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Marcar número en cartón (jugador)
   */
  static async markNumber(cardId, number, userId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verificar propiedad del cartón
      const cardResult = await client.query(
        `SELECT c.*, r.status, r.victory_mode, r.numbers_mode
         FROM bingo_cards c
         JOIN bingo_rooms r ON r.id = c.room_id
         WHERE c.id = $1 AND c.owner_id = $2`,
        [cardId, userId]
      );

      if (!cardResult.rows.length) {
        throw new Error('Cartón no encontrado o no es tuyo');
      }

      const card = cardResult.rows[0];

      if (card.status !== 'playing') {
        throw new Error('La partida no está en curso');
      }

      // Verificar que el número ha sido cantado
      const drawnCheck = await client.query(
        `SELECT * FROM bingo_drawn_numbers 
         WHERE room_id = $1 AND drawn_number = $2`,
        [card.room_id, number]
      );

      if (!drawnCheck.rows.length) {
        throw new Error('Este número no ha sido cantado aún');
      }

      // Actualizar números marcados
      const markedNumbers = card.marked_numbers || [];
      if (!markedNumbers.includes(number)) {
        markedNumbers.push(number);
        
        await client.query(
          `UPDATE bingo_cards 
           SET marked_numbers = $1 
           WHERE id = $2`,
          [JSON.stringify(markedNumbers), cardId]
        );
      }

      await this.updateRoomActivity(card.room_id, client);

      // Verificar si hay patrón ganador
      const hasWinningPattern = await this.checkWinningPattern(
        card,
        markedNumbers,
        card.victory_mode
      );

      await client.query('COMMIT');

      return {
        success: true,
        markedNumbers,
        hasWinningPattern
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error marcando número:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cantar bingo (reclamar victoria)
   */
  static async callBingo(code, cardId, userId) {
    const client = await getClient();

    try {
      logger.info('🎯 CALL BINGO INICIADO', {
        code,
        cardId,
        userId,
        timestamp: new Date().toISOString()
      });

      await client.query('BEGIN');

      // Obtener datos del usuario
      const userResult = await client.query(
        `SELECT username FROM users WHERE id = $1`,
        [userId]
      );

      const winnerName = userResult.rows[0]?.username || 'Jugador';
      logger.info('👤 Usuario obtenido', { winnerName, userId });

      // Verificar cartón y validar patrón
      const cardResult = await client.query(
        `SELECT 
           c.id, c.card_number, c.numbers, c.marked_numbers, c.owner_id, c.room_id,
           r.code, r.victory_mode, r.status, r.drawn_numbers
         FROM bingo_cards c
         JOIN bingo_rooms r ON r.id = c.room_id
         WHERE c.id = $1 AND c.owner_id = $2 AND r.status = 'playing' AND r.code = $3`,
        [cardId, userId, code]
      );

      if (!cardResult.rows.length) {
        await client.query('ROLLBACK');
        return {
          success: false,
          isValid: false,
          message: 'Cartón inválido o partida no en curso'
        };
      }

      const card = cardResult.rows[0];
      
      logger.info('🎴 Cartón encontrado', {
        cardId: card.id,
        roomId: card.room_id,
        victoryMode: card.victory_mode,
        status: card.status,
        markedNumbersRaw: card.marked_numbers,
        markedNumbersType: typeof card.marked_numbers
      });
      
      // Verificar que el cartón tenga números marcados
      const markedNumbers = card.marked_numbers || [];
      
      logger.info('✅ Números marcados parseados', {
        markedNumbers,
        count: markedNumbers.length,
        isArray: Array.isArray(markedNumbers)
      });

      // Validar patrón ganador
      logger.info('🔍 Iniciando validación de patrón', {
        victoryMode: card.victory_mode,
        markedCount: markedNumbers.length,
        cardNumbers: card.numbers
      });

      const isValid = await this.validateWinningPattern(
        card,
        markedNumbers,
        card.victory_mode,
        client
      );

      logger.info('📊 Resultado de validación', {
        isValid,
        markedNumbers,
        victoryMode: card.victory_mode
      });

      if (!isValid) {
        logger.warn('❌ BINGO INVÁLIDO - Patrón no completo', {
          cardId,
          markedNumbers,
          victoryMode: card.victory_mode
        });
        await client.query('ROLLBACK');
        return {
          success: false,
          isValid: false,
          message: 'No tienes un patrón ganador válido',
          winnerName
        };
      }

      // Verificar si ya hay ganadores (para empates)
      const existingWinners = await client.query(
        `SELECT * FROM bingo_winners 
         WHERE room_id = $1 AND validated = true`,
        [card.room_id]
      );

      const isFirstWinner = existingWinners.rows.length === 0;
      
      // Registrar ganador
      await client.query(
        `INSERT INTO bingo_winners (
          room_id, user_id, card_id, winning_pattern, 
          prize_amount, validated, validation_data
        ) VALUES ($1, $2, $3, $4, $5, true, $6)`,
        [
          card.room_id,
          userId,
          cardId,
          card.victory_mode,
          0, // Se calculará después
          JSON.stringify({ 
            markedNumbers: markedNumbers,
            timestamp: new Date().toISOString()
          })
        ]
      );

      // Marcar cartón como ganador
      await client.query(
        `UPDATE bingo_cards SET is_winner = true WHERE id = $1`,
        [cardId]
      );

      // Si es el primer ganador o dentro de ventana de empate (3 segundos)
      const shouldEndGame = isFirstWinner || 
        (existingWinners.rows.length > 0 && 
         new Date() - new Date(existingWinners.rows[0].claimed_at) < 3000);

      if (shouldEndGame) {
        // Esperar un momento para posibles empates
        if (isFirstWinner) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Distribuir premios
        await this.distributePrizes(card.room_id, client);

        // Finalizar partida
        await client.query(
          `UPDATE bingo_rooms 
           SET status = 'finished', ended_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [card.room_id]
        );
      }

      await this.updateRoomActivity(card.room_id, client);

      // Obtener totalPot antes del COMMIT para retornarlo
      const potResult = await client.query(
        `SELECT pot_total FROM bingo_rooms WHERE id = $1`,
        [card.room_id]
      );
      const totalPot = potResult.rows[0]?.pot_total || 0;

      await client.query('COMMIT');

      logger.info('✅ BINGO VÁLIDO - Proceso completo', {
        roomId: card.room_id,
        userId,
        cardId,
        isFirstWinner,
        victoryMode: card.victory_mode,
        totalPot,
        winnerName,
        markedNumbers
      });

      return {
        success: true,
        isValid: true,
        isWinner: true,
        isFirstWinner,
        winnerName,
        pattern: card.victory_mode,
        totalPot
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cantando bingo:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Distribuir premios
   * Normal: 70% ganador, 20% host, 10% plataforma
   * Host abandonado: 70% ganador, 0% host, 30% plataforma
   */
  static async distributePrizes(roomId, client) {
    try {
      // Obtener información de la sala y ganadores
      const roomResult = await client.query(
        `SELECT * FROM bingo_rooms WHERE id = $1`,
        [roomId]
      );

      const room = roomResult.rows[0];
      const totalPot = parseFloat(room.pot_total);
      // Retrocompatible: si el campo no existe, asume false
      const hostAbandoned = room.host_abandoned === true;

      // Obtener ganadores validados
      const winnersResult = await client.query(
        `SELECT w.*, u.username 
         FROM bingo_winners w
         JOIN users u ON u.id = w.user_id
         WHERE w.room_id = $1 AND w.validated = true`,
        [roomId]
      );

      const winners = winnersResult.rows;

      if (winners.length === 0) {
        throw new Error('No hay ganadores validados');
      }

      // Calcular distribución según si el host abandonó
      let winnerShare, hostShare, platformShare;
      
      if (hostAbandoned) {
        // Host abandonó: 70% ganador, 0% host, 30% plataforma
        winnerShare = totalPot * 0.7;
        hostShare = 0;
        platformShare = totalPot * 0.3;
        
        logger.info('💰 Distribución ajustada por abandono de host', {
          roomId,
          totalPot,
          winnerShare: '70%',
          hostShare: '0%',
          platformShare: '30%'
        });
      } else {
        // Distribución normal: 70% ganador, 20% host, 10% plataforma
        winnerShare = totalPot * 0.7;
        hostShare = totalPot * 0.2;
        platformShare = totalPot * 0.1;
      }

      // Premio por ganador (se divide en caso de empate)
      const prizePerWinner = winnerShare / winners.length;

      // Pagar a ganadores
      for (const winner of winners) {
        // Actualizar wallet
        await client.query(
          `UPDATE wallets 
           SET ${room.currency}_balance = ${room.currency}_balance + $1 
           WHERE user_id = $2`,
          [prizePerWinner, winner.user_id]
        );

        // Registrar transacción wallet
        const walletResult = await client.query(
          `SELECT id, ${room.currency}_balance as balance 
           FROM wallets WHERE user_id = $1`,
          [winner.user_id]
        );

        const wallet = walletResult.rows[0];

        await client.query(
          `INSERT INTO wallet_transactions (
            wallet_id, type, currency, amount, 
            balance_before, balance_after, description, reference
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            wallet.id,
            'game_win',
            room.currency,
            prizePerWinner,
            parseFloat(wallet.balance) - prizePerWinner,
            parseFloat(wallet.balance),
            `Premio Bingo - ${room.victory_mode}`,
            room.code
          ]
        );

        // Registrar transacción bingo
        await client.query(
          `INSERT INTO bingo_transactions (
            room_id, user_id, type, amount, currency, description
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            roomId,
            winner.user_id,
            'winner_payout',
            prizePerWinner,
            room.currency,
            winners.length > 1 ? 
              `Premio compartido entre ${winners.length} ganadores` : 
              'Premio ganador único'
          ]
        );

        // Actualizar premio en tabla de ganadores
        await client.query(
          `UPDATE bingo_winners SET prize_amount = $1 
           WHERE id = $2`,
          [prizePerWinner, winner.id]
        );

        // Actualizar payout del jugador
        await client.query(
          `UPDATE bingo_room_players 
           SET payout = $1, wins = wins + 1 
           WHERE room_id = $2 AND user_id = $3`,
          [prizePerWinner, roomId, winner.user_id]
        );
      }

      // Pagar al host (solo si NO abandonó)
      if (!hostAbandoned && hostShare > 0) {
        await client.query(
          `UPDATE wallets 
           SET ${room.currency}_balance = ${room.currency}_balance + $1 
           WHERE user_id = $2`,
          [hostShare, room.host_id]
        );

        // Transacción host
        await client.query(
          `INSERT INTO bingo_transactions (
            room_id, user_id, type, amount, currency, description
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            roomId,
            room.host_id,
            'host_commission',
            hostShare,
            room.currency,
            'Comisión por ser anfitrión'
          ]
        );
        
        logger.info(`💵 Comisión de host pagada: ${hostShare} ${room.currency}`);
      } else if (hostAbandoned) {
        logger.warn(`⚠️  Host abandonó sala - No recibe comisión`, {
          roomId,
          hostId: room.host_id,
          forfeitedAmount: totalPot * 0.2
        });
      }

      // Pagar a la plataforma (usuario con tg_id = 1417856820)
      const platformUserResult = await client.query(
        `SELECT id FROM users WHERE tg_id = '1417856820'`
      );

      if (platformUserResult.rows.length) {
        const platformUserId = platformUserResult.rows[0].id;

        await client.query(
          `UPDATE wallets 
           SET ${room.currency}_balance = ${room.currency}_balance + $1 
           WHERE user_id = $2`,
          [platformShare, platformUserId]
        );

        await client.query(
          `INSERT INTO bingo_transactions (
            room_id, user_id, type, amount, currency, description
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            roomId,
            platformUserId,
            'platform_fee',
            platformShare,
            room.currency,
            'Comisión de la plataforma (10%)'
          ]
        );
      }

      // Actualizar estadísticas
      for (const winner of winners) {
        await client.query(
          `UPDATE user_stats 
           SET bingo_games_played = bingo_games_played + 1,
               bingo_games_won = bingo_games_won + 1,
               bingo_total_earnings = bingo_total_earnings + $1
           WHERE user_id = $2`,
          [prizePerWinner, winner.user_id]
        );
      }

      logger.info('Premios distribuidos', {
        roomId,
        totalPot,
        winners: winners.length,
        prizePerWinner,
        hostShare,
        platformShare
      });

      return {
        winners: winners.map(w => ({
          userId: w.user_id,
          username: w.username,
          prize: prizePerWinner
        })),
        hostShare,
        platformShare,
        totalPot
      };

    } catch (error) {
      logger.error('Error distribuyendo premios:', error);
      throw error;
    }
  }

  /**
   * Verificar patrón ganador según modo
   */
  static async checkWinningPattern(card, markedNumbers, victoryMode) {
    // Esta función se implementará con la lógica específica
    // para cada modo de victoria (línea, esquinas, completo)
    // según el tipo de cartón (75 o 90)
    return false; // Por ahora
  }

  /**
   * Validar patrón ganador en el servidor
   */
  static async validateWinningPattern(card, markedNumbers, victoryMode, client) {
    try {
      logger.info('🔍 [VALIDATE] Iniciando validación de patrón', {
        cardId: card.id,
        victoryMode,
        markedNumbersRaw: markedNumbers,
        markedNumbersType: typeof markedNumbers
      });

      // Parsear números del cartón
      const numbers = typeof card.numbers === 'string' ? JSON.parse(card.numbers) : card.numbers;
      const marked = typeof markedNumbers === 'string' ? JSON.parse(markedNumbers) : (markedNumbers || []);
      
      logger.info('📄 [VALIDATE] Datos parseados', {
        numbersType: typeof numbers,
        markedType: typeof marked,
        markedCount: marked.length,
        markedArray: marked,
        numbersKeys: Object.keys(numbers || {})
      });
      
      // Obtener grid del cartón
      let grid;
      if (numbers.grid) {
        grid = numbers.grid;
      } else if (Array.isArray(numbers)) {
        // Si es array plano, construir grid 5x5 (modo 75)
        grid = [];
        for (let col = 0; col < 5; col++) {
          grid[col] = [];
          for (let row = 0; row < 5; row++) {
            const index = col * 5 + row;
            grid[col][row] = numbers[index];
          }
        }
      } else {
        logger.error('Formato de números del cartón inválido', numbers);
        return false;
      }
      
      // Función helper para verificar si un número está marcado
      const isMarked = (num) => {
        if (num === 'FREE' || num === null) return true; // FREE siempre cuenta como marcado
        
        let actualNum = num;
        if (typeof num === 'object' && num !== null) {
          actualNum = num.value;
        }
        
        // Normalizar ambos a string para comparación
        const numStr = String(actualNum);
        const result = marked.some(m => String(m) === numStr);
        
        logger.debug('🔎 [VALIDATE] Verificando número', {
          num: actualNum,
          numStr,
          marked,
          result
        });
        
        return result;
      };
      
      // Validar según modo de victoria
      logger.info('🎯 [VALIDATE] Validando modo', { victoryMode: victoryMode.toLowerCase() });

      switch (victoryMode.toLowerCase()) {
        case 'linea':
        case 'línea':
        case 'line':
          logger.info('📏 [VALIDATE] Verificando líneas (filas, columnas, diagonales)');

          // Verificar filas (horizontal)
          for (let row = 0; row < 5; row++) {
            let rowComplete = true;
            const rowNumbers = [];
            for (let col = 0; col < 5; col++) {
              const cell = grid[col][row];
              const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
              rowNumbers.push(num);
              if (!isMarked(num)) {
                rowComplete = false;
                break;
              }
            }
            logger.debug(`🔵 [VALIDATE] Fila ${row}`, { rowNumbers, rowComplete });
            if (rowComplete) {
              logger.info('✅ [VALIDATE] ¡FILA COMPLETA!', { row, rowNumbers });
              return true;
            }
          }
          
          // Verificar columnas (vertical)
          for (let col = 0; col < 5; col++) {
            let colComplete = true;
            for (let row = 0; row < 5; row++) {
              const cell = grid[col][row];
              const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
              if (!isMarked(num)) {
                colComplete = false;
                break;
              }
            }
            if (colComplete) return true;
          }
          
          // Verificar diagonal principal (top-left a bottom-right)
          let diag1Complete = true;
          for (let i = 0; i < 5; i++) {
            const cell = grid[i][i];
            const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
            if (!isMarked(num)) {
              diag1Complete = false;
              break;
            }
          }
          if (diag1Complete) return true;
          
          // Verificar diagonal secundaria (top-right a bottom-left)
          let diag2Complete = true;
          for (let i = 0; i < 5; i++) {
            const cell = grid[i][4 - i];
            const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
            if (!isMarked(num)) {
              diag2Complete = false;
              break;
            }
          }
          if (diag2Complete) return true;
          
          return false;
          
        case 'esquinas':
        case 'corners':
          // Verificar las 4 esquinas
          const corners = [
            grid[0][0],  // Top-left
            grid[4][0],  // Top-right
            grid[0][4],  // Bottom-left
            grid[4][4]   // Bottom-right
          ];
          
          for (const cell of corners) {
            const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
            if (!isMarked(num)) {
              return false;
            }
          }
          return true;
          
        case 'completo':
        case 'full':
        case 'blackout':
          // Verificar que todo el cartón esté marcado
          for (let col = 0; col < 5; col++) {
            for (let row = 0; row < 5; row++) {
              const cell = grid[col][row];
              const num = typeof cell === 'object' && cell !== null ? cell.value : cell;
              if (!isMarked(num)) {
                return false;
              }
            }
          }
          return true;
          
        default:
          logger.error('Modo de victoria desconocido:', victoryMode);
          return false;
      }
      
    } catch (error) {
      logger.error('Error validando patrón ganador:', error);
      return false;
    }
  }

  /**
   * Obtener detalles completos de una sala
   */
  static async getRoomDetails(roomCode, client) {
    try {
      // Información de la sala
      const roomResult = await client.query(`
        SELECT 
          r.*, u.username as host_name
          r.card_cost,
          r.max_players,
          r.max_cards_per_player,
          r.password,
          r.pot_total,
          r.status,
          r.created_at,
          r.last_activity,
          u.username as host_name
        FROM bingo_rooms r
        JOIN users u ON u.id = r.host_id
        WHERE r.code = $1
      `, [roomCode]);
      
      if (!roomResult.rows.length) {
        throw new Error('Sala no encontrada');
      }
      
      const room = roomResult.rows[0];
      
      // Jugadores
      const playersResult = await query(`
        SELECT 
          p.*,
          u.username,
          u.avatar_url
        FROM bingo_room_players p
        JOIN users u ON u.id = p.user_id
        WHERE p.room_id = $1
        ORDER BY p.joined_at
      `, [room.id]);
      
      // Cartones de cada jugador
      const cardsResult = await query(`
        SELECT * FROM bingo_cards 
        WHERE room_id = $1
        ORDER BY owner_id, card_number
      `, [room.id]);
      
      // Números cantados
      const drawnNumbersResult = await query(`
        SELECT * FROM bingo_drawn_numbers 
        WHERE room_id = $1
        ORDER BY sequence_number
      `, [room.id]);
      
      return {
        ...room,
        players: playersResult.rows,
        cards: cardsResult.rows,
        drawnNumbers: drawnNumbersResult.rows
      };
      
    } catch (error) {
      logger.error('Error obteniendo detalles de sala:', error);
      throw error;
    }
  }
}

module.exports = BingoService;
