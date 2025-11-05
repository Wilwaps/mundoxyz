-- ============================================
-- MIGRACIÓN 024: Añadir wallet_address a wallets
-- ============================================
-- Descripción: Columna para dirección única de billetera (UUID)
-- Fecha: 2025-11-05
-- Problema resuelto:
--   - Modal "Recibir Fuegos" mostraba solo "3" en lugar de dirección completa
--   - wallet_id es SERIAL (1, 2, 3...) no apto para mostrar como dirección pública
-- ============================================

BEGIN;

-- ============================================
-- TABLA WALLETS: Añadir wallet_address
-- ============================================

-- Columna wallet_address: dirección única de la billetera (UUID)
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS wallet_address UUID DEFAULT uuid_generate_v4() UNIQUE;

-- ============================================
-- ACTUALIZAR WALLETS EXISTENTES
-- ============================================
-- Generar UUIDs únicos para wallets que no tengan wallet_address
UPDATE wallets 
SET wallet_address = uuid_generate_v4() 
WHERE wallet_address IS NULL;

-- ============================================
-- CONSTRAINT: wallet_address debe ser único y no nulo
-- ============================================
ALTER TABLE wallets 
ALTER COLUMN wallet_address SET NOT NULL;

-- ============================================
-- ÍNDICE
-- ============================================

-- Índice único para búsqueda rápida por dirección
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN wallets.wallet_address IS 'Dirección única de la billetera (UUID) para recibir transferencias';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' 
    AND column_name = 'wallet_address'
  ) THEN
    RAISE NOTICE '✅ Migración 024 completada: wallet_address añadido a wallets';
  END IF;
END $$;
