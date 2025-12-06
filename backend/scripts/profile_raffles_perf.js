// Script to profile raffles query plans
// Usage: node backend/scripts/profile_raffles_perf.js
// Requires: env DATABASE_URL or DATABASE_PUBLIC_URL

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
    // Optional: disable seq scan to inspect index usage
    // await client.query('SET enable_seqscan = off;');

    console.log('Running ANALYZE...');
    await client.query('ANALYZE raffles;');
    await client.query('ANALYZE raffle_companies;');
    await client.query('ANALYZE raffle_numbers;');

    const explainSql = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT r.*
      FROM raffles r
      WHERE r.status = ANY(ARRAY['active','pending'])
        AND r.visibility = ANY(ARRAY['public','company'])
      ORDER BY r.created_at DESC
      LIMIT 20 OFFSET 0;
    `;

    console.log('\n--- EXPLAIN ANALYZE raffles ---');
    const { rows } = await client.query(explainSql);
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
