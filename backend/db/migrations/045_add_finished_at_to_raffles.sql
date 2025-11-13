-- ============================================
-- MIGRACIÓN 045: Añadir columna finished_at a raffles
-- ============================================
-- Descripción: Corrige mismatch entre código y BD. El servicio usa raffles.finished_at
-- Fecha: 2025-11-12
-- Seguro e idempotente: IF NOT EXISTS + verificación
-- ============================================

BEGIN;

-- Añadir columna finished_at si no existe
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;

COMMENT ON COLUMN raffles.finished_at IS 'Fecha/hora en que la rifa quedó finalizada';

-- Backfill opcional: si ended_at ya estaba poblado, copiarlo a finished_at
UPDATE raffles 
SET finished_at = ended_at 
WHERE finished_at IS NULL AND ended_at IS NOT NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  v_exists INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_exists
  FROM information_schema.columns
  WHERE table_name = 'raffles'
    AND column_name = 'finished_at';

  IF v_exists = 1 THEN
    RAISE NOTICE '✅ Migración 045 completada: columna raffles.finished_at disponible';
  ELSE
    RAISE WARNING '⚠️ Migración 045: no se detecta la columna raffles.finished_at';
  END IF;
END $$;
