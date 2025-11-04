/**
 * Script para aplicar migración 004 en Railway
 * Este script usa directamente las credenciales de Railway del .env
 * 
 * Uso: node scripts/apply_migration_railway.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Usar DATABASE_URL de las variables de entorno (Railway)
if (!process.env.DATABASE_URL) {
    console.error('✗ ERROR: DATABASE_URL no está definida en .env');
    console.error('  Agrega la URL de Railway a tu archivo .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const MIGRATION_FILE = path.join(__dirname, '..', 'migrations', '004_raffles_complete_system.sql');

async function main() {
    console.log('========================================');
    console.log('  APLICANDO MIGRACIÓN 004 EN RAILWAY');
    console.log('========================================\n');
    
    // Verificar conexión
    console.log('🔌 Conectando a Railway...');
    const client = await pool.connect();
    console.log('✓ Conectado exitosamente\n');
    
    try {
        // Leer y ejecutar migración
        console.log('📄 Leyendo archivo de migración...');
        const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
        console.log('✓ Archivo leído correctamente\n');
        
        console.log('🚀 Ejecutando migración...\n');
        console.log('─'.repeat(50));
        
        // Ejecutar SQL (el archivo ya tiene BEGIN/COMMIT)
        const result = await client.query(migrationSQL);
        
        console.log('─'.repeat(50));
        console.log('\n✓ Migración ejecutada exitosamente\n');
        
        // Verificar resultados
        console.log('🔍 Verificando cambios...\n');
        
        const verification = await client.query(`
            SELECT 
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raffle_host_payment_methods') as payment_methods_exists,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raffle_requests' AND column_name = 'buyer_profile') as buyer_profile_exists,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'raffles_played') as raffles_played_exists,
                EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'raffles_won') as raffles_won_exists,
                EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'raffle_statistics') as statistics_view_exists
        `);
        
        const v = verification.rows[0];
        
        console.log(v.payment_methods_exists ? '✓' : '✗', 'Tabla raffle_host_payment_methods');
        console.log(v.buyer_profile_exists ? '✓' : '✗', 'Columna buyer_profile en raffle_requests');
        console.log(v.raffles_played_exists ? '✓' : '✗', 'Columna raffles_played en users');
        console.log(v.raffles_won_exists ? '✓' : '✗', 'Columna raffles_won en users');
        console.log(v.statistics_view_exists ? '✓' : '✗', 'Vista raffle_statistics');
        
        const allOk = Object.values(v).every(x => x === true);
        
        if (allOk) {
            console.log('\n========================================');
            console.log('✓ MIGRACIÓN COMPLETADA EXITOSAMENTE');
            console.log('========================================\n');
            console.log('Base de datos lista para:');
            console.log('• Métodos de cobro (transferencia/efectivo)');
            console.log('• Perfiles de compradores modo premio');
            console.log('• Métricas de usuario (rifas jugadas/ganadas)');
            console.log('• Estadísticas consolidadas\n');
        } else {
            console.log('\n⚠️  Algunas verificaciones fallaron');
            console.log('Revisa manualmente la base de datos');
        }
        
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ ERROR EN MIGRACIÓN');
        console.error('========================================\n');
        
        if (error.message.includes('already exists')) {
            console.error('⚠️  Algunos objetos ya existen en la base de datos.');
            console.error('Esto puede significar que la migración ya fue aplicada.');
            console.error('\nSi necesitas re-aplicarla, primero revierte los cambios manualmente.');
        } else {
            console.error('Error:', error.message);
            console.error('\nDetalles técnicos:');
            console.error(error.stack);
        }
        
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error('\n✗ Error fatal:', error.message);
    process.exit(1);
});
