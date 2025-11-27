-- MUNDOXYZ - SCHEMA COMPLETO PARTE 2
-- BINGO V2 + WELCOME EVENTS + MIGRATIONS

BEGIN;

-- 10. BINGO_V2_ROOMS
CREATE TABLE IF NOT EXISTS bingo_v2_rooms (
  id SERIAL PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('75', '90')),
  pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('line', 'corners', 'fullcard')),
  is_public BOOLEAN DEFAULT true,
  max_players INTEGER DEFAULT 10 CHECK (max_players >= 2 AND max_players <= 30),
  max_cards_per_player INTEGER DEFAULT 5 CHECK (max_cards_per_player >= 1 AND max_cards_per_player <= 10),
  currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coins', 'fires')),
  card_cost DECIMAL(10, 2) NOT NULL CHECK (card_cost >= 0),
  total_pot DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished', 'cancelled')),
  auto_call_enabled BOOLEAN DEFAULT false,
  auto_call_interval INTEGER DEFAULT 5,
  next_auto_call_at TIMESTAMP,
  last_called_at TIMESTAMP,
  current_game_number INTEGER DEFAULT 0,
  last_called_number INTEGER,
  drawn_numbers JSONB DEFAULT '[]'::jsonb,
  winner_id UUID REFERENCES users(id),
  refund_processed BOOLEAN DEFAULT false,
  host_abandoned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_code ON bingo_v2_rooms(code);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_status ON bingo_v2_rooms(status);

