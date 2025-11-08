-- Migración 026: Cleanup de migración 027 fallida (CORREGIDA)
-- Propósito: Eliminar registro de migración 027 que falla por columna inexistente
-- Nota: Versión corregida que usa 'filename' en lugar de 'name'

BEGIN;

-- Eliminar registro de la migración 027 fallida si existe en la tabla migrations
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM migrations 
  WHERE filename = '027_fix_tictactoe_schema.sql';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '✅ Cleanup 026 completado: registro 027 eliminado de tabla migrations';
  ELSE
    RAISE NOTICE '✅ Cleanup 026: no había registro 027 (ya limpio)';
  END IF;
  
  RAISE NOTICE 'Sistema listo para continuar con siguientes migraciones';
END $$;

COMMIT;
