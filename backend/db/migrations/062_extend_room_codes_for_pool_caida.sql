-- Migration 062: Extend room_codes.game_type to support Pool and Caida
-- Description: Updates CHECK constraint and comment so that the unified room code
-- registry can be used by the new games 'pool' and 'caida'.

BEGIN;

-- Extend allowed game types in room_codes
ALTER TABLE room_codes
  DROP CONSTRAINT IF EXISTS room_codes_game_type_check;

ALTER TABLE room_codes
  ADD CONSTRAINT room_codes_game_type_check
    CHECK (game_type IN ('tictactoe', 'bingo', 'raffle', 'pool', 'caida'));

-- Update documentation comment
COMMENT ON COLUMN room_codes.game_type IS 'Tipo de juego: tictactoe, bingo, raffle, pool, caida';

COMMIT;
