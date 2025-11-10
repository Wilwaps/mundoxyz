const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway';

async function debugRaffleQuery() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    const code = '334710';
    console.log(`🔍 Consultando rifa código: ${code}\n`);

    // Query exacta del backend
    const query = `SELECT 
      r.*,
      u.username as host_username,
      COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
      COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
      rc.company_name,
      rc.rif_number,
      rc.brand_color as primary_color,
      rc.logo_url,
      rc.website_url
     FROM raffles r
     JOIN users u ON r.host_id = u.id
     LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
     LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
     WHERE r.code = $1
     GROUP BY r.id, u.username, rc.company_name, rc.rif_number, 
              rc.brand_color, rc.logo_url, rc.website_url`;

    const result = await client.query(query, [code]);

    if (result.rows.length === 0) {
      console.log('❌ No se encontró la rifa');
    } else {
      console.log('✅ Rifa encontrada:');
      console.log('━'.repeat(80));
      console.log(JSON.stringify(result.rows[0], null, 2));
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

debugRaffleQuery();
