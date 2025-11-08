-- Migración 026: Cleanup de migración 027 fallida
-- Propósito: Eliminar registro de migración 027 que falla por columna inexistente
-- Esta migración se ejecuta ANTES de la 037 para permitir que el deploy continúe

BEGIN;

-- Eliminar registro de la migración 027 fallida si existe
DELETE FROM migrations 
WHERE name = '027_fix_tictactoe_schema.sql';

-- Log para verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup completado: registro de 027 eliminado de tabla migrations';
  RAISE NOTICE 'La migración 037 podrá ejecutarse en el próximo ciclo';
END $$;

COMMIT;
