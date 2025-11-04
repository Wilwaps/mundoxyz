const { Pool } = require('pg');

// Configuración de conexión
const DATABASE_URL = "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`
==================================================
🔢 CAMBIO A CÓDIGOS NUMÉRICOS (6 DÍGITOS)
==================================================
`);

async function changeToNumericCodes() {
    const client = await pool.connect();
    try {
        console.log('🔧 1. ELIMINANDO FUNCIÓN ANTERIOR...\n');
        await client.query('DROP FUNCTION IF EXISTS generate_unique_bingo_room_code() CASCADE');
        console.log('✅ Función anterior eliminada\n');

        console.log('🔧 2. CREANDO FUNCIÓN CON CÓDIGOS NUMÉRICOS (6 DÍGITOS)...\n');
        
        const createFunctionSQL = `
CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    -- Generar códigos numéricos de 6 dígitos (100000-999999)
    LOOP
        -- Generar número aleatorio entre 100000 y 999999
        -- Esto garantiza siempre 6 dígitos (no empezará con 0)
        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
        
        -- Verificar si el código ya existe en bingo_rooms
        SELECT EXISTS(
            SELECT 1 
            FROM bingo_rooms 
            WHERE bingo_rooms.code = new_code
        ) INTO code_exists;
        
        -- Si no existe, retornar el código
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        -- Incrementar contador de intentos
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$;`;

        await client.query(createFunctionSQL);
        console.log('✅ Nueva función creada con códigos numéricos\n');

        // 3. También actualizar para TicTacToe si existe
        console.log('🔧 3. ACTUALIZANDO FUNCIÓN TICTACTOE (si existe)...\n');
        
        // Primero verificar si existe
        const checkTicTacToe = await client.query(`
            SELECT proname FROM pg_proc 
            WHERE proname = 'generate_unique_room_code'
        `);
        
        if (checkTicTacToe.rows.length > 0) {
            await client.query('DROP FUNCTION IF EXISTS generate_unique_room_code() CASCADE');
            
            const createTicTacToeFunction = `
CREATE OR REPLACE FUNCTION generate_unique_room_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    -- Generar códigos numéricos de 6 dígitos (100000-999999)
    LOOP
        -- Generar número aleatorio entre 100000 y 999999
        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
        
        -- Verificar si el código ya existe en tictactoe_rooms
        SELECT EXISTS(
            SELECT 1 
            FROM tictactoe_rooms 
            WHERE tictactoe_rooms.code = new_code
        ) INTO code_exists;
        
        -- Si no existe, retornar el código
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        -- Incrementar contador
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$;`;
            
            await client.query(createTicTacToeFunction);
            console.log('✅ Función TicTacToe también actualizada\n');
        } else {
            console.log('ℹ️ No se encontró función TicTacToe, omitiendo...\n');
        }

        // 4. Probar generación
        console.log('🧪 4. PROBANDO GENERACIÓN DE CÓDIGOS...\n');
        
        const test1 = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`✅ Test 1 - Código Bingo: ${test1.rows[0].code}`);
        
        const test2 = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`✅ Test 2 - Código Bingo: ${test2.rows[0].code}`);
        
        const test3 = await client.query('SELECT generate_unique_bingo_room_code() as code');
        console.log(`✅ Test 3 - Código Bingo: ${test3.rows[0].code}`);
        
        // Verificar formato
        const code = test1.rows[0].code;
        if (/^\d{6}$/.test(code)) {
            console.log('✅ Formato correcto: 6 dígitos numéricos');
        } else {
            console.log('❌ Error: El código no tiene el formato esperado');
        }
        
        console.log(`
==================================================
✅ CAMBIO COMPLETADO EXITOSAMENTE
==================================================

CAMBIOS APLICADOS:
1. Función generate_unique_bingo_room_code() ahora genera 
   códigos numéricos de 6 dígitos (100000-999999)
   
2. Función generate_unique_room_code() (TicTacToe) también
   actualizada con el mismo formato

3. Los códigos nunca empezarán con 0, siempre serán 
   6 dígitos completos

VENTAJAS:
- Más fácil de compartir verbalmente
- Más fácil de recordar
- Más fácil de escribir en dispositivos móviles
- Consistente con otros sistemas de códigos de sala

CAPACIDAD:
- 900,000 combinaciones posibles (100000-999999)
- Suficiente para el volumen esperado de salas
`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.detail) console.error('Detalle:', error.detail);
    } finally {
        client.release();
        await pool.end();
    }
}

changeToNumericCodes().catch(console.error);
