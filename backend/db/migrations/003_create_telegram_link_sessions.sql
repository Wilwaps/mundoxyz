-- ============================================
-- MIGRACIÓN 003: Telegram Link Sessions
-- ============================================
-- Descripción: Crea tabla para sesiones de vinculación de Telegram
-- Fecha: 2025-11-04
-- ============================================

BEGIN;

-- ============================================
-- TABLA: telegram_link_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(32) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_sessions_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_tg_sessions_user ON telegram_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_sessions_expires ON telegram_link_sessions(expires_at);

COMMENT ON TABLE telegram_link_sessions IS 'Sesiones temporales para vincular cuentas con Telegram';
COMMENT ON COLUMN telegram_link_sessions.link_token IS 'Token único de 32 caracteres para /start en Telegram';
COMMENT ON COLUMN telegram_link_sessions.expires_at IS 'Tokens expiran en 10 minutos por defecto';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telegram_link_sessions') THEN
    RAISE NOTICE '✅ Migración 003 completada: telegram_link_sessions creada';
  END IF;
END $$;
