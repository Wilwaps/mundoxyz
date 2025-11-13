-- ============================================
-- 046: Alinear raffle_requests con servicio V2
-- - Agrega buyer_id (UUID)
-- - Agrega number_idx (INT)
-- - Índices e índice único parcial para evitar duplicados
-- ============================================
BEGIN;

ALTER TABLE raffle_requests
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS number_idx INTEGER;

-- Backfill buyer_id desde user_id cuando sea posible
UPDATE raffle_requests
SET buyer_id = user_id
WHERE buyer_id IS NULL;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_raffle_requests_buyer ON raffle_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle_number ON raffle_requests(raffle_id, number_idx);

-- Índice único parcial para (raffle_id, number_idx) cuando status es pending/approved
CREATE UNIQUE INDEX IF NOT EXISTS uniq_raffle_request_pending_approved
  ON raffle_requests(raffle_id, number_idx)
  WHERE status IN ('pending','approved');

COMMIT;
