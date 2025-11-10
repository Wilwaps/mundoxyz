const { Pool } = require('pg');

// URL de Railway (de la memoria del usuario)
const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function checkWelcomeEvents() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Conectando a Railway PostgreSQL...\n');
    
    // Verificar eventos activos
    const eventsResult = await client.query(`
      SELECT 
        id,
        name,
        event_type,
        is_active,
        coins_amount,
        fires_amount,
        require_claim,
        starts_at,
        ends_at,
        max_claims,
        claimed_count
      FROM welcome_events
      WHERE event_type = 'first_login'
      ORDER BY priority DESC, created_at ASC
    `);
    
    console.log(`📋 Eventos first_login encontrados: ${eventsResult.rows.length}\n`);
    
    if (eventsResult.rows.length === 0) {
      console.log('❌ NO HAY EVENTOS first_login CONFIGURADOS');
      console.log('   ⚠️  Por eso prueba2 NO recibió regalo de bienvenida\n');
      console.log('📝 SOLUCIÓN: Crear evento first_login desde Admin Panel\n');
    } else {
      eventsResult.rows.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name}`);
        console.log(`   - ID: ${event.id}`);
        console.log(`   - Activo: ${event.is_active}`);
        console.log(`   - Coins: ${event.coins_amount}`);
        console.log(`   - Fires: ${event.fires_amount}`);
        console.log(`   - Requiere claim: ${event.require_claim}`);
        console.log(`   - Claims: ${event.claimed_count || 0}/${event.max_claims || 'sin límite'}\n`);
      });
    }
    
    // Verificar prueba1 y prueba2
    const usersCheck = await client.query(`
      SELECT u.id, u.username, u.created_at, w.coins_balance, w.fires_balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.username IN ('prueba1', 'prueba2')
      ORDER BY u.created_at ASC
    `);
    
    console.log(`👥 Usuarios de prueba:\n`);
    for (const user of usersCheck.rows) {
      console.log(`${user.username}:`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Creado: ${user.created_at}`);
      console.log(`   - Coins: ${user.coins_balance}`);
      console.log(`   - Fires: ${user.fires_balance}`);
      
      // Ver claims
      const claimsCheck = await client.query(`
        SELECT 
          we.name as event_name,
          wec.coins_claimed,
          wec.fires_claimed,
          wec.claimed_at
        FROM welcome_event_claims wec
        JOIN welcome_events we ON we.id = wec.event_id
        WHERE wec.user_id = $1
      `, [user.id]);
      
      if (claimsCheck.rows.length > 0) {
        console.log(`   ✅ Claims: ${claimsCheck.rows.length}`);
        claimsCheck.rows.forEach(claim => {
          console.log(`      - ${claim.event_name}: ${claim.coins_claimed} coins, ${claim.fires_claimed} fires`);
        });
      } else {
        console.log(`   ❌ Sin claims registrados`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkWelcomeEvents();
