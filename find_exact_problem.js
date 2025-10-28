const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function findExactProblem() {
    const client = await pool.connect();
    try {
        console.log('🔍 LOCALIZANDO LÍNEA PROBLEMÁTICA EXACTA\n');
        
        // 1. Verificar status actual
        const statusCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'raffles' AND column_name = 'status'
        `);
        
        console.log(`Columna status: ${statusCheck.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
        if (statusCheck.rows.length > 0) {
            console.log(`   Tipo: ${statusCheck.rows[0].data_type}`);
        }
        
        // 2. Probar cada sección del SQL
        console.log('\n🧪 PROBANDO SECCIONES INDIVIDUALES:\n');
        
        // SECCIÓN A: Columnas adicionales
        try {
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM information_schema.columns 
                                  WHERE table_name = 'raffles' AND column_name = 'type') THEN
                        ALTER TABLE raffles ADD COLUMN type VARCHAR(20) DEFAULT 'public';
                    END IF;
                END $$;
            `);
            console.log('✅ Sección A - Columnas adicionales: OK');
        } catch (e) {
            console.log(`❌ Sección A - Columnas adicionales: ${e.message}`);
            return;
        }
        
        // SECCIÓN B: Tablas nuevas
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS raffle_companies (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
                    company_name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Sección B - Tablas nuevas: OK');
        } catch (e) {
            console.log(`❌ Sección B - Tablas nuevas: ${e.message}`);
            return;
        }
        
        // SECCIÓN C: Índices
        try {
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_raffle_companies_ripple_id ON raffle_companies(raffle_id);
            `);
            console.log('✅ Sección C - Índices: OK');
        } catch (e) {
            console.log(`❌ Sección C - Índices: ${e.message}`);
            return;
        }
        
        // SECCIÓN D: Función generate_unique_raffle_code
        try {
            await client.query(`
                CREATE OR REPLACE FUNCTION generate_unique_raffle_code()
                RETURNS VARCHAR(6)
                LANGUAGE plpgsql
                AS $$
                DECLARE
                    new_code VARCHAR(6);
                    max_attempts INTEGER := 100;
                    attempt_count INTEGER := 0;
                    code_exists BOOLEAN;
                BEGIN
                    LOOP
                        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
                        
                        SELECT EXISTS(
                            SELECT 1 FROM raffles WHERE raffles.code = new_code
                        ) INTO code_exists;
                        
                        IF NOT code_exists THEN
                            RETURN new_code;
                        END IF;
                        
                        attempt_count := attempt_count + 1;
                        IF attempt_count >= max_attempts THEN
                            RAISE EXCEPTION 'No se pudo generar código único después de % intentos', max_attempts;
                        END IF;
                    END LOOP;
                END;
                $$;
            `);
            console.log('✅ Sección D - Función generate: OK');
        } catch (e) {
            console.log(`❌ Sección D - Función generate: ${e.message}`);
            return;
        }
        
        // SECCIÓN E: Función check_user_raffle_limit (LA PROBLEMÁTICA)
        try {
            await client.query(`
                CREATE OR REPLACE FUNCTION check_user_raffle_limit(p_user_id UUID)
                RETURNS TABLE (
                    current_active INTEGER,
                    max_allowed INTEGER,
                    can_create BOOLEAN,
                    needed_xp INTEGER
                ) LANGUAGE plpgsql AS $$
                DECLARE
                    user_xp INTEGER := 0;
                BEGIN
                    SELECT COALESCE(xp, 0) INTO user_xp
                    FROM users WHERE id = p_user_id;
                    
                    SELECT COUNT(*) INTO current_active
                    FROM raffles
                    WHERE host_id = p_user_id AND status IN ('pending', 'active');
                    
                    max_allowed := CASE
                        WHEN user_xp >= 1000 THEN 4
                        WHEN user_xp >= 500 THEN 3
                        WHEN user_xp >= 50 THEN 2
                        ELSE 1
                    END;
                    
                    needed_xp := CASE
                        WHEN user_xp >= 1000 THEN 0
                        WHEN user_xp >= 500 THEN 1000 - user_xp
                        WHEN user_xp >= 50 THEN 500 - user_xp
                        ELSE 50 - user_xp
                    END;
                    
                    can_create := current_active < max_allowed;
                    
                    RETURN QUERY SELECT current_active, max_allowed, can_create, needed_xp;
                END;
                $$;
            `);
            console.log('✅ Sección E - Función límites: OK');
        } catch (e) {
            console.log(`❌ Sección E - Función límites: ${e.message}`);
            console.log('🎯 ¡PROBLEMA ENCONTRADO! La sección E causa el error');
            return;
        }
        
        // SECCIÓN F: Vista
        try {
            await client.query(`
                CREATE OR REPLACE VIEW raffle_lobby_view AS
                SELECT 
                    r.id,
                    r.code,
                    r.name,
                    r.host_id,
                    u.username as host_username,
                    r.mode,
                    COALESCE(r.type, r.visibility, 'public') as type,
                    r.status,
                    COALESCE(r.entry_price_fire, 10) as cost_per_number,
                    COALESCE(r.pot_fires, 0) as current_pot,
                    r.numbers_range,
                    COALESCE(r.is_company_mode, false) as is_company_mode,
                    r.created_at,
                    rc.company_name,
                    rc.logo_url,
                    COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END) as purchased_count
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.ripple_id
                LEFT JOIN raffle_numbers rn ON r.id = rn.ripple_id
                WHERE r.status IN ('pending', 'active', 'finished')
                GROUP BY r.id, u.username, rc.company_name, rc.logo_url;
            `);
            console.log('✅ Sección F - Vista: OK');
        } catch (e) {
            console.log(`❌ Sección F - Vista: ${e.message}`);
            return;
        }
        
        console.log('\n🎯 TODAS LAS SECCIONES FUNCIONAN CORRECTAMENTE');
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

findExactProblem();
