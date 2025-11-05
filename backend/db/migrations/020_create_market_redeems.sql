-- ============================================
-- MIGRACIÓN 020: Crear tabla market_redeems
-- ============================================
-- Descripción: Sistema de redención de fires por dinero fiat
-- Fecha: 2025-11-05
-- Error resuelto: relation "market_redeems" does not exist
-- Referencia: no es fundamental/migrations/002_economy.sql líneas 115-165
-- ============================================

BEGIN;

-- ============================================
-- TABLA: market_redeems
-- ============================================

CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Montos
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 100 CHECK (fires_amount > 0),
  fiat_amount DECIMAL(18,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  
  -- Datos del usuario para transferencia
  cedula VARCHAR(20),
  phone VARCHAR(32),
  bank_code VARCHAR(10),
  bank_name VARCHAR(128),
  bank_account VARCHAR(64),
  payment_method VARCHAR(32), -- 'bank_transfer', 'mobile_payment', 'paypal', etc.
  transaction_id VARCHAR(128),
  
  -- Evidencia y notas
  proof_url TEXT,
  notes TEXT,
  
  -- Procesamiento
  processor_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

-- Índice por usuario (búsquedas de historial)
CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);

-- Índice por estado (búsquedas de pendientes/completadas)
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);

-- Índice por fecha de creación (ordenamiento)
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at DESC);

-- Índice por procesador (auditoría de quien aprobó/rechazó)
CREATE INDEX IF NOT EXISTS idx_market_redeems_processor ON market_redeems(processor_id) 
WHERE processor_id IS NOT NULL;

-- Índice compuesto para búsquedas por usuario y estado
CREATE INDEX IF NOT EXISTS idx_market_redeems_user_status ON market_redeems(user_id, status);

-- Índice para búsquedas de redenciones procesadas
CREATE INDEX IF NOT EXISTS idx_market_redeems_processed ON market_redeems(processed_at DESC) 
WHERE processed_at IS NOT NULL;

-- ============================================
-- TRIGGER PARA UPDATED_AT
-- ============================================
-- NOTA: Función update_updated_at_column() no existe en BD actual
-- Se creará en migración futura o se maneja a nivel de aplicación
-- Por ahora, updated_at se actualiza manualmente en queries

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE market_redeems IS 'Redenciones de fires por dinero fiat (sistema de cashout)';

COMMENT ON COLUMN market_redeems.fires_amount IS 'Cantidad de fuegos a redimir (mínimo 100)';
COMMENT ON COLUMN market_redeems.fiat_amount IS 'Cantidad en moneda fiat equivalente calculada';
COMMENT ON COLUMN market_redeems.currency_code IS 'Código ISO de moneda (USD, VES, etc.)';
COMMENT ON COLUMN market_redeems.status IS 'Estado: pending, processing, completed, rejected, cancelled';
COMMENT ON COLUMN market_redeems.cedula IS 'Cédula de identidad del usuario (para KYC)';
COMMENT ON COLUMN market_redeems.payment_method IS 'Método de pago: bank_transfer, mobile_payment, paypal, etc.';
COMMENT ON COLUMN market_redeems.transaction_id IS 'ID de transacción bancaria/pago externo';
COMMENT ON COLUMN market_redeems.proof_url IS 'URL de comprobante de pago subido';
COMMENT ON COLUMN market_redeems.processor_id IS 'Admin que procesó la solicitud (aprobó/rechazó)';
COMMENT ON COLUMN market_redeems.processor_notes IS 'Notas internas del procesador';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'market_redeems'
  ) THEN
    RAISE NOTICE '✅ Migración 020 completada: tabla market_redeems creada con 6 índices (sin trigger)';
  END IF;
END $$;
