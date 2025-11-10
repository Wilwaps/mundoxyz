-- ================================================================
-- Migración 036: Agregar segundo color a raffle_companies
-- ================================================================

ALTER TABLE raffle_companies 
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#06B6D4';

COMMENT ON COLUMN raffle_companies.brand_color IS 'Color primario de marca (HEX)';
COMMENT ON COLUMN raffle_companies.secondary_color IS 'Color secundario de marca (HEX)';
