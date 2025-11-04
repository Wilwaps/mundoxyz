const { Client } = require('pg');

async function verificarPasswordUsuario() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar usuario prueba1
    const userQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        ai.password_hash AS auth_identities_password_hash,
        ai.provider AS auth_provider
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id
      WHERE u.username = 'prueba1' OR u.id = '208d5eab-d6ce-4b56-9f18-f34bfdb29381'
    `;

    const result = await client.query(userQuery);

    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('📊 DATOS DEL USUARIO:');
    console.log('─'.repeat(60));
    
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Username: ${row.username}`);
      console.log(`Email: ${row.email}`);
      console.log(`\n🔑 CONTRASEÑAS:`);
      console.log(`auth_identities.password_hash: ${row.auth_identities_password_hash ? '✅ EXISTE (longitud: ' + row.auth_identities_password_hash.length + ')' : '❌ NULL'}`);
      console.log(`auth_identities.provider: ${row.auth_provider || 'N/A'}`);
      console.log('─'.repeat(60));
    });

    // Si tiene password, intentar verificar con bcrypt
    const testPassword = '123456';
    const bcrypt = require('bcryptjs');

    for (const row of result.rows) {
      const storedHash = row.auth_identities_password_hash;
      
      if (storedHash) {
        console.log(`\n🔐 VERIFICANDO PASSWORD "${testPassword}":`);
        try {
          const isValid = await bcrypt.compare(testPassword, storedHash);
          console.log(`Resultado: ${isValid ? '✅ CONTRASEÑA CORRECTA' : '❌ CONTRASEÑA INCORRECTA'}`);
          
          if (!isValid) {
            // Probar con otras contraseñas comunes
            const commonPasswords = ['123456789', 'password', 'admin', 'prueba1'];
            console.log('\n🔍 Probando otras contraseñas comunes...');
            for (const pwd of commonPasswords) {
              const valid = await bcrypt.compare(pwd, storedHash);
              if (valid) {
                console.log(`✅ Contraseña encontrada: "${pwd}"`);
                break;
              }
            }
          }
        } catch (error) {
          console.log(`❌ Error al verificar: ${error.message}`);
        }
      } else {
        console.log('\n⚠️  NO HAY CONTRASEÑA ALMACENADA EN LA BASE DE DATOS');
        console.log('   El usuario necesita establecer una contraseña primero.');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

// Ejecutar
if (!process.argv[2]) {
  console.log('❌ Falta la URL de conexión');
  console.log('Uso: node verificar_password_usuario.js "postgresql://..."');
  process.exit(1);
}

verificarPasswordUsuario();
