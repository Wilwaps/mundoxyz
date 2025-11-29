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

  const migrationFiles = [
    '055_create_tito_system.sql',
    '056_add_tito_role.sql',
    '057_add_tito_global_amount.sql'
  ];

  const client = new Client({ connectionString });

  console.log('⏳ Conectando a la base de datos...');

  try {
    await client.connect();
    console.log('✅ Conectado. Ejecutando migraciones Tito (055, 056, 057)...');

    for (const file of migrationFiles) {
      const sqlPath = path.resolve(__dirname, '../db/migrations', file);
      if (!fs.existsSync(sqlPath)) {
        console.error('❌ No se encontró el archivo de migración:', sqlPath);
        process.exitCode = 1;
        return;
      }

      console.log(`➡️ Ejecutando ${file}...`);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log(`✅ Migración ${file} aplicada.`);
    }

    console.log('🎯 Sistema Tito (tokens y comisiones) actualizado correctamente.');
  } catch (error) {
    console.error('❌ Error al ejecutar las migraciones Tito:', error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    console.log('🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado ejecutando las migraciones Tito:', err);
  process.exit(1);
});
