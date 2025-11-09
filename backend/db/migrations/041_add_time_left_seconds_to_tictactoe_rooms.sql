-- Migración 041: Añadir columna time_left_seconds a tictactoe_rooms
-- Propósito: El código backend actualiza time_left_seconds pero la columna no existe en Railway
-- Fecha: 2025-11-08

BEGIN;

-- Añadir columna time_left_seconds si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'tictactoe_rooms' 
      AND column_name = 'time_left_seconds'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN time_left_seconds INTEGER DEFAULT 15 CHECK (time_left_seconds >= 0);
    
    RAISE NOTICE '✅ Columna time_left_seconds añadida a tictactoe_rooms';
  ELSE
    RAISE NOTICE 'ℹ️ Columna time_left_seconds ya existe en tictactoe_rooms';
  END IF;
END $$;

-- Crear índice para consultas por tiempo restante
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_time_left 
ON tictactoe_rooms(time_left_seconds) 
WHERE status = 'playing';

-- Verificación
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'tictactoe_rooms' 
      AND column_name = 'time_left_seconds'
  ) INTO col_exists;
  
  IF col_exists THEN
    RAISE NOTICE '✅ Verificado: columna time_left_seconds existe en tictactoe_rooms';
  ELSE
    RAISE WARNING '⚠️ ATENCIÓN: columna time_left_seconds NO existe después de migración';
  END IF;
END $$;

COMMIT;

-- ================================================
-- NOTA TÉCNICA
-- ================================================
-- Esta columna es usada por el backend en routes/tictactoe.js línea 609:
-- UPDATE tictactoe_rooms SET time_left_seconds = 15 WHERE id = ...
--
-- Se usa para el timer de turno en el juego.
-- Default: 15 segundos por turno
-- Check constraint: >= 0 (no puede ser negativo)
