-- MUNDOXYZ - SCHEMA COMPLETO DESDE CERO
-- Fecha: 2025-11-04
-- PostgreSQL 14+

BEGIN;

-- EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  tg_id BIGINT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  role VARCHAR(50) DEFAULT 'user',
  roles TEXT[] DEFAULT ARRAY['user'],
  is_verified BOOLEAN DEFAULT false,
  security_answer TEXT,
  ci_prefix VARCHAR(1) CHECK (ci_prefix IN ('V','E','J')),
  ci_number VARCHAR(16),
  ci_full VARCHAR(32),
  phone VARCHAR(32),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_password_change TIMESTAMP,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT users_ci_prefix_number_consistent
    CHECK (
      (ci_prefix IS NULL AND ci_number IS NULL)
      OR (ci_prefix IS NOT NULL AND ci_number IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ci_full_unique
  ON users(ci_full)
  WHERE ci_full IS NOT NULL;

-- 2. AUTH_IDENTITIES (Multi-provider authentication)
CREATE TABLE IF NOT EXISTS auth_identities (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_uid VARCHAR(255) NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_uid),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider ON auth_identities(provider);
CREATE INDEX IF NOT EXISTS idx_auth_identities_provider_uid ON auth_identities(provider, provider_uid);

-- 3. WALLETS
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins_balance DECIMAL(20,2) DEFAULT 0 CHECK (coins_balance >= 0),
  fires_balance DECIMAL(20,2) DEFAULT 0 CHECK (fires_balance >= 0),
  total_coins_earned DECIMAL(20,2) DEFAULT 0,
  total_coins_spent DECIMAL(20,2) DEFAULT 0,
  total_fires_earned DECIMAL(20,2) DEFAULT 0,
  total_fires_spent DECIMAL(20,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- 4. WALLET_TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('coins', 'fires')),
  amount DECIMAL(20,2) NOT NULL,
  balance_before DECIMAL(20,2) NOT NULL,
  balance_after DECIMAL(20,2) NOT NULL,
  description TEXT,
  reference VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet ON wallet_transactions(wallet_id, created_at DESC);

-- 5. RAFFLES
CREATE TABLE IF NOT EXISTS raffles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('fires', 'prize')),
  raffle_mode VARCHAR(20) NOT NULL DEFAULT 'fires' CHECK (raffle_mode IN ('fires', 'coins', 'prize')),
  type VARCHAR(20) DEFAULT 'public',
  entry_price_fire DECIMAL(10,2) DEFAULT 0,
  entry_price_coin DECIMAL(10,2) DEFAULT 0,
  entry_price_fiat DECIMAL(10,2) DEFAULT 0,
  numbers_range INTEGER NOT NULL DEFAULT 100,
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'company')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished', 'cancelled')),
  is_company_mode BOOLEAN DEFAULT false,
  company_cost DECIMAL(10,2) DEFAULT 0,
  close_type VARCHAR(20) DEFAULT 'auto_full',
  scheduled_close_at TIMESTAMP,
  terms_conditions TEXT,
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  pot_fires DECIMAL(10,2) DEFAULT 0,
  pot_coins DECIMAL(10,2) DEFAULT 0,
  allow_fires_payment BOOLEAN DEFAULT false,
  prize_image_base64 TEXT,
  draw_mode VARCHAR(20) DEFAULT 'automatic' CHECK (draw_mode IN ('automatic', 'scheduled', 'manual')),
  scheduled_draw_at TIMESTAMP,
  winner_number INTEGER,
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  starts_at TIMESTAMP,
  started_at TIMESTAMP,
  ends_at TIMESTAMP,
  ended_at TIMESTAMP,
  finished_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_scheduled_draw_date CHECK (
    (draw_mode != 'scheduled') OR 
    (draw_mode = 'scheduled' AND scheduled_draw_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_raffles_code ON raffles(code);
CREATE INDEX IF NOT EXISTS idx_raffles_host ON raffles(host_id);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_allow_fires_payment ON raffles(allow_fires_payment) WHERE allow_fires_payment = TRUE;
CREATE INDEX IF NOT EXISTS idx_raffles_scheduled_draw ON raffles(scheduled_draw_at, draw_mode) WHERE draw_mode = 'scheduled' AND status = 'active';

-- 6. RAFFLE_NUMBERS
CREATE TABLE IF NOT EXISTS raffle_numbers (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'available' CHECK (state IN ('available', 'sold', 'reserved')),
  owner_id UUID REFERENCES users(id),
  purchased_at TIMESTAMP,
  UNIQUE(raffle_id, number_idx)
);

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle ON raffle_numbers(raffle_id, state);

-- 7. RAFFLE_COMPANIES
CREATE TABLE IF NOT EXISTS raffle_companies (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER UNIQUE NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  company_name VARCHAR(200) NOT NULL,
  rif_number VARCHAR(50),
  brand_color VARCHAR(7) DEFAULT '#8B5CF6',
  secondary_color VARCHAR(7) DEFAULT '#06B6D4',
  logo_url TEXT,
  logo_base64 TEXT,
  website_url TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. RAFFLE_AUDIT_LOGS
CREATE TABLE IF NOT EXISTS raffle_audit_logs (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER REFERENCES raffles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  admin_id UUID REFERENCES users(id),
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_audit_raffle ON raffle_audit_logs(raffle_id);

-- 9. RAFFLE_SETTINGS
CREATE TABLE IF NOT EXISTS raffle_settings (
  id SERIAL PRIMARY KEY,
  prize_mode_cost_fires DECIMAL(10,2) NOT NULL DEFAULT 500 CHECK (prize_mode_cost_fires >= 0),
  company_mode_cost_fires DECIMAL(10,2) NOT NULL DEFAULT 500 CHECK (company_mode_cost_fires >= 0),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. TICTACTOE_ROOMS
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  player_x_id UUID REFERENCES users(id),
  player_o_id UUID REFERENCES users(id),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  visibility VARCHAR(10) DEFAULT 'public',
  opponent_type VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (opponent_type IN ('player', 'ron_ai')),
  ai_difficulty VARCHAR(20) CHECK (ai_difficulty IN ('easy', 'medium', 'hard')),
  ai_profile JSONB,
  board TEXT DEFAULT '         ',
  current_turn CHAR(1) DEFAULT 'X',
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
  winner_id UUID REFERENCES users(id),
  is_draw BOOLEAN DEFAULT false,
  player_x_ready BOOLEAN DEFAULT false,
  player_o_ready BOOLEAN DEFAULT false,
  pot_coins DECIMAL(10,2) DEFAULT 0,
  pot_fires DECIMAL(10,2) DEFAULT 0,
  prize_coins DECIMAL(10,2) DEFAULT 0,
  prize_fires DECIMAL(10,2) DEFAULT 0,
  rematch_count INTEGER DEFAULT 0,
  player_x_wants_rematch BOOLEAN DEFAULT false,
  player_o_wants_rematch BOOLEAN DEFAULT false,
  player_x_left BOOLEAN DEFAULT false,
  player_o_left BOOLEAN DEFAULT false,
  archived_at TIMESTAMP,
  xp_awarded BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  last_move_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_code ON tictactoe_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tictactoe_status ON tictactoe_rooms(status);

-- 10. TICTACTOE_MOVES
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id SERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id),
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 9),
  symbol CHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  board_after TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id, created_at);

-- 11. POOL_ROOMS
CREATE TABLE IF NOT EXISTS pool_rooms (
  id UUID PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  player_opponent_id UUID REFERENCES users(id),

  -- Configuración de juego
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  opponent_type VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (opponent_type IN ('player', 'ron_ai')),
  ai_difficulty VARCHAR(20) CHECK (ai_difficulty IN ('easy', 'medium', 'hard')),
  ai_profile JSONB,

  -- Economía
  pot_coins DECIMAL(20, 2) DEFAULT 0,
  pot_fires DECIMAL(20, 2) DEFAULT 0,

  -- Estado de sala/partida
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
  current_turn UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),

  -- Estado específico de 8-ball (posiciones, turno, suit, etc.)
  game_state JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  last_move_at TIMESTAMP WITH TIME ZONE,

  -- Flags y revanchas
  player_host_ready BOOLEAN DEFAULT FALSE,
  player_opponent_ready BOOLEAN DEFAULT FALSE,
  rematch_requested_by_host BOOLEAN DEFAULT FALSE,
  rematch_requested_by_opponent BOOLEAN DEFAULT FALSE,
  rematch_count INTEGER DEFAULT 0,
  xp_awarded BOOLEAN DEFAULT FALSE
);

-- 12. POOL_MOVES
CREATE TABLE IF NOT EXISTS pool_moves (
  id SERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES pool_rooms(id),
  player_id UUID NOT NULL REFERENCES users(id),
  move_number INTEGER NOT NULL,

  -- Detalles del tiro
  shot_type VARCHAR(20), -- 'break', 'regular', 'foul'
  shot_params JSONB, -- power, angle, spin

  -- Resultado
  balls_potted JSONB, -- array de números de bolas
  foul_reason VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_rooms_code ON pool_rooms(code);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_status ON pool_rooms(status);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_host ON pool_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_opponent ON pool_rooms(player_opponent_id);
CREATE INDEX IF NOT EXISTS idx_pool_moves_room ON pool_moves(room_id);

-- VER PARTE 2 EN ARCHIVO: 000_COMPLETE_SCHEMA_PART2.sql

COMMIT;
