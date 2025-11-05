-- ============================================
-- SCHEMA MAESTRO PROPUESTO (CON CORRECCIONES)
-- ============================================
-- Fecha: 2025-11-05
-- Status: PROPUESTA - NO APLICAR AÚN
-- Descripción: Este es cómo DEBERÍA verse el schema maestro
--              con TODAS las columnas faltantes añadidas
-- ============================================

-- ============================================
-- CAMBIOS PROPUESTOS
-- ============================================

-- 1. TABLA: users
-- ==================
-- AÑADIR COLUMNA:
--   locale VARCHAR(10) DEFAULT 'es'  -- Después de avatar_url

-- Ubicación en schema actual: línea ~28
-- Razón: Error "column u.locale does not exist"
-- Referencia: 001_core.sql línea 33

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'es';

COMMENT ON COLUMN users.locale IS 'Idioma preferido del usuario (es=español, en=inglés, pt=portugués)';

-- ============================================

-- 2. TABLA: user_roles
-- ==================
-- RENOMBRAR COLUMNAS:
--   assigned_by → granted_by
--   assigned_at → granted_at

-- Ubicación en schema actual: línea 136-138
-- Razón: Error "column ur.granted_by does not exist"
-- Referencia: 001_core.sql línea 67-68

ALTER TABLE user_roles 
RENAME COLUMN assigned_by TO granted_by;

ALTER TABLE user_roles 
RENAME COLUMN assigned_at TO granted_at;

COMMENT ON COLUMN user_roles.granted_by IS 'Usuario que otorgó el rol';
COMMENT ON COLUMN user_roles.granted_at IS 'Fecha/hora en que se otorgó el rol';

-- ============================================

-- 3. TABLA: raffles
-- ==================
-- AÑADIR COLUMNAS:
--   starts_at TIMESTAMP
--   ends_at TIMESTAMP
--   drawn_at TIMESTAMP

-- Ubicación en schema actual: línea ~259 (antes de created_at)
-- Razón: Error "column r.ends_at does not exist"
-- Referencia: 003_raffles.sql línea 24-26

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMP;

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) 
WHERE ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) 
WHERE starts_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raffles_drawn_at ON raffles(drawn_at) 
WHERE drawn_at IS NOT NULL;

-- Índice compuesto para búsquedas de rifas activas por fecha
CREATE INDEX IF NOT EXISTS idx_raffles_timing_status ON raffles(status, starts_at, ends_at) 
WHERE status IN ('pending', 'active', 'in_progress');

COMMENT ON COLUMN raffles.starts_at IS 'Fecha/hora programada de inicio de la rifa';
COMMENT ON COLUMN raffles.ends_at IS 'Fecha/hora programada de cierre de la rifa';
COMMENT ON COLUMN raffles.drawn_at IS 'Fecha/hora en que se realizó el sorteo';

-- ============================================

-- 4. TABLA: market_redeems (COMPLETA - NO EXISTE)
-- ==================
-- CREAR TABLA COMPLETA

-- Ubicación en schema actual: NO EXISTE
-- Razón: Error "relation market_redeems does not exist"
-- Referencia: 002_economy.sql línea 115-165

CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Montos
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 100 CHECK (fires_amount > 0),
  fiat_amount DECIMAL(18,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  
  -- Datos del usuario para transferencia
  cedula VARCHAR(20),
  phone VARCHAR(32),
  bank_code VARCHAR(10),
  bank_name VARCHAR(128),
  bank_account VARCHAR(64),
  payment_method VARCHAR(32), -- 'bank_transfer', 'mobile_payment', 'paypal', etc.
  transaction_id VARCHAR(128),
  
  -- Evidencia y notas
  proof_url TEXT,
  notes TEXT,
  
  -- Procesamiento
  processor_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para market_redeems
CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_redeems_processor ON market_redeems(processor_id) 
WHERE processor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_redeems_user_status ON market_redeems(user_id, status);

-- Trigger para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_market_redeems_updated_at') THEN
    CREATE TRIGGER update_market_redeems_updated_at BEFORE UPDATE ON market_redeems
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

COMMENT ON TABLE market_redeems IS 'Redenciones de fires por dinero fiat';
COMMENT ON COLUMN market_redeems.fires_amount IS 'Cantidad de fuegos a redimir (mínimo 100)';
COMMENT ON COLUMN market_redeems.fiat_amount IS 'Cantidad en moneda fiat equivalente';
COMMENT ON COLUMN market_redeems.status IS 'Estado: pending, processing, completed, rejected, cancelled';
COMMENT ON COLUMN market_redeems.payment_method IS 'Método de pago: bank_transfer, mobile_payment, paypal, etc';
COMMENT ON COLUMN market_redeems.processor_id IS 'Admin que procesó la solicitud';

-- ============================================
-- VISTA COMPLETA: users (PROPUESTA)
-- ============================================

/*
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  tg_id BIGINT UNIQUE,
  avatar_url TEXT,
  locale VARCHAR(10) DEFAULT 'es',  -- ✅ AÑADIDO
  bio TEXT,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_games_won INTEGER DEFAULT 0,
  role VARCHAR(50) DEFAULT 'user',
  roles TEXT[] DEFAULT ARRAY['user'],
  is_verified BOOLEAN DEFAULT false,
  security_answer TEXT,
  last_password_change TIMESTAMP,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
*/

-- ============================================
-- VISTA COMPLETA: user_roles (PROPUESTA)
-- ============================================

/*
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),  -- ✅ RENOMBRADO (era assigned_at)
  granted_by UUID REFERENCES users(id), -- ✅ RENOMBRADO (era assigned_by)
  UNIQUE(user_id, role_id)
);
*/

-- ============================================
-- VISTA COMPLETA: raffles (PROPUESTA)
-- ============================================

/*
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
  status VARCHAR(20) DEFAULT 'pending',
  visibility VARCHAR(20) DEFAULT 'public',
  
  -- Modo empresa
  is_company_mode BOOLEAN DEFAULT FALSE,
  company_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Configuración de cierre
  close_type VARCHAR(20) DEFAULT 'auto_full',
  scheduled_close_at TIMESTAMP,
  
  -- Metadata
  terms_conditions TEXT,
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  
  -- Timing
  starts_at TIMESTAMP,     -- ✅ AÑADIDO
  ends_at TIMESTAMP,       -- ✅ AÑADIDO
  drawn_at TIMESTAMP,      -- ✅ AÑADIDO
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
*/

-- ============================================
-- ORDEN DE TABLAS EN SCHEMA MAESTRO
-- ============================================

/*
1.  users ✅ (añadir locale)
2.  auth_identities
3.  wallets
4.  wallet_transactions
5.  roles
6.  user_roles ✅ (renombrar assigned_by → granted_by)
7.  telegram_link_sessions
8.  user_sessions
9.  connection_logs
10. raffles ✅ (añadir starts_at, ends_at, drawn_at)
11. raffle_numbers
12. raffle_participants
13. raffle_purchases
14. raffle_requests
15. raffle_tickets
16. fire_supply
17. supply_txs
18. fire_requests
19. market_redeems ✅ CREAR (tabla completa nueva)
20. welcome_events
21. welcome_event_claims
22. welcome_event_history
23. direct_gifts
24. direct_gift_claims
25. gift_analytics
26. tictactoe_rooms
27. tictactoe_games
28. bingo_v2_rooms
29. bingo_v2_room_players
30. ... (más tablas bingo v2)
*/

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================

/*
TOTAL DE CAMBIOS: 4

1. users → AÑADIR: locale VARCHAR(10) DEFAULT 'es'

2. user_roles → RENOMBRAR: 
   - assigned_by → granted_by
   - assigned_at → granted_at

3. raffles → AÑADIR:
   - starts_at TIMESTAMP
   - ends_at TIMESTAMP
   - drawn_at TIMESTAMP

4. market_redeems → CREAR TABLA COMPLETA
   - 14 columnas
   - 5 índices
   - 1 trigger
   - 5 comentarios

MIGRACIONES NECESARIAS: 2
- Migración 019: users, user_roles, raffles
- Migración 020: market_redeems

IMPACTO: CRÍTICO
- Resuelve 4 errores de producción
- Habilita sistema de redenciones
- Completa funcionalidad de rifas
- Mejora UX con locale
*/

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

/*
⚠️  NO EJECUTAR ESTE ARCHIVO DIRECTAMENTE
    Este es un archivo de REFERENCIA para entender
    los cambios propuestos.

✅  Usar migraciones incrementales (019, 020)
    en lugar de ejecutar todo de una vez.

🔍  Verificar datos existentes antes de RENAME:
    SELECT COUNT(*) FROM user_roles WHERE assigned_by IS NOT NULL;

📋  Actualizar DATABASE_SCHEMA_MASTER.sql después
    de que las migraciones se ejecuten exitosamente.

🚀  Probar en entorno de desarrollo primero si es posible.
*/
