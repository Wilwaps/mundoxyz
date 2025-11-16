const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('Please set DATABASE_PUBLIC_URL or DATABASE_URL env var');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('=== Aggregated balances from wallets ===');
    const aggRes = await pool.query(`
      SELECT 
        COUNT(*) as wallets_count,
        COALESCE(SUM(coins_balance), 0) as total_coins_circulation,
        COALESCE(SUM(fires_balance), 0) as total_fires_circulation,
        COALESCE(AVG(coins_balance), 0) as avg_coins_balance,
        COALESCE(AVG(fires_balance), 0) as avg_fires_balance
      FROM wallets
    `);
    console.log(JSON.stringify(aggRes.rows[0], null, 2));

    console.log('\n=== Sample wallets ordered by coins_balance DESC (top 20) ===');
    const sampleRes = await pool.query(`
      SELECT user_id, coins_balance, fires_balance
      FROM wallets
      ORDER BY coins_balance DESC
      LIMIT 20
    `);
    for (const row of sampleRes.rows) {
      console.log(JSON.stringify(row));
    }

    console.log('\n=== Wallets with coins_balance <> 0 (up to 20) ===');
    const nonzeroRes = await pool.query(`
      SELECT user_id, coins_balance, fires_balance
      FROM wallets
      WHERE coins_balance <> 0
      LIMIT 20
    `);
    for (const row of nonzeroRes.rows) {
      console.log(JSON.stringify(row));
    }
  } catch (err) {
    console.error('Error checking wallets economy:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
