-- Migración 026: Crear tabla fire_requests
-- Sistema de solicitudes de fuegos desde usuarios hacia administradores

BEGIN;

-- Crear tabla fire_requests
CREATE TABLE IF NOT EXISTS fire_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reference VARCHAR(255),
  proof_url TEXT,
  notes TEXT,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_fire_requests_user ON fire_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_fire_requests_status ON fire_requests(status);
CREATE INDEX IF NOT EXISTS idx_fire_requests_created ON fire_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_fire_requests_reviewer ON fire_requests(reviewer_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_fire_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fire_requests_updated_at') THEN
    CREATE TRIGGER update_fire_requests_updated_at 
    BEFORE UPDATE ON fire_requests
    FOR EACH ROW 
    EXECUTE FUNCTION update_fire_requests_updated_at();
  END IF;
END$$;

-- Comentarios para documentación
COMMENT ON TABLE fire_requests IS 'Solicitudes de fuegos de usuarios hacia administradores';
COMMENT ON COLUMN fire_requests.status IS 'Estados: pending, approved, rejected, cancelled';
COMMENT ON COLUMN fire_requests.reference IS 'Referencia bancaria o comprobante de pago';
COMMENT ON COLUMN fire_requests.proof_url IS 'URL del comprobante de pago subido';

COMMIT;
