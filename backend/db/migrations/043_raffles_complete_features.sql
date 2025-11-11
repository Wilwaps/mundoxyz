/**
 * Migration 043: Funcionalidades completas de rifas
 * 
 * Agrega:
 * - Toggle pago con fuegos en modo Premio
 * - Imágenes de premios en base64
 * - Logos de empresa en base64
 * - Datos de solicitudes de pago
 */

BEGIN;

-- ============================================
-- 1. TOGGLE PAGO CON FUEGOS (MODO PREMIO)
-- ============================================

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS allow_fires_payment BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN raffles.allow_fires_payment IS 
  'Si TRUE, permite pago con fuegos en modo PRIZE (automático sin aprobación)';

-- ============================================
-- 2. IMÁGENES EN BASE64
-- ============================================

-- Columna para imagen de premio (base64)
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS prize_image_base64 TEXT;

COMMENT ON COLUMN raffles.prize_image_base64 IS 
  'Imagen del premio codificada en base64 (formato: data:image/png;base64,...)';

-- ============================================
-- 3. TABLA PARA LOGOS DE EMPRESA
-- ============================================

-- Actualizar tabla raffle_companies para incluir logo en base64
ALTER TABLE raffle_companies
ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

COMMENT ON COLUMN raffle_companies.logo_base64 IS 
  'Logo de la empresa codificado en base64 (formato: data:image/png;base64,...)';

-- ============================================
-- 4. MEJORAR TABLA RAFFLE_REQUESTS
-- ============================================

-- Asegurar que raffle_requests tenga todas las columnas necesarias
ALTER TABLE raffle_requests
ADD COLUMN IF NOT EXISTS payment_proof_base64 TEXT;

COMMENT ON COLUMN raffle_requests.payment_proof_base64 IS 
  'Comprobante de pago codificado en base64';

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_raffles_allow_fires_payment 
  ON raffles(allow_fires_payment) 
  WHERE allow_fires_payment = TRUE;

CREATE INDEX IF NOT EXISTS idx_raffle_requests_status 
  ON raffle_requests(status, raffle_id);

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
DECLARE
  v_columns_count INTEGER;
BEGIN
  -- Contar columnas nuevas en raffles
  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns
  WHERE table_name = 'raffles' 
    AND column_name IN ('allow_fires_payment', 'prize_image_base64');
  
  IF v_columns_count = 2 THEN
    RAISE NOTICE '✅ Migración 043 completada: Nuevas columnas en raffles agregadas';
  ELSE
    RAISE WARNING '⚠️ Migración 043: Solo % de 2 columnas agregadas en raffles', v_columns_count;
  END IF;
  
  -- Verificar raffle_companies
  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns
  WHERE table_name = 'raffle_companies' 
    AND column_name = 'logo_base64';
  
  IF v_columns_count = 1 THEN
    RAISE NOTICE '✅ Columna logo_base64 agregada a raffle_companies';
  END IF;
END $$;

COMMIT;
