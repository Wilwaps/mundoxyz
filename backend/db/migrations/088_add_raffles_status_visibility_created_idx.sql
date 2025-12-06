-- 088_add_raffles_status_visibility_created_idx.sql
-- Índice para acelerar listados por estado/visibilidad ordenados por created_at desc (lobby rifas)

BEGIN;

CREATE INDEX IF NOT EXISTS idx_raffles_status_visibility_created_desc
  ON raffles (status, visibility, created_at DESC)
  WHERE status IN ('active', 'pending') AND visibility IN ('public', 'company');

COMMIT;
