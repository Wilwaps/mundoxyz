-- Add SKU and stock columns to products, and unique constraint per store

BEGIN;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sku VARCHAR(50),
    ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Ensure SKU is unique per store when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_sku_unique
    ON products(store_id, sku)
    WHERE sku IS NOT NULL;

COMMIT;
