-- ================================================
-- MIGRACIÓN: Sistema de Experiencia (XP)
-- Ejecutar en Railway PostgreSQL Query
-- ================================================

BEGIN;

-- ================================================
-- 1. AGREGAR COLUMNAS A USERS
-- ================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_to_next_level INTEGER NOT NULL DEFAULT 100;

-- Índices para consultas eficientes (leaderboards)
CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_level ON users(current_level DESC);

-- ================================================
-- 2. CREAR TABLA XP_TRANSACTIONS
-- ================================================
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- XP otorgado (siempre positivo)
  xp_amount INTEGER NOT NULL CHECK (xp_amount > 0),
  
  -- Origen del XP
  game_type VARCHAR(50) NOT NULL, -- 'tictactoe', 'bingo', 'raffle'
  game_id UUID, -- ID de la sala/partida/rifa
  game_code VARCHAR(20), -- Código visible (para debugging)
  
  -- Estado del usuario antes/después
  level_before INTEGER NOT NULL,
  level_after INTEGER NOT NULL,
  total_xp_before INTEGER NOT NULL,
  total_xp_after INTEGER NOT NULL,
  
  -- Auditoría
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB -- Datos adicionales (victoria, racha, etc.)
);

-- Índices para queries comunes
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id 
  ON xp_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_game_type 
  ON xp_transactions(game_type);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at 
  ON xp_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_game_id 
  ON xp_transactions(game_id);

-- Índice compuesto para historial de usuario
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_game 
  ON xp_transactions(user_id, game_type, created_at DESC);

-- ================================================
-- 3. AGREGAR FLAGS XP_AWARDED A JUEGOS
-- ================================================

-- Bingo: prevenir doble otorgamiento
ALTER TABLE bingo_rooms 
  ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bingo_rooms_xp_awarded 
  ON bingo_rooms(xp_awarded) 
  WHERE status = 'finished';

-- Rifas: prevenir doble otorgamiento
ALTER TABLE raffles 
  ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_raffles_xp_awarded 
  ON raffles(xp_awarded) 
  WHERE status IN ('completed', 'finished');

COMMIT;

-- ================================================
-- VERIFICACIÓN (ejecuta esto después)
-- ================================================

-- Verificar columnas nuevas en users
SELECT 'users columns' as verification_step, column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('total_xp', 'current_level', 'xp_to_next_level')
ORDER BY column_name;

-- Verificar tabla xp_transactions
SELECT 'xp_transactions table' as verification_step, COUNT(*) as initial_rows 
FROM xp_transactions;

-- Verificar columna xp_awarded en bingo_rooms
SELECT 'bingo_rooms xp_awarded' as verification_step, 
       column_name, 
       data_type, 
       column_default 
FROM information_schema.columns 
WHERE table_name = 'bingo_rooms' 
  AND column_name = 'xp_awarded';

-- Verificar columna xp_awarded en raffles
SELECT 'raffles xp_awarded' as verification_step, 
       column_name, 
       data_type, 
       column_default 
FROM information_schema.columns 
WHERE table_name = 'raffles' 
  AND column_name = 'xp_awarded';

-- Contar usuarios existentes (recibirán valores por defecto)
SELECT 'existing users' as verification_step, COUNT(*) as total_users 
FROM users;

-- Verificar índices creados
SELECT 'indexes created' as verification_step, 
       indexname, 
       tablename 
FROM pg_indexes 
WHERE tablename IN ('users', 'xp_transactions', 'bingo_rooms', 'raffles')
  AND (indexname LIKE '%xp%' OR indexname LIKE '%level%')
ORDER BY tablename, indexname;

-- ================================================
-- RESULTADO ESPERADO:
-- - 3 columnas en users (total_xp, current_level, xp_to_next_level)
-- - tabla xp_transactions con 0 filas (vacía inicialmente)
-- - columna xp_awarded en bingo_rooms (boolean, default false)
-- - columna xp_awarded en raffles (boolean, default false)
-- - Todos los usuarios existentes con 0 XP, nivel 1
-- ================================================
