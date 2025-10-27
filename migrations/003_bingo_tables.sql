-- ============================================
-- MIGRACIÓN: SISTEMA DE BINGO COMPLETO
-- ============================================
-- Descripción: Crea todas las tablas necesarias para el juego de Bingo
-- Autor: MUNDOXYZ Team
-- Fecha: 2025-10-27
-- ============================================

-- 1. TABLA PRINCIPAL: SALAS DE BINGO
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) UNIQUE NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_name VARCHAR(100),
    room_type VARCHAR(10) NOT NULL CHECK (room_type IN ('public', 'private')),
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('coins', 'fires')),
    numbers_mode INTEGER NOT NULL CHECK (numbers_mode IN (75, 90)),
    victory_mode VARCHAR(20) NOT NULL CHECK (victory_mode IN ('line', 'corners', 'full')),
    card_cost DECIMAL(10,2) NOT NULL CHECK (card_cost > 0),
    max_players INTEGER DEFAULT 30 CHECK (max_players > 0 AND max_players <= 30),
    max_cards_per_player INTEGER DEFAULT 10 CHECK (max_cards_per_player > 0 AND max_cards_per_player <= 10),
    password VARCHAR(255), -- Para salas privadas
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'ready', 'playing', 'finished', 'cancelled')),
    pot_total DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bingo_rooms_code ON bingo_rooms(code);
CREATE INDEX idx_bingo_rooms_status ON bingo_rooms(status);
CREATE INDEX idx_bingo_rooms_host ON bingo_rooms(host_id);
CREATE INDEX idx_bingo_rooms_created ON bingo_rooms(created_at DESC);

-- 2. TABLA DE JUGADORES EN SALAS
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT FALSE,
    cards_owned INTEGER DEFAULT 0,
    ready_at TIMESTAMP WITH TIME ZONE,
    connected BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    wins INTEGER DEFAULT 0,
    payout DECIMAL(10,2) DEFAULT 0,
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_bingo_players_room ON bingo_room_players(room_id);
CREATE INDEX idx_bingo_players_user ON bingo_room_players(user_id);
CREATE INDEX idx_bingo_players_connected ON bingo_room_players(connected);

-- 3. TABLA DE CARTONES
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_number INTEGER NOT NULL, -- Número del cartón para el jugador (1, 2, 3...)
    numbers JSONB NOT NULL, -- Estructura del cartón según el modo (75 o 90)
    marked_numbers JSONB DEFAULT '[]'::jsonb, -- Números marcados por el jugador
    auto_marked JSONB DEFAULT '[]'::jsonb, -- Números señalados automáticamente
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bingo_cards_room ON bingo_cards(room_id);
CREATE INDEX idx_bingo_cards_owner ON bingo_cards(owner_id);
CREATE INDEX idx_bingo_cards_winner ON bingo_cards(is_winner) WHERE is_winner = true;

-- 4. TABLA DE NÚMEROS CANTADOS
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_drawn_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL, -- Orden en que fue cantado (1, 2, 3...)
    drawn_number INTEGER NOT NULL,
    drawn_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    drawn_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(room_id, drawn_number),
    UNIQUE(room_id, sequence_number)
);

CREATE INDEX idx_bingo_drawn_room ON bingo_drawn_numbers(room_id);
CREATE INDEX idx_bingo_drawn_sequence ON bingo_drawn_numbers(room_id, sequence_number);

-- 5. TABLA DE TRANSACCIONES DE BINGO
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id),
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'room_creation',    -- Host crea sala
        'card_purchase',    -- Jugador compra cartón
        'refund',          -- Devolución
        'winner_payout',   -- Premio ganador
        'host_commission', -- Comisión host
        'platform_fee'     -- Comisión plataforma
    )),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bingo_trans_room ON bingo_transactions(room_id);
CREATE INDEX idx_bingo_trans_user ON bingo_transactions(user_id);
CREATE INDEX idx_bingo_trans_type ON bingo_transactions(type);
CREATE INDEX idx_bingo_trans_created ON bingo_transactions(created_at DESC);

