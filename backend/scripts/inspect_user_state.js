'use strict';

const { Client } = require('pg');

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING;

  if (!connectionString) {
    console.error('❌ No se encontró cadena de conexión. Configura DATABASE_PUBLIC_URL o DATABASE_URL.');
    process.exit(1);
  }

  const usernameArg = process.argv[2] || 'divorare04';

  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos para inspeccionar estado de usuario...');

  try {
    await client.connect();

    console.log(`
=== 1) Buscando usuario '${usernameArg}' ===`);
    const userRes = await client.query(
      `SELECT id, username, display_name, tg_id, created_at, last_seen_at, is_verified
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [usernameArg]
    );

    if (userRes.rows.length === 0) {
      console.log('⚠️ Usuario no encontrado');
      return;
    }

    const user = userRes.rows[0];
    console.table([user]);

    const userId = user.id;

    console.log('\n=== 2) Roles del usuario ===');
    const rolesRes = await client.query(
      `SELECT r.name, r.description
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    console.table(rolesRes.rows);

    console.log('\n=== 3) Wallet ===');
    const walletRes = await client.query(
      `SELECT id, coins_balance, fires_balance,
              total_coins_earned, total_coins_spent,
              total_fires_earned, total_fires_spent,
              updated_at
       FROM wallets
       WHERE user_id = $1`,
      [userId]
    );
    console.table(walletRes.rows);

    console.log('\n=== 4) TicTacToe - Salas activas (host o jugador) ===');
    const tttRoomsRes = await client.query(
      `SELECT code, mode, bet_amount, status, created_at, updated_at,
              host_id, player_x_id, player_o_id
       FROM tictactoe_rooms
       WHERE (host_id = $1 OR player_x_id = $1 OR player_o_id = $1)
         AND status IN ('waiting', 'ready', 'playing')
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(tttRoomsRes.rows);

    console.log('\n=== 5) Bingo V2 - Salas activas como host ===');
    const bingoHostRes = await client.query(
      `SELECT id, code, name, status, currency_type, card_cost, created_at
       FROM bingo_v2_rooms
       WHERE host_id = $1
         AND status IN ('waiting', 'in_progress')
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(bingoHostRes.rows);

    console.log('\n=== 6) Bingo V2 - Salas activas donde tiene cartones ===');
    const bingoPlayerRes = await client.query(
      `SELECT DISTINCT
          r.code,
          r.name,
          r.status,
          r.currency_type,
          r.card_cost,
          p.cards_purchased,
          p.joined_at
       FROM bingo_v2_rooms r
       JOIN bingo_v2_room_players p ON r.id = p.room_id
       WHERE p.user_id = $1
         AND r.status IN ('waiting', 'in_progress')
       ORDER BY r.created_at DESC`,
      [userId]
    );
    console.table(bingoPlayerRes.rows);

    console.log('\n=== 7) Rifas - Como host ===');
    const rafflesHostRes = await client.query(
      `SELECT id, code, name, status, mode, created_at
       FROM raffles
       WHERE host_id = $1
         AND status IN ('active', 'pending')
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(rafflesHostRes.rows);

    console.log('\n=== 8) Rifas - Números propios / reservados ===');
    const raffleNumbersRes = await client.query(
      `SELECT
          COUNT(*) FILTER (WHERE owner_id = $1) AS owned_numbers,
          COUNT(*) FILTER (WHERE reserved_by = $1) AS reserved_numbers
       FROM raffle_numbers`,
      [userId]
    );
    console.table(raffleNumbersRes.rows);

    console.log('\n=== 9) Pool - Salas activas (host u oponente) ===');
    const poolRoomsRes = await client.query(
      `SELECT code, mode, bet_amount, status,
              host_id, player_opponent_id,
              created_at, updated_at
       FROM pool_rooms
       WHERE (host_id = $1 OR player_opponent_id = $1)
         AND status IN ('waiting', 'ready', 'playing')
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(poolRoomsRes.rows);

    console.log('\n=== 10) Caída - Salas activas como host ===');
    const caidaRoomsRes = await client.query(
      `SELECT code, mode, bet_amount, status,
              created_at, updated_at
       FROM caida_rooms
       WHERE host_id = $1
         AND status IN ('waiting', 'playing')
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(caidaRoomsRes.rows);

    console.log('\n=== 11) Tiendas - Donde es dueño ===');
    const storesOwnedRes = await client.query(
      `SELECT id, slug, name, created_at
       FROM stores
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    console.table(storesOwnedRes.rows);

    console.log('\n=== 12) Tiendas - Staff asignado ===');
    const storesStaffRes = await client.query(
      `SELECT s.id, s.store_id, st.slug AS store_slug, st.name AS store_name,
              s.role, s.is_active, s.created_at
       FROM store_staff s
       JOIN stores st ON s.store_id = st.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );
    console.table(storesStaffRes.rows);

    console.log('\n=== 13) Historial de cambios de roles (últimos 20) ===');
    const roleHistoryRes = await client.query(
      `SELECT created_at, action, role_name, previous_roles, new_roles, changed_by_user_id
       FROM role_change_logs
       WHERE target_user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    console.table(roleHistoryRes.rows);

    console.log('\n✅ Inspección completada.');
  } catch (err) {
    console.error('❌ Error inspeccionando estado de usuario:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    console.log('\n🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
