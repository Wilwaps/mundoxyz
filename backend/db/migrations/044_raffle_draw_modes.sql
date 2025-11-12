/**
 * Migration 044: Modos de Victoria para Rifas
 * 
 * Agrega:
 * - Modo de sorteo (automático, programado, manual)
 * - Fecha programada para sorteo
 * - Soporte para elección manual de ganador por host
 */

BEGIN;

-- ============================================
-- 1. MODO DE SORTEO
-- ============================================

-- Tipo ENUM para modo de sorteo
DO $$ BEGIN
  CREATE TYPE raffle_draw_mode AS ENUM ('automatic', 'scheduled', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Columna para modo de sorteo
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS draw_mode VARCHAR(20) DEFAULT 'automatic';

COMMENT ON COLUMN raffles.draw_mode IS 
  'Modo de sorteo: automatic (10seg después), scheduled (fecha específica), manual (host decide)';

-- ============================================
-- 2. FECHA PROGRAMADA
-- ============================================

-- Columna para fecha programada de sorteo
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS scheduled_draw_at TIMESTAMP;

COMMENT ON COLUMN raffles.scheduled_draw_at IS 
  'Fecha y hora programada para el sorteo (solo si draw_mode = scheduled)';

-- ============================================
-- 3. ÍNDICES Y CONSTRAINTS
-- ============================================

-- Índice para búsqueda de rifas con sorteo programado
CREATE INDEX IF NOT EXISTS idx_raffles_scheduled_draw 
  ON raffles(scheduled_draw_at, draw_mode) 
  WHERE draw_mode = 'scheduled' AND status = 'active';

-- Constraint: Si modo es 'scheduled', debe tener fecha
ALTER TABLE raffles
ADD CONSTRAINT check_scheduled_draw_date
  CHECK (
    (draw_mode != 'scheduled') OR 
    (draw_mode = 'scheduled' AND scheduled_draw_at IS NOT NULL)
  );

-- ============================================
-- 4. ACTUALIZAR RIFAS EXISTENTES
-- ============================================

-- Todas las rifas existentes usan modo automático (comportamiento actual)
UPDATE raffles
SET draw_mode = 'automatic'
WHERE draw_mode IS NULL;

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
DECLARE
  v_columns_count INTEGER;
  v_index_count INTEGER;
BEGIN
  -- Contar columnas nuevas
  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns
  WHERE table_name = 'raffles' 
    AND column_name IN ('draw_mode', 'scheduled_draw_at');
  
  IF v_columns_count = 2 THEN
    RAISE NOTICE '✅ Migración 044: 2 columnas agregadas a raffles';
  ELSE
    RAISE WARNING '⚠️ Migración 044: Solo % de 2 columnas agregadas', v_columns_count;
  END IF;
  
  -- Verificar índice
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename = 'raffles' 
    AND indexname = 'idx_raffles_scheduled_draw';
  
  IF v_index_count = 1 THEN
    RAISE NOTICE '✅ Índice idx_raffles_scheduled_draw creado';
  END IF;
  
  -- Verificar constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_scheduled_draw_date'
  ) THEN
    RAISE NOTICE '✅ Constraint check_scheduled_draw_date creado';
  END IF;
END $$;

COMMIT;
