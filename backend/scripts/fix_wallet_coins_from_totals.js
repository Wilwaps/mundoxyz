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

  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos para reparar wallets con coins_balance NaN/null...');

  try {
    await client.connect();

    const before = await client.query(`
      SELECT 
        COUNT(*) AS total_wallets,
        COUNT(*) FILTER (WHERE coins_balance::text = 'NaN') AS nan_coins,
        COUNT(*) FILTER (WHERE coins_balance IS NULL) AS null_coins
      FROM wallets
    `);

    console.log('\n=== RESUMEN ANTES ===');
    console.table(before.rows);

    const updateRes = await client.query(`
      UPDATE wallets w
      SET coins_balance = GREATEST(
            COALESCE(w.total_coins_earned, 0) - COALESCE(w.total_coins_spent, 0),
            0
          ),
          updated_at = NOW()
      WHERE w.coins_balance::text = 'NaN'
         OR w.coins_balance IS NULL
      RETURNING w.id, w.user_id, w.coins_balance, w.total_coins_earned, w.total_coins_spent
    `);

    console.log('\n✅ Wallets actualizados:', updateRes.rowCount);
    if (updateRes.rowCount > 0) {
      console.log('\nEjemplo de filas reparadas (máx 10):');
      console.table(updateRes.rows.slice(0, 10));
    }

    const after = await client.query(`
      SELECT 
        COUNT(*) AS total_wallets,
        COUNT(*) FILTER (WHERE coins_balance::text = 'NaN') AS nan_coins,
        COUNT(*) FILTER (WHERE coins_balance IS NULL) AS null_coins
      FROM wallets
    `);

    console.log('\n=== RESUMEN DESPUÉS ===');
    console.table(after.rows);
  } catch (err) {
    console.error('❌ Error reparando wallets:', err);
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
