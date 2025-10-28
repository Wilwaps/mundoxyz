-- ================================================================
-- SISTEMA DE RIFAS COMPLETO - MIGRACIÓN 003
-- ================================================================
-- Autor: Cascade AI
-- Fecha: 2025-10-28
-- Descripción: Sistema completo de rifas con modo empresas, premios,
--              límites por XP, tickets digitales y aprobaciones

-- ================================================================
-- 1. EXTENDER TABLA RAFFLES EXISTENTE
-- ================================================================
DO $$
BEGIN
    -- Verificar si la tabla raffles existe antes de modificar
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'raffles') THEN
        
        -- Agregar columnas si no existen
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'mode') THEN
            ALTER TABLE raffles ADD COLUMN mode VARCHAR(20) DEFAULT 'fire' CHECK (mode IN ('fire', 'prize'));
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'type') THEN
            ALTER TABLE raffles ADD COLUMN type VARCHAR(20) DEFAULT 'public' CHECK (type IN ('public', 'private'));
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'number_range') THEN
            ALTER TABLE raffles ADD COLUMN number_range VARCHAR(10) DEFAULT '00-99' CHECK (number_range IN ('00-99', '000-999', '0000-9999'));
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'is_company_mode') THEN
            ALTER TABLE raffles ADD COLUMN is_company_mode BOOLEAN DEFAULT FALSE;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'company_cost') THEN
            ALTER TABLE raffles ADD COLUMN company_cost INTEGER DEFAULT 3000;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'close_type') THEN
            ALTER TABLE raffles ADD COLUMN close_type VARCHAR(20) DEFAULT 'auto_full' CHECK (close_type IN ('auto_full', 'auto_1day', 'auto_1week', 'manual'));
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'scheduled_close_at') THEN
            ALTER TABLE raffles ADD COLUMN scheduled_close_at TIMESTAMP;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'prize_description') THEN
            ALTER TABLE raffles ADD COLUMN prize_description TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'prize_image_url') THEN
            ALTER TABLE raffles ADD COLUMN prize_image_url VARCHAR(500);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'payment_cost_description') THEN
            ALTER TABLE raffles ADD COLUMN payment_cost_description TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'contact_name') THEN
            ALTER TABLE raffles ADD COLUMN contact_name VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'contact_phone') THEN
            ALTER TABLE raffles ADD COLUMN contact_phone VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'contact_email') THEN
            ALTER TABLE raffles ADD COLUMN contact_email VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'contact_bank') THEN
            ALTER TABLE raffles ADD COLUMN contact_bank VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'contact_id_card') THEN
            ALTER TABLE raffles ADD COLUMN contact_id_card VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'terms_conditions') THEN
            ALTER TABLE raffles ADD COLUMN terms_conditions TEXT;
        END IF;
        
        -- Agregar índices para rendimiento
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'raffles' AND indexname = 'idx_raffles_host_status') THEN
            CREATE INDEX idx_raffles_host_status ON raffles(host_id, status);
        END IF;
        
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'raffles' AND indexname = 'idx_raffles_mode_type') THEN
            CREATE INDEX idx_raffles_mode_type ON raffles(mode, type, status);
        END IF;
        
    END IF;
END $$;

-- ================================================================
-- 2. TABLA RAFFLE_COMPANIES (MODO EMPRESAS)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_rif VARCHAR(50) NOT NULL,
    primary_color VARCHAR(7) NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    secondary_color VARCHAR(7) NOT NULL CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para raffle_companies
CREATE INDEX idx_raffle_companies_ripple_id ON raffle_companies(raffle_id);

-- ================================================================
-- 3. TABLA RAFFLE_NUMBERS (NÚMEROS DISPONIBLES/COMPRADOS)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'purchased', 'pending_approval')),
    reserved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reserved_at TIMESTAMP,
    purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
    purchased_at TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(raffle_id, number)
);

-- Índices para raffle_numbers
CREATE INDEX idx_raffle_numbers_ripple_status ON raffle_numbers(raffle_id, status);
CREATE INDEX idx_raffle_numbers_reserved ON raffle_numbers(reserved_by, status);
CREATE INDEX idx_raffle_numbers_purchased ON raffle_numbers(purchased_by, status);
CREATE INDEX idx_raffle_numbers_expires ON raffle_numbers(expires_at) WHERE status = 'reserved';

