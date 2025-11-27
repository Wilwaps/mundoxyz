-- Migration: Create store_market_config table for store marketplace plans
-- Description: Global config to control whether store plans are sellable and their USD prices

BEGIN;

CREATE TABLE IF NOT EXISTS store_market_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  plans JSONB NOT NULL DEFAULT '{
    "starter": {"price_usd": 29},
    "professional": {"price_usd": 79},
    "enterprise": {"price_usd": 199}
  }',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
