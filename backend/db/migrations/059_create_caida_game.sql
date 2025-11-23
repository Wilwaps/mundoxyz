-- Migration: Create Caída Game Tables
-- Description: Creates tables for Caída/Ronda game

BEGIN;

-- 1. Create caida_rooms table
CREATE TABLE IF NOT EXISTS caida_rooms (
    id UUID PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id),
    
    -- Players (stored as JSON array of UUIDs for flexibility 2-4 players)
    player_ids JSONB NOT NULL DEFAULT '[]',
    
    -- Game Configuration
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('coins', 'fires')),
    bet_amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
    visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    
    -- Economy
    pot_coins DECIMAL(20, 2) DEFAULT 0,
    pot_fires DECIMAL(20, 2) DEFAULT 0,
    
    -- Game State
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
    current_turn_index INTEGER DEFAULT 0, -- Index in player_ids array
    
    -- Complex Game State (JSONB)
    -- Includes: deck, table_cards, hands, scores, collected_cards, last_played_card, cantos_history
    game_state JSONB DEFAULT '{}',
    
    -- Winner
    winner_id UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    last_move_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_caida_rooms_code ON caida_rooms(code);
CREATE INDEX IF NOT EXISTS idx_caida_rooms_status ON caida_rooms(status);
CREATE INDEX IF NOT EXISTS idx_caida_rooms_host ON caida_rooms(host_id);

COMMIT;
