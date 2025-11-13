-- ============================================
-- MUNDOXYZ - SCHEMA MAESTRO COMPLETO
-- Última actualización: 2025-11-08
-- ============================================
-- Fecha: 2025-11-08
-- PostgreSQL 14+
-- Descripción: Schema completo de todas las tablas en producción
-- Este archivo representa el estado ACTUAL de la base de datos
-- IMPORTANTE: Balances de monedas están en tabla WALLETS, NO en users
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
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  role VARCHAR(50) DEFAULT 'user',
  roles TEXT[] DEFAULT ARRAY['user'],
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  nickname VARCHAR(20) UNIQUE,
  bio VARCHAR(500),
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
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;

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
-- AUDITORÍA DE CAMBIOS DE ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS role_change_logs (
  id SERIAL PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('add', 'remove')),
  role_name VARCHAR(50) NOT NULL,
  previous_roles JSONB DEFAULT '[]',
  new_roles JSONB DEFAULT '[]',
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_change_logs_target_user ON role_change_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_changed_by ON role_change_logs(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_created_at ON role_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_action ON role_change_logs(action);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_role_name ON role_change_logs(role_name);

COMMENT ON TABLE role_change_logs IS 'Auditoría de cambios de roles realizados por usuarios tote';
COMMENT ON COLUMN role_change_logs.target_user_id IS 'Usuario al que se le modificaron los roles';
COMMENT ON COLUMN role_change_logs.changed_by_user_id IS 'Usuario tote que realizó el cambio';
COMMENT ON COLUMN role_change_logs.action IS 'Acción realizada: add (agregar) o remove (remover)';
COMMENT ON COLUMN role_change_logs.role_name IS 'Nombre del rol que se agregó o removió';
COMMENT ON COLUMN role_change_logs.previous_roles IS 'Roles que tenía el usuario antes del cambio';
COMMENT ON COLUMN role_change_logs.new_roles IS 'Roles que tiene el usuario después del cambio';

-- ============================================
-- 3. WALLETS
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);

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
  related_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_related_user ON wallet_transactions(related_user_id) WHERE related_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_related ON wallet_transactions(wallet_id, related_user_id) WHERE related_user_id IS NOT NULL;

COMMENT ON TABLE wallet_transactions IS 'Historial de transacciones de wallets';

/*
 * TIPOS DE TRANSACCIÓN SOPORTADOS (type):
 * 
 * JUEGOS:
 * - game_bet: Apuesta en juego (TicTacToe, Bingo)
 * - game_win: Premio de juego ganado
 * - game_refund: Reembolso por abandono/error
 * 
 * RIFAS:
 * - raffle_cost: Costo de número(s) de rifa
 * - raffle_win: Premio de rifa ganada
 * - raffle_creation_cost: Costo de crear rifa (host)
 * - raffle_creation_refund: Reembolso al cancelar rifa
 * - raffle_number_refund: Reembolso de números comprados
 * 
 * EXPERIENCIA:
 * - buy_experience: Compra de XP (usuario paga coins+fires)
 * - experience_sale: Venta de XP (admin recibe coins+fires)
 * 
 * TRANSFERENCIAS:
 * - transfer_in: Recepción de transferencia
 * - transfer_out: Envío de transferencia
 * - transfer_refund: Reembolso de transferencia
 * 
 * SISTEMA:
 * - welcome_event: Regalo de bienvenida
 * - admin_grant: Grant manual por admin
 * - admin_deduct: Deducción manual por admin
 * - supply_emission: Emisión desde supply
 * - commission: Comisión de plataforma
 * 
 * MERCADO:
 * - market_redemption: Canje en mercado (quema fires)
 */

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
  prize_image TEXT,
  prize_image_mime VARCHAR(50),
  company_logo TEXT,
  company_logo_mime VARCHAR(50),
  
  -- Timing
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  drawn_at TIMESTAMP,
  finished_at TIMESTAMP,
  
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
COMMENT ON COLUMN raffles.prize_image IS 'Imagen del premio en Base64 (modo prize)';
COMMENT ON COLUMN raffles.prize_image_mime IS 'MIME type de la imagen del premio';
COMMENT ON COLUMN raffles.company_logo IS 'Logo de empresa en Base64 (modo empresa)';
COMMENT ON COLUMN raffles.company_logo_mime IS 'MIME type del logo de empresa';
COMMENT ON COLUMN raffles.starts_at IS 'Fecha/hora programada de inicio de la rifa';
COMMENT ON COLUMN raffles.ends_at IS 'Fecha/hora programada de cierre de la rifa';
COMMENT ON COLUMN raffles.drawn_at IS 'Fecha/hora en que se realizó el sorteo';
COMMENT ON COLUMN raffles.payment_cost_amount IS 'Costo en moneda fiat para rifas Premio/Empresa (migración 034)';
COMMENT ON COLUMN raffles.payment_cost_currency IS 'Moneda del costo: USD, VES, EUR, etc. (migración 034)';
COMMENT ON COLUMN raffles.payment_method IS 'Método de pago: cash (efectivo) o bank (pago móvil/banco) (migración 034)';
COMMENT ON COLUMN raffles.payment_bank_code IS 'Código del banco venezolano para pago móvil, ej: 0102, 0134 (migración 034)';
COMMENT ON COLUMN raffles.payment_phone IS 'Número de teléfono del anfitrión para pago móvil (migración 034)';
COMMENT ON COLUMN raffles.payment_id_number IS 'Cédula/ID del anfitrión para pago móvil (migración 034)';
COMMENT ON COLUMN raffles.payment_instructions IS 'Instrucciones/comentarios adicionales del anfitrión, máx 300 caracteres (migración 034)';
COMMENT ON COLUMN raffles.allow_fire_payments IS 'Habilita pago con fuegos en rifas premio, los fuegos se transfieren al host tras aprobación (migración 035)';

