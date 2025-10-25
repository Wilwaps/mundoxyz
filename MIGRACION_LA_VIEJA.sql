-- ================================================
-- MIGRACIÓN: Juego "La Vieja" (Tic-Tac-Toe)
-- Ejecutar en Railway PostgreSQL Query
-- ================================================

BEGIN;

-- ================================================
-- 1. TABLA: tictactoe_rooms (Salas de juego)
-- ================================================
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  
  -- Host y configuración
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('friendly', 'coins', 'fires')),
  bet_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (bet_amount >= 0),
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')) DEFAULT 'public',
  
  -- Estado
  status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')) DEFAULT 'waiting',
  
  -- Jugadores
  player_x_id UUID REFERENCES users(id) ON DELETE SET NULL, -- X (host)
  player_o_id UUID REFERENCES users(id) ON DELETE SET NULL, -- O (invitado)
  player_x_ready BOOLEAN DEFAULT FALSE,
  player_o_ready BOOLEAN DEFAULT FALSE,
  
  -- Juego
  current_turn VARCHAR(1) CHECK (current_turn IN ('X', 'O', NULL)),
  board JSONB DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]',
  moves_history JSONB DEFAULT '[]', -- [{player, symbol, row, col, timestamp, moveNumber}]
  
  -- Resultado
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner_symbol VARCHAR(1) CHECK (winner_symbol IN ('X', 'O', NULL)),
  winning_line JSONB, -- {type: 'row'|'col'|'diag', index: 0|1|2}
  is_draw BOOLEAN DEFAULT FALSE,
  
  -- Economía
  pot_coins NUMERIC(10,2) DEFAULT 0,
  pot_fires NUMERIC(10,2) DEFAULT 0,
  prize_coins NUMERIC(10,2) DEFAULT 0,
  prize_fires NUMERIC(10,2) DEFAULT 0,
  commission_coins NUMERIC(10,2) DEFAULT 0,
  commission_fires NUMERIC(10,2) DEFAULT 0,
  
  -- Experiencia
  xp_awarded BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 minutes'),
  
  -- Constraints
  CONSTRAINT valid_players CHECK (player_x_id IS NOT NULL OR player_o_id IS NOT NULL),
  CONSTRAINT valid_bet CHECK (
    (mode = 'friendly' AND bet_amount = 0) OR
    (mode IN ('coins', 'fires') AND bet_amount >= 10 AND bet_amount <= 1000)
  )
);

-- Índices para tictactoe_rooms
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_code ON tictactoe_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_status ON tictactoe_rooms(status);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_host ON tictactoe_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_mode ON tictactoe_rooms(mode);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_visibility 
  ON tictactoe_rooms(visibility, status) 
  WHERE status = 'waiting' AND player_o_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_created ON tictactoe_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_expires ON tictactoe_rooms(expires_at) WHERE status IN ('waiting', 'ready');

