-- Migración 063: Añadir soporte para modo RON-IA en tictactoe_rooms
-- Fecha: 2025-11-24

BEGIN;

DO $$
BEGIN
  -- opponent_type: tipo de oponente ('player' | 'ron_ai')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'opponent_type'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN opponent_type TEXT NOT NULL DEFAULT 'player' 
      CHECK (opponent_type IN ('player', 'ron_ai'));
    RAISE NOTICE '✅ Columna opponent_type añadida a tictactoe_rooms';
  END IF;

  -- ai_difficulty: nivel de dificultad de RON-IA ('easy' | 'medium' | 'hard')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'ai_difficulty'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN ai_difficulty TEXT 
      CHECK (ai_difficulty IN ('easy', 'medium', 'hard'));
    RAISE NOTICE '✅ Columna ai_difficulty añadida a tictactoe_rooms';
  END IF;

  -- ai_profile: estado/configuración adicional de la IA (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'ai_profile'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN ai_profile JSONB DEFAULT NULL;
    RAISE NOTICE '✅ Columna ai_profile añadida a tictactoe_rooms';
  END IF;
END $$;

COMMIT;
