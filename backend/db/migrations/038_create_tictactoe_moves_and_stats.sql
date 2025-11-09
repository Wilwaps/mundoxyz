-- Migración 038: Actualizar schema de tictactoe_moves y crear tictactoe_stats
-- Propósito: Añadir columnas faltantes (row, col, move_number) a tabla existente
-- Fecha: 2025-11-08

BEGIN;

-- ================================================
-- 1. TABLA: tictactoe_moves - Añadir columnas faltantes
-- ================================================

-- Crear tabla base si no existe (por si acaso)
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Añadir columnas faltantes si no existen
DO $$
BEGIN
  -- Añadir columna row si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_moves' AND column_name = 'row'
  ) THEN
    ALTER TABLE tictactoe_moves 
    ADD COLUMN row INTEGER CHECK (row >= 0 AND row <= 2);
    RAISE NOTICE 'Columna row añadida a tictactoe_moves';
  END IF;
  
  -- Añadir columna col si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_moves' AND column_name = 'col'
  ) THEN
    ALTER TABLE tictactoe_moves 
    ADD COLUMN col INTEGER CHECK (col >= 0 AND col <= 2);
    RAISE NOTICE 'Columna col añadida a tictactoe_moves';
  END IF;
  
  -- Añadir columna move_number si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_moves' AND column_name = 'move_number'
  ) THEN
    ALTER TABLE tictactoe_moves 
    ADD COLUMN move_number INTEGER CHECK (move_number > 0 AND move_number <= 9);
    RAISE NOTICE 'Columna move_number añadida a tictactoe_moves';
  END IF;
END $$;

-- Añadir constraint único si no existe (puede fallar si ya existe, ignoramos)
DO $$
BEGIN
  ALTER TABLE tictactoe_moves 
  ADD CONSTRAINT unique_move_position UNIQUE (room_id, row, col);
  RAISE NOTICE 'Constraint unique_move_position añadido';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint unique_move_position ya existe';
END $$;

-- Crear índices (IF NOT EXISTS los hace seguros)
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id, move_number);
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_player ON tictactoe_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_created ON tictactoe_moves(created_at DESC);

-- ================================================
-- 2. TABLA: tictactoe_stats (Estadísticas por jugador)
-- ================================================
CREATE TABLE IF NOT EXISTS tictactoe_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Partidas
  games_played INTEGER DEFAULT 0 CHECK (games_played >= 0),
  games_won INTEGER DEFAULT 0 CHECK (games_won >= 0),
  games_lost INTEGER DEFAULT 0 CHECK (games_lost >= 0),
  games_draw INTEGER DEFAULT 0 CHECK (games_draw >= 0),
  
  -- Rachas
  current_streak INTEGER DEFAULT 0, -- Victorias consecutivas (se resetea al perder)
  best_streak INTEGER DEFAULT 0,
  
  -- Economía
  total_coins_won NUMERIC(10,2) DEFAULT 0,
  total_coins_lost NUMERIC(10,2) DEFAULT 0,
  total_fires_won NUMERIC(10,2) DEFAULT 0,
  total_fires_lost NUMERIC(10,2) DEFAULT 0,
  
  -- Tiempos
  avg_game_duration INTEGER, -- Segundos promedio
  fastest_win INTEGER, -- Victoria más rápida en segundos
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_games CHECK (games_played = games_won + games_lost + games_draw),
  CONSTRAINT valid_streak CHECK (current_streak >= 0 AND best_streak >= current_streak)
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_streak ON tictactoe_stats(best_streak DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_wins ON tictactoe_stats(games_won DESC);

-- Comentarios para documentación
COMMENT ON TABLE tictactoe_moves IS 'Auditoría de movimientos de La Vieja (TicTacToe)';
COMMENT ON TABLE tictactoe_stats IS 'Estadísticas de jugadores de La Vieja';
COMMENT ON COLUMN tictactoe_moves.move_number IS 'Número secuencial del movimiento en la partida (1-9)';
COMMENT ON COLUMN tictactoe_stats.current_streak IS 'Racha actual de victorias consecutivas';
COMMENT ON COLUMN tictactoe_stats.best_streak IS 'Mejor racha histórica de victorias consecutivas';

-- Log final
DO $$ BEGIN
  RAISE NOTICE '✅ Migración 038 completada: tablas tictactoe_moves y tictactoe_stats creadas';
END $$;

COMMIT;
