'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSqlFile(client, filename) {
  const sqlPath = path.resolve(__dirname, '../db/migrations', filename);

  if (!fs.existsSync(sqlPath)) {
    console.error('❌ No se encontró el archivo de migración:', sqlPath);
    throw new Error('Migration file not found: ' + filename);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`⏳ Ejecutando migración ${filename}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✅ Migración ${filename} aplicada correctamente.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`❌ Error al ejecutar la migración ${filename}:`, error.message || error);
    throw error;
  }
}

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING;

  if (!connectionString) {
    console.error('❌ No se encontró cadena de conexión. Configura DATABASE_PUBLIC_URL o DATABASE_URL o PG_CONNECTION_STRING.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos para migraciones USDT...');

  try {
    await client.connect();
    console.log('✅ Conectado.');

    const files = [
      '052_alter_fire_requests_add_usdt_columns.sql',
      '053_alter_market_redeems_add_usdt_columns.sql',
      '054_alter_fiat_operational_config_add_usdt_settings.sql'
    ];

    for (const file of files) {
      await runSqlFile(client, file);
    }

    console.log('🎉 Todas las migraciones USDT aplicadas correctamente.');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones USDT:', error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    console.log('🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado ejecutando run_migration_052_053_054_usdt_economy:', err);
  process.exit(1);
});
