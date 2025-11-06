-- ============================================
-- MIGRACIÓN 034: Agregar columnas de pago a raffles
-- ============================================
-- Descripción: Sistema de pagos externos para rifas Premio y Empresa
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ
-- Relacionado: Feature rifas Premio/Empresa con pagos externos
-- ============================================

BEGIN;

-- ============================================
-- NUEVAS COLUMNAS: Datos de pago del anfitrión
-- ============================================

-- Costo de la rifa en moneda fiat
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_cost_amount DECIMAL(10,2);

-- Moneda del costo (USD, VES, etc.)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_cost_currency VARCHAR(10) DEFAULT 'USD';

-- Método de pago: cash (efectivo) o bank (pago móvil)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) 
  CHECK (payment_method IN ('cash', 'bank'));

-- Código del banco (solo si payment_method = 'bank')
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_bank_code VARCHAR(10);

-- Número de teléfono del anfitrión (para pago móvil)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(20);

-- Cédula/ID del anfitrión (para pago móvil)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_id_number VARCHAR(30);

-- Instrucciones/comentarios adicionales (máx 300 caracteres)
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- ============================================
-- CONSTRAINTS: Validaciones de integridad
-- ============================================

-- Validar longitud de instrucciones
ALTER TABLE raffles ADD CONSTRAINT payment_instructions_length 
  CHECK (payment_instructions IS NULL OR LENGTH(payment_instructions) <= 300);

-- Validar datos completos según método de pago
ALTER TABLE raffles ADD CONSTRAINT payment_data_complete 
  CHECK (
    payment_method IS NULL OR
    (payment_method = 'cash' AND payment_cost_amount IS NOT NULL) OR
    (payment_method = 'bank' AND 
     payment_cost_amount IS NOT NULL AND 
     payment_bank_code IS NOT NULL AND 
     payment_phone IS NOT NULL AND 
     payment_id_number IS NOT NULL)
  );

-- ============================================
-- ÍNDICES: Optimización de consultas
-- ============================================

CREATE INDEX IF NOT EXISTS idx_raffles_payment_method 
  ON raffles(payment_method) 
  WHERE payment_method IS NOT NULL;

-- ============================================
-- COMENTARIOS: Documentación de columnas
-- ============================================

COMMENT ON COLUMN raffles.payment_cost_amount IS 'Costo en moneda fiat para rifas Premio/Empresa';
COMMENT ON COLUMN raffles.payment_cost_currency IS 'Moneda del costo: USD, VES, etc.';
COMMENT ON COLUMN raffles.payment_method IS 'Método de pago: cash (efectivo) o bank (pago móvil/banco)';
COMMENT ON COLUMN raffles.payment_bank_code IS 'Código del banco venezolano (ej: 0102, 0134)';
COMMENT ON COLUMN raffles.payment_phone IS 'Número de teléfono del anfitrión para pago móvil';
COMMENT ON COLUMN raffles.payment_id_number IS 'Cédula/ID del anfitrión para pago móvil';
COMMENT ON COLUMN raffles.payment_instructions IS 'Instrucciones/comentarios adicionales (máx 300 caracteres)';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  v_columns_count INTEGER;
BEGIN
  -- Contar columnas nuevas
  SELECT COUNT(*) INTO v_columns_count
  FROM information_schema.columns
  WHERE table_name = 'raffles' 
    AND column_name IN (
      'payment_cost_amount',
      'payment_cost_currency',
      'payment_method',
      'payment_bank_code',
      'payment_phone',
      'payment_id_number',
      'payment_instructions'
    );
  
  IF v_columns_count = 7 THEN
    RAISE NOTICE '✅ Migración 034 completada: Sistema de pagos habilitado';
    RAISE NOTICE '   📋 Columnas agregadas:';
    RAISE NOTICE '      - payment_cost_amount (costo)';
    RAISE NOTICE '      - payment_cost_currency (moneda)';
    RAISE NOTICE '      - payment_method (cash/bank)';
    RAISE NOTICE '      - payment_bank_code (código banco)';
    RAISE NOTICE '      - payment_phone (teléfono)';
    RAISE NOTICE '      - payment_id_number (cédula)';
    RAISE NOTICE '      - payment_instructions (instrucciones)';
  ELSE
    RAISE WARNING '⚠️ Migración 034: Solo % de 7 columnas agregadas', v_columns_count;
  END IF;
END $$;