-- 6. TABLA DE GANADORES (Para manejar empates)
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
    winning_pattern VARCHAR(20) NOT NULL, -- line, corners, full
    prize_amount DECIMAL(10,2) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validated BOOLEAN DEFAULT FALSE,
    validation_data JSONB -- Datos de validación del servidor
);

CREATE INDEX idx_bingo_winners_room ON bingo_winners(room_id);
CREATE INDEX idx_bingo_winners_user ON bingo_winners(user_id);

-- 7. TABLA DE AUDITORÍA
-- ============================================
CREATE TABLE IF NOT EXISTS bingo_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES bingo_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bingo_audit_room ON bingo_audit_logs(room_id);
CREATE INDEX idx_bingo_audit_user ON bingo_audit_logs(user_id);
CREATE INDEX idx_bingo_audit_action ON bingo_audit_logs(action);
CREATE INDEX idx_bingo_audit_created ON bingo_audit_logs(created_at DESC);

-- 8. FUNCIÓN PARA GENERAR CÓDIGO ÚNICO DE SALA
-- ============================================
CREATE OR REPLACE FUNCTION generate_unique_bingo_room_code()
RETURNS VARCHAR(6) AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code VARCHAR(6) := '';
    i INTEGER;
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
BEGIN
    LOOP
        code := '';
        FOR i IN 1..6 LOOP
            code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
        
        -- Verificar unicidad
        IF NOT EXISTS (SELECT 1 FROM bingo_rooms WHERE bingo_rooms.code = code) THEN
            RETURN code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. TRIGGER PARA ACTUALIZAR last_activity
-- ============================================
CREATE OR REPLACE FUNCTION update_bingo_room_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bingo_rooms 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activity_on_draw
    AFTER INSERT ON bingo_drawn_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_bingo_room_activity();

CREATE TRIGGER update_activity_on_player_action
    AFTER INSERT OR UPDATE ON bingo_room_players
    FOR EACH ROW
    EXECUTE FUNCTION update_bingo_room_activity();

-- 10. FUNCIÓN PARA VALIDAR PATRÓN DE VICTORIA
-- ============================================
CREATE OR REPLACE FUNCTION validate_bingo_pattern(
    p_card_id UUID,
    p_victory_mode VARCHAR(20)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_card bingo_cards;
    v_room bingo_rooms;
    v_drawn_numbers INTEGER[];
    v_marked_numbers INTEGER[];
    v_numbers JSONB;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- Obtener cartón
    SELECT * INTO v_card FROM bingo_cards WHERE id = p_card_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Obtener sala
    SELECT * INTO v_room FROM bingo_rooms WHERE id = v_card.room_id;
    
    -- Obtener números cantados
    SELECT array_agg(drawn_number) INTO v_drawn_numbers 
    FROM bingo_drawn_numbers 
    WHERE room_id = v_card.room_id;
    
    -- Obtener números marcados del cartón
    SELECT array_agg(value::integer) INTO v_marked_numbers
    FROM jsonb_array_elements_text(v_card.marked_numbers);
    
    -- La validación específica dependerá del modo de victoria
    -- y la estructura del cartón (75 vs 90)
    -- Esta es una versión simplificada
    
    RETURN v_is_valid;
END;
$$ LANGUAGE plpgsql;

-- 11. ESTADÍSTICAS DE BINGO EN user_stats
-- ============================================
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_games_played INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_games_won INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_total_earnings DECIMAL(10,2) DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_total_spent DECIMAL(10,2) DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_cards_completed INTEGER DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS bingo_numbers_marked INTEGER DEFAULT 0;

-- 12. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================
CREATE INDEX idx_bingo_rooms_active ON bingo_rooms(status, room_type) 
    WHERE status IN ('lobby', 'ready', 'playing');
CREATE INDEX idx_bingo_cards_room_owner ON bingo_cards(room_id, owner_id);
CREATE INDEX idx_bingo_drawn_recent ON bingo_drawn_numbers(room_id, drawn_at DESC);

-- ============================================
-- FIN DE LA MIGRACIÓN DE BINGO
-- ============================================

-- Insertar registro de migración
INSERT INTO schema_migrations (version, executed_at) 
VALUES ('003_bingo_tables', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
