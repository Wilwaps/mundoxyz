const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL or DATABASE_PUBLIC_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running ANALYZE on store-related tables...');
    await client.query('ANALYZE stores');
    await client.query('ANALYZE products');
    await client.query('ANALYZE categories');
    await client.query('ANALYZE product_modifiers');
    await client.query('ANALYZE store_customers');
    console.log('✅ ANALYZE completed successfully.');
  } catch (error) {
    console.error('❌ Error running ANALYZE:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exitCode = 1;
});
