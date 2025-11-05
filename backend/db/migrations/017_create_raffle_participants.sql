-- ============================================
-- MIGRACIÓN 017: Raffle Participants
-- ============================================
-- Descripción: Crea tabla raffle_participants para tracking de participación en rifas
-- Fecha: 2025-11-04
-- Requerido por: RaffleService, routes/games.js, routes/profile.js
-- ============================================

BEGIN;

-- ============================================
-- TABLA: raffle_participants
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_participants (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  numbers INTEGER[] DEFAULT '{}',
  fires_spent DECIMAL(20,2) DEFAULT 0,
  coins_spent DECIMAL(20,2) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raffle_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle ON raffle_participants(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_user ON raffle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle_user ON raffle_participants(raffle_id, user_id);

-- Comentarios
COMMENT ON TABLE raffle_participants IS 'Participantes de rifas con tracking de números y gastos';
COMMENT ON COLUMN raffle_participants.numbers IS 'Array de números comprados por el participante';
COMMENT ON COLUMN raffle_participants.fires_spent IS 'Total de fuegos gastados en esta rifa';
COMMENT ON COLUMN raffle_participants.coins_spent IS 'Total de monedas gastadas en esta rifa';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raffle_participants') THEN
    RAISE NOTICE '✅ Migración 017 completada: raffle_participants creada';
  END IF;
END $$;
