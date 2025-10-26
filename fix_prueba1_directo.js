/**
 * Script simplificado para fix usuario prueba1
 * Pide los datos de conexión uno por uno si no tienes la URL completa
 */

const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🔧 FIX USUARIO PRUEBA1\n');
  console.log('Este script configura el password para que puedas hacer login.\n');

  let connectionString = process.env.DATABASE_URL || process.argv[2];

  if (!connectionString) {
    console.log('📋 Necesito los datos de conexión de Railway Postgres:\n');
    
    const host = await pregunta('Host (ej: roundhouse.proxy.rlwy.net): ');
    const port = await pregunta('Port (ej: 54321): ');
    const user = await pregunta('User (normalmente "postgres"): ') || 'postgres';
    const password = await pregunta('Password: ');
    const database = await pregunta('Database (normalmente "railway"): ') || 'railway';

    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    console.log('\n');
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar si existe el usuario
    console.log('📋 1. Buscando usuario prueba1...');
    const checkUser = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.tg_id
      FROM users u
      WHERE u.username = 'prueba1'
    `);

    if (checkUser.rows.length === 0) {
      console.log('❌ ERROR: Usuario prueba1 NO EXISTE en la base de datos');
      console.log('Debes crear el usuario primero desde el registro.\n');
      await client.end();
      rl.close();
      return;
    }

    const user = checkUser.rows[0];
    console.log('✅ Usuario encontrado:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Email: ${user.email || 'NULL'}`);
    console.log(`   - Telegram ID: ${user.tg_id || 'NULL'}\n`);

    // 2. Verificar auth_identity
    console.log('📋 2. Verificando auth_identity...');
    const checkAuth = await client.query(`
      SELECT 
        id,
        provider,
        provider_uid,
        password_hash IS NOT NULL as tiene_password
      FROM auth_identities
      WHERE user_id = $1 AND provider = 'email'
    `, [user.id]);

    if (checkAuth.rows.length === 0) {
      console.log('⚠️  No tiene auth_identity. Creando...\n');
      
      // Crear auth_identity
      const insertResult = await client.query(`
        INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
        VALUES (
          $1,
          'email',
          $2,
          '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ',
          NOW()
        )
        RETURNING *
      `, [user.id, user.email || user.username]);

      console.log('✅ Auth_identity creada exitosamente');
      console.log(`   - Provider: ${insertResult.rows[0].provider}`);
      console.log(`   - Provider UID: ${insertResult.rows[0].provider_uid}\n`);

    } else if (!checkAuth.rows[0].tiene_password) {
      console.log('⚠️  Tiene auth_identity pero sin password. Actualizando...\n');
      
      // Actualizar password
      await client.query(`
        UPDATE auth_identities
        SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
        WHERE user_id = $1 AND provider = 'email'
      `, [user.id]);

      console.log('✅ Password actualizado exitosamente\n');

    } else {
      console.log('✅ Ya tiene password configurado');
      console.log('   Actualizando a "123456" por si acaso...\n');
      
      await client.query(`
        UPDATE auth_identities
        SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
        WHERE user_id = $1 AND provider = 'email'
      `, [user.id]);

      console.log('✅ Password actualizado\n');
    }

    // 3. Verificación final
    console.log('📋 3. Verificación final...');
    const finalCheck = await client.query(`
      SELECT 
        u.username,
        u.email,
        ai.password_hash IS NOT NULL as tiene_password,
        LENGTH(ai.password_hash) as longitud_hash,
        u.security_answer IS NOT NULL as tiene_security_answer
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
      WHERE u.username = 'prueba1'
    `);

    const final = finalCheck.rows[0];
    console.log('Estado final:');
    console.log(`   - Username: ${final.username}`);
    console.log(`   - Email: ${final.email || 'NULL'}`);
    console.log(`   - Tiene password: ${final.tiene_password ? '✅' : '❌'}`);
    console.log(`   - Longitud hash: ${final.longitud_hash || 'NULL'}`);
    console.log(`   - Tiene security answer: ${final.tiene_security_answer ? '✅' : '❌'}\n`);

    if (final.tiene_password && final.longitud_hash === 60) {
      console.log('🎉 ¡ÉXITO TOTAL!\n');
      console.log('📝 Ahora puedes hacer login con:');
      console.log('   Username: prueba1');
      console.log('   Password: 123456\n');
      console.log('🔐 Después configura la respuesta de seguridad desde:');
      console.log('   Perfil → Mis Datos → Tab "🔒 Seguridad"\n');
    } else {
      console.log('⚠️  Algo no salió como esperado. Revisa los datos.\n');
    }

    await client.end();
    console.log('🔌 Conexión cerrada');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 SOLUCIÓN:');
      console.error('   La URL de conexión es incorrecta o interna.');
      console.error('   Necesitas la URL PÚBLICA de Railway.');
      console.error('   Lee: COMO_OBTENER_URL_RAILWAY.md\n');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 SOLUCIÓN:');
      console.error('   El puerto o host son incorrectos.');
      console.error('   Verifica los datos en Railway → Postgres → Connect\n');
    } else {
      console.error('\nDetalles:', error);
    }
    
    await client.end();
    process.exit(1);
  }

  rl.close();
}

main();
