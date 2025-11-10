const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function fixWelcomeEvent() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Aplicando fix al evento de bienvenida...\n');
    
    // Actualizar evento
    const result = await client.query(`
      UPDATE welcome_events
      SET 
        require_claim = FALSE,  -- Auto-acreditar (no requiere aceptación manual)
        max_claims = NULL,      -- Sin límite global
        max_per_user = 1        -- 1 vez por usuario
      WHERE id = 1
      RETURNING *
    `);
    
    if (result.rows.length > 0) {
      const event = result.rows[0];
      console.log('✅ Evento actualizado exitosamente:\n');
      console.log(`Nombre: ${event.name}`);
      console.log(`Tipo: ${event.event_type}`);
      console.log(`Coins: ${event.coins_amount}`);
      console.log(`Fires: ${event.fires_amount}`);
      console.log(`Requiere claim: ${event.require_claim}`);
      console.log(`Max claims global: ${event.max_claims || 'sin límite'}`);
      console.log(`Max por usuario: ${event.max_per_user || 'sin límite'}\n`);
      
      console.log('📝 CAMBIOS APLICADOS:');
      console.log('   ✅ require_claim: TRUE → FALSE (auto-acreditación)');
      console.log('   ✅ max_claims: 1 → NULL (sin límite global)');
      console.log('   ✅ max_per_user: → 1 (límite por usuario)\n');
      
      console.log('🎯 RESULTADO:');
      console.log('   - Nuevos usuarios recibirán automáticamente:');
      console.log('     • 1000 coins');
      console.log('     • 10 fires');
      console.log('   - Cada usuario puede recibir 1 vez');
      console.log('   - Sin límite de usuarios totales\n');
    } else {
      console.log('❌ No se encontró el evento con ID 1');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixWelcomeEvent();
