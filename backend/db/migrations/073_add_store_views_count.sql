-- Migration: Add views_count to stores for public store analytics
-- Description: Adds a counter of public store views per store

BEGIN;

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS views_count BIGINT NOT NULL DEFAULT 0;

COMMIT;
