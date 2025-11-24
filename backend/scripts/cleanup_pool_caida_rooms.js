#!/usr/bin/env node

/**
 * Limpia salas activas de Pool y Caida marcándolas como canceladas
 * y reembolsando las apuestas, usando la misma lógica de refundBet
 * que el backend.
 *
 * Por diseño:
 *  - Pool: usa pool_rooms, host_id y player_opponent_id.
 *  - Caida: usa caida_rooms, player_ids (array JSON).
 *
 * El script:
 *  1) Toma como máximo N salas activas de cada juego (por defecto 2 pool, 1 caida).
 *  2) Para cada sala hace un UPDATE dentro de una transacción:
 *     - Llama refundBet para cada jugador involucrado.
 *     - Marca status = 'cancelled' y finished_at = NOW().
 *
 * Uso (ejemplos):
 *   DATABASE_PUBLIC_URL=... node backend/scripts/cleanup_pool_caida_rooms.js
 *   node backend/scripts/cleanup_pool_caida_rooms.js --max-pool 2 --max-caida 1
 */

const { Client } = require('pg');
const { refundBet } = require('../utils/tictactoe');

function getArgValue(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return defaultValue;
  const raw = process.argv[idx + 1];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

const maxPool = getArgValue('--max-pool', 2);
const maxCaida = getArgValue('--max-caida', 1);

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Debe definir DATABASE_PUBLIC_URL o DATABASE_URL en las variables de entorno.');
  process.exit(1);
}

async function cleanupPoolRooms(client) {
  console.log(`\n== Pool: buscando hasta ${maxPool} salas activas ==`);

  const res = await client.query(
    `SELECT * FROM pool_rooms 
     WHERE status IN ('waiting', 'ready', 'playing') 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [maxPool]
  );

  if (res.rows.length === 0) {
    console.log('No hay salas activas de pool para limpiar.');
    return;
  }

  for (const room of res.rows) {
    console.log('\n--- Pool room ---');
    console.log({
      id: room.id,
      code: room.code,
      status: room.status,
      mode: room.mode,
      bet_amount: room.bet_amount,
      host_id: room.host_id,
      player_opponent_id: room.player_opponent_id
    });

    await client.query('BEGIN');
    try {
      const betAmount = parseFloat(room.bet_amount);
      const mode = room.mode; // 'coins' | 'fires'

      if (!Number.isFinite(betAmount) || betAmount <= 0) {
        console.log('  → Apuesta inválida, solo se marcará como cancelada.');
      } else {
        if (room.host_id) {
          console.log(`  → Reembolsando host ${room.host_id} (${mode} ${betAmount})`);
          await refundBet(client, room.host_id, mode, betAmount, room.code, 'Pool room cleanup script');
        }
        if (room.player_opponent_id) {
          console.log(`  → Reembolsando oponente ${room.player_opponent_id} (${mode} ${betAmount})`);
          await refundBet(client, room.player_opponent_id, mode, betAmount, room.code, 'Pool room cleanup script');
        }
      }

      await client.query(
        `UPDATE pool_rooms 
         SET status = 'cancelled', finished_at = NOW() 
         WHERE id = $1`,
        [room.id]
      );

      await client.query('COMMIT');
      console.log('  ✔ Sala de pool marcada como cancelled y reembolsada.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('  ✖ Error limpiando sala de pool:', err.message);
    }
  }
}

async function cleanupCaidaRooms(client) {
  console.log(`\n== Caida: buscando hasta ${maxCaida} salas activas ==`);

  const res = await client.query(
    `SELECT * FROM caida_rooms 
     WHERE status IN ('waiting', 'playing') 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [maxCaida]
  );

  if (res.rows.length === 0) {
    console.log('No hay salas activas de caida para limpiar.');
    return;
  }

  for (const room of res.rows) {
    console.log('\n--- Caida room ---');
    console.log({
      id: room.id,
      code: room.code,
      status: room.status,
      mode: room.mode,
      bet_amount: room.bet_amount,
      player_ids: room.player_ids
    });

    await client.query('BEGIN');
    try {
      const betAmount = parseFloat(room.bet_amount);
      const mode = room.mode; // 'coins' | 'fires'

      let playerIds = [];
      if (Array.isArray(room.player_ids)) {
        playerIds = room.player_ids;
      } else if (typeof room.player_ids === 'string') {
        try {
          playerIds = JSON.parse(room.player_ids);
        } catch (_) {
          playerIds = [];
        }
      }

      if (!Number.isFinite(betAmount) || betAmount <= 0 || playerIds.length === 0) {
        console.log('  → Datos de apuesta/jugadores inválidos, solo se marcará como cancelada.');
      } else {
        for (const pid of playerIds) {
          console.log(`  → Reembolsando jugador ${pid} (${mode} ${betAmount})`);
          await refundBet(client, pid, mode, betAmount, room.code, 'Caida room cleanup script');
        }
      }

      await client.query(
        `UPDATE caida_rooms 
         SET status = 'cancelled', finished_at = NOW() 
         WHERE id = $1`,
        [room.id]
      );

      await client.query('COMMIT');
      console.log('  ✔ Sala de caida marcada como cancelled y reembolsada.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('  ✖ Error limpiando sala de caida:', err.message);
    }
  }
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Conectado a la base de datos');

  try {
    await cleanupPoolRooms(client);
    await cleanupCaidaRooms(client);
  } finally {
    await client.end();
    console.log('\nConexión cerrada');
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});
