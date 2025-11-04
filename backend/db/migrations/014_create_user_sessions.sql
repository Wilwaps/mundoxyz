-- ============================================
-- MIGRACIÓN 014: User Sessions
-- ============================================
-- Descripción: Crea tabla user_sessions para manejo de tokens JWT
-- Fecha: 2025-11-04
-- Requerido por: Login Telegram, Login Email, Refresh Token, Logout
-- ============================================

BEGIN;

-- ============================================
-- TABLA: user_sessions
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  ip_address INET,
  user_agent TEXT,
  platform VARCHAR(64),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

-- Comentarios
COMMENT ON TABLE user_sessions IS 'Sesiones de usuario con tokens JWT y refresh tokens';
COMMENT ON COLUMN user_sessions.session_token IS 'Token JWT principal (7 días)';
COMMENT ON COLUMN user_sessions.refresh_token IS 'Token para renovar sesión (30 días)';
COMMENT ON COLUMN user_sessions.is_active IS 'false cuando usuario hace logout';
COMMENT ON COLUMN user_sessions.expires_at IS 'Fecha de expiración de la sesión';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
    RAISE NOTICE '✅ Migración 014 completada: user_sessions creada';
  END IF;
END $$;
