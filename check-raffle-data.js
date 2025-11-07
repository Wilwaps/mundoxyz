const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkRaffle() {
  try {
    const result = await pool.query(`
      SELECT 
        code, name, primary_color, secondary_color, 
        logo_url, is_company_mode
      FROM raffles 
      WHERE code = '951840'
    `);
    
    console.log('Raffle Data:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRaffle();
