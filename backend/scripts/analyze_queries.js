const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL or DATABASE_PUBLIC_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function runExplain(label, sql) {
  console.log(`\n=== ${label} ===`);
  try {
    const { rows } = await pool.query(sql);
    rows.forEach((row) => {
      const plan = row['QUERY PLAN'];
      if (plan) {
        console.log(plan);
      }
    });
  } catch (error) {
    console.error(`Error executing ${label}:`, error.message);
  }
}

async function main() {
  await runExplain(
    'raffles_by_host',
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT 
          r.*,
          u.username as host_username,
          COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
          COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
          rc.company_name,
          rc.brand_color as primary_color,
          rc.secondary_color,
          rc.logo_url,
          rc.logo_base64
     FROM raffles r
     JOIN users u ON r.host_id = u.id
     LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
     LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
     WHERE r.visibility = ANY(ARRAY['public','private','company'])
       AND r.host_id = '4c64bf14-0074-4fba-98d2-cd121948d01f'
     GROUP BY r.id, u.username, rc.company_name, rc.brand_color, rc.secondary_color, rc.logo_url, rc.logo_base64
     ORDER BY r.created_at DESC
     LIMIT 50 OFFSET 0;`
  );

  await runExplain(
    'store_by_slug',
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT id, name, slug, description, logo_url, cover_url,
            currency_config, settings, location, views_count
       FROM stores
       WHERE slug = 'divorare04';`
  );

  await runExplain(
    'products_by_store',
    `EXPLAIN (ANALYZE, BUFFERS)
     SELECT p.*
       FROM products p
       WHERE p.store_id = '7c5af3dd-b5bc-4e07-8c91-b9b77e8dd933'
         AND p.is_active = TRUE
         AND p.is_menu_item = TRUE
       ORDER BY p.name ASC;`
  );

  await pool.end();
}

main().catch((error) => {
  console.error('Unexpected error running analysis:', error);
  pool.end();
  process.exit(1);
});
