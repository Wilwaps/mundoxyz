-- ============================================
-- MIGRACIÓN: Fix marked_numbers tipo JSONB
-- Versión: 007
-- Fecha: 31 Octubre 2025
-- NOTA: Esta migración es para el sistema VIEJO de Bingo
--       que fue reemplazado por Bingo V2 en la migración 008.
--       Se convierte en NO-OP si las tablas no existen.
-- ============================================

-- Verificar y convertir marked_numbers a JSONB si es necesario
DO $$
BEGIN
  -- Verificar si existe la tabla del sistema viejo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'bingo_cards'
  ) THEN
    RAISE NOTICE '⚠️  Migración 007 SKIP: tabla bingo_cards no existe (sistema Bingo V2 activo)';
    RETURN;
  END IF;

  RAISE NOTICE '🔧 Ejecutando migración 007 en sistema Bingo viejo...';

  -- Solo convertir si no es jsonb
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'bingo_cards' 
    AND column_name = 'marked_numbers' 
    AND data_type != 'jsonb'
  ) THEN
    RAISE NOTICE 'Convirtiendo marked_numbers de % a JSONB', 
      (SELECT data_type FROM information_schema.columns 
       WHERE table_name = 'bingo_cards' AND column_name = 'marked_numbers');
    
    -- Crear columna temporal
    ALTER TABLE bingo_cards ADD COLUMN marked_numbers_temp JSONB;
    
    -- Migrar datos parseando el JSON string
    UPDATE bingo_cards 
    SET marked_numbers_temp = 
      CASE 
        WHEN marked_numbers IS NULL THEN '[]'::jsonb
        WHEN marked_numbers = '' THEN '[]'::jsonb
        WHEN marked_numbers = 'null' THEN '[]'::jsonb
        ELSE 
          -- Intentar parsear como JSON
          CASE 
            WHEN marked_numbers::text ~ '^\[.*\]$' THEN marked_numbers::jsonb
            WHEN marked_numbers::text ~ '^\{.*\}$' THEN marked_numbers::jsonb
            ELSE '[]'::jsonb
          END
      END;
    
    -- Eliminar columna vieja
    ALTER TABLE bingo_cards DROP COLUMN marked_numbers;
    
    -- Renombrar columna nueva
    ALTER TABLE bingo_cards RENAME COLUMN marked_numbers_temp TO marked_numbers;
    
    -- Agregar default
    ALTER TABLE bingo_cards ALTER COLUMN marked_numbers SET DEFAULT '[]'::jsonb;
    
    -- Agregar NOT NULL constraint
    ALTER TABLE bingo_cards ALTER COLUMN marked_numbers SET NOT NULL;
    
    RAISE NOTICE 'marked_numbers convertido a JSONB exitosamente';
  ELSE
    RAISE NOTICE 'marked_numbers ya es JSONB, no se requiere conversión';
  END IF;

  -- Índice GIN para mejorar performance en búsquedas JSON
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bingo_cards_marked_numbers 
    ON bingo_cards USING gin(marked_numbers)';

  -- Índice para búsquedas por room_id y owner_id
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bingo_cards_room_owner
    ON bingo_cards(room_id, owner_id)';

  RAISE NOTICE '✅ Migración 007 ejecutada en sistema Bingo viejo';

END $$;

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ marked_numbers convertido de text/varchar a JSONB
-- ✅ Índice GIN para búsquedas eficientes
-- ✅ Valores NULL/corruptos limpiados
-- ✅ Default '[]'::jsonb establecido
-- ✅ Constraint NOT NULL agregado
