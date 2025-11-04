/**
 * Script para inicializar base de datos en Railway desde cero
 * Ejecuta los schemas completos en orden
 * Uso: node backend/db/setup-railway-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// URL pública de Railway
const DATABASE_PUBLIC_URL = process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

console.log('🚀 Inicializando base de datos en Railway...\n');

const pool = new Pool({
  connectionString: DATABASE_PUBLIC_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeSQLFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`📝 Ejecutando: ${fileName}...`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`✅ ${fileName} completado\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error en ${fileName}:`);
    console.error(`   ${error.message}\n`);
    return false;
  }
}

async function main() {
  try {
    // Test connection
    console.log('🔌 Conectando a Railway PostgreSQL...');
    const testResult = await pool.query('SELECT NOW()');
    console.log(`✅ Conectado exitosamente a ${testResult.rows[0].now}\n`);
    
    // Ejecutar scripts en orden
    const scripts = [
      path.join(__dirname, '000_COMPLETE_SCHEMA.sql'),
      path.join(__dirname, '000_COMPLETE_SCHEMA_PART2.sql')
    ];
    
    console.log('📦 Ejecutando scripts de schema...\n');
    
    for (const script of scripts) {
      if (!fs.existsSync(script)) {
        console.error(`❌ Archivo no encontrado: ${script}`);
        process.exit(1);
      }
      
      const success = await executeSQLFile(script);
      if (!success) {
        console.error('❌ Falló la ejecución de scripts. Abortando.');
        process.exit(1);
      }
    }
    
    // Registrar migración 000 como ejecutada
    console.log('📝 Registrando migraciones iniciales...');
    await pool.query(`
      INSERT INTO migrations (filename) 
      VALUES ('000_COMPLETE_SCHEMA.sql'), ('000_COMPLETE_SCHEMA_PART2.sql')
      ON CONFLICT (filename) DO NOTHING
    `);
    console.log('✅ Migraciones registradas\n');
    
    // Verificar tablas creadas
    console.log('🔍 Verificando tablas creadas...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`\n✅ ${tablesResult.rows.length} tablas creadas:\n`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n🎉 ¡Base de datos inicializada correctamente!');
    console.log('✅ Todas las tablas están listas\n');
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
