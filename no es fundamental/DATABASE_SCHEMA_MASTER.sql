-- ============================================
-- MUNDOXYZ - SCHEMA MAESTRO COMPLETO
-- ============================================
-- Fecha: 2025-11-04
-- PostgreSQL 14+
-- Descripción: Schema completo de todas las tablas en producción
-- Este archivo representa el estado ACTUAL de la base de datos
-- ============================================

BEGIN;

-- ============================================
-- EXTENSIONES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 1. USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  tg_id BIGINT UNIQUE,
  avatar_url TEXT,
  locale VARCHAR(10) DEFAULT 'es',
  bio TEXT,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  role VARCHAR(50) DEFAULT 'user',
  roles TEXT[] DEFAULT ARRAY['user'],
  is_active BOOLEAN DEFAULT true,
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

COMMENT ON TABLE users IS 'Usuarios del sistema - información principal';
COMMENT ON COLUMN users.experience IS 'Puntos de experiencia acumulados';
COMMENT ON COLUMN users.security_answer IS 'Respuesta de seguridad para recuperación de cuenta';

-- ============================================
-- 2. AUTH_IDENTITIES
-- ============================================
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

COMMENT ON TABLE auth_identities IS 'Identidades de autenticación multi-provider (email, telegram, google)';
COMMENT ON COLUMN auth_identities.provider IS 'Tipo: email, telegram, google, facebook';
COMMENT ON COLUMN auth_identities.password_hash IS 'Hash bcrypt (solo para provider=email)';

-- ============================================
-- 3. WALLETS
-- ============================================
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

COMMENT ON TABLE wallets IS 'Billeteras virtuales - coins y fires';

-- ============================================
-- 4. WALLET_TRANSACTIONS
-- ============================================
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

COMMENT ON TABLE wallet_transactions IS 'Historial de transacciones de wallets';

-- ============================================
-- 5. ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ============================================
-- 6. USER_ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ============================================
-- 7. TELEGRAM_LINK_SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(32) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tg_sessions_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_tg_sessions_user ON telegram_link_sessions(user_id);

COMMENT ON TABLE telegram_link_sessions IS 'Sesiones temporales para vincular Telegram';

-- ============================================
-- 8. USER_SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  ip_address INET,
  user_agent TEXT,
  platform VARCHAR(64),
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  last_activity_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE user_sessions IS 'Sesiones de usuario con tokens JWT y refresh tokens';

-- ============================================
-- 9. CONNECTION_LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  platform VARCHAR(64),
  path VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_logs_user_id ON connection_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_logs_session_id ON connection_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_logs_created_at ON connection_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_event_type ON connection_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_event ON connection_logs(user_id, event_type, created_at DESC) WHERE user_id IS NOT NULL;

COMMENT ON TABLE connection_logs IS 'Registro de auditoría de conexiones y eventos';

-- ============================================
-- 10. RAFFLES
-- ============================================
CREATE TABLE IF NOT EXISTS raffles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('fires', 'prize')),
  type VARCHAR(20) DEFAULT 'public',
  
  -- Precios y economía
  entry_price_fire DECIMAL(10,2) DEFAULT 0,
  entry_price_coin DECIMAL(10,2) DEFAULT 0,
  entry_price_fiat DECIMAL(10,2) DEFAULT 0,
  cost_per_number DECIMAL(10,2) DEFAULT 10,
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  
  -- Configuración de números
  numbers_range INTEGER DEFAULT 100,
  total_pot DECIMAL(10,2) DEFAULT 0,
  
  -- Ganador
  winner_number INTEGER,
  winner_id UUID REFERENCES users(id),
  
  -- Estados y visibilidad
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'open', 'in_progress', 'drawing', 'finished', 'cancelled')),
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'friends')),
  
  -- Modo empresa
  is_company_mode BOOLEAN DEFAULT FALSE,
  company_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Configuración de cierre
  close_type VARCHAR(20) DEFAULT 'auto_full' CHECK (close_type IN ('auto_full', 'manual', 'scheduled')),
  scheduled_close_at TIMESTAMP,
  
  -- Metadata
  terms_conditions TEXT,
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  
  -- Timing
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  drawn_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffles_code ON raffles(code);
CREATE INDEX IF NOT EXISTS idx_raffles_host ON raffles(host_id);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_visibility ON raffles(visibility);
CREATE INDEX IF NOT EXISTS idx_raffles_is_company ON raffles(is_company_mode);
CREATE INDEX IF NOT EXISTS idx_raffles_close_type ON raffles(close_type);
CREATE INDEX IF NOT EXISTS idx_raffles_pot_fires ON raffles(pot_fires DESC) WHERE pot_fires > 0;
CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffles_drawn_at ON raffles(drawn_at) WHERE drawn_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffles_timing_status ON raffles(status, starts_at, ends_at) WHERE status IN ('pending', 'active', 'in_progress');

