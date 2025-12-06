// Profile \"mis rifas\" (host-specific) query plan
// Usage (PowerShell):
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/profile_my_raffles_perf.js

const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
if (!connStr) {
  console.error('Missing DATABASE_URL or DATABASE_PUBLIC_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: connStr });

async function main() {
  const client = await pool.connect();
  try {
    const hostId = '4c64bf14-0074-4fba-98d2-cd121948d01f';

    console.log('Running ANALYZE on raffles and raffle_companies...');
    await client.query('ANALYZE raffles;');
    await client.query('ANALYZE raffle_companies;');

    const explainSql = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT r.*
      FROM raffles r
      WHERE r.visibility = ANY(ARRAY['public','private','company'])
        AND r.host_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50 OFFSET 0;
    `;

    console.log('\\n--- EXPLAIN ANALYZE my raffles ---');
    const { rows } = await client.query(explainSql, [hostId]);
    rows.forEach(r => console.log(r['QUERY PLAN']));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
