-- ============================================
-- MIGRATION 029: Sistema Unificado de Códigos de Sala
-- ============================================
-- Propósito: Crear registro central de códigos únicos para TicTacToe, Bingo y Rifas
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ

-- Tabla central de códigos de sala
CREATE TABLE IF NOT EXISTS room_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('tictactoe', 'bingo', 'raffle')),
    room_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_room_reference UNIQUE (game_type, room_id)
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_room_codes_code ON room_codes(code);
CREATE INDEX IF NOT EXISTS idx_room_codes_game_type ON room_codes(game_type);
CREATE INDEX IF NOT EXISTS idx_room_codes_status ON room_codes(status);
CREATE INDEX IF NOT EXISTS idx_room_codes_active ON room_codes(code, game_type) WHERE status = 'active';

-- Función para generar código único cross-game
CREATE OR REPLACE FUNCTION generate_unique_room_code() RETURNS VARCHAR(6) AS $$
DECLARE
    new_code VARCHAR(6);
    code_exists BOOLEAN;
    attempts INTEGER := 0;
    max_attempts INTEGER := 50;
BEGIN
    LOOP
        -- Generar código de 6 dígitos
        new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        -- Verificar si existe en el registro central
        SELECT EXISTS(
            SELECT 1 FROM room_codes WHERE code = new_code
        ) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
        
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Función para reservar código
CREATE OR REPLACE FUNCTION reserve_room_code(
    p_game_type VARCHAR(20),
    p_room_id VARCHAR(255)
) RETURNS VARCHAR(6) AS $$
DECLARE
    v_code VARCHAR(6);
BEGIN
    -- Generar código único
    v_code := generate_unique_room_code();
    
    -- Insertar en registro
    INSERT INTO room_codes (code, game_type, room_id, status)
    VALUES (v_code, p_game_type, p_room_id, 'active');
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar estado de sala
CREATE OR REPLACE FUNCTION update_room_code_status(
    p_code VARCHAR(6),
    p_status VARCHAR(20)
) RETURNS VOID AS $$
BEGIN
    UPDATE room_codes 
    SET status = p_status, updated_at = CURRENT_TIMESTAMP
    WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;

-- Función para buscar sala por código
CREATE OR REPLACE FUNCTION find_room_by_code(p_code VARCHAR(6))
RETURNS TABLE(
    code VARCHAR(6),
    game_type VARCHAR(20),
    room_id VARCHAR(255),
    status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT rc.code, rc.game_type, rc.room_id, rc.status
    FROM room_codes rc
    WHERE rc.code = p_code AND rc.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_room_codes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_codes_timestamp
    BEFORE UPDATE ON room_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_room_codes_timestamp();

-- Comentarios para documentación
COMMENT ON TABLE room_codes IS 'Registro central de códigos únicos para todas las salas de juego';
COMMENT ON COLUMN room_codes.code IS 'Código único de 6 dígitos numéricos';
COMMENT ON COLUMN room_codes.game_type IS 'Tipo de juego: tictactoe, bingo, raffle';
COMMENT ON COLUMN room_codes.room_id IS 'ID de la sala en su tabla específica';
COMMENT ON COLUMN room_codes.status IS 'Estado: active, finished, cancelled';
