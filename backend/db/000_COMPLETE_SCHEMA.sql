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
  last_password_change TIMESTAMP,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. WALLETS
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

-- 3. WALLET_TRANSACTIONS
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

-- 4. RAFFLES
CREATE TABLE IF NOT EXISTS raffles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('fires', 'prize')),
  type VARCHAR(20) DEFAULT 'public',
  entry_price_fire DECIMAL(10,2) DEFAULT 0,
  entry_price_coin DECIMAL(10,2) DEFAULT 0,
  entry_price_fiat DECIMAL(10,2) DEFAULT 0,
  numbers_range INTEGER NOT NULL DEFAULT 100,
  visibility VARCHAR(20) DEFAULT 'public',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished', 'cancelled')),
  is_company_mode BOOLEAN DEFAULT false,
  company_cost DECIMAL(10,2) DEFAULT 0,
  close_type VARCHAR(20) DEFAULT 'auto_full',
  scheduled_close_at TIMESTAMP,
  terms_conditions TEXT,
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  winner_number INTEGER,
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffles_code ON raffles(code);
CREATE INDEX IF NOT EXISTS idx_raffles_host ON raffles(host_id);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);

-- 5. RAFFLE_NUMBERS
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

-- 6. RAFFLE_COMPANIES
CREATE TABLE IF NOT EXISTS raffle_companies (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER UNIQUE NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  company_name VARCHAR(200) NOT NULL,
  rif_number VARCHAR(50),
  brand_color VARCHAR(7) DEFAULT '#8B5CF6',
  logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. RAFFLE_AUDIT_LOGS
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

-- 8. TICTACTOE_ROOMS
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  player_x_id UUID REFERENCES users(id),
  player_o_id UUID REFERENCES users(id),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  visibility VARCHAR(10) DEFAULT 'public',
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

-- 9. TICTACTOE_MOVES
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

-- VER PARTE 2 EN ARCHIVO: 000_COMPLETE_SCHEMA_PART2.sql

COMMIT;
