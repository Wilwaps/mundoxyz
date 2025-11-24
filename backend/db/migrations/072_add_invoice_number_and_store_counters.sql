-- Migration: Add invoice_number to orders and per-store counters
-- Description: Adds numeric consecutive invoice numbers per store

BEGIN;

-- 1) Add invoice_number to orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS invoice_number BIGINT;

-- 2) Per-store invoice counters
CREATE TABLE IF NOT EXISTS store_counters (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    last_invoice_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Ensure uniqueness of invoice_number per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_invoice_unique
    ON orders (store_id, invoice_number)
    WHERE invoice_number IS NOT NULL;

COMMIT;
