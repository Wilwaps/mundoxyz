-- 048_create_welcome_event_history.sql
-- Historial de acciones de eventos de bienvenida

BEGIN;

CREATE TABLE IF NOT EXISTS welcome_event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_event_history_event
  ON welcome_event_history(event_id, created_at DESC);

COMMIT;
