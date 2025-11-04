-- ============================================
-- MIGRACIÓN 016: Welcome Events Timing
-- ============================================
-- Descripción: Añade columnas de temporización a welcome_events
-- Fecha: 2025-11-04
-- Requerido por: routes/admin.js (activate/deactivate), routes/welcome.js (status)
-- ============================================

BEGIN;

-- ============================================
-- AÑADIR COLUMNAS DE TIMING
-- ============================================

-- Añadir columnas si no existen
ALTER TABLE welcome_events 
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Actualizar columna updated_at para trigger
ALTER TABLE welcome_events 
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Índices para performance en consultas de eventos activos
CREATE INDEX IF NOT EXISTS idx_welcome_events_starts_at ON welcome_events(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welcome_events_ends_at ON welcome_events(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_welcome_events_active_timing ON welcome_events(is_active, starts_at, ends_at) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_welcome_events_priority ON welcome_events(priority DESC, created_at DESC);

-- Comentarios
COMMENT ON COLUMN welcome_events.starts_at IS 'Fecha/hora de inicio del evento (NULL = inmediato)';
COMMENT ON COLUMN welcome_events.ends_at IS 'Fecha/hora de fin del evento (calculado desde duration_hours)';
COMMENT ON COLUMN welcome_events.duration_hours IS 'Duración del evento en horas (NULL = sin límite)';
COMMENT ON COLUMN welcome_events.priority IS 'Prioridad del evento (mayor = más prioritario)';

-- ============================================
-- ACTUALIZAR EVENTOS EXISTENTES
-- ============================================

-- Si hay eventos activos sin starts_at, establecer NOW()
UPDATE welcome_events 
SET starts_at = NOW()
WHERE is_active = true 
  AND starts_at IS NULL;

-- Calcular ends_at para eventos con duration_hours pero sin ends_at
UPDATE welcome_events
SET ends_at = COALESCE(starts_at, created_at) + (duration_hours || ' hours')::interval
WHERE duration_hours IS NOT NULL
  AND ends_at IS NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
DO $$
DECLARE
  col_count INTEGER;
  active_events INTEGER;
BEGIN
  -- Verificar columnas creadas
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'welcome_events' 
    AND column_name IN ('starts_at', 'ends_at', 'duration_hours', 'priority');
  
  -- Contar eventos activos
  SELECT COUNT(*) INTO active_events
  FROM welcome_events
  WHERE is_active = true;
  
  IF col_count = 4 THEN
    RAISE NOTICE '✅ Migración 016 completada: welcome_events timing añadido';
    RAISE NOTICE '📊 Columnas timing creadas: 4/4';
    RAISE NOTICE '📊 Eventos activos: %', active_events;
  ELSE
    RAISE WARNING '⚠️  Solo % de 4 columnas fueron creadas', col_count;
  END IF;
END $$;
