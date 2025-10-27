const { query, getClient } = require('../db');
const logger = require('../utils/logger');
const BingoCardGenerator = require('../utils/bingoCardGenerator');

class BingoService {
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
          created_at, updated_at`,
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

      // Registrar al host como jugador
      await client.query(
        `INSERT INTO bingo_room_players (
          room_id, user_id, is_host, cards_owned
        ) VALUES ($1, $2, true, 1)`,
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

      // Obtener sala
      const roomResult = await client.query(
        `SELECT * FROM bingo_rooms 
         WHERE code = $1 AND status = 'lobby'`,
        [roomCode]
      );

      if (!roomResult.rows.length) {
        throw new Error('Sala no encontrada o no disponible');
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

      if (existingPlayer.rows.length) {
        throw new Error('Ya estás en esta sala');
      }

      // Verificar capacidad
      const playerCount = await client.query(
        `SELECT COUNT(*) as count FROM bingo_room_players 
         WHERE room_id = $1`,
        [room.id]
      );

      if (parseInt(playerCount.rows[0].count) >= room.max_players) {
        throw new Error('Sala llena');
      }

      // Validar número de cartones
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

      // Registrar jugador
      await client.query(
        `INSERT INTO bingo_room_players (
          room_id, user_id, cards_owned
        ) VALUES ($1, $2, $3)`,
        [room.id, userId, numberOfCards]
      );

      // Generar cartones
      const cards = BingoCardGenerator.generateMultipleCards(room.numbers_mode, numberOfCards);
      
      for (let i = 0; i < cards.length; i++) {
        await client.query(
          `INSERT INTO bingo_cards (
            room_id, owner_id, card_number, numbers
          ) VALUES ($1, $2, $3, $4)`,
          [room.id, userId, i + 1, JSON.stringify(cards[i])]
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

      logger.info('Jugador unido a sala de bingo', {
        roomId: room.id,
        userId,
        cardsOwned: numberOfCards,
        totalCost,
        newPot
      });

      return {
        success: true,
        cardsOwned: numberOfCards,
        totalCost,
        cards
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
   * Cantar un número (solo host)
   */
  static async drawNumber(roomId, hostId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verificar que es el host y la partida está en curso
      const roomResult = await client.query(
        `SELECT * FROM bingo_rooms 
         WHERE id = $1 AND host_id = $2 AND status = 'playing'`,
        [roomId, hostId]
      );

      if (!roomResult.rows.length) {
        throw new Error('No autorizado o partida no en curso');
      }

      const room = roomResult.rows[0];

      // Obtener números ya cantados
      const drawnResult = await client.query(
        `SELECT drawn_number FROM bingo_drawn_numbers 
         WHERE room_id = $1`,
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
  static async callBingo(cardId, userId) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Verificar cartón y validar patrón
      const cardResult = await client.query(
        `SELECT c.*, r.*
         FROM bingo_cards c
         JOIN bingo_rooms r ON r.id = c.room_id
         WHERE c.id = $1 AND c.owner_id = $2 AND r.status = 'playing'`,
        [cardId, userId]
      );

      if (!cardResult.rows.length) {
        throw new Error('Cartón inválido o partida no en curso');
      }

      const card = cardResult.rows[0];

      // Validar patrón ganador
      const isValid = await this.validateWinningPattern(
        card,
        card.marked_numbers,
        card.victory_mode,
        client
      );

      if (!isValid) {
        throw new Error('No tienes un patrón ganador válido');
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
            markedNumbers: card.marked_numbers,
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

      await client.query('COMMIT');

      logger.info('Bingo cantado', {
        roomId: card.room_id,
        userId,
        cardId,
        isFirstWinner,
        victoryMode: card.victory_mode
      });

      return {
        success: true,
        isWinner: true,
        isFirstWinner
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
   * Distribuir premios (70% ganador, 20% host, 10% plataforma)
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

      // Calcular distribución
      const winnerShare = totalPot * 0.7;
      const hostShare = totalPot * 0.2;
      const platformShare = totalPot * 0.1;

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

      // Pagar al host
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
    // Implementación completa de validación server-side
    // Esto es crítico para evitar trampas
    return true; // Por ahora
  }

  /**
   * Obtener detalles completos de una sala
   */
  static async getRoomDetails(roomCode) {
    const { query } = require('../db');
    
    try {
      // Información de la sala
      const roomResult = await query(`
        SELECT 
          r.id,
          r.code,
          r.host_id,
          r.room_name,
          r.room_type,
          r.currency,
          r.numbers_mode,
          r.victory_mode,
          r.card_cost,
          r.max_players,
          r.max_cards_per_player,
          r.password,
          r.pot_total,
          r.status,
          r.created_at,
          r.updated_at,
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
