-- ============================================
-- FIX: Crear columnas de experiencia si no existen
-- Ejecutar ESTE SCRIPT en Railway PostgreSQL
-- ============================================

-- Paso 1: Verificar si las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('experience', 'total_games_played', 'total_games_won')
ORDER BY column_name;

-- Si el resultado está vacío, las columnas NO EXISTEN
-- Ejecuta los siguientes comandos:

-- Paso 2: Crear las columnas (seguro - no falla si ya existen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_won INTEGER DEFAULT 0;

-- Paso 3: Actualizar valores NULL a 0
UPDATE users 
SET experience = 0 
WHERE experience IS NULL;

UPDATE users 
SET total_games_played = 0 
WHERE total_games_played IS NULL;

UPDATE users 
SET total_games_won = 0 
WHERE total_games_won IS NULL;

-- Paso 4: Agregar restricción NOT NULL (opcional pero recomendado)
ALTER TABLE users ALTER COLUMN experience SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN total_games_played SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN total_games_won SET DEFAULT 0;

-- Paso 5: Crear índice para performance (opcional)
CREATE INDEX IF NOT EXISTS idx_users_experience ON users(experience DESC);

-- Paso 6: Verificar que las columnas existen ahora
SELECT 
  username,
  experience,
  total_games_played,
  total_games_won
FROM users
WHERE username IN ('prueba1', 'prueba2')
ORDER BY username;

-- Resultado esperado:
-- username | experience | total_games_played | total_games_won
-- ---------+------------+--------------------+----------------
-- prueba1  | 0          | 0                  | 0
-- prueba2  | 0          | 0                  | 0

-- ============================================
-- BONUS: Poblar experiencia basada en historial
-- (Solo si quieres dar XP retroactivo)
-- ============================================

-- Contar partidas de TicTacToe por usuario
WITH ttt_stats AS (
  SELECT 
    user_id,
    COUNT(*) as ttt_games,
    COUNT(CASE WHEN is_winner = true THEN 1 END) as ttt_wins
  FROM (
    SELECT 
      player_x_id as user_id,
      CASE WHEN winner_id = player_x_id THEN true ELSE false END as is_winner
    FROM tictactoe_rooms
    WHERE status = 'finished'
    UNION ALL
    SELECT 
      player_o_id as user_id,
      CASE WHEN winner_id = player_o_id THEN true ELSE false END as is_winner
    FROM tictactoe_rooms
    WHERE status = 'finished' AND player_o_id IS NOT NULL
  ) t
  GROUP BY user_id
),
bingo_stats AS (
  SELECT 
    brp.user_id,
    COUNT(DISTINCT br.id) as bingo_games,
    COUNT(CASE WHEN br.winner_id = brp.user_id THEN 1 END) as bingo_wins
  FROM bingo_v2_room_players brp
  JOIN bingo_v2_rooms br ON br.id = brp.room_id
  WHERE br.status = 'finished'
  GROUP BY brp.user_id
)
UPDATE users u
SET 
  total_games_played = COALESCE(t.ttt_games, 0) + COALESCE(b.bingo_games, 0),
  total_games_won = COALESCE(t.ttt_wins, 0) + COALESCE(b.bingo_wins, 0),
  experience = COALESCE(t.ttt_games, 0) + COALESCE(b.bingo_games, 0) + 
               COALESCE(t.ttt_wins, 0) + COALESCE(b.bingo_wins, 0)
FROM ttt_stats t
FULL OUTER JOIN bingo_stats b ON t.user_id = b.user_id
WHERE u.id = COALESCE(t.user_id, b.user_id);

-- Verificar resultado final
SELECT 
  username,
  experience,
  total_games_played,
  total_games_won,
  CASE 
    WHEN total_games_played > 0 
    THEN ROUND((total_games_won::NUMERIC / total_games_played * 100), 1)
    ELSE 0
  END as win_rate_percent
FROM users
WHERE experience > 0 OR total_games_played > 0
ORDER BY experience DESC
LIMIT 10;