COMMENT ON TABLE raffles IS 'Rifas - modo fires o premio';
COMMENT ON COLUMN raffles.mode IS 'fires: reparte pot, prize: premio físico';
COMMENT ON COLUMN raffles.cost_per_number IS 'Costo base por número en modo fires';
COMMENT ON COLUMN raffles.pot_fires IS 'Acumulador de fuegos en el pote';
COMMENT ON COLUMN raffles.pot_coins IS 'Acumulador de monedas en el pote';
COMMENT ON COLUMN raffles.numbers_range IS 'Rango total de números disponibles';
COMMENT ON COLUMN raffles.is_company_mode IS 'TRUE si es rifa empresarial (3000🔥)';
COMMENT ON COLUMN raffles.prize_meta IS 'Metadata del premio en formato JSON';
COMMENT ON COLUMN raffles.host_meta IS 'Metadata del host en formato JSON';
COMMENT ON COLUMN raffles.starts_at IS 'Fecha/hora programada de inicio de la rifa';
COMMENT ON COLUMN raffles.ends_at IS 'Fecha/hora programada de cierre de la rifa';
COMMENT ON COLUMN raffles.drawn_at IS 'Fecha/hora en que se realizó el sorteo';

-- ============================================
-- 11. RAFFLE_NUMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_numbers (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'available' CHECK (state IN ('available', 'sold', 'reserved')),
  owner_id UUID REFERENCES users(id),
  purchased_at TIMESTAMP,
  UNIQUE(raffle_id, number_idx)
);

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle ON raffle_numbers(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_owner ON raffle_numbers(owner_id);

COMMENT ON TABLE raffle_numbers IS 'Números de cada rifa';

-- ============================================
-- 12. RAFFLE_COMPANIES
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_raffle_companies_raffle ON raffle_companies(raffle_id);

COMMENT ON TABLE raffle_companies IS 'Información de empresas patrocinadoras';

-- ============================================
-- 13. RAFFLE_PARTICIPANTS
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_participants (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  numbers INTEGER[] DEFAULT '{}',
  fires_spent DECIMAL(20,2) DEFAULT 0,
  coins_spent DECIMAL(20,2) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raffle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle ON raffle_participants(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_user ON raffle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_participants_raffle_user ON raffle_participants(raffle_id, user_id);

COMMENT ON TABLE raffle_participants IS 'Participantes de rifas con tracking de números y gastos';

-- ============================================
-- 14. RAFFLE_AUDIT_LOGS
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_raffle_audit_created ON raffle_audit_logs(created_at DESC);

-- ============================================
-- 15. TICTACTOE_ROOMS
-- ============================================
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
  current_turn CHAR(1) CHECK (current_turn IN ('X', 'O')),
  winner CHAR(1) CHECK (winner IN ('X', 'O', 'D')),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  player_x_ready BOOLEAN DEFAULT FALSE,
  player_o_ready BOOLEAN DEFAULT FALSE,
  player_x_left BOOLEAN DEFAULT FALSE,
  player_o_left BOOLEAN DEFAULT FALSE,
  rematch_requested_by CHAR(1) CHECK (rematch_requested_by IN ('X', 'O')),
  rematch_accepted BOOLEAN DEFAULT FALSE,
  round_number INTEGER DEFAULT 1,
  player_x_score INTEGER DEFAULT 0,
  player_o_score INTEGER DEFAULT 0,
  xp_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  last_move_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_code ON tictactoe_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tictactoe_status ON tictactoe_rooms(status);

COMMENT ON TABLE tictactoe_rooms IS 'Salas de TicTacToe con sistema de revancha';

-- ============================================
-- 16. TICTACTOE_MOVES
-- ============================================
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id SERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id),
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 9),
  symbol CHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  move_number INTEGER NOT NULL,
  board_after TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id, move_number);

-- ============================================
-- 17. BINGO V2 - ROOMS
-- ============================================
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
  current_game_number INTEGER DEFAULT 0,
  last_called_number INTEGER,
  last_called_at TIMESTAMP,
  drawn_numbers JSONB DEFAULT '[]'::jsonb,
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_code ON bingo_v2_rooms(code);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_host ON bingo_v2_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_status ON bingo_v2_rooms(status);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_rooms_active ON bingo_v2_rooms(status, created_at DESC) 
  WHERE status IN ('waiting', 'in_progress');

COMMENT ON TABLE bingo_v2_rooms IS 'Salas de Bingo V2 - sistema completo reescrito';

-- ============================================
-- 18. BINGO V2 - ROOM PLAYERS
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_bingo_v2_players_user ON bingo_v2_room_players(user_id);

