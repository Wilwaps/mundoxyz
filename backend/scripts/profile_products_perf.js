// Profile products query plan for store menu items
// Usage (PowerShell):
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/profile_products_perf.js

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
    // Ajusta el store_id si pruebas otra tienda
    const storeId = '7c5af3dd-b5bc-4e07-8c91-b9b77e8dd933';

    console.log('Running ANALYZE on products...');
    await client.query('ANALYZE products;');

    const explainSql = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
      SELECT p.*
      FROM products p
      WHERE p.store_id = $1
        AND p.is_active = TRUE
        AND p.is_menu_item = TRUE
      ORDER BY p.name ASC;
    `;

    console.log('\\n--- EXPLAIN ANALYZE products ---');
    const { rows } = await client.query(explainSql, [storeId]);
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
