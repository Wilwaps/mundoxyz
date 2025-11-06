/**
 * Script para agregar columnas de reserva a raffle_numbers
 * Ejecutar: node backend/scripts/add-reservation-columns.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function addReservationColumns() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Verificando columnas de reserva...');

        // Verificar si las columnas existen
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'raffle_numbers' 
              AND column_name IN ('reserved_by', 'reserved_until')
        `);

        const existingColumns = checkResult.rows.map(r => r.column_name);
        console.log('Columnas existentes:', existingColumns);

        // Agregar reserved_by si no existe
        if (!existingColumns.includes('reserved_by')) {
            console.log('➕ Agregando columna reserved_by...');
            await client.query(`
                ALTER TABLE raffle_numbers 
                ADD COLUMN reserved_by INTEGER REFERENCES users(id)
            `);
            console.log('✅ Columna reserved_by agregada');
        } else {
            console.log('✅ Columna reserved_by ya existe');
        }

        // Agregar reserved_until si no existe
        if (!existingColumns.includes('reserved_until')) {
            console.log('➕ Agregando columna reserved_until...');
            await client.query(`
                ALTER TABLE raffle_numbers 
                ADD COLUMN reserved_until TIMESTAMP WITH TIME ZONE
            `);
            console.log('✅ Columna reserved_until agregada');
        } else {
            console.log('✅ Columna reserved_until ya existe');
        }

        // Crear índice si no existe
        console.log('🔍 Verificando índice...');
        const indexCheck = await client.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'raffle_numbers' 
              AND indexname = 'idx_raffle_numbers_reserved'
        `);

        if (indexCheck.rows.length === 0) {
            console.log('➕ Creando índice idx_raffle_numbers_reserved...');
            await client.query(`
                CREATE INDEX idx_raffle_numbers_reserved 
                ON raffle_numbers(reserved_until) 
                WHERE reserved_until IS NOT NULL
            `);
            console.log('✅ Índice creado');
        } else {
            console.log('✅ Índice ya existe');
        }

        console.log('\n🎉 ¡Migración completada exitosamente!');
        console.log('✅ Sistema de reservas listo para usar');

    } catch (error) {
        console.error('❌ Error en migración:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addReservationColumns()
    .then(() => {
        console.log('\n✅ Script finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Script falló:', error);
        process.exit(1);
    });
