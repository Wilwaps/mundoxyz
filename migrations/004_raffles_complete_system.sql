-- ================================================================
-- MIGRACIÓN 004: SISTEMA COMPLETO DE RIFAS
-- Fecha: 2025-11-04
-- Descripción: Métodos de cobro, buyer profiles, métricas usuario
-- ================================================================

BEGIN;

-- ================================================================
-- 1. TABLA PARA MÉTODOS DE COBRO DEL HOST
-- ================================================================

CREATE TABLE IF NOT EXISTS raffle_host_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('transferencia', 'efectivo')),
    is_active BOOLEAN DEFAULT true,
    
    -- Campos para transferencia bancaria
    bank_name VARCHAR(100),
    account_holder VARCHAR(200),
    account_number VARCHAR(50),
    id_number VARCHAR(20),
    phone VARCHAR(20),
    instructions TEXT,
    
    -- Campos para pago en efectivo
    pickup_instructions TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Un solo método de cada tipo por rifa
    UNIQUE(raffle_id, method_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_raffle ON raffle_host_payment_methods(raffle_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON raffle_host_payment_methods(raffle_id, is_active);

COMMENT ON TABLE raffle_host_payment_methods IS 'Métodos de cobro configurados por el host para rifas modo premio';
COMMENT ON COLUMN raffle_host_payment_methods.method_type IS 'Tipo de método: transferencia o efectivo';
COMMENT ON COLUMN raffle_host_payment_methods.is_active IS 'Si está activo para recibir pagos';

-- ================================================================
-- 2. EXTENDER TABLA raffle_requests
-- ================================================================

-- Perfil completo del comprador (modo premio)
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS buyer_profile JSONB DEFAULT '{}';

COMMENT ON COLUMN raffle_requests.buyer_profile IS 'Datos completos del comprador: username, display_name, full_name, id_number, phone, location';

-- Método de pago seleccionado
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) CHECK (payment_method IN ('transferencia', 'efectivo', NULL));

-- Referencia de pago bancario
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- Mensaje opcional del comprador
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS message TEXT;

-- Notas del host al aprobar/rechazar
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS host_notes TEXT;

-- Notas administrativas
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Historial de cambios
ALTER TABLE raffle_requests 
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]';

COMMENT ON COLUMN raffle_requests.payment_method IS 'Método de pago usado: transferencia o efectivo';
COMMENT ON COLUMN raffle_requests.payment_reference IS 'Referencia bancaria proporcionada (solo transferencia)';
COMMENT ON COLUMN raffle_requests.message IS 'Mensaje opcional del comprador al host';
COMMENT ON COLUMN raffle_requests.host_notes IS 'Notas del host al aprobar/rechazar';
COMMENT ON COLUMN raffle_requests.admin_notes IS 'Notas administrativas de auditoría';
COMMENT ON COLUMN raffle_requests.history IS 'Historial de cambios con timestamps y acciones';

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_requests_payment_method ON raffle_requests(payment_method);
CREATE INDEX IF NOT EXISTS idx_requests_buyer_profile ON raffle_requests USING GIN(buyer_profile);

-- ================================================================
-- 3. MÉTRICAS DE USUARIO
-- ================================================================

-- Contador de rifas jugadas
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS raffles_played INTEGER DEFAULT 0 CHECK (raffles_played >= 0);

-- Contador de rifas ganadas
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS raffles_won INTEGER DEFAULT 0 CHECK (raffles_won >= 0);

COMMENT ON COLUMN users.raffles_played IS 'Total de rifas en las que ha participado';
COMMENT ON COLUMN users.raffles_won IS 'Total de rifas que ha ganado';

-- Índices para performance en ranking/perfil
CREATE INDEX IF NOT EXISTS idx_users_raffles_stats ON users(raffles_played, raffles_won);

-- ================================================================
-- 4. COLUMNAS ADICIONALES EN raffles
-- ================================================================

-- Costo de creación pagado (para auditoría)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS creation_cost NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN raffles.creation_cost IS 'Costo pagado por el host al crear la rifa (300 fuegos para modo premio)';

