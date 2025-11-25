-- Migration: Add store levels, configuration and home_store_id
-- Description: Adds commission, type, allowed currencies and level to stores, and home_store_id to users

BEGIN;

-- 1) Extend stores table with level/config fields
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS store_type VARCHAR(50) NOT NULL DEFAULT 'papeleria',
  ADD COLUMN IF NOT EXISTS allowed_currencies JSONB NOT NULL DEFAULT '["coins","fires","usdt","ves"]'::jsonb,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 3;

-- 2) Extend users table with home_store_id
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_store_id UUID REFERENCES stores(id);

-- 3) Extend orders table with commission fields (reporting only in Fase 1)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS platform_commission_usdt DECIMAL(20,2) NOT NULL DEFAULT 0;

COMMIT;
