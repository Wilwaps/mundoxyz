-- ============================================
-- MIGRACIÓN 055: Sistema Tito (tokens y log de comisiones)
-- ============================================
-- Descripción:
--  - Añade columna tito_owner_id a users para vincular usuarios referidos por un Tito
--  - Crea tabla tito_tokens para gestionar tokens de invitación de Tito
--  - Crea tabla commissions_log para auditar distribuciones de comisión (Tito/Líder/Pote/Tote)
-- Fecha: 2025-11-22
-- ============================================

BEGIN;

-- ============================================
-- 1) Columna tito_owner_id en users
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tito_owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_tito_owner_id
  ON users(tito_owner_id)
  WHERE tito_owner_id IS NOT NULL;

COMMENT ON COLUMN users.tito_owner_id IS 'Usuario Tito que trajo a este usuario (tracking de comunidad Tito)';

-- ============================================
-- 2) Tabla tito_tokens
-- ============================================

CREATE TABLE IF NOT EXISTS tito_tokens (
  id BIGSERIAL PRIMARY KEY,
  tito_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'active', -- active | revoked | expired
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tito_tokens_user ON tito_tokens(tito_user_id);
CREATE INDEX IF NOT EXISTS idx_tito_tokens_status ON tito_tokens(status);

COMMENT ON TABLE tito_tokens IS 'Tokens de invitación para rol Tito (tracking de comunidad)';
COMMENT ON COLUMN tito_tokens.tito_user_id IS 'Usuario con rol Tito dueño del token';
COMMENT ON COLUMN tito_tokens.token IS 'Token único utilizado en links ?tito=TOKEN';

-- ============================================
-- 3) Tabla commissions_log
-- ============================================

CREATE TABLE IF NOT EXISTS commissions_log (
  id BIGSERIAL PRIMARY KEY,
  operation_id VARCHAR(64) NOT NULL,
  operation_type VARCHAR(32) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_base DECIMAL(18,4) NOT NULL,
  platform_commission_rate NUMERIC(6,4) NOT NULL,
  platform_commission_total DECIMAL(18,4) NOT NULL,

  tito_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  tito_commission_amount DECIMAL(18,4),
  tito_base_amount DECIMAL(18,4),
  tito_referral_amount DECIMAL(18,4),

  leader_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  leader_commission_amount DECIMAL(18,4),

  community_pot_amount DECIMAL(18,4),
  tote_commission_amount DECIMAL(18,4) NOT NULL,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_log_user ON commissions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_log_tito ON commissions_log(tito_user_id) WHERE tito_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_log_leader ON commissions_log(leader_user_id) WHERE leader_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_log_operation ON commissions_log(operation_type, operation_id);
CREATE INDEX IF NOT EXISTS idx_commissions_log_created ON commissions_log(created_at DESC);

COMMENT ON TABLE commissions_log IS 'Log de distribuciones de comisión (Tito / Líder / Pote / Tote) por operación económica';
COMMENT ON COLUMN commissions_log.operation_type IS 'Tipo de operación: withdraw, transfer, raffle_fire, bingo, etc.';
COMMENT ON COLUMN commissions_log.tito_base_amount IS 'Parte de la comisión de Tito por ser rol Tito (propia actividad)';
COMMENT ON COLUMN commissions_log.tito_referral_amount IS 'Parte de la comisión de Tito por comunidad (usuarios traídos con token)';

COMMIT;

-- ============================================
-- VERIFICACIÓN BÁSICA
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tito_owner_id') THEN
    RAISE NOTICE '✅ Migración 055: columna users.tito_owner_id creada o ya existente';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tito_tokens') THEN
    RAISE NOTICE '✅ Migración 055: tabla tito_tokens creada o ya existente';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commissions_log') THEN
    RAISE NOTICE '✅ Migración 055: tabla commissions_log creada o ya existente';
  END IF;
END $$;
