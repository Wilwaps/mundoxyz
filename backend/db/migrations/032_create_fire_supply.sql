-- ============================================
-- MIGRACIÓN 032: Crear tabla fire_supply
-- ============================================
-- Descripción: Control de suministro total de fuegos (tabla singleton)
-- Fecha: 2025-11-05
-- Autor: Sistema MundoXYZ
-- Relacionado: Fix aprobación fuegos - tabla faltante
-- ============================================

BEGIN;

-- ============================================
-- TABLA: fire_supply (Singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS fire_supply (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_max DECIMAL(20, 2) NOT NULL DEFAULT 1000000000,
  total_emitted DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_burned DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_circulating DECIMAL(20, 2) NOT NULL DEFAULT 0,
  total_reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================
-- ÍNDICE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fire_supply_updated ON fire_supply(updated_at);

-- ============================================
-- INSERTAR REGISTRO INICIAL
-- ============================================
INSERT INTO fire_supply (id, total_max, total_emitted, total_burned, total_circulating, total_reserved)
VALUES (1, 1000000000, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_fire_supply_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fire_supply_updated_at') THEN
    CREATE TRIGGER update_fire_supply_updated_at 
    BEFORE UPDATE ON fire_supply
    FOR EACH ROW 
    EXECUTE FUNCTION update_fire_supply_updated_at();
  END IF;
END$$;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE fire_supply IS 'Control de suministro total de fuegos (tabla singleton - solo 1 fila)';
COMMENT ON COLUMN fire_supply.id IS 'ID siempre 1 (singleton pattern)';
COMMENT ON COLUMN fire_supply.total_max IS 'Máximo suministro de fuegos: 1,000,000,000';
COMMENT ON COLUMN fire_supply.total_emitted IS 'Total emitido acumulado';
COMMENT ON COLUMN fire_supply.total_burned IS 'Total quemado acumulado (deflación)';
COMMENT ON COLUMN fire_supply.total_circulating IS 'En circulación actual (emitted - burned)';
COMMENT ON COLUMN fire_supply.total_reserved IS 'Reservado para eventos/premios';
COMMENT ON COLUMN fire_supply.updated_at IS 'Última actualización del supply';

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'fire_supply'
  ) THEN
    RAISE NOTICE '✅ Migración 032 completada: tabla fire_supply creada';
    
    -- Mostrar estado actual
    DECLARE
      v_supply RECORD;
    BEGIN
      SELECT * INTO v_supply FROM fire_supply WHERE id = 1;
      RAISE NOTICE '   📊 Supply inicial:';
      RAISE NOTICE '      - Max: % fuegos', v_supply.total_max;
      RAISE NOTICE '      - Emitido: % fuegos', v_supply.total_emitted;
      RAISE NOTICE '      - Disponible: % fuegos', (v_supply.total_max - v_supply.total_emitted);
    END;
  END IF;
END $$;
