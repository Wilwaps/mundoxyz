/**
 * Script temporal para verificar datos de experiencia en Railway
 * Ejecutar: node verify_xp_data.js
 */

const { Pool } = require('pg');

// Configurar con tu DATABASE_URL de Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mundoxyz',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function verifyExperienceData() {
  try {
    console.log('🔍 Verificando datos de experiencia...\n');

    // 1. Verificar si las columnas existen
    console.log('1️⃣ Verificando columnas en tabla users:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' 
        AND column_name IN ('experience', 'total_games_played', 'total_games_won')
      ORDER BY column_name
    `);
    
    if (columnsResult.rows.length === 0) {
      console.log('❌ ERROR: Las columnas de experiencia NO EXISTEN en la tabla users');
      console.log('   Necesitas ejecutar la migración 008 o crear las columnas manualmente\n');
    } else {
      console.log('✅ Columnas encontradas:');
      columnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) default: ${col.column_default}`);
      });
      console.log();
    }

    // 2. Datos del usuario prueba1
    console.log('2️⃣ Datos del usuario prueba1:');
    const userResult = await pool.query(`
      SELECT 
        id,
        username,
        experience,
        total_games_played,
        total_games_won,
        created_at
      FROM users
      WHERE username = 'prueba1'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuario prueba1 NO encontrado\n');
    } else {
      const user = userResult.rows[0];
      console.log('✅ Usuario encontrado:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Experience: ${user.experience} XP`);
      console.log(`   Total Games Played: ${user.total_games_played}`);
      console.log(`   Total Games Won: ${user.total_games_won}`);
      console.log();
    }

    // 3. Usuarios con experiencia
    console.log('3️⃣ Top usuarios con experiencia:');
    const topUsers = await pool.query(`
      SELECT 
        username,
        experience,
        total_games_played,
        total_games_won
      FROM users
      WHERE experience > 0 OR total_games_played > 0
      ORDER BY experience DESC
      LIMIT 10
    `);

    if (topUsers.rows.length === 0) {
      console.log('❌ Ningún usuario tiene experiencia > 0');
      console.log('   Esto significa que el sistema NO está otorgando XP correctamente\n');
    } else {
      console.log('✅ Usuarios con XP:');
      topUsers.rows.forEach(u => {
        console.log(`   - ${u.username}: ${u.experience} XP (${u.total_games_played} partidas, ${u.total_games_won} victorias)`);
      });
      console.log();
    }

    // 4. Partidas de TicTacToe de prueba1
    console.log('4️⃣ Historial TicTacToe de prueba1:');
    const tttResult = await pool.query(`
      SELECT 
        COUNT(*) as total_partidas,
        COUNT(CASE WHEN winner_id = u.id THEN 1 END) as victorias,
        COUNT(CASE WHEN is_draw = true THEN 1 END) as empates
      FROM tictactoe_rooms tr
      JOIN users u ON u.username = 'prueba1'
      WHERE (tr.player_x_id = u.id OR tr.player_o_id = u.id)
        AND tr.status = 'finished'
    `);

    if (tttResult.rows.length > 0) {
      const ttt = tttResult.rows[0];
      console.log(`   Total partidas: ${ttt.total_partidas}`);
      console.log(`   Victorias: ${ttt.victorias}`);
      console.log(`   Empates: ${ttt.empates}`);
      console.log();
    }

    // 5. Partidas de Bingo V2 de prueba1
    console.log('5️⃣ Historial Bingo V2 de prueba1:');
    const bingoResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT br.id) as total_partidas_bingo,
        COUNT(CASE WHEN br.winner_id = u.id THEN 1 END) as victorias_bingo
      FROM bingo_v2_room_players brp
      JOIN bingo_v2_rooms br ON br.id = brp.room_id
      JOIN users u ON u.username = 'prueba1'
      WHERE brp.user_id = u.id
        AND br.status = 'finished'
    `);

    if (bingoResult.rows.length > 0) {
      const bingo = bingoResult.rows[0];
      console.log(`   Total partidas: ${bingo.total_partidas_bingo}`);
      console.log(`   Victorias: ${bingo.victorias_bingo}`);
      console.log();
    }

    // 6. Verificar endpoint profile
    console.log('6️⃣ Simulando respuesta del endpoint /api/profile:');
    const profileResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.experience,
        u.total_games_played,
        u.total_games_won,
        w.coins_balance,
        w.fires_balance
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.username = 'prueba1'
    `);

    if (profileResult.rows.length > 0) {
      console.log('✅ Respuesta del endpoint (simulada):');
      console.log(JSON.stringify(profileResult.rows[0], null, 2));
    }

    console.log('\n✅ Verificación completa');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

verifyExperienceData();
