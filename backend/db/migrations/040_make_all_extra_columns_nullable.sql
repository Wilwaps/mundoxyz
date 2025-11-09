-- Migración 040: Hacer NULLABLE todas las columnas extra/legacy en tictactoe_moves
-- Propósito: El schema real en Railway tiene columnas adicionales (position, board_after, etc)
--            que el código backend NO usa. Necesitamos hacerlas todas NULLABLE.
-- Fecha: 2025-11-08

BEGIN;

-- ================================================
-- ESTRATEGIA: Hacer NULLABLE todas las columnas excepto las esenciales
-- ================================================
-- Columnas esenciales que el backend SÍ usa:
-- - id, room_id, player_id, symbol, row, col, move_number, created_at
--
-- Cualquier otra columna debe ser NULLABLE

DO $$
DECLARE
  col_name TEXT;
  col_nullable TEXT;
  col_count INTEGER := 0;
BEGIN
  -- Iterar sobre todas las columnas de tictactoe_moves
  FOR col_name, col_nullable IN 
    SELECT column_name, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'tictactoe_moves'
      AND is_nullable = 'NO'
      -- Excluir columnas esenciales que DEBEN ser NOT NULL
      AND column_name NOT IN ('id', 'room_id', 'player_id', 'symbol', 'row', 'col', 'move_number')
  LOOP
    -- Hacer la columna NULLABLE
    EXECUTE format('ALTER TABLE tictactoe_moves ALTER COLUMN %I DROP NOT NULL', col_name);
    col_count := col_count + 1;
    RAISE NOTICE '✅ Columna % cambiada a NULLABLE (legacy/extra no usada)', col_name;
  END LOOP;
  
  IF col_count = 0 THEN
    RAISE NOTICE 'ℹ️ No hay columnas extra con NOT NULL, schema ya está correcto';
  ELSE
    RAISE NOTICE '✅ Total de columnas extra cambiadas a NULLABLE: %', col_count;
  END IF;
END $$;

-- ================================================
-- VERIFICACIÓN: Listar todas las columnas y su nullability
-- ================================================
DO $$
DECLARE
  col_record RECORD;
BEGIN
  RAISE NOTICE '📋 Schema final de tictactoe_moves:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  FOR col_record IN 
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'tictactoe_moves'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  % | % | % | Default: %', 
      RPAD(col_record.column_name, 20),
      RPAD(col_record.data_type, 15),
      CASE WHEN col_record.is_nullable = 'YES' THEN 'NULL' ELSE 'NOT NULL' END,
      COALESCE(col_record.column_default, 'none');
  END LOOP;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

COMMIT;

-- ================================================
-- NOTA TÉCNICA
-- ================================================
-- Esta migración resuelve el problema de columnas desconocidas con NOT NULL
-- que causan errores cuando el backend intenta INSERT sin proveer valores.
--
-- Errores que resuelve:
-- - "null value in column 'position' violates not-null constraint"
-- - "null value in column 'board_after' violates not-null constraint"
-- - Cualquier otra columna extra que pueda existir en Railway
--
-- El código backend (routes/tictactoe.js línea 525-528) solo inserta:
-- INSERT INTO tictactoe_moves (room_id, player_id, symbol, row, col, move_number)
--
-- Por lo tanto, todas las demás columnas deben permitir NULL.
