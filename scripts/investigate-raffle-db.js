const { Client } = require('pg');

// URL pública de Railway
const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

async function investigate() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL en Railway\n');

    // 1. Verificar estructura de tabla raffle_companies
    console.log('📋 ESTRUCTURA DE raffle_companies:');
    console.log('━'.repeat(80));
    const companyStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'raffle_companies'
      ORDER BY ordinal_position;
    `);
    console.table(companyStructure.rows);

    // 2. Verificar estructura de tabla raffles (columnas relevantes)
    console.log('\n📋 ESTRUCTURA DE raffles (columnas clave):');
    console.log('━'.repeat(80));
    const raffleStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'raffles'
      AND column_name IN ('id', 'code', 'name', 'mode', 'host_id', 'created_at', 'prize_meta')
      ORDER BY ordinal_position;
    `);
    console.table(raffleStructure.rows);

    // 3. Verificar últimas rifas creadas
    console.log('\n🎟️ ÚLTIMAS 5 RIFAS CREADAS:');
    console.log('━'.repeat(80));
    const recentRaffles = await client.query(`
      SELECT 
        id, 
        code, 
        name, 
        mode, 
        host_id,
        created_at,
        prize_meta
      FROM raffles
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    console.table(recentRaffles.rows);

    // 4. Verificar si hay raffle_companies asociadas
    console.log('\n🏢 REGISTROS EN raffle_companies:');
    console.log('━'.repeat(80));
    const companies = await client.query(`
      SELECT * FROM raffle_companies
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    if (companies.rows.length === 0) {
      console.log('⚠️  No hay registros en raffle_companies');
    } else {
      console.table(companies.rows);
    }

    // 5. Verificar si hay alguna rifa con código NULL o vacío
    console.log('\n⚠️  RIFAS CON CÓDIGO NULL O VACÍO:');
    console.log('━'.repeat(80));
    const invalidCodes = await client.query(`
      SELECT id, code, name, mode, created_at
      FROM raffles
      WHERE code IS NULL OR code = ''
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    if (invalidCodes.rows.length === 0) {
      console.log('✅ No hay rifas con código inválido');
    } else {
      console.table(invalidCodes.rows);
    }

    // 6. Verificar el trigger que genera códigos
    console.log('\n⚙️  TRIGGERS EN raffles:');
    console.log('━'.repeat(80));
    const triggers = await client.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement,
        action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'raffles';
    `);
    if (triggers.rows.length === 0) {
      console.log('⚠️  No hay triggers configurados en la tabla raffles');
    } else {
      console.table(triggers.rows);
    }

    console.log('\n✅ Investigación completada');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

investigate();
