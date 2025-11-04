const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@trolley.proxy.rlwy.net:28951/railway";
const pool = new Pool({ connectionString: DATABASE_URL });

async function applyFix() {
    const client = await pool.connect();
    try {
        console.log('🔧 Aplicando fix para constraint raffles_mode_check...\n');
        
        // Leer el SQL
        const sqlPath = path.join(__dirname, 'fix_raffles_mode_constraint.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Ejecutar
        await client.query('BEGIN');
        
        console.log('1️⃣ Eliminando constraint anterior...');
        await client.query('ALTER TABLE raffles DROP CONSTRAINT IF EXISTS raffles_mode_check');
        console.log('✅ Constraint anterior eliminado\n');
        
        console.log('2️⃣ Creando nuevo constraint (fires, prize)...');
        await client.query(`ALTER TABLE raffles ADD CONSTRAINT raffles_mode_check CHECK (mode IN ('fires', 'prize'))`);
        console.log('✅ Nuevo constraint creado\n');
        
        await client.query('COMMIT');
        
        // Verificar
        console.log('3️⃣ Verificando constraint...');
        const result = await client.query(`
            SELECT constraint_name, check_clause 
            FROM information_schema.check_constraints 
            WHERE constraint_name = 'raffles_mode_check'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Constraint verificado:');
            console.log('   Nombre:', result.rows[0].constraint_name);
            console.log('   Check:', result.rows[0].check_clause);
        }
        
        console.log('\n🎉 Fix aplicado exitosamente!');
        console.log('📝 Modes permitidos: fires, prize');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error aplicando fix:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

applyFix().catch(console.error);
