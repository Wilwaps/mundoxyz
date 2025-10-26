/**
 * Script de limpieza INMEDIATA de salas duplicadas existentes
 * Ejecuta AHORA para limpiar las salas que ya están en DB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const { Client } = require('pg');

async function cleanupNow() {
  const connectionString = process.env.DB_CONNECTION || process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('❌ No se encontró URL de conexión');
    console.error('Usa: $env:DB_CONNECTION="postgresql://..."; node limpiar_salas_ahora.js');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🧹 LIMPIEZA INMEDIATA DE SALAS DUPLICADAS\n');
    console.log('🔌 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado\n');

    // 1. Obtener todas las salas activas agrupadas por usuario
    console.log('📋 Analizando salas activas...');
    const result = await client.query(`
      SELECT 
        r.*,
        CASE 
          WHEN r.player_x_id IS NOT NULL THEN r.player_x_id
          WHEN r.player_o_id IS NOT NULL THEN r.player_o_id
          ELSE r.host_id
        END as user_id,
        ux.username as player_x_username,
        uo.username as player_o_username
      FROM tictactoe_rooms r
      LEFT JOIN users ux ON ux.id = r.player_x_id
      LEFT JOIN users uo ON uo.id = r.player_o_id
      WHERE r.status IN ('waiting', 'ready')
      ORDER BY r.created_at DESC
    `);

    console.log(`📊 Encontradas ${result.rows.length} salas en waiting/ready\n`);

    // 2. Agrupar por usuario
    const roomsByUser = {};
    result.rows.forEach(room => {
      // Considerar tanto player_x como player_o
      if (room.player_x_id) {
        if (!roomsByUser[room.player_x_id]) roomsByUser[room.player_x_id] = [];
        roomsByUser[room.player_x_id].push({ ...room, user_type: 'host' });
      }
      if (room.player_o_id) {
        if (!roomsByUser[room.player_o_id]) roomsByUser[room.player_o_id] = [];
        roomsByUser[room.player_o_id].push({ ...room, user_type: 'guest' });
      }
    });

    // 3. Identificar salas a cancelar
    const roomsToCancel = [];
    for (const [userId, rooms] of Object.entries(roomsByUser)) {
      if (rooms.length > 1) {
        // Mantener solo la más reciente, cancelar las demás
        const sorted = rooms.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const toKeep = sorted[0];
        const toCancel = sorted.slice(1);
        
        console.log(`👤 Usuario ${rooms[0].player_x_username || rooms[0].player_o_username}:`);
        console.log(`   ✅ Mantener: ${toKeep.code} (${toKeep.created_at})`);
        toCancel.forEach(room => {
          console.log(`   ❌ Cancelar: ${room.code} (${room.created_at})`);
          roomsToCancel.push(room);
        });
        console.log('');
      }
    }

    if (roomsToCancel.length === 0) {
      console.log('✅ No hay salas duplicadas para limpiar\n');
      await client.end();
      return;
    }

    console.log(`\n🔧 Cancelando ${roomsToCancel.length} salas duplicadas...\n`);

    let cleaned = 0;
    for (const room of roomsToCancel) {
      try {
        // Devolver apuesta al host
        if (room.player_x_id) {
          const currency = room.mode === 'fires' ? 'fires_balance' : 'coins_balance';
          await client.query(`
            UPDATE wallets
            SET ${currency} = ${currency} + $1,
                updated_at = NOW()
            WHERE user_id = $2
          `, [parseFloat(room.bet_amount), room.player_x_id]);
          
          console.log(`   💰 Devuelto ${room.bet_amount} ${room.mode} a ${room.player_x_username}`);
        }

        // Devolver apuesta al invitado si existe
        if (room.player_o_id) {
          const currency = room.mode === 'fires' ? 'fires_balance' : 'coins_balance';
          await client.query(`
            UPDATE wallets
            SET ${currency} = ${currency} + $1,
                updated_at = NOW()
            WHERE user_id = $2
          `, [parseFloat(room.bet_amount), room.player_o_id]);
          
          console.log(`   💰 Devuelto ${room.bet_amount} ${room.mode} a ${room.player_o_username}`);
        }

        // Marcar sala como cancelada
        await client.query(`
          UPDATE tictactoe_rooms
          SET status = 'cancelled',
              finished_at = NOW()
          WHERE id = $1
        `, [room.id]);

        console.log(`   ✅ Sala ${room.code} cancelada\n`);
        cleaned++;

      } catch (error) {
        console.error(`   ❌ Error cancelando sala ${room.code}:`, error.message);
      }
    }

    console.log(`\n🎉 LIMPIEZA COMPLETADA`);
    console.log(`   Salas canceladas: ${cleaned}`);
    console.log(`   Apuestas devueltas: 100%\n`);

    await client.end();
    console.log('🔌 Conexión cerrada');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await client.end();
    process.exit(1);
  }
}

cleanupNow();
