-- Script para actualizar constraint de mode en tabla raffles
-- Solo permite 'fires' y 'prize'

-- 1. Eliminar el constraint anterior
ALTER TABLE raffles DROP CONSTRAINT IF EXISTS raffles_mode_check;

-- 2. Crear nuevo constraint con solo fires y prize
ALTER TABLE raffles ADD CONSTRAINT raffles_mode_check 
  CHECK (mode IN ('fires', 'prize'));

-- 3. Verificar constraint aplicado
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'raffles_mode_check';
