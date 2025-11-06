/**
 * Migración 035: Agregar método de pago "Fuego" a rifas modo premio
 * 
 * OBJETIVO:
 * Permitir que rifas en modo "prize" acepten pagos en fuegos además de
 * efectivo y pago móvil/banco. Los fuegos se transfieren directamente
 * al anfitrión tras aprobación manual.
 * 
 * CAMBIOS:
 * - allow_fire_payments: flag para habilitar pago en fuegos
 * - raffle_requests.payment_method: registrar método elegido por comprador
 * - raffle_requests.fire_amount: cantidad de fuegos (si aplica)
 * 
 * FECHA: 2025-11-06
 */

-- 1. Agregar columna para habilitar pago en fuegos
ALTER TABLE raffles 
  ADD COLUMN IF NOT EXISTS allow_fire_payments BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN raffles.allow_fire_payments IS 
  'Habilita pago con fuegos en rifas premio (migración 035). Los fuegos se transfieren al host tras aprobación.';

-- 2. Agregar columna para registrar método de pago elegido
ALTER TABLE raffle_requests
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);

COMMENT ON COLUMN raffle_requests.payment_method IS 
  'Método de pago elegido: cash, bank, fire (migración 035)';

-- 3. Agregar columna para cantidad de fuegos (cuando payment_method = fire)
ALTER TABLE raffle_requests
  ADD COLUMN IF NOT EXISTS fire_amount DECIMAL(18,2) DEFAULT 0;

COMMENT ON COLUMN raffle_requests.fire_amount IS 
  'Cantidad de fuegos a transferir si payment_method = fire (migración 035)';

-- 4. Crear índice para búsquedas por método de pago
CREATE INDEX IF NOT EXISTS idx_raffle_requests_payment_method 
  ON raffle_requests(payment_method);

-- Log de migración completada
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 035 completada: método de pago fuego habilitado';
END $$;
