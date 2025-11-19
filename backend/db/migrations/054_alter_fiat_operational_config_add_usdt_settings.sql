-- Migración 054: Añadir configuración de economía USDT/Fuegos a fiat_operational_config
-- Contexto: tasa interna 1 USDT = N fuegos y billetera oficial USDT TRON

BEGIN;

ALTER TABLE fiat_operational_config
  ADD COLUMN IF NOT EXISTS fires_per_usdt NUMERIC(20,6) NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS usdt_official_wallet VARCHAR(128),
  ADD COLUMN IF NOT EXISTS usdt_network VARCHAR(32) DEFAULT 'TRON';

COMMENT ON COLUMN fiat_operational_config.fires_per_usdt IS 'Cantidad de fuegos equivalente a 1 USDT según la lógica interna de MundoXYZ';
COMMENT ON COLUMN fiat_operational_config.usdt_official_wallet IS 'Dirección oficial de la billetera USDT para depósitos (ej. TRON TRC20)';
COMMENT ON COLUMN fiat_operational_config.usdt_network IS 'Red por defecto para operaciones USDT (ej. TRON)';

COMMIT;