-- ================================================
-- 2. TABLA: tictactoe_moves (Historial de movimientos)
-- ================================================
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  row INTEGER NOT NULL CHECK (row >= 0 AND row <= 2),
  col INTEGER NOT NULL CHECK (col >= 0 AND col <= 2),
  move_number INTEGER NOT NULL CHECK (move_number > 0 AND move_number <= 9),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: un movimiento por posición por sala
  CONSTRAINT unique_move_position UNIQUE (room_id, row, col)
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id, move_number);
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_player ON tictactoe_moves(player_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_created ON tictactoe_moves(created_at DESC);

-- ================================================
-- 3. TABLA: tictactoe_stats (Estadísticas por jugador)
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

CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_wins ON tictactoe_stats(games_won DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_played ON tictactoe_stats(games_played DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_streak ON tictactoe_stats(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_stats_best_streak ON tictactoe_stats(best_streak DESC);

-- ================================================
-- 4. FUNCIÓN: Limpiar salas expiradas automáticamente
-- ================================================
CREATE OR REPLACE FUNCTION clean_expired_tictactoe_rooms()
RETURNS void AS $$
BEGIN
  UPDATE tictactoe_rooms
  SET status = 'cancelled'
  WHERE status IN ('waiting', 'ready')
    AND expires_at < NOW()
    AND status != 'cancelled';
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 5. FUNCIÓN: Actualizar estadísticas tras partida
-- ================================================
CREATE OR REPLACE FUNCTION update_tictactoe_stats()
RETURNS TRIGGER AS $$
DECLARE
  game_duration INTEGER;
BEGIN
  -- Solo ejecutar cuando el juego termine
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    game_duration := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::INTEGER;
    
    -- Actualizar stats del jugador X
    INSERT INTO tictactoe_stats (user_id, games_played, games_won, games_lost, games_draw, 
                                   total_coins_won, total_coins_lost, total_fires_won, total_fires_lost,
                                   avg_game_duration, fastest_win, current_streak, best_streak)
    VALUES (
      NEW.player_x_id,
      1,
      CASE WHEN NEW.winner_id = NEW.player_x_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id IS NOT NULL AND NEW.winner_id != NEW.player_x_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_x_id AND NEW.mode = 'coins' THEN NEW.prize_coins ELSE 0 END,
      CASE WHEN NEW.winner_id != NEW.player_x_id AND NEW.mode = 'coins' THEN NEW.bet_amount ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_x_id AND NEW.mode = 'fires' THEN NEW.prize_fires ELSE 0 END,
      CASE WHEN NEW.winner_id != NEW.player_x_id AND NEW.mode = 'fires' THEN NEW.bet_amount ELSE 0 END,
      game_duration,
      CASE WHEN NEW.winner_id = NEW.player_x_id THEN game_duration ELSE NULL END,
      CASE WHEN NEW.winner_id = NEW.player_x_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_x_id THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = tictactoe_stats.games_played + 1,
      games_won = tictactoe_stats.games_won + CASE WHEN NEW.winner_id = NEW.player_x_id THEN 1 ELSE 0 END,
      games_lost = tictactoe_stats.games_lost + CASE WHEN NEW.winner_id IS NOT NULL AND NEW.winner_id != NEW.player_x_id THEN 1 ELSE 0 END,
      games_draw = tictactoe_stats.games_draw + CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      total_coins_won = tictactoe_stats.total_coins_won + CASE WHEN NEW.winner_id = NEW.player_x_id AND NEW.mode = 'coins' THEN NEW.prize_coins ELSE 0 END,
      total_coins_lost = tictactoe_stats.total_coins_lost + CASE WHEN NEW.winner_id != NEW.player_x_id AND NEW.mode = 'coins' THEN NEW.bet_amount ELSE 0 END,
      total_fires_won = tictactoe_stats.total_fires_won + CASE WHEN NEW.winner_id = NEW.player_x_id AND NEW.mode = 'fires' THEN NEW.prize_fires ELSE 0 END,
      total_fires_lost = tictactoe_stats.total_fires_lost + CASE WHEN NEW.winner_id != NEW.player_x_id AND NEW.mode = 'fires' THEN NEW.bet_amount ELSE 0 END,
      avg_game_duration = (COALESCE(tictactoe_stats.avg_game_duration, 0) * tictactoe_stats.games_played + game_duration) / (tictactoe_stats.games_played + 1),
      fastest_win = CASE 
        WHEN NEW.winner_id = NEW.player_x_id THEN LEAST(COALESCE(tictactoe_stats.fastest_win, 999999), game_duration)
        ELSE tictactoe_stats.fastest_win
      END,
      current_streak = CASE 
        WHEN NEW.winner_id = NEW.player_x_id THEN tictactoe_stats.current_streak + 1
        WHEN NEW.winner_id IS NOT NULL THEN 0
        ELSE tictactoe_stats.current_streak
      END,
      best_streak = CASE 
        WHEN NEW.winner_id = NEW.player_x_id THEN GREATEST(tictactoe_stats.best_streak, tictactoe_stats.current_streak + 1)
        ELSE tictactoe_stats.best_streak
      END,
      updated_at = NOW();
    
    -- Actualizar stats del jugador O (similar)
    INSERT INTO tictactoe_stats (user_id, games_played, games_won, games_lost, games_draw, 
                                   total_coins_won, total_coins_lost, total_fires_won, total_fires_lost,
                                   avg_game_duration, fastest_win, current_streak, best_streak)
    VALUES (
      NEW.player_o_id,
      1,
      CASE WHEN NEW.winner_id = NEW.player_o_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id IS NOT NULL AND NEW.winner_id != NEW.player_o_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_o_id AND NEW.mode = 'coins' THEN NEW.prize_coins ELSE 0 END,
      CASE WHEN NEW.winner_id != NEW.player_o_id AND NEW.mode = 'coins' THEN NEW.bet_amount ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_o_id AND NEW.mode = 'fires' THEN NEW.prize_fires ELSE 0 END,
      CASE WHEN NEW.winner_id != NEW.player_o_id AND NEW.mode = 'fires' THEN NEW.bet_amount ELSE 0 END,
      game_duration,
      CASE WHEN NEW.winner_id = NEW.player_o_id THEN game_duration ELSE NULL END,
      CASE WHEN NEW.winner_id = NEW.player_o_id THEN 1 ELSE 0 END,
      CASE WHEN NEW.winner_id = NEW.player_o_id THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = tictactoe_stats.games_played + 1,
      games_won = tictactoe_stats.games_won + CASE WHEN NEW.winner_id = NEW.player_o_id THEN 1 ELSE 0 END,
      games_lost = tictactoe_stats.games_lost + CASE WHEN NEW.winner_id IS NOT NULL AND NEW.winner_id != NEW.player_o_id THEN 1 ELSE 0 END,
      games_draw = tictactoe_stats.games_draw + CASE WHEN NEW.is_draw THEN 1 ELSE 0 END,
      total_coins_won = tictactoe_stats.total_coins_won + CASE WHEN NEW.winner_id = NEW.player_o_id AND NEW.mode = 'coins' THEN NEW.prize_coins ELSE 0 END,
      total_coins_lost = tictactoe_stats.total_coins_lost + CASE WHEN NEW.winner_id != NEW.player_o_id AND NEW.mode = 'coins' THEN NEW.bet_amount ELSE 0 END,
      total_fires_won = tictactoe_stats.total_fires_won + CASE WHEN NEW.winner_id = NEW.player_o_id AND NEW.mode = 'fires' THEN NEW.prize_fires ELSE 0 END,
      total_fires_lost = tictactoe_stats.total_fires_lost + CASE WHEN NEW.winner_id != NEW.player_o_id AND NEW.mode = 'fires' THEN NEW.bet_amount ELSE 0 END,
      avg_game_duration = (COALESCE(tictactoe_stats.avg_game_duration, 0) * tictactoe_stats.games_played + game_duration) / (tictactoe_stats.games_played + 1),
      fastest_win = CASE 
        WHEN NEW.winner_id = NEW.player_o_id THEN LEAST(COALESCE(tictactoe_stats.fastest_win, 999999), game_duration)
        ELSE tictactoe_stats.fastest_win
      END,
      current_streak = CASE 
        WHEN NEW.winner_id = NEW.player_o_id THEN tictactoe_stats.current_streak + 1
        WHEN NEW.winner_id IS NOT NULL THEN 0
        ELSE tictactoe_stats.current_streak
      END,
      best_streak = CASE 
        WHEN NEW.winner_id = NEW.player_o_id THEN GREATEST(tictactoe_stats.best_streak, tictactoe_stats.current_streak + 1)
        ELSE tictactoe_stats.best_streak
      END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
CREATE TRIGGER trigger_update_tictactoe_stats
AFTER UPDATE OF status ON tictactoe_rooms
FOR EACH ROW
EXECUTE FUNCTION update_tictactoe_stats();

COMMIT;

-- ================================================
-- VERIFICACIÓN (ejecutar después)
-- ================================================

-- Verificar tabla tictactoe_rooms
SELECT 'tictactoe_rooms' as table_name, COUNT(*) as rows FROM tictactoe_rooms;

-- Verificar tabla tictactoe_moves
SELECT 'tictactoe_moves' as table_name, COUNT(*) as rows FROM tictactoe_moves;

-- Verificar tabla tictactoe_stats
SELECT 'tictactoe_stats' as table_name, COUNT(*) as rows FROM tictactoe_stats;

-- Verificar índices creados
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE 'tictactoe%'
ORDER BY tablename, indexname;

-- Verificar constraints
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid IN (
  SELECT oid FROM pg_class WHERE relname LIKE 'tictactoe%'
)
ORDER BY conname;

-- ================================================
-- RESULTADO ESPERADO:
-- - 3 tablas creadas (rooms, moves, stats)
-- - Múltiples índices para performance
-- - Constraints de validación
-- - 2 funciones (clean_expired, update_stats)
-- - 1 trigger (actualizar stats al finalizar)
-- ================================================
