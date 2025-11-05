-- ============================================
-- MIGRACIÓN 023: Añadir related_user_id a wallet_transactions
-- ============================================
-- Descripción: Columna para relacionar transacciones con otro usuario
-- Fecha: 2025-11-05
-- Errores resueltos:
--   - column wt.related_user_id does not exist
-- Referencia: backend/routes/profile.js y economy.js usan related_user_id
-- ============================================

BEGIN;

-- ============================================
-- TABLA WALLET_TRANSACTIONS: Añadir related_user_id
-- ============================================

-- Columna related_user_id: usuario relacionado en la transacción
-- (emisor/receptor en transferencias, otorgante en bonos, etc.)
ALTER TABLE wallet_transactions 
ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id);

-- ============================================
-- ÍNDICES
-- ============================================

-- Índice para búsquedas de transacciones por usuario relacionado
CREATE INDEX IF NOT EXISTS idx_wallet_txns_related_user ON wallet_transactions(related_user_id) 
WHERE related_user_id IS NOT NULL;

-- Índice compuesto para búsquedas de transacciones entre usuarios
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_related ON wallet_transactions(wallet_id, related_user_id) 
WHERE related_user_id IS NOT NULL;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN wallet_transactions.related_user_id IS 'Usuario relacionado con la transacción (emisor/receptor en transferencias, otorgante en bonos, etc.)';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions' 
    AND column_name = 'related_user_id'
  ) THEN
    RAISE NOTICE '✅ Migración 023 completada: related_user_id añadido a wallet_transactions';
  END IF;
END $$;
