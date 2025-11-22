-- ============================================
-- MIGRACIÓN 057: Campo tito_global_amount en commissions_log
-- ============================================
-- Descripción:
--  - Añade columna tito_global_amount para registrar la parte de la
--    comisión de plataforma (1.5% de M) reservada como dividendo global
--    para todos los Titos.
-- Nota: Es una columna puramente contable, no mueve wallets por sí misma.
-- Fecha: 2025-11-22
-- ============================================

BEGIN;

ALTER TABLE commissions_log
  ADD COLUMN IF NOT EXISTS tito_global_amount DECIMAL(18,4);

COMMENT ON COLUMN commissions_log.tito_global_amount IS 'Porción de la comisión de plataforma (1.5% de M) reservada como dividendo global para todos los Titos';

COMMIT;

-- Verificación básica
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'commissions_log'
      AND column_name = 'tito_global_amount'
  ) THEN
    RAISE NOTICE '✅ Migración 057: columna commissions_log.tito_global_amount creada o ya existente';
  END IF;
END $$;
