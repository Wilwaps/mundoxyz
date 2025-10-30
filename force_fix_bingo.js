/**
 * Script para FORZAR la actualización de la función de Bingo
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

const CORRECT_FUNCTION = `
DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE;

CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    new_code VARCHAR(6) := '';
    i INTEGER;
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    room_exists BOOLEAN;
BEGIN
    LOOP
        new_code := '';
        FOR i IN 1..6 LOOP
            new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        -- Sin ambigüedad: new_code es variable local, code es columna
        SELECT EXISTS(
            SELECT 1 FROM bingo_rooms WHERE code = new_code
        ) INTO room_exists;
        
        IF NOT room_exists THEN
            RETURN new_code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
`;

async function forceFix() {
  console.log('🔨 FORZANDO actualización de función Bingo...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway\n');
    
    // 1. Eliminar función anterior
    console.log('1️⃣ Eliminando función anterior...');
    await client.query('DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE');
    console.log('✅ Función eliminada\n');
    
    // 2. Crear nueva función
    console.log('2️⃣ Creando función corregida...');
    await client.query(CORRECT_FUNCTION);
    console.log('✅ Función creada\n');
    
    // 3. Verificar
    console.log('3️⃣ Verificando función...');
    const verify = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (verify.rows.length > 0) {
      console.log('✅ Función existe');
      console.log('📄 Código fuente incluye "new_code":', verify.rows[0].prosrc.includes('new_code') ? '✅ SÍ' : '❌ NO');
    } else {
      console.log('❌ Función NO existe');
      return;
    }
    
    // 4. Probar 5 veces
    console.log('\n4️⃣ Probando generación de códigos...');
    let success = 0;
    let errors = 0;
    
    for (let i = 1; i <= 5; i++) {
      try {
        const result = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`   ✅ ${i}. Código: ${result.rows[0].code}`);
        success++;
      } catch (err) {
        console.log(`   ❌ ${i}. ERROR: ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\n📊 Resultado: ${success} éxitos, ${errors} errores`);
    
    if (errors === 0) {
      console.log('\n🎉 ¡FIX APLICADO EXITOSAMENTE!');
      console.log('\n📋 Próximos pasos:');
      console.log('   1. Ir a: https://confident-bravery-production-ce7b.up.railway.app/bingo/lobby');
      console.log('   2. Crear sala de Bingo');
      console.log('   3. Verificar que NO aparece error');
    } else {
      console.log('\n⚠️ Todavía hay errores. Revisar la función manualmente.');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await client.end();
  }
}

forceFix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
