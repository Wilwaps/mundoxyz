-- Migración 027: Corregir schema TicTacToe
-- Propósito: Agregar columnas faltantes y cambiar board a JSONB
-- Fecha: 2025-11-08

BEGIN;

-- 1. Agregar columnas winner_id y winner_symbol (usadas por código)
ALTER TABLE tictactoe_rooms 
ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS winner_symbol CHAR(1) CHECK (winner_symbol IN ('X', 'O'));

-- 2. Agregar columna ready para tracking de estado (usada por código)
ALTER TABLE tictactoe_rooms 
ADD COLUMN IF NOT EXISTS status_ready VARCHAR(20);

UPDATE tictactoe_rooms 
SET status_ready = 'ready'
WHERE player_x_ready = TRUE AND player_o_ready = TRUE AND status = 'waiting';

-- 3. Migrar winner a winner_symbol si existe
UPDATE tictactoe_rooms 
SET winner_symbol = winner 
WHERE winner IS NOT NULL AND winner IN ('X', 'O');

-- 4. Crear columna temporal para board JSONB
ALTER TABLE tictactoe_rooms 
ADD COLUMN IF NOT EXISTS board_jsonb JSONB;

-- 5. Migrar datos de board TEXT a JSONB
-- Convertir espacios en blanco o strings inválidos a array null 3x3
UPDATE tictactoe_rooms 
SET board_jsonb = '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
WHERE board IS NULL 
   OR TRIM(board) = '' 
   OR LENGTH(TRIM(board)) = 9;  -- 9 espacios del default

-- Intentar parsear boards que parecen JSON válidos
UPDATE tictactoe_rooms 
SET board_jsonb = board::jsonb
WHERE board IS NOT NULL 
  AND TRIM(board) != ''
  AND LENGTH(TRIM(board)) > 9
  AND board ~ '^\[.*\]$';  -- Parece un array JSON

-- Para cualquier board que no se pudo convertir, usar default
UPDATE tictactoe_rooms 
SET board_jsonb = '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
WHERE board_jsonb IS NULL;

-- 6. Eliminar columna board vieja y renombrar
ALTER TABLE tictactoe_rooms DROP COLUMN IF EXISTS board;
ALTER TABLE tictactoe_rooms RENAME COLUMN board_jsonb TO board;

-- 7. Establecer default para board
ALTER TABLE tictactoe_rooms 
ALTER COLUMN board SET DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb;

-- 8. Agregar constraint NOT NULL después de migración
ALTER TABLE tictactoe_rooms 
ALTER COLUMN board SET NOT NULL;

-- 9. Actualizar status 'ready' a 'playing' si es necesario
UPDATE tictactoe_rooms 
SET status = 'playing'
WHERE status = 'waiting' 
  AND player_x_ready = TRUE 
  AND player_o_ready = TRUE
  AND started_at IS NOT NULL;

-- 10. Índices para optimización
CREATE INDEX IF NOT EXISTS idx_tictactoe_winner_id ON tictactoe_rooms(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tictactoe_status_playing ON tictactoe_rooms(status) WHERE status = 'playing';

-- Comentarios
COMMENT ON COLUMN tictactoe_rooms.winner_id IS 'UUID del jugador ganador';
COMMENT ON COLUMN tictactoe_rooms.winner_symbol IS 'Símbolo del ganador: X o O';
COMMENT ON COLUMN tictactoe_rooms.board IS 'Tablero 3x3 como array JSONB: [[null,X,O],[null,null,X],[O,null,null]]';

COMMIT;
