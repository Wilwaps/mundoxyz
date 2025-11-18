-- Migración 051: Crear tablas FIAT (tasas, configuración operativa, valoraciones y operaciones)
-- Contexto: plugin FIAT MundoXYZ (peg 300:1, tasas BCV/Binance, margen 5%)

BEGIN;

-- Tabla: fiat_rates
-- Registra tasas capturadas desde BCV, Binance P2P y la tasa operativa MundoXYZ
CREATE TABLE IF NOT EXISTS fiat_rates (
  id SERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL CHECK (source IN ('bcv', 'binance', 'mundoxyz')),
  pair VARCHAR(20) NOT NULL,
  rate NUMERIC(20,6) NOT NULL CHECK (rate > 0),
  spread_vs_bcv NUMERIC(20,6),
  is_degraded BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_rates_source_captured
  ON fiat_rates (source, captured_at DESC);

-- Tabla: fiat_operational_config
-- Parámetros globales del plugin FIAT (margen, flags, TTL)
CREATE TABLE IF NOT EXISTS fiat_operational_config (
  id SERIAL PRIMARY KEY,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (margin_percent >= 0 AND margin_percent <= 100),
  max_rate_age_minutes INTEGER NOT NULL DEFAULT 30 CHECK (max_rate_age_minutes > 0),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shadow_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opcional: garantizar una sola fila activa podría hacerse vía lógica de aplicación

-- Tabla: fiat_valuations
-- Snapshot FIAT por operación de negocio (tokens, USDT, VES, fuente y tasa usada)
CREATE TABLE IF NOT EXISTS fiat_valuations (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
  operation_id UUID,
  tokens_amount NUMERIC(20,6),
  usdt_amount NUMERIC(20,6),
  ves_amount NUMERIC(20,2),
  rate_source VARCHAR(20),
  rate_value NUMERIC(20,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_valuations_operation
  ON fiat_valuations (operation_type, operation_id);

-- Tabla: fiat_operations
-- Relación entre operaciones FIAT, wallet_transactions y usuarios
CREATE TABLE IF NOT EXISTS fiat_operations (
  id SERIAL PRIMARY KEY,
  wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in', 'out')),
  fiat_amount_ves NUMERIC(20,2),
  usdt_equivalent NUMERIC(20,6),
  tokens_amount NUMERIC(20,6),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_operations_user
  ON fiat_operations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiat_operations_wallet_tx
  ON fiat_operations (wallet_transaction_id);

COMMIT;
