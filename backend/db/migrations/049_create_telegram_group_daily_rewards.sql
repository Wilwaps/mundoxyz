-- ============================================
-- MIGRACIÓN 049: Recompensas por mensajes en grupo de Telegram
-- ============================================
-- Descripción: Tabla para registrar actividad diaria en el grupo oficial
--              y calcular recompensas en coins por mensajes.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS telegram_group_daily_rewards (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL,
  activity_date DATE NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  coins_earned DECIMAL(20,2) NOT NULL DEFAULT 0,
  coins_claimed DECIMAL(20,2) NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP,
  last_claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (coins_earned >= 0),
  CHECK (coins_claimed >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_group_rewards_tg_date
  ON telegram_group_daily_rewards (tg_id, activity_date);

CREATE INDEX IF NOT EXISTS idx_tg_group_rewards_tg
  ON telegram_group_daily_rewards (tg_id);

COMMIT;
