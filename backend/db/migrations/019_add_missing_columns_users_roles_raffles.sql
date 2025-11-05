-- ============================================
-- MIGRACIÓN 019: Añadir columnas faltantes a users, user_roles, raffles
-- ============================================
-- Descripción: Resuelve errores de columnas inexistentes en producción
-- Fecha: 2025-11-05
-- Errores resueltos:
--   - column u.locale does not exist
--   - column ur.granted_by does not exist
--   - column r.ends_at does not exist
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLA USERS: Añadir columna locale
-- ============================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'es';

COMMENT ON COLUMN users.locale IS 'Idioma preferido del usuario (es=español, en=inglés, pt=portugués)';

-- ============================================
-- 2. TABLA USER_ROLES: Renombrar columnas para consistencia
-- ============================================

-- Renombrar assigned_by a granted_by (preserva datos)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' 
        AND column_name = 'assigned_by'
    ) THEN
        ALTER TABLE user_roles RENAME COLUMN assigned_by TO granted_by;
    END IF;
END $$;

-- Renombrar assigned_at a granted_at (preserva datos)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' 
        AND column_name = 'assigned_at'
    ) THEN
        ALTER TABLE user_roles RENAME COLUMN assigned_at TO granted_at;
    END IF;
END $$;

COMMENT ON COLUMN user_roles.granted_by IS 'Usuario que otorgó el rol';
COMMENT ON COLUMN user_roles.granted_at IS 'Fecha/hora en que se otorgó el rol';

-- ============================================
-- 3. TABLA RAFFLES: Añadir columnas de timing
-- ============================================

-- starts_at: Fecha/hora programada de inicio
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;

-- ends_at: Fecha/hora programada de cierre
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;

-- drawn_at: Fecha/hora en que se realizó el sorteo
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMP;

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índice para búsquedas de rifas por fecha de cierre
CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) 
WHERE ends_at IS NOT NULL;

-- Índice para búsquedas de rifas por fecha de inicio
CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) 
WHERE starts_at IS NOT NULL;

-- Índice para búsquedas de rifas ya sorteadas
CREATE INDEX IF NOT EXISTS idx_raffles_drawn_at ON raffles(drawn_at) 
WHERE drawn_at IS NOT NULL;

-- Índice compuesto para búsquedas de rifas activas por fecha
CREATE INDEX IF NOT EXISTS idx_raffles_timing_status ON raffles(status, starts_at, ends_at) 
WHERE status IN ('pending', 'active', 'in_progress');

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN raffles.starts_at IS 'Fecha/hora programada de inicio de la rifa';
COMMENT ON COLUMN raffles.ends_at IS 'Fecha/hora programada de cierre de la rifa';
COMMENT ON COLUMN raffles.drawn_at IS 'Fecha/hora en que se realizó el sorteo';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'locale'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' 
    AND column_name = 'granted_by'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raffles' 
    AND column_name IN ('starts_at', 'ends_at', 'drawn_at')
  ) THEN
    RAISE NOTICE '✅ Migración 019 completada: columnas añadidas/renombradas en users, user_roles, raffles';
  END IF;
END $$;
