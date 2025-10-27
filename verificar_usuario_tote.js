const { Client } = require('pg');

async function verificarUsuarioTote() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Buscar usuario Tote
    const userQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.tg_id,
        u.created_at
      FROM users u
      WHERE LOWER(u.username) = 'tote' OR u.tg_id::text = '7734154282'
      LIMIT 1
    `;

    const userResult = await client.query(userQuery);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuario Tote no encontrado');
      return;
    }

    const toteUser = userResult.rows[0];
    console.log('📊 USUARIO TOTE:');
    console.log('─'.repeat(60));
    console.log(`ID: ${toteUser.id}`);
    console.log(`Username: ${toteUser.username}`);
    console.log(`Email: ${toteUser.email}`);
    console.log(`Telegram ID: ${toteUser.tg_id}`);
    console.log(`Creado: ${toteUser.created_at}`);
    console.log('─'.repeat(60));

    // Verificar auth_identities
    const authQuery = `
      SELECT 
        ai.id,
        ai.provider,
        ai.password_hash,
        LENGTH(ai.password_hash) AS hash_length,
        ai.created_at
      FROM auth_identities ai
      WHERE ai.user_id = $1
      ORDER BY ai.created_at DESC
    `;

    const authResult = await client.query(authQuery, [toteUser.id]);

    console.log('\n🔑 AUTH_IDENTITIES:');
    console.log('─'.repeat(60));
    
    if (authResult.rows.length === 0) {
      console.log('❌ NO HAY REGISTROS EN auth_identities');
      console.log('   El usuario NO PUEDE usar contraseña (solo Telegram)');
    } else {
      authResult.rows.forEach((auth, idx) => {
        console.log(`\n[${idx + 1}] Provider: ${auth.provider}`);
        console.log(`    Password Hash: ${auth.password_hash ? '✅ EXISTE (longitud: ' + auth.hash_length + ')' : '❌ NULL'}`);
        console.log(`    Creado: ${auth.created_at}`);
      });
    }
    console.log('─'.repeat(60));

    // Verificar roles
    const rolesQuery = `
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `;

    const rolesResult = await client.query(rolesQuery, [toteUser.id]);

    console.log('\n👑 ROLES:');
    console.log('─'.repeat(60));
    
    if (rolesResult.rows.length === 0) {
      console.log('❌ NO HAY ROLES ASIGNADOS');
    } else {
      rolesResult.rows.forEach(role => {
        console.log(`✅ ${role.name}`);
      });
    }
    console.log('─'.repeat(60));

    // Verificar wallet
    const walletQuery = `
      SELECT 
        w.id,
        w.coins_balance,
        w.fires_balance
      FROM wallets w
      WHERE w.user_id = $1
    `;

    const walletResult = await client.query(walletQuery, [toteUser.id]);

    console.log('\n💰 WALLET:');
    console.log('─'.repeat(60));
    
    if (walletResult.rows.length === 0) {
      console.log('❌ NO HAY WALLET');
    } else {
      const wallet = walletResult.rows[0];
      console.log(`Wallet ID: ${wallet.id}`);
      console.log(`Coins: ${wallet.coins_balance}`);
      console.log(`Fires: ${wallet.fires_balance}`);
    }
    console.log('─'.repeat(60));

    // Si tiene password, verificar con bcrypt
    const emailAuth = authResult.rows.find(a => a.provider === 'email');
    
    if (emailAuth && emailAuth.password_hash) {
      console.log('\n🔐 VERIFICANDO CONTRASEÑA "123456":');
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare('123456', emailAuth.password_hash);
      console.log(`Resultado: ${isValid ? '✅ CONTRASEÑA CORRECTA' : '❌ CONTRASEÑA INCORRECTA'}`);
    } else {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
      console.log('   El usuario Tote NO tiene auth_identities con provider="email"');
      console.log('   Por lo tanto, NO PUEDE usar contraseña para transacciones críticas');
      console.log('\n💡 SOLUCIÓN:');
      console.log('   1. Ir a "Cambiar Contraseña" en el perfil de Tote');
      console.log('   2. Establecer una contraseña nueva');
      console.log('   3. Esto creará el registro en auth_identities');
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
  console.log('Uso: node verificar_usuario_tote.js "postgresql://..."');
  process.exit(1);
}

verificarUsuarioTote();
