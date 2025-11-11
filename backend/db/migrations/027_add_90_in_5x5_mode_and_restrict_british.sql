-- Migración 027: Agregar modo 90-in-5x5 y restringir modo británico a fullcard
-- Fecha: 2025-11-10
-- Descripción: 
--   1. Agregar '90-in-5x5' como modo válido en bingo_v2_rooms
--   2. Modo '90' (británico 9x3) solo permite pattern_type='fullcard'

BEGIN;

-- 1. Eliminar constraint actual de mode
ALTER TABLE bingo_v2_rooms
  DROP CONSTRAINT IF EXISTS bingo_v2_rooms_mode_check;

-- 2. Agregar nuevo constraint con '90-in-5x5' incluido
ALTER TABLE bingo_v2_rooms
  ADD CONSTRAINT bingo_v2_rooms_mode_check 
  CHECK (mode IN ('75', '90', '90-in-5x5'));

-- 3. PRIMERO: Actualizar salas existentes con modo '90' para asegurar patrón fullcard
--    Esto DEBE hacerse ANTES de agregar el constraint
UPDATE bingo_v2_rooms
  SET pattern_type = 'fullcard'
  WHERE mode = '90' AND pattern_type != 'fullcard';

-- 4. LUEGO: Agregar constraint para modo británico (ahora no hay filas que lo violen)
ALTER TABLE bingo_v2_rooms
  ADD CONSTRAINT bingo_v2_rooms_british_fullcard_check
  CHECK (
    (mode != '90') OR 
    (mode = '90' AND pattern_type = 'fullcard')
  );

COMMIT;

-- Verificar los constraints
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 027 completed successfully';
  RAISE NOTICE '   - Mode constraint: 75, 90, 90-in-5x5';
  RAISE NOTICE '   - British mode (90): only fullcard pattern';
END $$;
