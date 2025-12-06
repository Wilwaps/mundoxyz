// Run EXPLAIN ANALYZE for store by slug and products by store_id.
// Usage:
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/profile_store_products_explain.js
const { Pool } = require('pg');

const conn =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  (process.env.PGUSER &&
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);

if (!conn) {
  throw new Error('No DB connection string found in env');
}

const pool = new Pool({ connectionString: conn });

async function run() {
  const client = await pool.connect();
  try {
    const q1 = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT id, name, slug, description, logo_url, cover_url,
             currency_config, settings, location, views_count
      FROM stores
      WHERE slug = 'divorare04';
    `;

    const q2 = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT p.*
      FROM products p
      WHERE p.store_id = '7c5af3dd-b5bc-4e07-8c91-b9b77e8dd933'
        AND p.is_active = TRUE
        AND p.is_menu_item = TRUE
      ORDER BY p.name ASC;
    `;

    for (const sql of [q1, q2]) {
      const { rows } = await client.query(sql);
      console.log('\n--- PLAN ---');
      rows.forEach((r) => console.log(r['QUERY PLAN']));
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
