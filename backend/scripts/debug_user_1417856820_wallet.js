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

  console.log('⏳ Conectando a la base de datos para inspeccionar usuario tg_id =', tgId);

  try {
    await client.connect();

    const userRes = await client.query(
      `SELECT id, username, tg_id, roles, created_at
       FROM users
       WHERE tg_id = $1`,
      [tgId]
    );

    if (userRes.rows.length === 0) {
      console.log('⚠️ No se encontró usuario con tg_id =', tgId);
      return;
    }

    for (const user of userRes.rows) {
      console.log('\n=== USUARIO ===');
      console.log(user);

      const walletRes = await client.query(
        `SELECT * FROM wallets WHERE user_id = $1`,
        [user.id]
      );

      console.log('\n=== WALLET ===');
      if (walletRes.rows.length === 0) {
        console.log('⚠️ No tiene wallet asociada');
      } else {
        console.log(walletRes.rows[0]);
      }

      const txAggRes = await client.query(
        `SELECT
           SUM(CASE WHEN wt.currency = 'coins' THEN wt.amount ELSE 0 END) AS coins_delta,
           SUM(CASE WHEN wt.currency = 'fires' THEN wt.amount ELSE 0 END) AS fires_delta,
           COUNT(*) AS tx_count
         FROM wallet_transactions wt
         JOIN wallets w ON w.id = wt.wallet_id
         WHERE w.user_id = $1`,
        [user.id]
      );

      console.log('\n=== TRANSACCIONES (AGREGADO) ===');
      console.log(txAggRes.rows[0]);

      const txRes = await client.query(
        `SELECT id, type, currency, amount, balance_before, balance_after, description, created_at
         FROM wallet_transactions wt
         JOIN wallets w ON w.id = wt.wallet_id
         WHERE w.user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [user.id]
      );

      console.log('\n=== ÚLTIMAS 20 TRANSACCIONES ===');
      console.table(txRes.rows);

      const rewardsRes = await client.query(
        `SELECT *
         FROM telegram_group_daily_rewards
         WHERE tg_id = $1
         ORDER BY activity_date DESC
         LIMIT 20`,
        [tgId]
      );

      console.log('\n=== TELEGRAM_GROUP_DAILY_REWARDS ===');
      console.table(rewardsRes.rows);
    }
  } catch (err) {
    console.error('❌ Error inspeccionando usuario:', err);
  } finally {
    await client.end().catch(() => {});
    console.log('\n🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
