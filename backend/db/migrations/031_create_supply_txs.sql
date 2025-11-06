-- ============================================
-- MIGRACIÓN 031: Crear tabla supply_txs
-- ============================================
-- Descripción: Registro de transacciones de suministro (audit log)
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ
-- Relacionado: Fix registro usuarios - tabla faltante
-- ============================================

BEGIN;

-- ============================================
-- HABILITAR EXTENSIÓN UUID
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: supply_txs
-- ============================================
CREATE TABLE IF NOT EXISTS supply_txs (
  id BIGSERIAL PRIMARY KEY,
  transaction_hash UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  type VARCHAR(32) NOT NULL,
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('fires', 'coins')),
  amount DECIMAL(18,2) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_ext VARCHAR(128),
  event_id INTEGER,
  reference VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(128),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_supply_txs_type ON supply_txs(type);
CREATE INDEX IF NOT EXISTS idx_supply_txs_user_id ON supply_txs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supply_txs_created_at ON supply_txs(created_at);
CREATE INDEX IF NOT EXISTS idx_supply_txs_hash ON supply_txs(transaction_hash);

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE supply_txs IS 'Registro de transacciones de suministro (audit log)';
COMMENT ON COLUMN supply_txs.id IS 'ID único de la transacción';
COMMENT ON COLUMN supply_txs.transaction_hash IS 'Hash único UUID de la transacción';
COMMENT ON COLUMN supply_txs.type IS 'Tipos: emission, burn, welcome_bonus, game_reward, market_redeem, admin_grant, account_created';
COMMENT ON COLUMN supply_txs.currency IS 'Moneda: fires o coins';
COMMENT ON COLUMN supply_txs.amount IS 'Cantidad de la transacción';
COMMENT ON COLUMN supply_txs.user_id IS 'Usuario objetivo de la transacción';
COMMENT ON COLUMN supply_txs.user_ext IS 'Identificador externo del usuario (ej: email:user@example.com)';
COMMENT ON COLUMN supply_txs.event_id IS 'ID del evento relacionado (si aplica)';
COMMENT ON COLUMN supply_txs.reference IS 'Referencia externa (ej: room_code, redeem_id)';
COMMENT ON COLUMN supply_txs.description IS 'Descripción legible de la transacción';
COMMENT ON COLUMN supply_txs.metadata IS 'Metadatos adicionales en formato JSON';
COMMENT ON COLUMN supply_txs.actor_id IS 'Usuario que ejecutó la acción (admin)';
COMMENT ON COLUMN supply_txs.actor_name IS 'Nombre del actor';
COMMENT ON COLUMN supply_txs.ip_address IS 'Dirección IP de origen';
COMMENT ON COLUMN supply_txs.created_at IS 'Fecha de creación';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'supply_txs'
  ) THEN
    RAISE NOTICE '✅ Migración 031 completada: tabla supply_txs creada';
  END IF;
END $$;
