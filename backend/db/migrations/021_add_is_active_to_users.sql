-- ============================================
-- MIGRACIÓN 021: Añadir columna is_active a users
-- ============================================
-- Descripción: Columna para controlar usuarios activos/desactivados
-- Fecha: 2025-11-05
-- Error resuelto: column u.is_active does not exist
-- ============================================

BEGIN;

-- ============================================
-- TABLA USERS: Añadir columna is_active
-- ============================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Comentario
COMMENT ON COLUMN users.is_active IS 'Indica si el usuario está activo (true) o desactivado (false)';

-- ============================================
-- ACTUALIZAR USUARIOS EXISTENTES
-- ============================================
-- Asegurar que todos los usuarios existentes estén activos por defecto
UPDATE users SET is_active = true WHERE is_active IS NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_active'
  ) THEN
    RAISE NOTICE '✅ Migración 021 completada: columna is_active añadida a users';
  END IF;
END $$;
