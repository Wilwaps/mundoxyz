'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING;

  if (!connectionString) {
    console.error('❌ No se encontró cadena de conexión. Configura DATABASE_PUBLIC_URL o DATABASE_URL.');
    process.exit(1);
  }

  const sqlPath = path.resolve(__dirname, '../db/migrations/051_create_fiat_tables.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ No se encontró el archivo de migración:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos...');

  try {
    await client.connect();
    console.log('✅ Conectado. Ejecutando migración 051_create_fiat_tables.sql');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migración 051 aplicada correctamente.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignorar error de rollback
    }
    console.error('❌ Error al ejecutar la migración:', error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    console.log('🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado ejecutando la migración:', err);
  process.exit(1);
});
