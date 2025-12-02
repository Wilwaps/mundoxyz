const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function main() {
  console.log('Ensuring suppliers.tax_id column exists...');

  try {
    await pool.query(
      `ALTER TABLE suppliers
       ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50)`
    );

    const check = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'suppliers' AND column_name = 'tax_id'`
    );

    if (check.rowCount > 0) {
      console.log('✅ Column suppliers.tax_id is present:', check.rows[0]);
    } else {
      console.log('⚠️ Column suppliers.tax_id was not found after ALTER TABLE.');
    }
  } catch (err) {
    console.error('❌ Error while ensuring suppliers.tax_id:', err);
  } finally {
    await pool.end();
  }
}

main();
