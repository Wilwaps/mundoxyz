/**
 * Script para verificar la función de Bingo en Railway
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

async function verifyFunction() {
  console.log('🔍 Verificando función generate_unique_bingo_room_code en Railway...\n');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Verificar que la función existe
    console.log('1️⃣ Verificando existencia de la función...');
    const funcExists = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    if (funcExists.rows.length === 0) {
      console.log('❌ La función NO existe en la base de datos');
      return;
    }
    
    console.log('✅ Función existe:', funcExists.rows[0].proname);
    console.log('📄 Código fuente (primeros 200 caracteres):');
    console.log(funcExists.rows[0].prosrc.substring(0, 200) + '...\n');
    
    // 2. Ver definición completa
    console.log('2️⃣ Obteniendo definición completa...');
    const funcDef = await client.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'generate_unique_bingo_room_code'
    `);
    
    console.log('📋 Definición completa:');
    console.log('─'.repeat(80));
    console.log(funcDef.rows[0].definition);
    console.log('─'.repeat(80) + '\n');
    
    // 3. Probar la función 5 veces
    console.log('3️⃣ Probando generación de códigos (5 intentos)...');
    for (let i = 1; i <= 5; i++) {
      try {
        const result = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`   ✅ ${i}. Código generado: ${result.rows[0].code}`);
      } catch (err) {
        console.log(`   ❌ ${i}. ERROR: ${err.message}`);
      }
    }
    
    // 4. Verificar si hay códigos en la tabla
    console.log('\n4️⃣ Códigos existentes en bingo_rooms...');
    const existingCodes = await client.query(`
      SELECT code, created_at 
      FROM bingo_rooms 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (existingCodes.rows.length === 0) {
      console.log('   ℹ️  No hay salas creadas aún');
    } else {
      console.log(`   📊 ${existingCodes.rows.length} salas encontradas:`);
      existingCodes.rows.forEach((room, idx) => {
        console.log(`   ${idx + 1}. ${room.code} (${room.created_at})`);
      });
    }
    
    console.log('\n✅ Verificación completa');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) console.error('   Código:', error.code);
    if (error.detail) console.error('   Detalle:', error.detail);
    console.error('\n   Stack:', error.stack);
  } finally {
    await client.end();
  }
}

verifyFunction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