-- 11. BINGO_V2_ROOM_PLAYERS
CREATE TABLE IF NOT EXISTS bingo_v2_room_players (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  is_ready BOOLEAN DEFAULT false,
  is_connected BOOLEAN DEFAULT true,
  last_activity TIMESTAMP DEFAULT NOW(),
  cards_purchased INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  winnings DECIMAL(10, 2) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_players_room ON bingo_v2_room_players(room_id);

-- 12. BINGO_V2_CARDS
CREATE TABLE IF NOT EXISTS bingo_v2_cards (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES bingo_v2_room_players(id) ON DELETE CASCADE,
  card_number INTEGER NOT NULL,
  grid JSONB NOT NULL,
  marked_numbers JSONB DEFAULT '[]'::jsonb,
  marked_positions JSONB DEFAULT '[]'::jsonb,
  has_bingo BOOLEAN DEFAULT false,
  pattern_completed VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(room_id, player_id, card_number)
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_cards_room ON bingo_v2_cards(room_id);

-- 13. BINGO_V2_DRAWS
CREATE TABLE IF NOT EXISTS bingo_v2_draws (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  draw_order INTEGER NOT NULL,
  drawn_by UUID REFERENCES users(id),
  drawn_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, number),
  UNIQUE(room_id, draw_order)
);

-- 14. BINGO_V2_AUDIT_LOGS
CREATE TABLE IF NOT EXISTS bingo_v2_audit_logs (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES bingo_v2_rooms(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. BINGO_V2_ROOM_CHAT_MESSAGES
CREATE TABLE IF NOT EXISTS bingo_v2_room_chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 16. BINGO_V2_MESSAGES
CREATE TABLE IF NOT EXISTS bingo_v2_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(20) NOT NULL CHECK (category IN ('system', 'friends')),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_messages_user ON bingo_v2_messages(user_id);

-- 17. WELCOME_EVENTS
CREATE TABLE IF NOT EXISTS welcome_events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  coins_amount DECIMAL(20,2) DEFAULT 0,
  fires_amount DECIMAL(20,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  max_claims INTEGER,
  created_by UUID REFERENCES users(id),
  event_type VARCHAR(50) DEFAULT 'manual',
  recurrence VARCHAR(50),
  target_segment JSONB DEFAULT '{"type": "all"}',
  min_user_level INTEGER DEFAULT 0,
  max_per_user INTEGER,
  cooldown_hours INTEGER,
  require_claim BOOLEAN DEFAULT true,
  auto_send BOOLEAN DEFAULT false,
  expires_hours INTEGER DEFAULT 72,
  claimed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (coins_amount >= 0 AND fires_amount >= 0),
  CHECK (coins_amount > 0 OR fires_amount > 0)
);

-- 18. WELCOME_EVENT_CLAIMS
CREATE TABLE IF NOT EXISTS welcome_event_claims (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins_claimed DECIMAL(20,2) DEFAULT 0,
  fires_claimed DECIMAL(20,2) DEFAULT 0,
  claimed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  UNIQUE(event_id, user_id)
);

-- 18.1. WELCOME_EVENT_HISTORY
CREATE TABLE IF NOT EXISTS welcome_event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_event_history_event
  ON welcome_event_history(event_id, created_at DESC);

-- 19. DIRECT_GIFTS
CREATE TABLE IF NOT EXISTS direct_gifts (
  id SERIAL PRIMARY KEY,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(50) NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_segment JSONB DEFAULT '{}',
  message TEXT NOT NULL,
  coins_amount DECIMAL(20,2) DEFAULT 0,
  fires_amount DECIMAL(20,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMP,
  claimed_at TIMESTAMP,
  origin VARCHAR(20) DEFAULT 'supply',
  link_token VARCHAR(64),
  max_claims INTEGER,
  claimed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (coins_amount >= 0 AND fires_amount >= 0),
  CHECK (coins_amount > 0 OR fires_amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_gifts_link_token ON direct_gifts(link_token);

-- 20. DIRECT_GIFT_CLAIMS
CREATE TABLE IF NOT EXISTS direct_gift_claims (
  id SERIAL PRIMARY KEY,
  gift_id INTEGER REFERENCES direct_gifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coins_claimed DECIMAL(20,2) DEFAULT 0,
  fires_claimed DECIMAL(20,2) DEFAULT 0,
  claimed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  UNIQUE(gift_id, user_id)
);

-- 21. GIFT_ANALYTICS
CREATE TABLE IF NOT EXISTS gift_analytics (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES welcome_events(id) ON DELETE CASCADE,
  gift_id INTEGER REFERENCES direct_gifts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (event_id IS NOT NULL OR gift_id IS NOT NULL)
);

-- 22. MIGRATIONS
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);

-- 23. TELEGRAM_GROUP_DAILY_REWARDS
CREATE TABLE IF NOT EXISTS telegram_group_daily_rewards (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL,
  activity_date DATE NOT NULL,
  messages_count INTEGER NOT NULL DEFAULT 0,
  coins_earned DECIMAL(20,2) NOT NULL DEFAULT 0,
  coins_claimed DECIMAL(20,2) NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP,
  last_claimed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (coins_earned >= 0),
  CHECK (coins_claimed >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_group_rewards_tg_date
  ON telegram_group_daily_rewards (tg_id, activity_date);

CREATE INDEX IF NOT EXISTS idx_tg_group_rewards_tg
  ON telegram_group_daily_rewards (tg_id);

-- 24. TELEGRAM_LINK_SESSIONS
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_sessions(expires_at) WHERE used = FALSE;

-- 25. FIAT_RATES
CREATE TABLE IF NOT EXISTS fiat_rates (
  id SERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL CHECK (source IN ('bcv', 'binance', 'mundoxyz')),
  pair VARCHAR(20) NOT NULL,
  rate NUMERIC(20,6) NOT NULL CHECK (rate > 0),
  spread_vs_bcv NUMERIC(20,6),
  is_degraded BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_rates_source_captured
  ON fiat_rates (source, captured_at DESC);

-- 26. FIAT_OPERATIONAL_CONFIG
CREATE TABLE IF NOT EXISTS fiat_operational_config (
  id SERIAL PRIMARY KEY,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (margin_percent >= 0 AND margin_percent <= 100),
  max_rate_age_minutes INTEGER NOT NULL DEFAULT 30 CHECK (max_rate_age_minutes > 0),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shadow_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. FIAT_VALUATIONS
CREATE TABLE IF NOT EXISTS fiat_valuations (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
  operation_id UUID,
  tokens_amount NUMERIC(20,6),
  usdt_amount NUMERIC(20,6),
  ves_amount NUMERIC(20,2),
  rate_source VARCHAR(20),
  rate_value NUMERIC(20,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_valuations_operation
  ON fiat_valuations (operation_type, operation_id);

-- 28. FIAT_OPERATIONS
CREATE TABLE IF NOT EXISTS fiat_operations (
  id SERIAL PRIMARY KEY,
  wallet_transaction_id INTEGER REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in', 'out')),
  fiat_amount_ves NUMERIC(20,2),
  usdt_equivalent NUMERIC(20,6),
  tokens_amount NUMERIC(20,6),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiat_operations_user
  ON fiat_operations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiat_operations_wallet_tx
  ON fiat_operations (wallet_transaction_id);

-- 29. SYSTEM_CHANGELOG_ENTRIES
CREATE TABLE IF NOT EXISTS system_changelog_entries (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category VARCHAR(32),
  version VARCHAR(32),
  content_html TEXT NOT NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_changelog_created
  ON system_changelog_entries(created_at DESC);

-- 30. STORE_INTEREST_REQUESTS
CREATE TABLE IF NOT EXISTS store_interest_requests (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  store_concept TEXT,
  interested_services TEXT,
  heard_from VARCHAR(32) NOT NULL,
  heard_from_other TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_interest_created
  ON store_interest_requests(created_at DESC);

-- FUNCIONES
CREATE OR REPLACE FUNCTION generate_room_code() RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        SELECT EXISTS(SELECT 1 FROM bingo_v2_rooms WHERE code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

COMMIT;
