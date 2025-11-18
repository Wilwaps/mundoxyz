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

  const tgId = 1417856820;
  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos para reparar wallet de tg_id =', tgId);

  try {
    await client.connect();

    const beforeRes = await client.query(
      `SELECT w.id, w.user_id, w.coins_balance, w.total_coins_earned, w.total_coins_spent
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE u.tg_id = $1`,
      [tgId]
    );

    if (beforeRes.rows.length === 0) {
      console.log('⚠️ No se encontró wallet para tg_id =', tgId);
      return;
    }

    console.log('\n=== WALLET ANTES ===');
    console.log(beforeRes.rows[0]);

    const updateRes = await client.query(
      `UPDATE wallets w
       SET coins_balance = GREATEST(w.total_coins_earned - w.total_coins_spent, 0),
           updated_at = NOW()
       FROM users u
       WHERE w.user_id = u.id
         AND u.tg_id = $1
       RETURNING w.id, w.user_id, w.coins_balance, w.total_coins_earned, w.total_coins_spent`,
      [tgId]
    );

    console.log('\n=== WALLET DESPUÉS ===');
    console.log(updateRes.rows[0]);
  } catch (err) {
    console.error('❌ Error reparando wallet:', err);
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
