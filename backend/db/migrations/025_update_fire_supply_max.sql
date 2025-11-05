-- Actualizar max supply de fuegos a 1,000,000,000
BEGIN;

-- Alinear default del campo total_max si la tabla ya existe
ALTER TABLE IF EXISTS fire_supply
  ALTER COLUMN total_max SET DEFAULT 1000000000;

-- Actualizar registro existente
UPDATE fire_supply
SET total_max = 1000000000
WHERE id = 1;

COMMIT;
