BEGIN;

ALTER TABLE direct_gifts
  ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'supply',
  ADD COLUMN IF NOT EXISTS link_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS max_claims INTEGER,
  ADD COLUMN IF NOT EXISTS claimed_count INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_gifts_link_token
  ON direct_gifts(link_token);

COMMIT;
