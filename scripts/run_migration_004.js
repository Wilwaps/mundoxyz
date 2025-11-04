/**
 * Script para ejecutar migración 004 - Sistema Completo de Rifas
 * Uso: node scripts/run_migration_004.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de base de datos
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const MIGRATION_FILE = path.join(__dirname, '..', 'migrations', '004_raffles_complete_system.sql');
const BACKUP_FILE = path.join(__dirname, '..', 'backups', `backup_pre_migration_004_${Date.now()}.sql`);

/**
 * Crear backup de tablas críticas antes de la migración
 */
async function createBackup(client) {
    console.log('📦 Creando backup de seguridad...');
    
    try {
        const tables = [
            'raffles',
            'raffle_numbers',
            'raffle_requests',
            'raffle_purchases',
            'users'
        ];
        
        let backupSQL = `-- BACKUP PRE-MIGRACIÓN 004\n-- Fecha: ${new Date().toISOString()}\n\n`;
        
        for (const table of tables) {
            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
            const count = countResult.rows[0].count;
            backupSQL += `-- Tabla: ${table} (${count} registros)\n\n`;
        }
        
        // Crear directorio de backups si no existe
        const backupDir = path.dirname(BACKUP_FILE);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        fs.writeFileSync(BACKUP_FILE, backupSQL);
        console.log(`✓ Backup creado: ${BACKUP_FILE}`);
        
        return true;
    } catch (error) {
        console.error('✗ Error creando backup:', error);
        return false;
    }
}

/**
 * Verificar estado actual de la base de datos
 */
async function checkCurrentState(client) {
    console.log('\n🔍 Verificando estado actual de la base de datos...');
    
    const checks = [];
    
    // Verificar si ya existe la tabla raffle_host_payment_methods
    const tableExists = await client.query(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'raffle_host_payment_methods'
        ) as exists
    `);
    
    if (tableExists.rows[0].exists) {
        console.log('⚠️  ADVERTENCIA: La tabla raffle_host_payment_methods ya existe');
        console.log('   Esta migración podría haber sido ejecutada previamente.');
        
        const proceed = process.env.FORCE_MIGRATION === 'true';
        if (!proceed) {
            console.log('   Use FORCE_MIGRATION=true para forzar la ejecución.');
            return false;
        }
    }
    
    // Contar rifas existentes
    const rafflesCount = await client.query('SELECT COUNT(*) as count FROM raffles');
    console.log(`✓ Rifas en sistema: ${rafflesCount.rows[0].count}`);
    
    // Contar usuarios
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`✓ Usuarios en sistema: ${usersCount.rows[0].count}`);
    
    // Contar solicitudes pendientes
    const requestsCount = await client.query(`
        SELECT COUNT(*) as count FROM raffle_requests WHERE status = 'pending'
    `);
    console.log(`✓ Solicitudes pendientes: ${requestsCount.rows[0].count}`);
    
    return true;
}

/**
 * Ejecutar la migración
 */
async function runMigration(client) {
    console.log('\n🚀 Ejecutando migración 004...\n');
    
    // Leer archivo SQL
    const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
    
    // Ejecutar migración
    await client.query(migrationSQL);
    
    console.log('\n✓ Migración ejecutada exitosamente');
}

/**
 * Verificar que la migración se aplicó correctamente
 */
async function verifyMigration(client) {
    console.log('\n🔍 Verificando resultados de la migración...');
    
    const checks = [
        {
            name: 'Tabla raffle_host_payment_methods',
            query: `SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'raffle_host_payment_methods'
            ) as exists`
        },
        {
            name: 'Columna buyer_profile en raffle_requests',
            query: `SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'raffle_requests' AND column_name = 'buyer_profile'
            ) as exists`
        },
        {
            name: 'Columna raffles_played en users',
            query: `SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'raffles_played'
            ) as exists`
        },
        {
            name: 'Columna raffles_won en users',
            query: `SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'raffles_won'
            ) as exists`
        },
        {
            name: 'Vista raffle_statistics',
            query: `SELECT EXISTS (
                SELECT 1 FROM information_schema.views 
                WHERE table_name = 'raffle_statistics'
            ) as exists`
        }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
        const result = await client.query(check.query);
        const passed = result.rows[0].exists;
        
        if (passed) {
            console.log(`✓ ${check.name}`);
        } else {
            console.log(`✗ ${check.name} - FALLO`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

/**
 * Main
 */
async function main() {
    console.log('========================================');
    console.log('  MIGRACIÓN 004 - SISTEMA DE RIFAS');
    console.log('========================================\n');
    
    const client = await pool.connect();
    
    try {
        // 1. Verificar estado actual
        const stateOk = await checkCurrentState(client);
        if (!stateOk) {
            console.log('\n⚠️  Migración cancelada.');
            return;
        }
        
        // 2. Crear backup
        const backupOk = await createBackup(client);
        if (!backupOk) {
            console.log('\n⚠️  No se pudo crear backup. Migración cancelada.');
            return;
        }
        
        // 3. Ejecutar migración
        await runMigration(client);
        
        // 4. Verificar migración
        const verifyOk = await verifyMigration(client);
        
        if (verifyOk) {
            console.log('\n========================================');
            console.log('✓ MIGRACIÓN COMPLETADA EXITOSAMENTE');
            console.log('========================================\n');
            console.log('Próximos pasos:');
            console.log('1. Verificar en Railway que todo está correcto');
            console.log('2. Continuar con Etapa 1: Flujo Modo Fuegos');
            console.log('');
        } else {
            console.log('\n========================================');
            console.log('⚠️  MIGRACIÓN COMPLETADA CON ADVERTENCIAS');
            console.log('========================================\n');
            console.log('Algunas verificaciones fallaron.');
            console.log('Revisa los logs y la base de datos manualmente.');
            console.log('');
        }
        
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ ERROR EN MIGRACIÓN');
        console.error('========================================\n');
        console.error('Error:', error.message);
        console.error('\nStack trace:', error.stack);
        console.error('\n⚠️  La transacción fue revertida (ROLLBACK)');
        console.error('La base de datos está en su estado original.');
        console.error(`Backup disponible en: ${BACKUP_FILE}`);
        
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Ejecutar
main().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});