-- ============================================
-- 19. BINGO V2 - CARDS
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_bingo_v2_cards_player ON bingo_v2_cards(player_id);

-- ============================================
-- 20. BINGO V2 - DRAWS
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_bingo_v2_draws_room ON bingo_v2_draws(room_id);

-- ============================================
-- 21. BINGO V2 - AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_v2_audit_logs (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES bingo_v2_rooms(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_audit_room ON bingo_v2_audit_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_audit_user ON bingo_v2_audit_logs(user_id);

-- ============================================
-- 22. BINGO V2 - ROOM CHAT
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_v2_room_chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_chat_room ON bingo_v2_room_chat_messages(room_id);

-- ============================================
-- 23. BINGO V2 - USER MESSAGES (BUZÓN)
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_bingo_v2_messages_unread ON bingo_v2_messages(user_id, is_read);

-- ============================================
-- 24. MARKET REDEEMS
-- ============================================
CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 100 CHECK (fires_amount > 0),
  fiat_amount DECIMAL(18,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  cedula VARCHAR(20),
  phone VARCHAR(32),
  bank_code VARCHAR(10),
  bank_name VARCHAR(128),
  bank_account VARCHAR(64),
  payment_method VARCHAR(32),
  transaction_id VARCHAR(128),
  proof_url TEXT,
  notes TEXT,
  processor_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_redeems_processor ON market_redeems(processor_id) WHERE processor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_redeems_user_status ON market_redeems(user_id, status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_processed ON market_redeems(processed_at DESC) WHERE processed_at IS NOT NULL;

COMMENT ON TABLE market_redeems IS 'Redenciones de fires por dinero fiat';
COMMENT ON COLUMN market_redeems.fires_amount IS 'Cantidad de fuegos a redimir (mínimo 100)';
COMMENT ON COLUMN market_redeems.status IS 'Estado: pending, processing, completed, rejected, cancelled';

-- ============================================
-- 25. WELCOME EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS welcome_events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(200) NOT NULL,
  event_type VARCHAR(50) DEFAULT 'manual',
  description TEXT,
  coins_reward DECIMAL(10,2) DEFAULT 0,
  fires_reward DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  duration_hours INTEGER,
  priority INTEGER DEFAULT 0,
  max_claims INTEGER,
  current_claims INTEGER DEFAULT 0,
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
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_events_active ON welcome_events(is_active);
CREATE INDEX IF NOT EXISTS idx_welcome_events_starts_at ON welcome_events(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welcome_events_ends_at ON welcome_events(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welcome_events_active_timing ON welcome_events(is_active, starts_at, ends_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_welcome_events_priority ON welcome_events(priority DESC, created_at DESC);

COMMENT ON TABLE welcome_events IS 'Eventos de bienvenida y fidelización';
COMMENT ON COLUMN welcome_events.starts_at IS 'Fecha/hora de inicio del evento (NULL = inmediato)';
COMMENT ON COLUMN welcome_events.ends_at IS 'Fecha/hora de fin del evento';
COMMENT ON COLUMN welcome_events.duration_hours IS 'Duración del evento en horas';
COMMENT ON COLUMN welcome_events.priority IS 'Prioridad del evento (mayor = más prioritario)';

-- ============================================
-- 26. DIRECT GIFTS
-- ============================================
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (coins_amount >= 0 AND fires_amount >= 0),
  CHECK (coins_amount > 0 OR fires_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_direct_gifts_target_user ON direct_gifts(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_gifts_sender ON direct_gifts(sender_id);

-- ============================================
-- 26. DIRECT GIFT CLAIMS
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_direct_gift_claims_user ON direct_gift_claims(user_id);

-- ============================================
-- 27. GIFT ANALYTICS
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_gift_analytics_event ON gift_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_gift_analytics_user ON gift_analytics(user_id);

-- ============================================
-- 28. MIGRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);

COMMENT ON TABLE migrations IS 'Control de versiones de migraciones ejecutadas';

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para generar códigos de sala Bingo
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

-- Función para limpiar salas abandonadas
CREATE OR REPLACE FUNCTION cleanup_abandoned_rooms() RETURNS void AS $$
BEGIN
  UPDATE bingo_v2_rooms
  SET status = 'cancelled'
  WHERE status IN ('waiting', 'in_progress')
  AND NOT EXISTS (
    SELECT 1 FROM bingo_v2_room_players
    WHERE room_id = bingo_v2_rooms.id
    AND last_activity > NOW() - INTERVAL '5 minutes'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Roles por defecto
INSERT INTO roles (name, description) VALUES
  ('user', 'Usuario regular'),
  ('admin', 'Administrador del sistema'),
  ('tote', 'Super administrador')
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- ============================================
-- FIN DEL SCHEMA
-- ============================================
