-- Migración 028: Cleanup de migración 027 fallida
-- Propósito: Eliminar registro de migración 027 que falla por columna inexistente
-- Esta migración se ejecuta y permite que la 037 funcione correctamente

BEGIN;

-- Eliminar registro de la migración 027 fallida si existe en la tabla migrations
DELETE FROM migrations 
WHERE name = '027_fix_tictactoe_schema.sql';

-- Log para verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup 028 completado: registro de migración 027 eliminado';
  RAISE NOTICE 'Sistema listo para ejecutar migración 037 (fix board TicTacToe)';
END $$;

COMMIT;
