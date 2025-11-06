-- ============================================
-- MIGRACIÓN 033: Crear tabla raffle_requests
-- ============================================
-- Descripción: Solicitudes de aprobación para compra de números en rifas premio
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ
-- Relacionado: Fix creación rifas premio - tabla faltante
-- ============================================

BEGIN;

-- ============================================
-- EXTENSIÓN UUID
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: raffle_requests
-- ============================================
CREATE TABLE IF NOT EXISTS raffle_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL DEFAULT 'approval' CHECK (request_type IN ('approval', 'refund', 'cancel')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  request_data JSONB DEFAULT '{}',
  buyer_profile JSONB DEFAULT '{}',
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  message TEXT,
  history JSONB DEFAULT '[]',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_raffle_requests_raffle ON raffle_requests(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_user ON raffle_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_status ON raffle_requests(status);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_type ON raffle_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_raffle_requests_reviewed_by ON raffle_requests(reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffle_requests_created ON raffle_requests(created_at);

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_raffle_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_raffle_requests_updated_at') THEN
    CREATE TRIGGER update_raffle_requests_updated_at 
    BEFORE UPDATE ON raffle_requests
    FOR EACH ROW 
    EXECUTE FUNCTION update_raffle_requests_updated_at();
  END IF;
END$$;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE raffle_requests IS 'Solicitudes de aprobación para rifas premio (modo pago)';
COMMENT ON COLUMN raffle_requests.id IS 'ID único UUID de la solicitud';
COMMENT ON COLUMN raffle_requests.raffle_id IS 'ID de la rifa';
COMMENT ON COLUMN raffle_requests.user_id IS 'Usuario que solicita';
COMMENT ON COLUMN raffle_requests.request_type IS 'Tipos: approval (compra), refund (reembolso), cancel (cancelación)';
COMMENT ON COLUMN raffle_requests.status IS 'Estados: pending, approved, rejected, cancelled';
COMMENT ON COLUMN raffle_requests.request_data IS 'Datos de la solicitud (número, costo, etc)';
COMMENT ON COLUMN raffle_requests.buyer_profile IS 'Perfil del comprador (nombre, email, teléfono, etc)';
COMMENT ON COLUMN raffle_requests.payment_method IS 'Método de pago usado';
COMMENT ON COLUMN raffle_requests.payment_reference IS 'Referencia del pago';
COMMENT ON COLUMN raffle_requests.message IS 'Mensaje del comprador al host';
COMMENT ON COLUMN raffle_requests.history IS 'Historial de cambios en formato JSON array';
COMMENT ON COLUMN raffle_requests.reviewed_by IS 'Host que revisó la solicitud';
COMMENT ON COLUMN raffle_requests.reviewed_at IS 'Fecha de revisión';
COMMENT ON COLUMN raffle_requests.admin_notes IS 'Notas del admin/host';
COMMENT ON COLUMN raffle_requests.created_at IS 'Fecha de creación';
COMMENT ON COLUMN raffle_requests.updated_at IS 'Última actualización';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'raffle_requests'
  ) THEN
    RAISE NOTICE '✅ Migración 033 completada: tabla raffle_requests creada';
    RAISE NOTICE '   📋 Solicitudes de aprobación para rifas premio habilitadas';
  END IF;
END $$;
