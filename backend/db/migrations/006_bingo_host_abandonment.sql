-- ============================================
-- MIGRACIÓN: Sistema de Abandono de Host en Bingo
-- Versión: 006
-- Fecha: 30 Octubre 2025
-- NOTA: Esta migración es para el sistema VIEJO de Bingo
--       que fue reemplazado por Bingo V2 en la migración 008.
--       Se convierte en NO-OP si las tablas no existen.
-- ============================================

-- Verificar si existe la tabla del sistema viejo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bingo_rooms'
  ) THEN
    RAISE NOTICE '⚠️  Migración 006 SKIP: tabla bingo_rooms no existe (sistema Bingo V2 activo)';
    RETURN;
  END IF;

  -- Solo ejecutar si existe la tabla del sistema viejo
  RAISE NOTICE '🔧 Ejecutando migración 006 en sistema Bingo viejo...';

  -- Agregar campos para manejo de abandono del host
  EXECUTE 'ALTER TABLE bingo_rooms
    ADD COLUMN IF NOT EXISTS host_abandoned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS substitute_host_id UUID,
    ADD COLUMN IF NOT EXISTS host_last_activity TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS abandonment_detected_at TIMESTAMP';

  -- Índices para consultas de salas abandonadas
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bingo_rooms_host_abandoned 
    ON bingo_rooms(host_abandoned) WHERE host_abandoned = TRUE';

  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bingo_rooms_host_activity 
    ON bingo_rooms(host_last_activity) WHERE status = ''playing''';

  RAISE NOTICE '✅ Migración 006 ejecutada en sistema Bingo viejo';
  
END $$;

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ Agregados campos: host_abandoned, substitute_host_id, host_last_activity
-- ✅ Trigger automático para actualizar host_last_activity
-- ✅ Tabla de notificaciones de abandono
-- ✅ Vista de monitoreo de salas en riesgo
-- ✅ Índices para optimizar consultas
-- ✅ Auditoría extendida para cambios de host
