-- ============================================
-- MIGRACIÓN 015: Connection Logs
-- ============================================
-- Descripción: Crea tabla connection_logs para auditoría de conexiones
-- Fecha: 2025-11-04
-- Dependencias: user_sessions (migración 014)
-- Requerido por: Login Telegram, Login Email (auditoría)
-- ============================================

BEGIN;

-- ============================================
-- TABLA: connection_logs
-- ============================================
CREATE TABLE IF NOT EXISTS connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  platform VARCHAR(64),
  path VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance y consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_id ON connection_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_logs_session_id ON connection_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_logs_created_at ON connection_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_event_type ON connection_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_event ON connection_logs(user_id, event_type, created_at DESC) WHERE user_id IS NOT NULL;

-- Comentarios
COMMENT ON TABLE connection_logs IS 'Registro de auditoría de conexiones y eventos de usuarios';
COMMENT ON COLUMN connection_logs.event_type IS 'Tipos: login, logout, session_refresh, api_call, etc.';
COMMENT ON COLUMN connection_logs.session_id IS 'FK a user_sessions si la conexión está asociada a una sesión';
COMMENT ON COLUMN connection_logs.meta IS 'Información adicional del evento en formato JSON';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  logs_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO logs_count FROM information_schema.tables WHERE table_name = 'connection_logs';
  
  IF logs_count > 0 THEN
    RAISE NOTICE '✅ Migración 015 completada: connection_logs creada';
    RAISE NOTICE '📊 Tabla lista para auditoría de conexiones';
  END IF;
END $$;
