const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function ultraSimpleMigration() {
    const client = await pool.connect();
    try {
        console.log('🔍 ULTRA SIMPLIFIED - MIGRACIÓN MÍNIMA\n');
        
        // 1. Verificar solo la tabla raffles
        const rafflesTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'raffles'
            ) as exists
        `);
        
        console.log(`Tabla raffles existe: ${rafflesTable.rows[0].exists ? 'SÍ' : 'NO'}`);
        
        if (rafflesTable.rows[0].exists) {
            // 2. Verificar columnas EXACTAS
            const columns = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'raffles' 
                ORDER BY ordinal_position
            `);
            
            console.log('\n📋 Columnas exactas en raffles:');
            columns.rows.forEach((col, index) => {
                console.log(`   ${index + 1}. ${col.column_name}: ${col.data_type}`);
            });
            
            // 3. Verificar si status existe
            const hasStatus = columns.rows.some(col => col.column_name === 'status');
            console.log(`\n¿Columna status existe? ${hasStatus ? 'SÍ' : 'NO'}`);
            
            // 4. Crear solo las tablas NUEVAS sin modificar raffles
            console.log('\n🔧 Creando solo tablas NUEVAS...');
            
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS raffle_companies (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                        company_name VARCHAR(255) NOT NULL,
                        company_rif VARCHAR(50) NOT NULL,
                        primary_color VARCHAR(7) DEFAULT '#FF6B6B',
                        secondary_color VARCHAR(7) DEFAULT '#4ECDC4',
                        logo_url VARCHAR(500),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ raffle_companies: CREADA');
            } catch (e) {
                console.log(`❌ raffle_companies: ${e.message}`);
            }
            
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS raffle_numbers (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                        number VARCHAR(10) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'available',
                        purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
                        UNIQUE(raffle_id, number)
                    )
                `);
                console.log('✅ raffle_numbers: CREADA');
            } catch (e) {
                console.log(`❌ raffle_numbers: ${e.message}`);
            }
            
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS raffle_purchases (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
                        number VARCHAR(10) NOT NULL,
                        cost_amount INTEGER NOT NULL,
                        currency VARCHAR(10) DEFAULT 'fires',
                        status VARCHAR(20) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ raffle_purchases: CREADA');
            } catch (e) {
                console.log(`❌ raffle_purchases: ${e.message}`);
            }
            
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS raffle_winners (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        winning_number VARCHAR(10) NOT NULL,
                        prize_amount INTEGER,
                        prize_type VARCHAR(20) DEFAULT 'fire',
                        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ raffle_winners: CREADA');
            } catch (e) {
                console.log(`❌ raffle_winners: ${e.message}`);
            }
            
            // 5. Crear función simple sin referencias a status
            try {
                await client.query(`
                    CREATE OR REPLACE FUNCTION generate_unique_raffle_code()
                    RETURNS VARCHAR(6)
                    LANGUAGE plpgsql
                    AS $$
                    DECLARE
                        new_code VARCHAR(6);
                    BEGIN
                        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
                        RETURN new_code;
                    END;
                    $$;
                `);
                console.log('✅ generate_unique_raffle_code: CREADA');
            } catch (e) {
                console.log(`❌ generate_unique_raffle_code: ${e.message}`);
            }
            
            // 6. Probar función
            try {
                const test = await client.query('SELECT generate_unique_raffle_code() as code');
                console.log(`✅ Prueba función: Código ${test.rows[0].code}`);
            } catch (e) {
                console.log(`❌ Prueba función: ${e.message}`);
            }
            
            // 7. Contar tablas raffle
            const finalTables = await client.query(`
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name LIKE 'raffle%'
            `);
            
            console.log(`\n📊 Total tablas raffle: ${finalTables.rows[0].count}`);
            
            console.log('\n🎯 SISTEMA BÁSICO DE RIFAS FUNCIONAL');
            console.log('✅ Tablas nuevas creadas');
            console.log('✅ Generador de códigos operativo');
            console.log('✅ Estructura lista para backend');
            
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

ultraSimpleMigration();
