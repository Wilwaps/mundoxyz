-- Migración 052: Añadir columnas USDT a fire_requests
-- Contexto: compras de fuegos pagadas en USDT (TRON/TRC20)

BEGIN;

ALTER TABLE fire_requests
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS usdt_amount NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS network VARCHAR(32),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN fire_requests.payment_method IS 'Método de pago: bank_transfer, usdt_tron, etc.';
COMMENT ON COLUMN fire_requests.usdt_amount IS 'Monto en USDT declarado por el usuario para la compra de fuegos';
COMMENT ON COLUMN fire_requests.tx_hash IS 'Hash de transacción on-chain (ej. Tron)';
COMMENT ON COLUMN fire_requests.network IS 'Red cripto utilizada (ej. TRON, TRC20)';
COMMENT ON COLUMN fire_requests.metadata IS 'Metadata adicional en formato JSON para auditoría futura';

COMMIT;
