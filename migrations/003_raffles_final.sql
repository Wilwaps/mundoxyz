-- ================================================================
-- SISTEMA DE RIFAS - MIGRACIÓN DEFINITIVA (EXISTENTE STRUCTURE)
-- ================================================================
-- Trabaja con la estructura EXACTA que ya existe en la DB

-- ================================================================
-- 1. ADAPTAR TABLA RAFFLES EXISTENTE (SIN MODIFICAR COLUMNAS QUE EXISTEN)
-- ================================================================
DO $$
BEGIN
    -- Solo agregar columnas que realmente no existen
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'raffles') THEN
        
        -- Verificar y agregar solo columnas inexistentes
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'type') THEN
            ALTER TABLE raffles ADD COLUMN type VARCHAR(20) DEFAULT 'public';
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
            ALTER TABLE raffles ADD COLUMN close_type VARCHAR(20) DEFAULT 'auto_full';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'scheduled_close_at') THEN
            ALTER TABLE raffles ADD COLUMN scheduled_close_at TIMESTAMP;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'raffles' AND column_name = 'terms_conditions') THEN
            ALTER TABLE raffles ADD COLUMN terms_conditions TEXT;
        END IF;
        
        RAISE NOTICE 'Tabla raffles adaptada exitosamente';
    END IF;
END $$;

-- ================================================================
-- 2. TABLAS NUEVAS (IF NOT EXISTS)
-- ================================================================
CREATE TABLE IF NOT EXISTS raffle_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_rif VARCHAR(50) NOT NULL,
    primary_color VARCHAR(7) DEFAULT '#FF6B6B',
    secondary_color VARCHAR(7) DEFAULT '#4ECDC4',
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raffle_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    reserved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reserved_at TIMESTAMP,
    purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
    purchased_at TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(raffle_id, number)
);

CREATE TABLE IF NOT EXISTS raffle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    cost_amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'fires',
    purchase_type VARCHAR(20) DEFAULT 'fire',
    status VARCHAR(20) DEFAULT 'pending',
    payment_reference VARCHAR(255),
    purchase_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raffle_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number_id UUID NOT NULL REFERENCES raffle_numbers(id) ON DELETE CASCADE,
    number VARCHAR(10) NOT NULL,
    payment_reference VARCHAR(255),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- ================================================================
