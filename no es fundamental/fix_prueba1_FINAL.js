/**
 * FIX FINAL para usuario prueba1
 * Usa hashes REALES generados por bcryptjs
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('❌ Proporciona la URL de conexión:');
    console.log('node fix_prueba1_FINAL.js "postgresql://..."');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 FIX FINAL USUARIO PRUEBA1\n');
    console.log('🔌 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado\n');

    // 1. Generar hashes REALES
    console.log('🔐 Generando hashes con bcryptjs...');
    const passwordHash = await bcrypt.hash('123456', 10);
    const securityAnswerHash = await bcrypt.hash('copito', 10);
    console.log('✅ Hashes generados\n');

    // 2. Verificar usuario
    console.log('📋 Verificando usuario prueba1...');
    const userCheck = await client.query(`
      SELECT id, username, email FROM users WHERE username = 'prueba1'
    `);

    if (userCheck.rows.length === 0) {
      console.log('❌ Usuario prueba1 NO EXISTE\n');
      await client.end();
      return;
    }

    const user = userCheck.rows[0];
    console.log(`✅ Usuario encontrado: ${user.username} (${user.email})\n`);

    // 3. Actualizar/Crear auth_identity
    console.log('🔧 Configurando password...');
    const authCheck = await client.query(`
      SELECT id FROM auth_identities 
      WHERE user_id = $1 AND provider = 'email'
    `, [user.id]);

    if (authCheck.rows.length === 0) {
      // Crear
      await client.query(`
        INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
        VALUES ($1, 'email', $2, $3, NOW())
      `, [user.id, user.email || user.username, passwordHash]);
      console.log('✅ Auth_identity CREADA\n');
    } else {
      // Actualizar
      await client.query(`
        UPDATE auth_identities 
        SET password_hash = $1
        WHERE user_id = $2 AND provider = 'email'
      `, [passwordHash, user.id]);
      console.log('✅ Password ACTUALIZADO\n');
    }

    // 4. Actualizar security_answer
    console.log('🔧 Configurando security_answer...');
    await client.query(`
      UPDATE users 
      SET security_answer = $1 
      WHERE id = $2
    `, [securityAnswerHash, user.id]);
    console.log('✅ Security_answer ACTUALIZADA\n');

    // 5. Verificación final
    console.log('📋 Verificación final...');
    const finalCheck = await client.query(`
      SELECT 
        u.username,
        u.email,
        ai.password_hash IS NOT NULL as tiene_password,
        LENGTH(ai.password_hash) as longitud_password,
        u.security_answer IS NOT NULL as tiene_security_answer,
        LENGTH(u.security_answer) as longitud_security
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
      WHERE u.username = 'prueba1'
    `);

    const result = finalCheck.rows[0];
    console.log('Estado final:');
    console.log(`  Username: ${result.username}`);
    console.log(`  Email: ${result.email}`);
    console.log(`  Password: ${result.tiene_password ? '✅' : '❌'} (${result.longitud_password} chars)`);
    console.log(`  Security Answer: ${result.tiene_security_answer ? '✅' : '❌'} (${result.longitud_security} chars)`);
    
    // 6. Probar que el password funciona
    console.log('\n🧪 Probando password...');
    const passwordCheck = await client.query(`
      SELECT password_hash FROM auth_identities
      WHERE user_id = (SELECT id FROM users WHERE username = 'prueba1')
      AND provider = 'email'
    `);
    
    const isPasswordValid = await bcrypt.compare('123456', passwordCheck.rows[0].password_hash);
    console.log(`Bcrypt compare("123456", hash): ${isPasswordValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);

    // 7. Probar security_answer
    console.log('🧪 Probando security_answer...');
    const securityCheck = await client.query(`
      SELECT security_answer FROM users WHERE username = 'prueba1'
    `);
    
    const isSecurityValid = await bcrypt.compare('copito', securityCheck.rows[0].security_answer);
    console.log(`Bcrypt compare("copito", hash): ${isSecurityValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);

    console.log('\n🎉 ¡CONFIGURACIÓN COMPLETA!\n');
    console.log('📝 Puedes hacer login con:');
    console.log('   Username: prueba1');
    console.log('   Password: 123456\n');
    console.log('🔐 Y resetear clave con:');
    console.log('   Email: ' + result.email);
    console.log('   Respuesta: copito\n');

    await client.end();
    console.log('🔌 Conexión cerrada');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

main();