-- ================================================================
-- 5. TRIGGER PARA ACTUALIZAR updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION update_payment_methods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_methods_updated_at ON raffle_host_payment_methods;
CREATE TRIGGER trigger_payment_methods_updated_at
    BEFORE UPDATE ON raffle_host_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_timestamp();

-- ================================================================
-- 6. FUNCIÓN HELPER PARA BUYER PROFILE
-- ================================================================

-- Validar estructura de buyer_profile
CREATE OR REPLACE FUNCTION validate_buyer_profile(profile JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        profile ? 'username' AND
        profile ? 'display_name' AND
        profile ? 'full_name' AND
        profile ? 'id_number' AND
        profile ? 'phone'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_buyer_profile IS 'Valida que un buyer_profile tenga todos los campos requeridos';

-- ================================================================
-- 7. VISTA PARA ESTADÍSTICAS DE RIFAS
-- ================================================================

CREATE OR REPLACE VIEW raffle_statistics AS
SELECT 
    r.id,
    r.code,
    r.name,
    r.mode,
    r.status,
    r.host_id,
    u.username as host_username,
    COUNT(DISTINCT rn.owner_id) FILTER (WHERE rn.state = 'sold') as unique_participants,
    COUNT(*) FILTER (WHERE rn.state = 'sold') as numbers_sold,
    COUNT(*) FILTER (WHERE rn.state = 'reserved') as numbers_reserved,
    COUNT(*) FILTER (WHERE rn.state = 'available') as numbers_available,
    r.numbers_range as total_numbers,
    ROUND((COUNT(*) FILTER (WHERE rn.state = 'sold')::NUMERIC / NULLIF(r.numbers_range, 0)) * 100, 2) as completion_percentage,
    r.pot_fires,
    r.pot_coins,
    r.created_at,
    r.ended_at
FROM raffles r
LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
LEFT JOIN users u ON r.host_id = u.id
GROUP BY r.id, r.code, r.name, r.mode, r.status, r.host_id, u.username;

COMMENT ON VIEW raffle_statistics IS 'Vista consolidada de estadísticas por rifa';

-- ================================================================
-- 8. DATOS DE PRUEBA (SOLO EN DESARROLLO)
-- ================================================================

-- Descomentar para insertar datos de prueba
/*
INSERT INTO raffle_host_payment_methods (raffle_id, method_type, bank_name, account_holder, id_number, phone, instructions)
SELECT 
    id,
    'transferencia',
    'Banco Provincial',
    'Juan Pérez',
    'V-12345678',
    '0412-1234567',
    'Transferir a cuenta corriente. Enviar capture del comprobante.'
FROM raffles 
WHERE mode = 'prize' 
LIMIT 1
ON CONFLICT (raffle_id, method_type) DO NOTHING;
*/

-- ================================================================
-- VERIFICACIÓN DE MIGRACIÓN
-- ================================================================

DO $$
BEGIN
    -- Verificar que la tabla existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raffle_host_payment_methods') THEN
        RAISE NOTICE '✓ Tabla raffle_host_payment_methods creada exitosamente';
    ELSE
        RAISE EXCEPTION '✗ Error: Tabla raffle_host_payment_methods no fue creada';
    END IF;
    
    -- Verificar columnas en raffle_requests
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raffle_requests' AND column_name = 'buyer_profile') THEN
        RAISE NOTICE '✓ Columna buyer_profile agregada a raffle_requests';
    ELSE
        RAISE EXCEPTION '✗ Error: Columna buyer_profile no fue agregada';
    END IF;
    
    -- Verificar columnas en users
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'raffles_played') THEN
        RAISE NOTICE '✓ Métricas de rifas agregadas a users';
    ELSE
        RAISE EXCEPTION '✗ Error: Métricas no fueron agregadas a users';
    END IF;
    
    -- Verificar vista
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'raffle_statistics') THEN
        RAISE NOTICE '✓ Vista raffle_statistics creada exitosamente';
    ELSE
        RAISE WARNING '⚠ Vista raffle_statistics no fue creada';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ MIGRACIÓN 004 COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '========================================';
END $$;

COMMIT;
