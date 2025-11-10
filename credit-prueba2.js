const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function creditPrueba2() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('💳 Acreditando regalo de bienvenida a prueba2...\n');
    
    const userId = '8c0da584-76b9-41f5-867b-3252a26e8ebf';
    const eventId = 1;
    const coinsAmount = 1000;
    const firesAmount = 10;
    
    // Verificar si ya reclamó
    const alreadyClaimed = await client.query(
      'SELECT 1 FROM welcome_event_claims WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    
    if (alreadyClaimed.rows.length > 0) {
      console.log('ℹ️  prueba2 ya reclamó este evento');
      await client.query('ROLLBACK');
      return;
    }
    
    // Obtener wallet
    const walletResult = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    
    if (walletResult.rows.length === 0) {
      console.log('❌ Wallet no encontrado');
      await client.query('ROLLBACK');
      return;
    }
    
    const wallet = walletResult.rows[0];
    const oldCoinsBalance = parseFloat(wallet.coins_balance);
    const oldFiresBalance = parseFloat(wallet.fires_balance);
    
    // Actualizar wallet
    await client.query(
      `UPDATE wallets 
       SET coins_balance = coins_balance + $1,
           fires_balance = fires_balance + $2,
           total_coins_earned = total_coins_earned + $1,
           total_fires_earned = total_fires_earned + $2,
           updated_at = NOW()
       WHERE user_id = $3`,
      [coinsAmount, firesAmount, userId]
    );
    
    console.log(`✅ Wallet actualizado:`);
    console.log(`   Coins: ${oldCoinsBalance} → ${oldCoinsBalance + coinsAmount}`);
    console.log(`   Fires: ${oldFiresBalance} → ${oldFiresBalance + firesAmount}\n`);
    
    // Registrar transacción coins
    await client.query(
      `INSERT INTO wallet_transactions 
       (wallet_id, type, currency, amount, balance_before, balance_after, description)
       VALUES ($1, 'welcome_event', 'coins', $2, $3, $4, $5)`,
      [wallet.id, coinsAmount, oldCoinsBalance, oldCoinsBalance + coinsAmount, 
       'Welcome: Bienvenido A Mundo XYZ (retroactivo)']
    );
    
    // Registrar transacción fires
    await client.query(
      `INSERT INTO wallet_transactions 
       (wallet_id, type, currency, amount, balance_before, balance_after, description)
       VALUES ($1, 'welcome_event', 'fires', $2, $3, $4, $5)`,
      [wallet.id, firesAmount, oldFiresBalance, oldFiresBalance + firesAmount, 
       'Welcome: Bienvenido A Mundo XYZ (retroactivo)']
    );
    
    console.log(`✅ Transacciones registradas\n`);
    
    // Actualizar fire supply
    await client.query(
      'UPDATE fire_supply SET total_emitted = total_emitted + $1, total_circulating = total_circulating + $1 WHERE id = 1',
      [firesAmount]
    );
    
    console.log(`✅ Fire supply actualizado (+${firesAmount})\n`);
    
    // Registrar claim
    await client.query(
      `INSERT INTO welcome_event_claims 
       (event_id, user_id, coins_claimed, fires_claimed)
       VALUES ($1, $2, $3, $4)`,
      [eventId, userId, coinsAmount, firesAmount]
    );
    
    console.log(`✅ Claim registrado\n`);
    
    await client.query('COMMIT');
    
    console.log('🎉 COMPLETADO EXITOSAMENTE');
    console.log(`   prueba2 ahora tiene:`);
    console.log(`   • ${oldCoinsBalance + coinsAmount} coins`);
    console.log(`   • ${oldFiresBalance + firesAmount} fires`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

creditPrueba2();
