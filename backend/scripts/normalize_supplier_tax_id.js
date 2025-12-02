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
  console.log('Normalizando suppliers.tax_id (eliminando guiones "-")...');

  try {
    const before = await pool.query(
      `SELECT id, tax_id
       FROM suppliers
       WHERE tax_id IS NOT NULL AND tax_id LIKE '%-%'`
    );

    console.log(`Encontrados ${before.rowCount} proveedores con guiones en tax_id`);

    if (before.rowCount > 0) {
      await pool.query(
        `UPDATE suppliers
         SET tax_id = regexp_replace(tax_id, '-', '', 'g')
         WHERE tax_id IS NOT NULL AND tax_id LIKE '%-%'`
      );

      const after = await pool.query(
        `SELECT COUNT(*) AS remaining
         FROM suppliers
         WHERE tax_id IS NOT NULL AND tax_id LIKE '%-%'`
      );

      console.log('Proveedores que aún tienen guiones en tax_id:', after.rows[0].remaining);
    }

    console.log('✅ Normalización de tax_id completada');
  } catch (err) {
    console.error('❌ Error normalizando suppliers.tax_id:', err);
  } finally {
    await pool.end();
  }
}

main();
