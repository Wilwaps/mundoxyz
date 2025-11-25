-- Migration: Create referral system core tables
-- Description: Adds referral relationships, config, levels, taps and commissions tracking

BEGIN;

-- 1) Extend users table with referral fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS referrals_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

-- 2) Global referral configuration (singleton row controlled from Tote panel)
CREATE TABLE IF NOT EXISTS referral_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enable_withdrawals BOOLEAN NOT NULL DEFAULT FALSE,
  enable_transfers BOOLEAN NOT NULL DEFAULT FALSE,
  enable_bingo_rooms BOOLEAN NOT NULL DEFAULT FALSE,
  enable_raffle_fire_rooms BOOLEAN NOT NULL DEFAULT FALSE,
  enable_stores BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT referral_config_single_row CHECK (id = 1)
);

INSERT INTO referral_config (id, enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3) Referral levels: percentage per level and source (withdrawals, transfers, bingo, raffle_fire, stores)
CREATE TABLE IF NOT EXISTS referral_levels (
  id SERIAL PRIMARY KEY,
  level SMALLINT NOT NULL CHECK (level >= 1 AND level <= 5),
  source VARCHAR(32) NOT NULL CHECK (source IN ('withdrawal', 'transfer', 'bingo_room', 'raffle_fire_room', 'store')),
  percentage NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (percentage >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(level, source)
);

CREATE INDEX IF NOT EXISTS idx_referral_levels_source_level ON referral_levels(source, level);

-- 4) Referral taps: interaction log for Tap actions (cooldown will be enforced per user in code)
CREATE TABLE IF NOT EXISTS referral_taps (
  id BIGSERIAL PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_taps_from_user ON referral_taps(from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_taps_to_user ON referral_taps(to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_taps_created_at ON referral_taps(created_at DESC);

-- 5) Referral commissions log: tracking multi-level referral earnings per operation
CREATE TABLE IF NOT EXISTS referral_commissions (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE SET NULL,
  level SMALLINT NOT NULL CHECK (level >= 1 AND level <= 5),
  source VARCHAR(32) NOT NULL CHECK (source IN ('withdrawal', 'transfer', 'bingo_room', 'raffle_fire_room', 'store')),
  amount DECIMAL(20,4) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('fires', 'coins', 'usdt', 'ves')),
  operation_type VARCHAR(32) NOT NULL,
  operation_id VARCHAR(64),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON referral_commissions(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_created ON referral_commissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_source ON referral_commissions(source);

COMMIT;