-- 3. ÍNDICES PARA PERFORMANCE
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_raffle_companies_ripple_id ON raffle_companies(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_ripple_status ON raffle_numbers(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_reserved ON raffle_numbers(reserved_by, status);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_purchased ON raffle_numbers(purchased_by, status);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_expires ON raffle_numbers(expires_at) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_raffle_purchases_user_status ON raffle_purchases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_purchases_ripple_status ON raffle_purchases(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_ripple_status ON raffle_requests(raffle_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_user ON raffle_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_raffle_tickets_user ON raffle_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_tickets_ripple ON raffle_tickets(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_user ON raffle_winners(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_ripple ON raffle_winners(raffle_id);

-- ================================================================
-- 4. FUNCIÓN PARA GENERAR CÓDIGOS NUMÉRICOS DE 6 DÍGITOS
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
    LOOP
        -- Generar número entre 100000-999999 (siempre 6 dígitos)
        new_code := CAST(100000 + floor(random() * 900000)::int AS VARCHAR);
        
        -- Verificar si existe
        SELECT EXISTS(
            SELECT 1 FROM raffles WHERE raffles.code = new_code
        ) INTO code_exists;
        
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
        
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION 'No se pudo generar código único después de % intentos', max_attempts;
        END IF;
    END LOOP;
END;
$$;

-- ================================================================
-- 5. FUNCIÓN PARA VERIFICAR LÍMITES POR XP
-- ================================================================
CREATE OR REPLACE FUNCTION check_user_raffle_limit(p_user_id UUID)
RETURNS TABLE (
    current_active INTEGER,
    max_allowed INTEGER,
    can_create BOOLEAN,
    needed_xp INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
    user_xp INTEGER := 0;
BEGIN
    -- Obtener XP del usuario
    SELECT COALESCE(xp, 0) INTO user_xp
    FROM users WHERE id = p_user_id;
    
    -- Contar rifas activas (usando status existente: pending, active)
    SELECT COUNT(*) INTO current_active
    FROM raffles
    WHERE host_id = p_user_id AND status IN ('pending', 'active');
    
    -- Determinar límite según XP
    max_allowed := CASE
        WHEN user_xp >= 1000 THEN 4
        WHEN user_xp >= 500 THEN 3
        WHEN user_xp >= 50 THEN 2
        ELSE 1
    END;
    
    -- Calcular XP necesario para siguiente nivel
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
-- 6. VISTA OPTIMIZADA PARA LOBBY (ADAPTADA A ESTRUCTURA EXISTENTE)
-- ================================================================
CREATE OR REPLACE VIEW raffle_lobby_view AS
SELECT 
    r.id,
    r.code,
    r.name,
    r.host_id,
    u.username as host_username,
    r.mode,
    COALESCE(r.type, r.visibility, 'public') as type,
    r.status,
    COALESCE(r.entry_price_fire, 10) as cost_per_number,
    COALESCE(r.pot_fires, 0) as current_pot,
    r.numbers_range,
    COALESCE(r.is_company_mode, false) as is_company_mode,
    r.created_at,
    r.scheduled_close_at,
    r.ends_at,
    rc.company_name,
    rc.logo_url,
    COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END) as purchased_count
FROM raffles r
JOIN users u ON r.host_id = u.id
LEFT JOIN raffle_companies rc ON r.id = rc.ripple_id
LEFT JOIN raffle_numbers rn ON r.id = rn.ripple_id
WHERE r.status IN ('pending', 'active', 'finished')
GROUP BY r.id, u.username, rc.company_name, rc.logo_url;

-- ================================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- ================================================================
CREATE OR REPLACE FUNCTION update_raffle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers (solo si no existen)
DROP TRIGGER IF EXISTS trigger_raffle_companies_updated ON raffle_companies;
CREATE TRIGGER trigger_raffle_companies_updated
    BEFORE UPDATE ON raffle_companies
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

DROP TRIGGER IF EXISTS trigger_raffle_purchases_updated ON raffle_purchases;
CREATE TRIGGER trigger_raffle_purchases_updated
    BEFORE UPDATE ON raffle_purchases
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

DROP TRIGGER IF EXISTS trigger_raffle_requests_updated ON raffle_requests;
CREATE TRIGGER trigger_raffle_requests_updated
    BEFORE UPDATE ON raffle_requests
    FOR EACH ROW EXECUTE FUNCTION update_raffle_timestamp();

-- ================================================================
-- 8. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_raffles_host_status ON raffles(host_id, status);
CREATE INDEX IF NOT EXISTS idx_raffles_mode_type ON raffles(mode, COALESCE(type, visibility), status);
CREATE INDEX IF NOT EXISTS idx_raffles_scheduled_close ON raffles(scheduled_close_at, status) WHERE close_type IN ('auto_1day', 'auto_1week');

-- ================================================================
-- 9. COMENTARIOS EXPLICATIVOS
-- ================================================================
COMMENT ON TABLE raffle_companies IS 'Configuración de branding para modo empresas (+3000 fuegos)';
COMMENT ON TABLE raffle_numbers IS 'Números individuales con estado: available, reserved, purchased, pending_approval';
COMMENT ON TABLE raffle_purchases IS 'Registro completo de compras de números';
COMMENT ON TABLE raffle_requests IS 'Solicitudes pendientes de aprobación (modo premio)';
COMMENT ON TABLE raffle_tickets IS 'Tickets digitales con código QR para validación';
COMMENT ON TABLE raffle_winners IS 'Historial de ganadores y PDFs generados';

COMMENT ON FUNCTION generate_unique_raffle_code() IS 'Genera códigos numéricos únicos de 6 dígitos (100000-999999)';
COMMENT ON FUNCTION check_user_raffle_limit() IS 'Verifica límites de creación: 1 (0 XP), 2 (50 XP), 3 (500 XP), 4+ (1000 XP)';
COMMENT ON VIEW raffle_lobby_view IS 'Vista optimizada para lobby público con paginación';

-- ================================================================
-- FINALIZACIÓN
-- ================================================================
-- Migración definitiva completada exitosamente
-- Sistema de rifas listo para implementación del backend
