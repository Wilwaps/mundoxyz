-- Migración 053: Añadir columnas USDT a market_redeems
-- Contexto: canjes de fuegos con pago de salida en USDT (TRON/TRC20)

BEGIN;

ALTER TABLE market_redeems
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(128),
  ADD COLUMN IF NOT EXISTS network VARCHAR(32),
  ADD COLUMN IF NOT EXISTS usdt_amount NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN market_redeems.payout_method IS 'Método de pago de salida: bank_transfer, usdt_tron, etc.';
COMMENT ON COLUMN market_redeems.wallet_address IS 'Dirección de wallet cripto del usuario para retiros (ej. USDT TRON)';
COMMENT ON COLUMN market_redeems.network IS 'Red utilizada para el retiro (ej. TRON, TRC20)';
COMMENT ON COLUMN market_redeems.usdt_amount IS 'Monto estimado en USDT correspondiente a los fuegos canjeados';
COMMENT ON COLUMN market_redeems.metadata IS 'Metadata adicional en formato JSON para auditoría futura';

COMMIT;
