const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkWelcomeEvents() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando eventos de bienvenida...\n');
    
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
      WHERE is_active = true
      ORDER BY priority DESC, created_at ASC
    `);
    
    console.log(`📋 Eventos activos: ${eventsResult.rows.length}\n`);
    
    if (eventsResult.rows.length === 0) {
      console.log('❌ NO HAY EVENTOS ACTIVOS');
      console.log('   - processFirstLoginEvents() no hará nada');
      console.log('   - Los usuarios nuevos NO recibirán regalo de bienvenida\n');
    } else {
      eventsResult.rows.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.name}`);
        console.log(`   - ID: ${event.id}`);
        console.log(`   - Tipo: ${event.event_type}`);
        console.log(`   - Activo: ${event.is_active}`);
        console.log(`   - Coins: ${event.coins_amount}`);
        console.log(`   - Fires: ${event.fires_amount}`);
        console.log(`   - Requiere claim: ${event.require_claim}`);
        console.log(`   - Reclamados: ${event.claimed_count || 0}/${event.max_claims || 'sin límite'}`);
      });
      console.log('\n');
    }
    
    // Verificar si prueba2 reclamó algo
    const prueba2Check = await client.query(`
      SELECT u.id, u.username, w.coins_balance, w.fires_balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.username = 'prueba2'
    `);
    
    if (prueba2Check.rows.length > 0) {
      const user = prueba2Check.rows[0];
      console.log(`👤 Usuario prueba2:`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Coins: ${user.coins_balance}`);
      console.log(`   - Fires: ${user.fires_balance}\n`);
      
      // Ver si hay claims
      const claimsCheck = await client.query(`
        SELECT 
          wec.id,
          wec.event_id,
          we.name as event_name,
          wec.coins_claimed,
          wec.fires_claimed,
          wec.claimed_at
        FROM welcome_event_claims wec
        JOIN welcome_events we ON we.id = wec.event_id
        WHERE wec.user_id = $1
      `, [user.id]);
      
      if (claimsCheck.rows.length > 0) {
        console.log(`✅ Claims de prueba2: ${claimsCheck.rows.length}`);
        claimsCheck.rows.forEach(claim => {
          console.log(`   - ${claim.event_name}: ${claim.coins_claimed} coins, ${claim.fires_claimed} fires`);
        });
      } else {
        console.log(`❌ prueba2 NO tiene claims registrados`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkWelcomeEvents();
