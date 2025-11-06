-- ============================================
-- MIGRATION 030: Sistema Unificado de Chat
-- ============================================
-- Propósito: Crear tablas para chat global, anónimo y de sala
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ

-- ============================================
-- 1. TABLA: global_chat_messages
-- ============================================
CREATE TABLE IF NOT EXISTS global_chat_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para global chat
CREATE INDEX IF NOT EXISTS idx_global_chat_created ON global_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_chat_user ON global_chat_messages(user_id);

-- ============================================
-- 2. TABLA: anonymous_chat_messages
-- ============================================
CREATE TABLE IF NOT EXISTS anonymous_chat_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para anonymous chat
CREATE INDEX IF NOT EXISTS idx_anonymous_chat_created ON anonymous_chat_messages(created_at DESC);

-- ============================================
-- 3. TABLA: room_chat_messages (Unificada)
-- ============================================
CREATE TABLE IF NOT EXISTS room_chat_messages (
    id SERIAL PRIMARY KEY,
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('tictactoe', 'bingo', 'raffle')),
    room_code VARCHAR(6) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para room chat
CREATE INDEX IF NOT EXISTS idx_room_chat_type_code ON room_chat_messages(room_type, room_code);
CREATE INDEX IF NOT EXISTS idx_room_chat_created ON room_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_chat_user ON room_chat_messages(user_id);

-- ============================================
-- 4. MIGRAR DATOS EXISTENTES
-- ============================================
-- Migrar mensajes de bingo_v2_room_chat_messages a room_chat_messages
INSERT INTO room_chat_messages (room_type, room_code, user_id, username, message, created_at)
SELECT 
    'bingo' as room_type,
    r.code as room_code,
    m.user_id,
    u.username,
    m.message,
    m.created_at
FROM bingo_v2_room_chat_messages m
JOIN bingo_v2_rooms r ON m.room_id = r.id
JOIN users u ON m.user_id = u.id
WHERE NOT EXISTS (
    -- Evitar duplicados si se re-ejecuta la migración
    SELECT 1 FROM room_chat_messages
    WHERE room_type = 'bingo' 
    AND room_code = r.code 
    AND user_id = m.user_id 
    AND message = m.message
    AND created_at = m.created_at
);

-- ============================================
-- 5. FUNCIONES DE LIMPIEZA AUTOMÁTICA
-- ============================================

-- Limpiar mensajes antiguos (más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages() RETURNS void AS $$
BEGIN
    -- Global chat
    DELETE FROM global_chat_messages 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Anonymous chat
    DELETE FROM anonymous_chat_messages 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Room chat (solo de salas finalizadas)
    DELETE FROM room_chat_messages 
    WHERE created_at < NOW() - INTERVAL '7 days'
    AND (
        -- TicTacToe rooms finished
        (room_type = 'tictactoe' AND EXISTS (
            SELECT 1 FROM tictactoe_rooms 
            WHERE code = room_code AND status = 'finished'
        ))
        OR
        -- Bingo rooms finished
        (room_type = 'bingo' AND EXISTS (
            SELECT 1 FROM bingo_v2_rooms 
            WHERE code = room_code AND status = 'finished'
        ))
        OR
        -- Raffles finished
        (room_type = 'raffle' AND EXISTS (
            SELECT 1 FROM raffles 
            WHERE code = room_code AND status = 'finished'
        ))
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FUNCIONES HELPER
-- ============================================

-- Obtener historial de chat global
CREATE OR REPLACE FUNCTION get_global_chat_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    id INTEGER,
    user_id UUID,
    username VARCHAR,
    message TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.user_id,
        g.username,
        g.message,
        g.created_at
    FROM global_chat_messages g
    ORDER BY g.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Obtener historial de chat anónimo
CREATE OR REPLACE FUNCTION get_anonymous_chat_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    id INTEGER,
    message TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.message,
        a.created_at
    FROM anonymous_chat_messages a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Obtener historial de chat de sala
CREATE OR REPLACE FUNCTION get_room_chat_history(
    p_room_type VARCHAR,
    p_room_code VARCHAR,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    id INTEGER,
    user_id UUID,
    username VARCHAR,
    message TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.user_id,
        r.username,
        r.message,
        r.created_at
    FROM room_chat_messages r
    WHERE r.room_type = p_room_type AND r.room_code = p_room_code
    ORDER BY r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================
COMMENT ON TABLE global_chat_messages IS 'Mensajes del chat global visible en toda la plataforma';
COMMENT ON TABLE anonymous_chat_messages IS 'Mensajes del chat anónimo sin revelar identidad';
COMMENT ON TABLE room_chat_messages IS 'Mensajes de chat específicos de cada sala (TicTacToe, Bingo, Rifa)';

COMMENT ON COLUMN room_chat_messages.room_type IS 'Tipo de sala: tictactoe, bingo, raffle';
COMMENT ON COLUMN room_chat_messages.room_code IS 'Código único de 6 dígitos de la sala';

COMMENT ON FUNCTION cleanup_old_chat_messages() IS 'Limpia mensajes antiguos: 30 días global/anónimo, 7 días salas finalizadas';
COMMENT ON FUNCTION get_global_chat_history(INTEGER) IS 'Retorna últimos N mensajes del chat global';
COMMENT ON FUNCTION get_anonymous_chat_history(INTEGER) IS 'Retorna últimos N mensajes del chat anónimo';
COMMENT ON FUNCTION get_room_chat_history(VARCHAR, VARCHAR, INTEGER) IS 'Retorna últimos N mensajes de una sala específica';
