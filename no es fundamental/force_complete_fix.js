// Script para force complete fix - eliminar y recrear todo
const { Client } = require('pg');

console.log('==================================================');
console.log('🔥 FORCE COMPLETE FIX - BINGO FUNCTION');
console.log('==================================================\n');

const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function forceCompleteFix() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    console.log('🔥 Eliminando función completamente...\n');
    await client.query('DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE');
    console.log('✅ Función eliminada\n');
    
    console.log('🔥 Limpiando caché de PostgreSQL...\n');
    await client.query('DISCARD ALL');
    await client.query('RESET ALL');
    console.log('✅ Caché limpiada\n');
    
    console.log('🔥 Recreando función desde cero...\n');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
      RETURNS VARCHAR(6) AS $$
      DECLARE
          chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          room_code VARCHAR(6) := '';
          i INTEGER;
          max_attempts INTEGER := 100;
          attempt_count INTEGER := 0;
          room_exists BOOLEAN;
      BEGIN
          LOOP
              room_code := '';
              FOR i IN 1..6 LOOP
                  room_code := room_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
              END LOOP;
              
              -- Usar variable diferente para evitar ambigüedad
              SELECT EXISTS(SELECT 1 FROM bingo_rooms WHERE code = room_code) INTO room_exists;
              
              IF NOT room_exists THEN
                  RETURN room_code;
              END IF;
              
              attempt_count := attempt_count + 1;
              IF attempt_count >= max_attempts THEN
                  RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
              END IF;
          END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(createFunctionSQL);
    console.log('✅ Función recreada exitosamente\n');
    
    console.log('🔥 Verificando función final...\n');
    const verification = await client.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (verification.rows.length > 0) {
      console.log('✅ Función verificada:');
      console.log(verification.rows[0].prosrc);
    }
    
    console.log('\n🔥 Probando función directamente...\n');
    const testResult = await client.query('SELECT generate_unique_bingo_room_code() as test_code');
    console.log(`✅ Código generado: ${testResult.rows[0].test_code}`);
    
    console.log('\n==================================================');
    console.log('✅ FORCE COMPLETE FIX TERMINADO');
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
    if (error.detail) console.error('Detalle:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

forceCompleteFix();