-- ============================================
-- 11. RAFFLE_NUMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_numbers (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'available' CHECK (state IN ('available', 'sold', 'reserved')),
  owner_id UUID REFERENCES users(id),
  reserved_by UUID REFERENCES users(id),
  reserved_until TIMESTAMPTZ,
  purchased_at TIMESTAMP,
  UNIQUE(raffle_id, number_idx)
);

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle ON raffle_numbers(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_owner ON raffle_numbers(owner_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_reserved ON raffle_numbers(reserved_until) WHERE reserved_until IS NOT NULL;

COMMENT ON TABLE raffle_numbers IS 'Números de cada rifa';
COMMENT ON COLUMN raffle_numbers.reserved_by IS 'User ID que reservó temporalmente este número (NULL si no reservado)';
COMMENT ON COLUMN raffle_numbers.reserved_until IS 'Expira la reserva (NULL si no reservado)';

-- ============================================
-- 12. RAFFLE_COMPANIES
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_companies (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER UNIQUE NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  company_name VARCHAR(200) NOT NULL,
  rif_number VARCHAR(50),
  brand_color VARCHAR(7) DEFAULT '#8B5CF6',
  secondary_color VARCHAR(7) DEFAULT '#06B6D4',
  logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_companies_raffle ON raffle_companies(raffle_id);

COMMENT ON TABLE raffle_companies IS 'Información de empresas patrocinadoras';
COMMENT ON COLUMN raffle_companies.brand_color IS 'Color primario de marca (HEX)';
COMMENT ON COLUMN raffle_companies.secondary_color IS 'Color secundario de marca (HEX)';

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
-- 15. RAFFLE_REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  number_idx INTEGER,
  request_type VARCHAR(20) NOT NULL DEFAULT 'approval' CHECK (request_type IN ('approval', 'refund', 'cancel')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  request_data JSONB DEFAULT '{}',
  buyer_profile JSONB DEFAULT '{}',
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  message TEXT,
  fire_amount DECIMAL(18,2) DEFAULT 0,
  history JSONB DEFAULT '[]',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle ON raffle_requests(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_user ON raffle_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_buyer ON raffle_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle_number ON raffle_requests(raffle_id, number_idx);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_status ON raffle_requests(status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_type ON raffle_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_reviewed_by ON raffle_requests(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffle_requests_created ON raffle_requests(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_raffle_request_pending_approved
  ON raffle_requests(raffle_id, number_idx)
  WHERE status IN ('pending','approved');

COMMENT ON TABLE raffle_requests IS 'Solicitudes de aprobación para rifas premio (modo pago)';
COMMENT ON COLUMN raffle_requests.payment_method IS 'Método de pago elegido por comprador: cash, bank, fire (migración 035)';
COMMENT ON COLUMN raffle_requests.fire_amount IS 'Cantidad de fuegos a transferir si payment_method = fire (migración 035)';

-- ============================================
-- 16. TICTACTOE_ROOMS (Estado real en producción)
-- ============================================
-- Nota: Creada con MIGRACION_LA_VIEJA.sql + migración 012
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  
  -- Host y configuración
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (bet_amount >= 1),
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'private')) DEFAULT 'public',
  
  -- Estado
  status VARCHAR(20) NOT NULL CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')) DEFAULT 'waiting',
  
  -- Jugadores
  player_x_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_o_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_x_ready BOOLEAN DEFAULT FALSE,
  player_o_ready BOOLEAN DEFAULT FALSE,
  player_x_left BOOLEAN DEFAULT FALSE,  -- Agregado en migración 012
  player_o_left BOOLEAN DEFAULT FALSE,   -- Agregado en migración 012
  
  -- Juego
  current_turn VARCHAR(1) CHECK (current_turn IN ('X', 'O', NULL)),
  board JSONB DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]',  -- Migración 037: TEXT → JSONB
  moves_history JSONB DEFAULT '[]',
  
  -- Timer (15 segundos por turno)
  time_left_seconds INTEGER DEFAULT 15 CHECK (time_left_seconds >= 0 AND time_left_seconds <= 15),
  last_move_at TIMESTAMP,
  
  -- Resultado
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner_symbol VARCHAR(1) CHECK (winner_symbol IN ('X', 'O', NULL)),
  winning_line JSONB,
  is_draw BOOLEAN DEFAULT FALSE,
  
  -- Economía
  pot_coins NUMERIC(10,2) DEFAULT 0,
  pot_fires NUMERIC(10,2) DEFAULT 0,
  prize_coins NUMERIC(10,2) DEFAULT 0,
  prize_fires NUMERIC(10,2) DEFAULT 0,
  
  -- Experiencia
  xp_awarded BOOLEAN DEFAULT FALSE,
  
  -- Sistema de Revancha
  rematch_requested_by_x BOOLEAN DEFAULT FALSE,
  rematch_requested_by_o BOOLEAN DEFAULT FALSE,
  rematch_count INTEGER DEFAULT 0,
  is_rematch BOOLEAN DEFAULT FALSE,
  original_room_id UUID REFERENCES tictactoe_rooms(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 minutes'),
  archived_at TIMESTAMP,  -- Agregado en migración 012
  
  -- Constraints
  CONSTRAINT valid_players CHECK (player_x_id IS NOT NULL OR player_o_id IS NOT NULL),
  CONSTRAINT valid_bet CHECK (
    (mode = 'coins' AND bet_amount >= 1 AND bet_amount <= 1000) OR
    (mode = 'fires' AND bet_amount = 1)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_code ON tictactoe_rooms(code);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_status ON tictactoe_rooms(status);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_host ON tictactoe_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_mode ON tictactoe_rooms(mode);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_visibility 
  ON tictactoe_rooms(visibility, status) 
  WHERE status = 'waiting' AND player_o_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_created ON tictactoe_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_expires ON tictactoe_rooms(expires_at) WHERE status IN ('waiting', 'ready');
CREATE INDEX IF NOT EXISTS idx_tictactoe_winner_id ON tictactoe_rooms(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tictactoe_status_playing ON tictactoe_rooms(status) WHERE status = 'playing';
CREATE INDEX IF NOT EXISTS idx_tictactoe_rooms_archived ON tictactoe_rooms(archived_at) WHERE archived_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE tictactoe_rooms IS 'Salas de TicTacToe con sistema de revancha (MIGRACION_LA_VIEJA.sql + migración 012)';
COMMENT ON COLUMN tictactoe_rooms.board IS 'Tablero 3x3 como array JSONB: [[null,X,O],[null,null,X],[O,null,null]]';
COMMENT ON COLUMN tictactoe_rooms.winner_id IS 'UUID del jugador ganador';
COMMENT ON COLUMN tictactoe_rooms.winner_symbol IS 'Símbolo del ganador: X o O';
COMMENT ON COLUMN tictactoe_rooms.player_x_left IS 'Indica si el jugador X abandonó la sala (migración 012)';
COMMENT ON COLUMN tictactoe_rooms.player_o_left IS 'Indica si el jugador O abandonó la sala (migración 012)';
COMMENT ON COLUMN tictactoe_rooms.archived_at IS 'Timestamp cuando ambos jugadores abandonaron (migración 012)';

-- ============================================
-- 17. TICTACTOE_MOVES
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
-- 18. BINGO V2 - ROOMS
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
-- 19. BINGO V2 - ROOM PLAYERS
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
-- 20. BINGO V2 - CARDS
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
-- 21. BINGO V2 - DRAWS
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
-- 22. BINGO V2 - AUDIT LOGS
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
-- 23. BINGO V2 - ROOM CHAT
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
-- 24. BINGO V2 - USER MESSAGES (BUZÓN)
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
-- 25. MARKET REDEEMS
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
-- 26. WELCOME EVENTS
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
-- 27. DIRECT GIFTS
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
-- 28. DIRECT GIFT CLAIMS
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
-- 29. GIFT ANALYTICS
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
-- 30. FIRE SUPPLY
-- ============================================
CREATE TABLE IF NOT EXISTS fire_supply (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_max DECIMAL(20, 2) NOT NULL DEFAULT 1000000000,
  total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

CREATE INDEX IF NOT EXISTS idx_fire_supply_updated ON fire_supply(updated_at);

COMMENT ON TABLE fire_supply IS 'Control de suministro total de fuegos (tabla singleton)';
COMMENT ON COLUMN fire_supply.total_max IS 'Máximo suministro de fuegos: 1,000,000,000';

-- ============================================
-- 31. SUPPLY TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS supply_txs (
  id BIGSERIAL PRIMARY KEY,
  transaction_hash UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  type VARCHAR(32) NOT NULL,
  currency VARCHAR(10) NOT NULL CHECK (currency IN ('fires', 'coins')),
  amount DECIMAL(18,2) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_ext VARCHAR(128),
  event_id INTEGER,
  reference VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(128),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_txs_type ON supply_txs(type);
CREATE INDEX IF NOT EXISTS idx_supply_txs_user_id ON supply_txs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supply_txs_created_at ON supply_txs(created_at);
CREATE INDEX IF NOT EXISTS idx_supply_txs_hash ON supply_txs(transaction_hash);

COMMENT ON TABLE supply_txs IS 'Registro de transacciones de suministro (audit log)';
COMMENT ON COLUMN supply_txs.type IS 'Tipos: emission, burn, welcome_bonus, game_reward, market_redeem, admin_grant';

-- ============================================
-- 30. WELCOME EVENT CLAIMS
-- ============================================
CREATE TABLE IF NOT EXISTS welcome_event_claims (
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  coins_claimed DECIMAL(18,2) NOT NULL DEFAULT 0,
  fires_claimed DECIMAL(18,2) NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  PRIMARY KEY(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_welcome_claims_user ON welcome_event_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_welcome_claims_claimed_at ON welcome_event_claims(claimed_at);

COMMENT ON TABLE welcome_event_claims IS 'Tracking de claims de eventos de bienvenida';

-- ============================================
-- 31. WELCOME EVENT HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS welcome_event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES welcome_events(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_name VARCHAR(128),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_history_event ON welcome_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_welcome_history_action ON welcome_event_history(action);

COMMENT ON TABLE welcome_event_history IS 'Historial de auditoría de eventos de bienvenida';
COMMENT ON COLUMN welcome_event_history.action IS 'Acciones: created, updated, activated, deactivated, claimed';

-- ============================================
-- 32. FIRE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS fire_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reference VARCHAR(255),
  proof_url TEXT,
  notes TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fire_requests_user ON fire_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fire_requests_status ON fire_requests(status);
CREATE INDEX IF NOT EXISTS idx_fire_requests_created ON fire_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_fire_requests_reviewer ON fire_requests(reviewer_id);

COMMENT ON TABLE fire_requests IS 'Solicitudes de fuegos de usuarios hacia administradores';
COMMENT ON COLUMN fire_requests.status IS 'Estados: pending, approved, rejected, cancelled';
COMMENT ON COLUMN fire_requests.reference IS 'Referencia bancaria o comprobante de pago';

-- ============================================
-- 33. BINGO V2 REFUNDS
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_v2_refunds (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES bingo_v2_rooms(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES bingo_v2_room_players(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('coins', 'fires')),
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('host_closed', 'system_failure', 'admin_forced', 'timeout')),
  refunded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  refunded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_room ON bingo_v2_refunds(room_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_user ON bingo_v2_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_v2_refunds_date ON bingo_v2_refunds(refunded_at DESC);

COMMENT ON TABLE bingo_v2_refunds IS 'Registro de reembolsos de salas de Bingo';
COMMENT ON COLUMN bingo_v2_refunds.reason IS 'Razones: host_closed, system_failure, admin_forced, timeout';

-- ============================================
-- 34. MIGRATIONS
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
