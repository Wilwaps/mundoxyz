-- ============================================
-- MIGRACIÓN 026: Añadir columnas de comisión a market_redeems
-- ============================================
-- Descripción: Registra la comisión de plataforma y el total descontado
-- Fecha: 2025-11-05
-- ============================================

BEGIN;

ALTER TABLE market_redeems
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deducted DECIMAL(18,2) DEFAULT 0;

-- Actualizar registros existentes para mantener consistencia
UPDATE market_redeems
SET total_deducted = COALESCE(total_deducted, 0) + COALESCE(fires_amount, 0)
WHERE (total_deducted IS NULL OR total_deducted = 0) AND fires_amount IS NOT NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'market_redeems'
      AND column_name = 'commission_amount'
  ) AND EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'market_redeems'
      AND column_name = 'total_deducted'
  ) THEN
    RAISE NOTICE '✅ Migración 026 completada: columnas commission_amount y total_deducted disponibles en market_redeems';
  ELSE
    RAISE WARNING '⚠️ Migración 026: verifique manualmente la creación de columnas';
  END IF;
END
$$;
