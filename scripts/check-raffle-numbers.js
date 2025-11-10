const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

async function checkRaffleNumbers() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado\n');

    const raffleId = 17; // ID de la rifa 334710

    // 1. Verificar números existentes
    console.log('🔢 NÚMEROS EN raffle_numbers:');
    console.log('━'.repeat(80));
    const numbers = await client.query(
      `SELECT COUNT(*) as count FROM raffle_numbers WHERE raffle_id = $1`,
      [raffleId]
    );
    console.log(`Total números: ${numbers.rows[0].count}\n`);

    // 2. Ver si hay triggers
    console.log('⚙️  TRIGGERS EN raffles:');
    console.log('━'.repeat(80));
    const triggers = await client.query(`
      SELECT trigger_name, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'raffles';
    `);
    if (triggers.rows.length === 0) {
      console.log('⚠️  NO HAY TRIGGERS\n');
    } else {
      console.table(triggers.rows);
    }

    // 3. Verificar funciones de creación de números
    console.log('📝 FUNCIONES RELACIONADAS:');
    console.log('━'.repeat(80));
    const functions = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname LIKE '%raffle%number%'
      LIMIT 5;
    `);
    if (functions.rows.length === 0) {
      console.log('⚠️  NO HAY FUNCIONES create_raffle_numbers\n');
    } else {
      functions.rows.forEach(f => {
        console.log(`\n📌 ${f.proname}:`);
        console.log(f.prosrc.substring(0, 200) + '...\n');
      });
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await client.end();
  }
}

checkRaffleNumbers();
