-- ============================================
-- Migration 001: Create auth_identities table
-- Date: 2025-11-04
-- Description: Tabla crítica para autenticación multi-provider
-- ============================================

-- Crear tabla auth_identities si no existe
CREATE TABLE IF NOT EXISTS auth_identities (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'email', 'telegram', 'google', etc.
  provider_uid VARCHAR(255) NOT NULL, -- email, telegram_id, google_id, etc.
  password_hash TEXT, -- Solo para provider='email'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Un usuario puede tener múltiples providers, pero cada provider_uid es único
  UNIQUE(provider, provider_uid),
  
  -- Un usuario puede tener solo un identity por provider
  UNIQUE(user_id, provider)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth_identities(provider);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_uid ON auth_identities(provider, provider_uid);

-- Comentarios
COMMENT ON TABLE auth_identities IS 'Identidades de autenticación multi-provider (email, telegram, google, etc)';
COMMENT ON COLUMN auth_identities.provider IS 'Tipo de proveedor: email, telegram, google, facebook, etc';
COMMENT ON COLUMN auth_identities.provider_uid IS 'ID único del proveedor (email, telegram_id, etc)';
COMMENT ON COLUMN auth_identities.password_hash IS 'Hash de contraseña (solo para provider=email)';

-- Migrar datos existentes de users.tg_id a auth_identities
DO $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  -- Insertar identidades de Telegram existentes
  INSERT INTO auth_identities (user_id, provider, provider_uid, created_at)
  SELECT 
    id,
    'telegram',
    CAST(tg_id AS VARCHAR),
    created_at
  FROM users
  WHERE tg_id IS NOT NULL
  ON CONFLICT (user_id, provider) DO NOTHING;
  
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrados % usuarios con Telegram ID a auth_identities', migrated_count;
  
  -- Crear identidades de email para usuarios con email (sin password por ahora)
  INSERT INTO auth_identities (user_id, provider, provider_uid, created_at)
  SELECT 
    id,
    'email',
    email,
    created_at
  FROM users
  WHERE email IS NOT NULL AND email != ''
  ON CONFLICT (user_id, provider) DO NOTHING;
  
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrados % usuarios con email a auth_identities', migrated_count;
  
END $$;

-- Verificación
DO $$
DECLARE
  total_identities INTEGER;
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_identities FROM auth_identities;
  SELECT COUNT(*) INTO total_users FROM users;
  
  RAISE NOTICE '📊 Total auth_identities: %', total_identities;
  RAISE NOTICE '📊 Total users: %', total_users;
  
  IF total_identities = 0 THEN
    RAISE WARNING '⚠️  No se migraron identidades. Verifica que existan usuarios con tg_id o email';
  END IF;
END $$;
