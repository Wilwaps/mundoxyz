// Script para ejecutar fix de función bingo en Railway PostgreSQL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de conexión
const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

// Leer archivo SQL
const sqlFile = path.join(__dirname, 'fix_bingo_function.sql');

console.log('==================================================');
console.log('🚀 EJECUTANDO FIX FUNCIÓN BINGO EN RAILWAY');
console.log('==================================================\n');

if (!fs.existsSync(sqlFile)) {
  console.error('❌ ERROR: No se encuentra el archivo fix_bingo_function.sql');
  process.exit(1);
}

console.log('✓ Archivo SQL encontrado');

const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('✓ Contenido SQL cargado');
console.log('✓ Conectando a Railway PostgreSQL...\n');

// Crear cliente PostgreSQL
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runFix() {
  try {
    // Conectar
    await client.connect();
    console.log('✅ Conectado exitosamente a Railway PostgreSQL\n');
    
    console.log('📊 Ejecutando fix de función...\n');
    
    // Ejecutar el SQL completo
    const result = await client.query(sqlContent);
    
    console.log('✅ Fix ejecutado exitosamente!\n');
    
    // Verificar que la función se actualizó
    console.log('🔍 Verificando función actualizada...\n');
    const verification = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code';
    `);
    
    if (verification.rows.length > 0) {
      console.log('✅ Función actualizada correctamente:');
      console.log(`   - ${verification.rows[0].proname}`);
    } else {
      console.log('❌ Función no encontrada después del update');
    }
    
    console.log('\n==================================================');
    console.log('✅ FIX COMPLETADO EXITOSAMENTE');
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar fix:');
    console.error(error.message);
    
    if (error.detail) {
      console.error('\nDetalle:', error.detail);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Ejecutar
runFix();
