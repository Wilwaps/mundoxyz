const { Client } = require('pg');

async function verificarTablasBingo() {
  const client = new Client({
    connectionString: process.argv[2],
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');

    // Verificar tablas de bingo
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'bingo_%'
      ORDER BY table_name;
    `;

    const result = await client.query(tablesQuery);

    console.log('📊 TABLAS DE BINGO EXISTENTES:');
    console.log('─'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('  ❌ No hay tablas de bingo creadas aún');
    } else {
      for (const row of result.rows) {
        console.log(`  ✓ ${row.table_name}`);
        
        // Contar registros en cada tabla
        try {
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM ${row.table_name}`
          );
          console.log(`    → ${countResult.rows[0].count} registros`);
        } catch (e) {
          console.log(`    → Error contando registros`);
        }
      }
    }
    console.log('─'.repeat(60));

    // Verificar columnas de estadísticas en user_stats
    const statsQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_stats' 
      AND column_name LIKE 'bingo_%'
      ORDER BY column_name;
    `;

    const statsResult = await client.query(statsQuery);

    console.log('\n📈 COLUMNAS DE ESTADÍSTICAS DE BINGO:');
    console.log('─'.repeat(60));
    
    if (statsResult.rows.length === 0) {
      console.log('  ❌ No hay columnas de estadísticas de bingo');
    } else {
      statsResult.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name} (${row.data_type})`);
      });
    }
    console.log('─'.repeat(60));

    // Verificar índices
    const indexQuery = `
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename LIKE 'bingo_%' 
      AND schemaname = 'public'
      ORDER BY tablename, indexname;
    `;

    const indexResult = await client.query(indexQuery);

    console.log(`\n🔍 ÍNDICES DE BINGO: ${indexResult.rows.length}`);
    console.log('─'.repeat(60));
    
    if (indexResult.rows.length > 0) {
      let currentTable = '';
      indexResult.rows.forEach(row => {
        if (row.tablename !== currentTable) {
          currentTable = row.tablename;
          console.log(`\n  📁 ${row.tablename}:`);
        }
        console.log(`    → ${row.indexname}`);
      });
    }
    console.log('─'.repeat(60));

    // Verificar funciones
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION' 
      AND routine_schema = 'public'
      AND routine_name LIKE '%bingo%';
    `;

    const functionsResult = await client.query(functionsQuery);

    console.log(`\n⚙️  FUNCIONES DE BINGO: ${functionsResult.rows.length}`);
    console.log('─'.repeat(60));
    
    if (functionsResult.rows.length > 0) {
      functionsResult.rows.forEach(row => {
        console.log(`  ✓ ${row.routine_name}()`);
      });
    } else {
      console.log('  ❌ No hay funciones específicas de bingo');
    }
    console.log('─'.repeat(60));

    // Verificar triggers
    const triggersQuery = `
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE event_object_table LIKE 'bingo_%'
      AND trigger_schema = 'public';
    `;

    const triggersResult = await client.query(triggersQuery);

    console.log(`\n🎯 TRIGGERS DE BINGO: ${triggersResult.rows.length}`);
    console.log('─'.repeat(60));
    
    if (triggersResult.rows.length > 0) {
      triggersResult.rows.forEach(row => {
        console.log(`  ✓ ${row.trigger_name} → ${row.event_object_table}`);
      });
    } else {
      console.log('  ❌ No hay triggers de bingo');
    }
    console.log('─'.repeat(60));

    // Estado final
    const tablasClave = [
      'bingo_rooms',
      'bingo_room_players',
      'bingo_cards',
      'bingo_drawn_numbers',
      'bingo_transactions',
      'bingo_winners'
    ];

    const tablasExistentes = result.rows.map(r => r.table_name);
    const tablasFaltantes = tablasClave.filter(t => !tablasExistentes.includes(t));

    console.log('\n📋 RESUMEN:');
    console.log('─'.repeat(60));
    console.log(`  ✅ Tablas creadas: ${tablasExistentes.length}/${tablasClave.length}`);
    
    if (tablasFaltantes.length > 0) {
      console.log(`  ⚠️  Tablas faltantes:`);
      tablasFaltantes.forEach(t => console.log(`    - ${t}`));
    } else {
      console.log('  🎉 ¡Todas las tablas principales están creadas!');
    }

    console.log('─'.repeat(60));

    if (tablasExistentes.length === tablasClave.length) {
      console.log('\n✨ El sistema de BINGO está listo para usar!');
      console.log('\n📝 PRÓXIMOS PASOS:');
      console.log('  1. Hacer commit y push de los cambios');
      console.log('  2. Esperar deploy automático en Railway');
      console.log('  3. Implementar el frontend del lobby de bingo');
      console.log('  4. Probar creación de salas y compra de cartones');
    } else {
      console.log('\n⚠️  El sistema de BINGO está parcialmente instalado');
      console.log('Ejecuta la migración completa para crear las tablas faltantes');
    }

  } catch (error) {
    console.error('❌ Error verificando tablas:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Conexión cerrada');
  }
}

// Validar argumentos
if (!process.argv[2]) {
  console.log('❌ Falta la URL de conexión de Railway');
  console.log('\n📖 USO:');
  console.log('  node verificar_tablas_bingo.js "postgresql://..."');
  process.exit(1);
}

// Ejecutar
console.log('🎰 VERIFICACIÓN DE TABLAS BINGO - MUNDOXYZ');
console.log('═'.repeat(60));
console.log('📅 Fecha:', new Date().toLocaleString('es-ES'));
console.log('═'.repeat(60) + '\n');

verificarTablasBingo();
