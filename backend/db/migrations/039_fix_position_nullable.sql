-- Migración 039: Hacer columna position NULLABLE en tictactoe_moves
-- Propósito: Columna legacy "position" tiene NOT NULL pero código actual no la usa
-- Fecha: 2025-11-08

BEGIN;

-- Hacer columna position NULLABLE si existe y es NOT NULL
DO $$
BEGIN
  -- Verificar si columna position existe y es NOT NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'tictactoe_moves' 
      AND column_name = 'position' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tictactoe_moves ALTER COLUMN position DROP NOT NULL;
    RAISE NOTICE '✅ Columna position cambiada a NULLABLE (legacy, no usada por código actual)';
  ELSE
    RAISE NOTICE 'ℹ️ Columna position ya es NULLABLE o no existe';
  END IF;
END $$;

-- Verificar resultado
DO $$
DECLARE
  col_nullable TEXT;
BEGIN
  SELECT is_nullable INTO col_nullable
  FROM information_schema.columns 
  WHERE table_schema = 'public'
    AND table_name = 'tictactoe_moves' 
    AND column_name = 'position';
  
  IF col_nullable = 'YES' THEN
    RAISE NOTICE '✅ Verificado: columna position es NULLABLE';
  ELSIF col_nullable = 'NO' THEN
    RAISE WARNING '⚠️ ATENCIÓN: columna position sigue siendo NOT NULL';
  ELSE
    RAISE NOTICE 'ℹ️ Columna position no existe en la tabla';
  END IF;
END $$;

COMMIT;

-- Comentario técnico:
-- Esta migración resuelve el error:
-- "null value in column 'position' violates not-null constraint"
-- 
-- La columna 'position' es legacy de un schema antiguo pero el código backend
-- actual usa las columnas 'row' y 'col' en su lugar.
-- 
-- Backend INSERT (línea 525-528 de routes/tictactoe.js):
-- INSERT INTO tictactoe_moves (room_id, player_id, symbol, row, col, move_number)
-- 
-- No incluye 'position', por lo tanto debe ser NULLABLE.
