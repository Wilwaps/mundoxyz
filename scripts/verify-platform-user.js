/**
 * Script para verificar/crear usuario plataforma
 * Usuario plataforma recibe comisiones del sistema
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || 
  'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

const PLATFORM_TG_ID = '1417856820';
const PLATFORM_USERNAME = 'mundoxyz_platform';

async function verifyPlatformUser() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Conectando a Railway PostgreSQL...\n');
    await client.connect();

    // Verificar si existe
    const checkQuery = `
      SELECT 
        u.id,
        u.tg_id,
        u.username,
        u.email,
        w.fires_balance,
        w.coins_balance,
        w.total_fires_earned,
        w.total_coins_earned
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.tg_id = $1
    `;

    const result = await client.query(checkQuery, [PLATFORM_TG_ID]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Usuario plataforma encontrado:\n');
      console.table([{
        'User ID': user.id,
        'Telegram ID': user.tg_id,
        'Username': user.username,
        'Email': user.email || 'N/A',
        'Fuegos': user.fires_balance || 0,
        'Monedas': user.coins_balance || 0,
        'Total Ganado (F)': user.total_fires_earned || 0,
        'Total Ganado (C)': user.total_coins_earned || 0
      }]);

      console.log('\n✨ El usuario plataforma está listo para recibir comisiones\n');
      return true;
    } else {
      console.log('⚠️  Usuario plataforma NO existe\n');
      console.log('📝 Para crear el usuario plataforma, ejecuta:');
      console.log('\n   1. Inicia sesión en Telegram con el bot');
      console.log('   2. Usa el bot para registrarte');
      console.log(`   3. Asegúrate de que tu Telegram ID sea: ${PLATFORM_TG_ID}\n`);
      console.log('O ejecuta este SQL manualmente en Railway:\n');
      console.log(`
-- Crear usuario plataforma
INSERT INTO users (tg_id, username, email, password_hash)
VALUES ('${PLATFORM_TG_ID}', '${PLATFORM_USERNAME}', 'platform@mundoxyz.com', 'N/A')
ON CONFLICT (tg_id) DO NOTHING
RETURNING id;

-- Crear wallet para usuario plataforma (usar el ID retornado arriba)
INSERT INTO wallets (user_id, fires_balance, coins_balance)
VALUES ((SELECT id FROM users WHERE tg_id = '${PLATFORM_TG_ID}'), 0, 0)
ON CONFLICT (user_id) DO NOTHING;
      `);
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada\n');
  }
}

console.log('╔═══════════════════════════════════════════╗');
console.log('║  VERIFICAR USUARIO PLATAFORMA MUNDOXYZ   ║');
console.log('╚═══════════════════════════════════════════╝\n');

verifyPlatformUser()
  .then((exists) => {
    if (exists) {
      console.log('✅ Verificación completada: Usuario plataforma OK');
      process.exit(0);
    } else {
      console.log('⚠️  Verificación completada: Usuario plataforma falta crear');
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('❌ Error en verificación:', error.message);
    process.exit(1);
  });
