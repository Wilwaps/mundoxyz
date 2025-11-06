/**
 * Script para verificar y aplicar columnas de pago en raffles
 * Si faltan columnas, las agrega directamente
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifyAndApplyColumns() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔍 VERIFICANDO COLUMNAS DE PAGO EN TABLA RAFFLES...\n');

    // Verificar qué columnas existen
    const columnsCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'raffles'
        AND column_name IN (
          'payment_cost_amount',
          'payment_cost_currency',
          'payment_method',
          'payment_bank_code',
          'payment_phone',
          'payment_id_number',
          'payment_instructions',
          'allow_fire_payments'
        )
    `);

    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    console.log('✅ Columnas existentes:', existingColumns);

    const requiredColumns = [
      'payment_cost_amount',
      'payment_cost_currency',
      'payment_method',
      'payment_bank_code',
      'payment_phone',
      'payment_id_number',
      'payment_instructions',
      'allow_fire_payments'
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('\n✅ TODAS LAS COLUMNAS YA EXISTEN - No se requiere acción\n');
      return;
    }

    console.log('\n⚠️  COLUMNAS FALTANTES:', missingColumns);
    console.log('\n🔧 APLICANDO COLUMNAS FALTANTES...\n');

    // Aplicar columnas una por una con manejo de errores individual
    for (const col of missingColumns) {
      try {
        console.log(`📝 Agregando columna: ${col}...`);
        
        switch(col) {
          case 'payment_cost_amount':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_cost_amount DECIMAL(10,2)`);
            break;
          case 'payment_cost_currency':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_cost_currency VARCHAR(10) DEFAULT 'USD'`);
            break;
          case 'payment_method':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`);
            break;
          case 'payment_bank_code':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_bank_code VARCHAR(10)`);
            break;
          case 'payment_phone':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(20)`);
            break;
          case 'payment_id_number':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_id_number VARCHAR(30)`);
            break;
          case 'payment_instructions':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_instructions TEXT`);
            break;
          case 'allow_fire_payments':
            await client.query(`ALTER TABLE raffles ADD COLUMN IF NOT EXISTS allow_fire_payments BOOLEAN DEFAULT FALSE`);
            break;
        }
        
        console.log(`   ✅ ${col} agregada exitosamente`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ℹ️  ${col} ya existía`);
        } else {
          console.error(`   ❌ Error agregando ${col}:`, error.message);
        }
      }
    }

    // Verificar resultado final
    const finalCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'raffles'
        AND column_name IN (
          'payment_cost_amount',
          'payment_cost_currency',
          'payment_method',
          'payment_bank_code',
          'payment_phone',
          'payment_id_number',
          'payment_instructions',
          'allow_fire_payments'
        )
    `);

    const finalColumns = finalCheck.rows.map(r => r.column_name);
    
    console.log('\n✅ COLUMNAS FINALES:', finalColumns);
    
    if (finalColumns.length === 8) {
      console.log('\n🎉 ÉXITO: Todas las columnas de pago están disponibles\n');
    } else {
      console.log('\n⚠️  ATENCIÓN: Faltan', 8 - finalColumns.length, 'columnas\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
verifyAndApplyColumns()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script falló:', error);
    process.exit(1);
  });
