-- Games tables: raffles, bingo

-- Raffles table
CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('free', 'fires', 'coins')),
  entry_price_fire DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_fire >= 0),
  entry_price_coin DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_coin >= 0),
  entry_price_fiat DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_fiat >= 0),
  numbers_range INTEGER NOT NULL DEFAULT 100,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'friends')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'drawing', 'finished', 'cancelled')),
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  max_participants INTEGER,
  winner_id UUID REFERENCES users(id),
  winning_number INTEGER,
  host_meta JSONB DEFAULT '{}',
  prize_meta JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raffles_code ON raffles(code);
CREATE INDEX idx_raffles_host ON raffles(host_id);
CREATE INDEX idx_raffles_status ON raffles(status);
CREATE INDEX idx_raffles_visibility ON raffles(visibility);
CREATE INDEX idx_raffles_created ON raffles(created_at);

-- Raffle numbers table
CREATE TABLE IF NOT EXISTS raffle_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL CHECK (number_idx >= 0),
  state VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'reserved', 'sold')),
  owner_id UUID REFERENCES users(id),
  owner_ext VARCHAR(128),
  reserved_by_ext VARCHAR(128),
  reserved_until TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  reference VARCHAR(255),
  transaction_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, number_idx)
);

CREATE INDEX idx_raffle_numbers_raffle ON raffle_numbers(raffle_id);
CREATE INDEX idx_raffle_numbers_state ON raffle_numbers(state);
CREATE INDEX idx_raffle_numbers_owner ON raffle_numbers(owner_id) WHERE owner_id IS NOT NULL;

-- Raffle participants table
CREATE TABLE IF NOT EXISTS raffle_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  numbers INTEGER[] NOT NULL DEFAULT '{}',
  fires_spent DECIMAL(18,2) DEFAULT 0,
  coins_spent DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'winner', 'loser')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, user_id)
);

CREATE INDEX idx_raffle_participants_raffle ON raffle_participants(raffle_id);
CREATE INDEX idx_raffle_participants_user ON raffle_participants(user_id);
CREATE INDEX idx_raffle_participants_status ON raffle_participants(status);

-- Raffle pending requests
CREATE TABLE IF NOT EXISTS raffle_pending_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  user_id UUID REFERENCES users(id),
  user_ext VARCHAR(128) NOT NULL,
  reference VARCHAR(255),
  proof_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raffle_requests_raffle ON raffle_pending_requests(raffle_id);
CREATE INDEX idx_raffle_requests_status ON raffle_pending_requests(status);

-- Bingo rooms table
CREATE TABLE IF NOT EXISTS bingo_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('friendly', 'fires', 'coins')),
  victory_mode VARCHAR(20) NOT NULL DEFAULT 'line' CHECK (victory_mode IN ('line', 'corners', 'full')),
  ball_count INTEGER NOT NULL DEFAULT 75 CHECK (ball_count IN (75, 90)),
  entry_price_fire DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_fire >= 0),
  entry_price_coin DECIMAL(18,2) DEFAULT 0 CHECK (entry_price_coin >= 0),
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  max_players INTEGER DEFAULT 20,
  max_cards_per_player INTEGER DEFAULT 10 CHECK (max_cards_per_player BETWEEN 1 AND 10),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  numbers_drawn INTEGER[] DEFAULT '{}',
  current_number INTEGER,
  winner_id UUID REFERENCES users(id),
  winning_card_id UUID,
  rules_meta JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bingo_rooms_code ON bingo_rooms(code);
CREATE INDEX idx_bingo_rooms_host ON bingo_rooms(host_id);
CREATE INDEX idx_bingo_rooms_status ON bingo_rooms(status);
CREATE INDEX idx_bingo_rooms_visibility ON bingo_rooms(visibility);

-- Bingo players table
CREATE TABLE IF NOT EXISTS bingo_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  cards_count INTEGER NOT NULL DEFAULT 1 CHECK (cards_count BETWEEN 1 AND 10),
  fires_spent DECIMAL(18,2) DEFAULT 0,
  coins_spent DECIMAL(18,2) DEFAULT 0,
  is_ready BOOLEAN DEFAULT false,
  is_winner BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'winner', 'loser', 'left')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_bingo_players_room ON bingo_players(room_id);
CREATE INDEX idx_bingo_players_user ON bingo_players(user_id);
CREATE INDEX idx_bingo_players_status ON bingo_players(status);

-- Bingo cards table
CREATE TABLE IF NOT EXISTS bingo_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  card_number INTEGER NOT NULL,
  card_data JSONB NOT NULL, -- 5x5 array for 75-ball or appropriate for 90-ball
  marked_numbers INTEGER[] DEFAULT '{}',
  is_winner BOOLEAN DEFAULT false,
  winning_pattern VARCHAR(20),
  claimed_at TIMESTAMPTZ,
  claim_ref VARCHAR(255)
);

CREATE INDEX idx_bingo_cards_room ON bingo_cards(room_id);
CREATE INDEX idx_bingo_cards_player ON bingo_cards(player_id);
CREATE INDEX idx_bingo_cards_winner ON bingo_cards(is_winner) WHERE is_winner = true;

-- Bingo draws history
CREATE TABLE IF NOT EXISTS bingo_draws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  draw_order INTEGER NOT NULL,
  drawn_by UUID REFERENCES users(id),
  drawn_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bingo_draws_room ON bingo_draws(room_id);
CREATE INDEX idx_bingo_draws_order ON bingo_draws(room_id, draw_order);

-- Bingo claims (when players claim victory)
CREATE TABLE IF NOT EXISTS bingo_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES bingo_players(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_ext VARCHAR(128) NOT NULL,
  claim_type VARCHAR(20) NOT NULL, -- 'line', 'corners', 'full'
  is_valid BOOLEAN,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'approved', 'rejected')),
  validator_id UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bingo_claims_room ON bingo_claims(room_id);
CREATE INDEX idx_bingo_claims_player ON bingo_claims(player_id);
CREATE INDEX idx_bingo_claims_status ON bingo_claims(status);

-- Game history/stats table
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(32) NOT NULL, -- 'bingo', 'raffle', 'tictactoe'
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  fires_won DECIMAL(18,2) DEFAULT 0,
  coins_won DECIMAL(18,2) DEFAULT 0,
  fires_spent DECIMAL(18,2) DEFAULT 0,
  coins_spent DECIMAL(18,2) DEFAULT 0,
  highest_win_fires DECIMAL(18,2) DEFAULT 0,
  highest_win_coins DECIMAL(18,2) DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_type)
);

CREATE INDEX idx_game_stats_user ON game_stats(user_id);
CREATE INDEX idx_game_stats_type ON game_stats(game_type);

-- Triggers
CREATE TRIGGER update_raffles_updated_at BEFORE UPDATE ON raffles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bingo_rooms_updated_at BEFORE UPDATE ON bingo_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_stats_updated_at BEFORE UPDATE ON game_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
