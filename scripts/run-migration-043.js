/**
 * Script para ejecutar migración 043 en Railway
 * Uso: node scripts/run-migration-043.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// URL de Railway desde variable de entorno o hardcoded
const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || 
  'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado exitosamente\n');

    // Leer archivo de migración
    const migrationPath = path.join(__dirname, '..', 'backend', 'db', 'migrations', '043_raffles_complete_features.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando migración 043...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Ejecutar migración
    const result = await client.query(migrationSQL);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Migración 043 ejecutada exitosamente!\n');

    // Verificar columnas creadas
    console.log('🔍 Verificando columnas creadas...\n');

    const verifyQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name IN ('raffles', 'raffle_companies', 'raffle_requests')
        AND column_name IN ('allow_fires_payment', 'prize_image_base64', 'logo_base64', 'payment_proof_base64')
      ORDER BY table_name, column_name;
    `;

    const verifyResult = await client.query(verifyQuery);
    
    console.table(verifyResult.rows);

    // Verificar índices creados
    console.log('\n🔍 Verificando índices creados...\n');

    const indexQuery = `
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('raffles', 'raffle_requests')
        AND indexname LIKE 'idx_%allow_fires%' OR indexname LIKE 'idx_raffle_requests_status'
      ORDER BY tablename, indexname;
    `;

    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.table(indexResult.rows);
    } else {
      console.log('⚠️  No se encontraron los índices esperados');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 MIGRACIÓN 043 COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Resumen
    console.log('📊 RESUMEN:');
    console.log(`   ✅ Columnas agregadas: ${verifyResult.rows.length}/4`);
    console.log(`   ✅ Índices creados: ${indexResult.rows.length}`);
    console.log('\n✨ El sistema de rifas ahora soporta:');
    console.log('   • Pago con fuegos en modo PRIZE (toggle)');
    console.log('   • Imágenes de premio en base64');
    console.log('   • Logos de empresa en base64');
    console.log('   • Comprobantes de pago en base64\n');

  } catch (error) {
    console.error('\n❌ ERROR ejecutando migración:', error.message);
    console.error('\nDetalles completos:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar
console.log('╔═══════════════════════════════════════════╗');
console.log('║   MIGRACIÓN 043: RIFAS V2 COMPLETO      ║');
console.log('╚═══════════════════════════════════════════╝\n');

runMigration()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error.message);
    process.exit(1);
  });
