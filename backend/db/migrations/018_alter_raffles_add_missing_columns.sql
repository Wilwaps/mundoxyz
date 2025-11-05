-- ============================================
-- MIGRACIÓN 018: Añadir columnas faltantes a raffles
-- ============================================
-- Descripción: Añade columnas necesarias para sistema completo de rifas
-- Fecha: 2025-11-05
-- Requerido por: RaffleService.js, routes/raffles.js
-- Problema: Errores "column does not exist" en pot_fires, cost_per_number, numbers_range
-- ============================================

BEGIN;

-- ============================================
-- AÑADIR COLUMNAS ECONÓMICAS
-- ============================================

-- cost_per_number: Costo base por número en modo fires
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS cost_per_number DECIMAL(10,2) DEFAULT 10;

-- pot_fires y pot_coins: Acumuladores de potes
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS pot_fires DECIMAL(18,2) DEFAULT 0;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS pot_coins DECIMAL(18,2) DEFAULT 0;

-- numbers_range: Rango de números (alias de total_numbers para compatibilidad)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS numbers_range INTEGER DEFAULT 100;

-- Migrar datos existentes de total_numbers a numbers_range
UPDATE raffles 
SET numbers_range = total_numbers 
WHERE numbers_range IS NULL OR numbers_range = 100;

-- ============================================
-- AÑADIR COLUMNAS DE CONFIGURACIÓN
-- ============================================

-- visibility: Visibilidad de la rifa
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public' 
CHECK (visibility IN ('public', 'private', 'friends'));

-- entry_price_fiat: Precio en moneda fiat
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS entry_price_fiat DECIMAL(10,2) DEFAULT 0;

-- is_company_mode: Indica si es rifa empresarial
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS is_company_mode BOOLEAN DEFAULT FALSE;

-- company_cost: Costo de creación para modo empresa
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS company_cost DECIMAL(10,2) DEFAULT 0;

-- close_type: Tipo de cierre (automático o manual)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS close_type VARCHAR(20) DEFAULT 'auto_full'
CHECK (close_type IN ('auto_full', 'manual', 'scheduled'));

-- scheduled_close_at: Fecha programada de cierre
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS scheduled_close_at TIMESTAMP;

-- terms_conditions: Términos y condiciones
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS terms_conditions TEXT;

-- prize_meta: Metadata del premio (JSONB)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS prize_meta JSONB DEFAULT '{}';

-- host_meta: Metadata del host (JSONB)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS host_meta JSONB DEFAULT '{}';

-- ============================================
-- ACTUALIZAR STATUS PARA INCLUIR 'pending' y 'active'
-- ============================================

-- Primero eliminar el constraint existente si existe
DO $$ 
BEGIN
    ALTER TABLE raffles DROP CONSTRAINT IF EXISTS raffles_status_check;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Añadir nuevo constraint con todos los estados
ALTER TABLE raffles 
ADD CONSTRAINT raffles_status_check 
CHECK (status IN ('pending', 'active', 'open', 'in_progress', 'drawing', 'finished', 'cancelled'));

-- Migrar estados antiguos a nuevos
UPDATE raffles SET status = 'pending' WHERE status = 'open';

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_raffles_visibility ON raffles(visibility);
CREATE INDEX IF NOT EXISTS idx_raffles_is_company ON raffles(is_company_mode);
CREATE INDEX IF NOT EXISTS idx_raffles_close_type ON raffles(close_type);
CREATE INDEX IF NOT EXISTS idx_raffles_pot_fires ON raffles(pot_fires DESC) WHERE pot_fires > 0;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN raffles.cost_per_number IS 'Costo base por número en modo fires';
COMMENT ON COLUMN raffles.pot_fires IS 'Acumulador de fuegos en el pote';
COMMENT ON COLUMN raffles.pot_coins IS 'Acumulador de monedas en el pote';
COMMENT ON COLUMN raffles.numbers_range IS 'Rango total de números disponibles';
COMMENT ON COLUMN raffles.visibility IS 'Visibilidad de la rifa: public, private, friends';
COMMENT ON COLUMN raffles.is_company_mode IS 'TRUE si es rifa empresarial (3000🔥)';
COMMENT ON COLUMN raffles.company_cost IS 'Costo pagado por modo empresa';
COMMENT ON COLUMN raffles.close_type IS 'Tipo de cierre: auto_full, manual, scheduled';
COMMENT ON COLUMN raffles.prize_meta IS 'Metadata del premio en formato JSON';
COMMENT ON COLUMN raffles.host_meta IS 'Metadata del host en formato JSON';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raffles' 
    AND column_name IN ('cost_per_number', 'pot_fires', 'pot_coins', 'numbers_range')
  ) THEN
    RAISE NOTICE '✅ Migración 018 completada: columnas añadidas a raffles';
  END IF;
END $$;
