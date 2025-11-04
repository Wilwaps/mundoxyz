-- Script para verificar datos de experiencia en Railway
-- Ejecutar este query en Railway PostgreSQL

-- 1. Verificar si las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('experience', 'total_games_played', 'total_games_won')
ORDER BY column_name;

-- 2. Ver datos del usuario prueba1
SELECT 
  id,
  username,
  experience,
  total_games_played,
  total_games_won,
  created_at
FROM users
WHERE username = 'prueba1';

-- 3. Ver todos los usuarios con experiencia > 0
SELECT 
  username,
  experience,
  total_games_played,
  total_games_won
FROM users
WHERE experience > 0 OR total_games_played > 0
ORDER BY experience DESC
LIMIT 10;

-- 4. Verificar partidas de TicTacToe del usuario prueba1
SELECT 
  COUNT(*) as total_partidas,
  COUNT(CASE WHEN winner_id = u.id THEN 1 END) as victorias
FROM tictactoe_rooms tr
JOIN users u ON u.username = 'prueba1'
WHERE (tr.player_x_id = u.id OR tr.player_o_id = u.id)
  AND tr.status = 'finished';

-- 5. Verificar partidas de Bingo V2 del usuario prueba1
SELECT 
  COUNT(DISTINCT br.id) as total_partidas_bingo,
  COUNT(CASE WHEN br.winner_id = u.id THEN 1 END) as victorias_bingo
FROM bingo_v2_room_players brp
JOIN bingo_v2_rooms br ON br.id = brp.room_id
JOIN users u ON u.username = 'prueba1'
WHERE brp.user_id = u.id
  AND br.status = 'finished';
