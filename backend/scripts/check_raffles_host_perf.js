// Check raffles indexes and explain plan for "mis rifas" query.
// Usage:
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/check_raffles_host_perf.js
const { Pool } = require('pg');

const HOST_ID = '4c64bf14-0074-4fba-98d2-cd121948d01f';

const conn =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  (process.env.PGUSER &&
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);

if (!conn) {
  throw new Error('No DB URL in env');
}

const pool = new Pool({ connectionString: conn });

async function run() {
  const client = await pool.connect();
  try {
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'raffles' AND indexname LIKE 'idx_raffles_host%';
    `);
    console.log('\n--- raffles indexes ---');
    console.table(idxRes.rows);

    const explainSql = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT r.*
      FROM raffles r
      JOIN users u ON r.host_id = u.id
      LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
      WHERE r.visibility = ANY(ARRAY['public','private','company'])
        AND r.host_id = '${HOST_ID}'
      ORDER BY r.created_at DESC
      LIMIT 50 OFFSET 0;
    `;
    const plan = await client.query(explainSql);
    console.log('\n--- plan ---');
    plan.rows.forEach((r) => console.log(r['QUERY PLAN']));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