-- ================================================================
-- 4. TABLA RAFFLE_PURCHASES (COMPRAS DE NÚMEROS)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    cost_amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'fires',
    purchase_type VARCHAR(20) NOT NULL DEFAULT 'fire' CHECK (purchase_type IN ('fire', 'prize')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    payment_reference VARCHAR(255),
    purchase_data JSONB, -- Datos adicionales del modo premio
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para raffle_purchases
CREATE INDEX idx_raffle_purchases_user_status ON raffle_purchases(user_id, status);
CREATE INDEX idx_raffle_purchases_ripple_status ON raffle_purchases(raffle_id, status);
CREATE INDEX idx_raffle_purchases_purchase_type ON raffle_purchases(purchase_type, status);

-- ================================================================
-- 5. TABLA RAFFLE_REQUESTS (SOLICITUDES MODO PREMIO)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    payment_reference VARCHAR(255),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(raffle_id, user_id, number_id)
);

-- Índices para raffle_requests
CREATE INDEX idx_raffle_requests_ripple_status ON raffle_requests(raffle_id, status);
CREATE INDEX idx_raffle_requests_user ON raffle_requests(user_id, status);

-- ================================================================
-- 6. TABLA RAFFLE_TICKETS (TICKETS DIGITALES CON QR)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES raffle_purchases(id) ON DELETE CASCADE,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    qr_code_url VARCHAR(500),
    is_valid BOOLEAN DEFAULT TRUE,
    validated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para raffle_tickets
CREATE INDEX idx_raffle_tickets_user ON raffle_tickets(user_id);
CREATE INDEX idx_raffle_tickets_number ON raffle_tickets(number_id);
CREATE INDEX idx_raffle_tickets_ripple ON raffle_tickets(raffle_id);

-- ================================================================
-- 7. TABLA RAFFLE_WINNERS (GANADORES Y HISTÓRICO)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    winning_number VARCHAR(10) NOT NULL,
    prize_amount INTEGER,
    prize_type VARCHAR(20) DEFAULT 'fire',
    pdf_url VARCHAR(500),
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMP
);

-- Índices para raffle_winners
CREATE INDEX idx_raffle_winners_user ON raffle_winners(user_id);
CREATE INDEX idx_raffle_winners_ripple ON raffle_winners(raffle_id);

-- ================================================================
-- 8. FUNCIÓN PARA GENERAR CÓDIGO ÚNICO DE RIFA (6 DÍGITOS NUMÉRICOS)
-- ================================================================
CREATE OR REPLACE FUNCTION generate_unique_raffle_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
    new_code VARCHAR(6);
    max_attempts INTEGER := 100;
    attempt_count INTEGER := 0;
    code_exists BOOLEAN;
BEGIN
    -- Generar códigos numéricos de 6 dígitos (100000-999999)
    LOOP
        -- Generar número aleatorio entre 100000 y 999999
        -- Esto garantiza siempre 6 dígitos (no empezará con 0)
        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);

        -- Verificar si el código ya existe en raffles
        SELECT EXISTS(
            SELECT 1
            FROM raffles
            WHERE raffles.code = new_code
        ) INTO code_exists;

        -- Si no existe, retornar el código
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;

        -- Incrementar contador de intentos
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$;

-- ================================================================
-- 9. TRIGGER PARA ACTUALIZAR UPDATED_AT
-- ================================================================
CREATE OR REPLACE FUNCTION update_raffle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas que lo necesiten
CREATE TRIGGER trigger_raffle_companies_updated
    BEFORE UPDATE ON raffle_companies
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

CREATE TRIGGER trigger_raffle_purchases_updated
    BEFORE UPDATE ON raffle_purchases
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

CREATE TRIGGER trigger_raffle_requests_updated
    BEFORE UPDATE ON raffle_requests
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

