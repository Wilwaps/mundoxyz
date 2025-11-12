/**
 * Script para ejecutar migración 044: Modos de Sorteo
 * 
 * Agrega:
 * - draw_mode (automatic, scheduled, manual)
 * - scheduled_draw_at (fecha programada)
 * - Índice para búsqueda eficiente
 * - Constraint para validar fecha requerida
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de conexión a Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Conectado a PostgreSQL en Railway');
    console.log('📂 Ejecutando migración 044...\n');
    
    // Leer archivo de migración
    const migrationPath = path.join(__dirname, '../backend/db/migrations/044_raffle_draw_modes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Ejecutar migración
    await client.query(migrationSQL);
    
    console.log('✅ Migración 044 ejecutada exitosamente\n');
    
    // Verificar columnas agregadas
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'raffles' 
        AND column_name IN ('draw_mode', 'scheduled_draw_at')
      ORDER BY column_name;
    `);
    
    console.log('📋 Columnas agregadas:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) DEFAULT ${row.column_default || 'NULL'}`);
    });
    
    // Verificar índice
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'raffles'
        AND indexname = 'idx_raffles_scheduled_draw';
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('\n📊 Índice creado:');
      console.log(`  - ${indexResult.rows[0].indexname}`);
    }
    
    // Verificar constraint
    const constraintResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'check_scheduled_draw_date'
        AND conrelid = 'raffles'::regclass;
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('\n🔒 Constraint creado:');
      console.log(`  - ${constraintResult.rows[0].conname}`);
    }
    
    // Actualizar rifas existentes
    const updateResult = await client.query(`
      UPDATE raffles
      SET draw_mode = 'automatic'
      WHERE draw_mode IS NULL
      RETURNING id;
    `);
    
    if (updateResult.rowCount > 0) {
      console.log(`\n🔄 ${updateResult.rowCount} rifas existentes actualizadas con modo 'automatic'`);
    }
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
runMigration()
  .then(() => {
    console.log('\n✅ Script finalizado correctamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script finalizado con errores:', error);
    process.exit(1);
  });
