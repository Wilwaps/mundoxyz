/**
 * FIX REAL - Esta vez de verdad
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function fixReal() {
  console.log('🔨 APLICANDO FIX REAL A LA FUNCIÓN BINGO\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado\n');
    
    // Paso 1: Eliminar COMPLETAMENTE la función anterior
    console.log('1️⃣ Eliminando función anterior...');
    await client.query('DROP FUNCTION IF EXISTS public.generate_unique_bingo_room_code() CASCADE');
    console.log('✅ Función eliminada\n');
    
    // Paso 2: Crear la nueva función CON new_code
    console.log('2️⃣ Creando función corregida...');
    
    const newFunction = `
CREATE OR REPLACE FUNCTION public.generate_unique_bingo_room_code()
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
    
    await client.query(newFunction);
    console.log('✅ Función creada\n');
    
    // Paso 3: VERIFICAR que la nueva función tiene new_code
    console.log('3️⃣ VERIFICANDO que se aplicó correctamente...');
    const verify = await client.query(`
      SELECT pg_get_functiondef('public.generate_unique_bingo_room_code'::regproc) as def
    `);
    
    const definition = verify.rows[0].def;
    console.log('📋 Nueva definición:');
    console.log(definition);
    console.log();
    
    if (definition.includes('new_code')) {
      console.log('✅✅✅ CORRECTO: La función USA new_code');
    } else {
      console.log('❌❌❌ ERROR: La función AÚN USA code');
      console.log('⚠️  Algo salió mal, la función no se actualizó');
      return;
    }
    
    // Paso 4: Probar que funciona
    console.log('\n4️⃣ Probando generación de códigos...');
    let allSuccess = true;
    
    for (let i = 1; i <= 10; i++) {
      try {
        const result = await client.query('SELECT public.generate_unique_bingo_room_code() as code');
        console.log(`   ✅ ${i}. ${result.rows[0].code}`);
      } catch (err) {
        console.log(`   ❌ ${i}. ERROR: ${err.message}`);
        allSuccess = false;
      }
    }
    
    if (allSuccess) {
      console.log('\n🎉🎉🎉 FIX APLICADO CORRECTAMENTE');
      console.log('✅ 10 códigos generados sin errores');
      console.log('\n📋 AHORA SÍ puedes crear salas de Bingo sin problemas');
    } else {
      console.log('\n❌ Todavía hay errores - revisar manualmente');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

fixReal()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