-- ================================================================
-- 10. FUNCIÓN PARA VERIFICAR LÍMITES DE RIFA POR XP
-- ================================================================
CREATE OR REPLACE FUNCTION check_user_raffle_limit(p_user_id UUID)
RETURNS TABLE (
    current_active INTEGER,
    max_allowed INTEGER,
    can_create BOOLEAN,
    needed_xp INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
    user_xp INTEGER;
BEGIN
    -- Obtener XP del usuario
    SELECT COALESCE(xp, 0) INTO user_xp
    FROM users
    WHERE id = p_user_id;
    
    -- Contar rifas activas del usuario
    SELECT COUNT(*) INTO current_active
    FROM raffles
    WHERE host_id = p_user_id AND status IN ('active', 'waiting');
    
    -- Determinar límite según XP
    max_allowed := CASE
        WHEN user_xp >= 1000 THEN 4
        WHEN user_xp >= 500 THEN 3
        WHEN user_xp >= 50 THEN 2
        ELSE 1
    END;
    
    -- Calcular XP necesaria para siguiente nivel
    needed_xp := CASE
        WHEN user_xp >= 1000 THEN 0
        WHEN user_xp >= 500 THEN 1000 - user_xp
        WHEN user_xp >= 50 THEN 500 - user_xp
        ELSE 50 - user_xp
    END;
    
    can_create := current_active < max_allowed;
    
    RETURN QUERY SELECT current_active, max_allowed, can_create, needed_xp;
END;
$$;

-- ================================================================
-- 11. VISTA PARA CONSULTAS EFICIENTES EN LOBBY
-- ================================================================
CREATE OR REPLACE VIEW raffle_lobby_view AS
SELECT 
    r.id,
    r.code,
    r.name,
    r.host_id,
    u.username as host_username,
    r.mode,
    r.type,
    r.number_range,
    r.status,
    r.cost_per_number,
    r.initial_pot,
    r.current_pot,
    r.total_numbers,
    r.purchased_numbers,
    r.is_company_mode,
    r.created_at,
    r.scheduled_close_at,
    rc.company_name,
    rc.logo_url,
    COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END) as real_purchased_count
FROM raffles r
JOIN users u ON r.host_id = u.id
LEFT JOIN raffle_companies rc ON r.id = rc.ripple_id
LEFT JOIN raffle_numbers rn ON r.id = rn.ripple_id
WHERE r.status IN ('active', 'waiting', 'finished')
GROUP BY r.id, u.username, rc.company_name, rc.logo_url;

-- ================================================================
-- 12. ÍNDICES PARA RENDIMIENTO EN ALTAS CARGAS
-- ================================================================
CREATE INDEX idx_raffles_lobby_mode ON raffles(mode, status, created_at DESC) WHERE status IN ('active', 'waiting');
CREATE INDEX idx_raffles_scheduled_close ON raffles(scheduled_close_at, status) WHERE close_type IN ('auto_1day', 'auto_1week');

-- ================================================================
-- 13. COMENTARIOS EXPLICATIVOS
-- ================================================================
COMMENT ON TABLE raffle_companies IS 'Configuración de branding para modo empresas';
COMMENT ON TABLE raffle_numbers IS 'Números individuales de cada rifa con su estado';
COMMENT ON TABLE raffle_purchases IS 'Registro de todas las compras de números';
COMMENT ON TABLE raffle_requests IS 'Solicitudes pendientes en modo premio';
COMMENT ON TABLE raffle_tickets IS 'Tickets digitales con código QR para validación';
COMMENT ON TABLE raffle_winners IS 'Historial de ganadores y premios entregados';

COMMENT ON FUNCTION generate_unique_raffle_code() IS 'Genera códigos numéricos únicos de 6 dígitos para rifas';
COMMENT ON FUNCTION check_user_raffle_limit() IS 'Verifica límites de creación de rifas según XP del usuario';
COMMENT ON VIEW raffle_lobby_view IS 'Vista optimizada para consultas del lobby público de rifas';

-- ================================================================
-- FINALIZACIÓN
-- ================================================================
-- La migración está lista para ser ejecutada en Railway PostgreSQL
-- Incluye todas las tablas, funciones, triggers e índices necesarios
-- para el sistema completo de rifas con empresas, premios y tickets digitales
-- ================================================================
