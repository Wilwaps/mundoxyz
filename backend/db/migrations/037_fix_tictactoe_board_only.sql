-- Migración 037: Fix TicTacToe - Solo corregir board a JSONB
-- Propósito: La tabla YA tiene winner_id y winner_symbol. Solo necesitamos migrar board.
-- Fecha: 2025-11-08

BEGIN;

-- 1. Verificar si board es TEXT y convertir a JSONB
-- Nota: En producción board puede ser TEXT o ya ser JSONB
DO $$
DECLARE
  board_type text;
BEGIN
  -- Obtener tipo actual de la columna board
  SELECT data_type INTO board_type
  FROM information_schema.columns
  WHERE table_name = 'tictactoe_rooms' 
    AND column_name = 'board';
  
  RAISE NOTICE 'Tipo actual de board: %', board_type;
  
  -- Solo migrar si NO es jsonb
  IF board_type != 'jsonb' THEN
    RAISE NOTICE 'Migrando board de % a JSONB...', board_type;
    
    -- Crear columna temporal
    ALTER TABLE tictactoe_rooms ADD COLUMN IF NOT EXISTS board_temp JSONB;
    
    -- Migrar datos válidos o usar default
    UPDATE tictactoe_rooms 
    SET board_temp = CASE
      -- Si es NULL o vacío, usar default
      WHEN board IS NULL OR TRIM(board) = '' THEN '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
      -- Si parece JSON válido, convertir
      WHEN board ~ '^\[.*\]$' THEN 
        CASE
          WHEN board::jsonb IS NOT NULL THEN board::jsonb
          ELSE '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
        END
      -- Cualquier otro caso, usar default
      ELSE '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
    END;
    
    -- Reemplazar columna vieja
    ALTER TABLE tictactoe_rooms DROP COLUMN board;
    ALTER TABLE tictactoe_rooms RENAME COLUMN board_temp TO board;
    
    -- Establecer default y NOT NULL
    ALTER TABLE tictactoe_rooms 
    ALTER COLUMN board SET DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb,
    ALTER COLUMN board SET NOT NULL;
    
    RAISE NOTICE '✅ Board migrado exitosamente a JSONB';
  ELSE
    RAISE NOTICE '✅ Board ya es JSONB, no se requiere migración';
  END IF;
END $$;

-- 2. Actualizar status CHECK constraint para incluir 'ready' si no existe
-- Nota: Esto es seguro ejecutar múltiples veces
ALTER TABLE tictactoe_rooms DROP CONSTRAINT IF EXISTS tictactoe_rooms_status_check;
ALTER TABLE tictactoe_rooms ADD CONSTRAINT tictactoe_rooms_status_check 
  CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled'));

-- 3. Índices de optimización (IF NOT EXISTS es seguro)
CREATE INDEX IF NOT EXISTS idx_tictactoe_winner_id 
  ON tictactoe_rooms(winner_id) WHERE winner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tictactoe_status_playing 
  ON tictactoe_rooms(status) WHERE status = 'playing';

-- 4. Comentarios para documentación
COMMENT ON COLUMN tictactoe_rooms.board IS 'Tablero 3x3 como array JSONB: [[null,X,O],[null,null,X],[O,null,null]]';
COMMENT ON COLUMN tictactoe_rooms.winner_id IS 'UUID del jugador ganador (ya existía desde inicio)';
COMMENT ON COLUMN tictactoe_rooms.winner_symbol IS 'Símbolo del ganador: X o O (ya existía desde inicio)';

-- Log final
DO $$ BEGIN
  RAISE NOTICE '✅ Migración 037 completada: board convertido a JSONB';
END $$;

COMMIT;
