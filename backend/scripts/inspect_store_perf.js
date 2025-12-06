// Quick diagnostics: activity, sizes, indexes.
// Usage:
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/inspect_store_perf.js
const { Pool } = require('pg');

const conn =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  (process.env.PGUSER &&
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);

if (!conn) throw new Error('No DB URL in env');

const pool = new Pool({ connectionString: conn });

async function run() {
  const client = await pool.connect();
  try {
    const queries = [
      {
        label: 'activity',
        sql: `
          SELECT pid, state, wait_event_type, wait_event, query_start, backend_start, query
          FROM pg_stat_activity
          WHERE state <> 'idle'
          ORDER BY query_start DESC
          LIMIT 20;
        `
      },
      {
        label: 'sizes',
        sql: `
          SELECT relname,
                 pg_size_pretty(pg_relation_size(relid)) AS rel_size,
                 seq_scan,
                 idx_scan
          FROM pg_stat_all_tables
          WHERE relname IN ('stores', 'products');
        `
      },
      {
        label: 'product_indexes',
        sql: `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = 'products' AND indexname LIKE 'idx_products%';
        `
      }
    ];

    for (const { label, sql } of queries) {
      const { rows } = await client.query(sql);
      console.log(`\n--- ${label} ---`);
      console.table(rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
