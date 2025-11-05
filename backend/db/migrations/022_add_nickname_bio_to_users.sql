-- ============================================
-- MIGRACIÓN 022: Añadir nickname y bio a users
-- ============================================
-- Descripción: Columnas para alias único y biografía del usuario
-- Fecha: 2025-11-05
-- Errores resueltos:
--   - column u.nickname does not exist
-- Referencia: backend/routes/profile.js usa nickname en queries
-- ============================================

BEGIN;

-- ============================================
-- TABLA USERS: Añadir nickname y bio
-- ============================================

-- Columna nickname: alias único del usuario (máx. 20 caracteres)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(20) UNIQUE;

-- Columna bio: biografía del usuario (máx. 500 caracteres)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

-- ============================================
-- ÍNDICES
-- ============================================

-- Índice para búsqueda rápida de nickname (solo registros con nickname)
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) 
WHERE nickname IS NOT NULL;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN users.nickname IS 'Alias único del usuario (máximo 20 caracteres)';
COMMENT ON COLUMN users.bio IS 'Biografía del usuario (máximo 500 caracteres)';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name IN ('nickname', 'bio')
  ) THEN
    RAISE NOTICE '✅ Migración 022 completada: nickname y bio añadidos a users';
  END IF;
END $$;
