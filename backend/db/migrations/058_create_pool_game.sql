-- Migration: Create Pool Game Tables
-- Description: Creates tables for 8-Ball Pool game (rooms and moves)

BEGIN;

-- 1. Create pool_rooms table
CREATE TABLE IF NOT EXISTS pool_rooms (
    id UUID PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id),
    player_opponent_id UUID REFERENCES users(id),
    
    -- Game Configuration
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
    bet_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
    visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    
    -- Economy
    pot_coins DECIMAL(20, 2) DEFAULT 0,
    pot_fires DECIMAL(20, 2) DEFAULT 0,
    
    -- Game State
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
    current_turn UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    
    -- 8-Ball Specific State
    -- Stores: ball positions, active suit (solids/stripes), cue ball state
    game_state JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    last_move_at TIMESTAMP WITH TIME ZONE,
    
    -- Flags
    player_host_ready BOOLEAN DEFAULT FALSE,
    player_opponent_ready BOOLEAN DEFAULT FALSE,
    rematch_requested_by_host BOOLEAN DEFAULT FALSE,
    rematch_requested_by_opponent BOOLEAN DEFAULT FALSE,
    rematch_count INTEGER DEFAULT 0,
    xp_awarded BOOLEAN DEFAULT FALSE
);

-- 2. Create pool_moves table (for audit/replay if needed)
CREATE TABLE IF NOT EXISTS pool_moves (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES pool_rooms(id),
    player_id UUID NOT NULL REFERENCES users(id),
    move_number INTEGER NOT NULL,
    
    -- Shot details
    shot_type VARCHAR(20), -- 'break', 'regular', 'foul'
    shot_params JSONB, -- power, angle, spin
    
    -- Result
    balls_potted JSONB, -- array of ball numbers
    foul_reason VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_pool_rooms_code ON pool_rooms(code);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_status ON pool_rooms(status);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_host ON pool_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_pool_rooms_opponent ON pool_rooms(player_opponent_id);
CREATE INDEX IF NOT EXISTS idx_pool_moves_room ON pool_moves(room_id);

COMMIT;
