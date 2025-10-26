// Script para verificar si las tablas de TicTacToe existen en Railway
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyTables() {
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // Verificar tablas
    console.log('🔍 Buscando tablas de TicTacToe...\n');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'tictactoe%'
      ORDER BY table_name;
    `);
    
    if (tables.rows.length === 0) {
      console.log('❌ NO se encontraron tablas de TicTacToe');
      console.log('\n⚠️  Las tablas NO EXISTEN en Railway\n');
    } else {
      console.log('✅ Tablas encontradas:');
      tables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      // Verificar estructura de tictactoe_rooms
      console.log('\n🔍 Verificando estructura de tictactoe_rooms...\n');
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tictactoe_rooms'
        ORDER BY ordinal_position;
      `);
      
      console.log('Columnas en tictactoe_rooms:');
      columns.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
      
      // Verificar triggers
      console.log('\n🔍 Verificando triggers...\n');
      const triggers = await client.query(`
        SELECT trigger_name, event_manipulation, event_object_table
        FROM information_schema.triggers
        WHERE trigger_name LIKE '%tictactoe%'
        ORDER BY trigger_name;
      `);
      
      if (triggers.rows.length > 0) {
        console.log('Triggers encontrados:');
        triggers.rows.forEach(row => {
          console.log(`   - ${row.trigger_name} on ${row.event_object_table}`);
        });
      } else {
        console.log('❌ No se encontraron triggers de TicTacToe');
      }
    }
    
    console.log('\n==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyTables();
