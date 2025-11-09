-- Migración 042: Añadir TODAS las columnas faltantes a tictactoe_rooms
-- Propósito: Evitar ciclo de error tras error añadiendo todas las columnas necesarias de una vez
-- Fecha: 2025-11-08

BEGIN;

-- ================================================
-- AÑADIR TODAS LAS COLUMNAS FALTANTES
-- ================================================
DO $$
DECLARE
  col_count INTEGER := 0;
BEGIN
  -- 1. winning_line (línea ganadora)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'winning_line'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN winning_line JSONB DEFAULT NULL;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna winning_line añadida';
  END IF;
  
  -- 2. is_draw (empate)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'is_draw'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN is_draw BOOLEAN DEFAULT FALSE;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna is_draw añadida';
  END IF;
  
  -- 3. moves_history (historial de movimientos)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'moves_history'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN moves_history JSONB DEFAULT '[]'::jsonb;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna moves_history añadida';
  END IF;
  
  -- 4. last_move_at (último movimiento)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'last_move_at'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN last_move_at TIMESTAMP DEFAULT NULL;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna last_move_at añadida';
  END IF;
  
  -- 5. pot_coins (bote de coins)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'pot_coins'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN pot_coins NUMERIC(10,2) DEFAULT 0;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna pot_coins añadida';
  END IF;
  
  -- 6. pot_fires (bote de fires)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'pot_fires'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN pot_fires NUMERIC(10,2) DEFAULT 0;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna pot_fires añadida';
  END IF;
  
  -- 7. prize_coins (premio en coins)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'prize_coins'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN prize_coins NUMERIC(10,2) DEFAULT 0;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna prize_coins añadida';
  END IF;
  
  -- 8. prize_fires (premio en fires)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'prize_fires'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN prize_fires NUMERIC(10,2) DEFAULT 0;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna prize_fires añadida';
  END IF;
  
  -- 9. xp_awarded (XP ya otorgado)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'xp_awarded'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN xp_awarded BOOLEAN DEFAULT FALSE;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna xp_awarded añadida';
  END IF;
  
  -- 10. rematch_requested_by_x (revancha solicitada por X)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'rematch_requested_by_x'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN rematch_requested_by_x BOOLEAN DEFAULT FALSE;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna rematch_requested_by_x añadida';
  END IF;
  
  -- 11. rematch_requested_by_o (revancha solicitada por O)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'rematch_requested_by_o'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN rematch_requested_by_o BOOLEAN DEFAULT FALSE;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna rematch_requested_by_o añadida';
  END IF;
  
  -- 12. rematch_count (contador de revanchas)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'rematch_count'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN rematch_count INTEGER DEFAULT 0;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna rematch_count añadida';
  END IF;
  
  -- 13. is_rematch (es una sala de revancha)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'is_rematch'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN is_rematch BOOLEAN DEFAULT FALSE;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna is_rematch añadida';
  END IF;
  
  -- 14. original_room_id (ID de sala original)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'original_room_id'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN original_room_id UUID REFERENCES tictactoe_rooms(id) ON DELETE SET NULL;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna original_room_id añadida';
  END IF;
  
  -- 15. started_at (timestamp de inicio)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN started_at TIMESTAMP DEFAULT NULL;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna started_at añadida';
  END IF;
  
  -- 16. finished_at (timestamp de finalización)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'finished_at'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN finished_at TIMESTAMP DEFAULT NULL;
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna finished_at añadida';
  END IF;
  
  -- 17. expires_at (expiración de sala)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE tictactoe_rooms ADD COLUMN expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 minutes');
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna expires_at añadida';
  END IF;
  
  -- Resumen
  IF col_count = 0 THEN
    RAISE NOTICE 'ℹ️ Todas las columnas ya existen en tictactoe_rooms';
  ELSE
    RAISE NOTICE '✅ Total de columnas añadidas a tictactoe_rooms: %', col_count;
  END IF;
END $$;

-- ================================================
-- CREAR ÍNDICES
-- ================================================
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_winning_line 
ON tictactoe_rooms USING GIN (winning_line) 
WHERE winning_line IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_is_draw 
ON tictactoe_rooms(is_draw) 
WHERE is_draw = TRUE;

CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_expires 
ON tictactoe_rooms(expires_at) 
WHERE status IN ('waiting', 'ready');

CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_started_at 
ON tictactoe_rooms(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_finished_at 
ON tictactoe_rooms(finished_at DESC) 
WHERE status = 'finished';

COMMIT;

-- ================================================
-- NOTAS TÉCNICAS
-- ================================================
-- Esta migración añade TODAS las columnas que faltan en tictactoe_rooms
-- según el schema definido en MIGRACION_LA_VIEJA.sql
--
-- Columnas críticas para el funcionamiento del juego:
-- - winning_line: Registra línea ganadora para destacar en UI
-- - is_draw: Indica si el juego terminó en empate
-- - time_left_seconds: Timer de turno (ya añadida en 041)
-- - xp_awarded: Evita duplicación de XP
-- - rematch_*: Sistema de revanchas
-- - pot_* / prize_*: Economía del juego
-- - *_at: Timestamps para tracking
