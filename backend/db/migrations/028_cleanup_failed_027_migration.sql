-- Migración 028: Cleanup de migraciones TicTacToe fallidas
-- Propósito: Eliminar registros de migraciones 026/027 que fallan
-- Esta migración se ejecuta y permite que la 037 funcione correctamente

BEGIN;

-- Eliminar TODOS los registros problemáticos de migraciones TicTacToe
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM migrations 
  WHERE filename IN (
    '026_cleanup_failed_tictactoe_migration.sql',
    '027_fix_tictactoe_schema.sql'
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '✅ Cleanup 028 completado: % registros eliminados de tabla migrations', deleted_count;
  RAISE NOTICE 'Sistema listo para ejecutar migración 037 (fix board TicTacToe)';
END $$;

COMMIT;
