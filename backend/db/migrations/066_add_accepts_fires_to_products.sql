-- Add accepts_fires flag to products to indicate if a product can be paid with Fires

BEGIN;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS accepts_fires BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
