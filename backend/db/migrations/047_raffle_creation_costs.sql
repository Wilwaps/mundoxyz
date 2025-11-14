-- 047_raffle_creation_costs.sql
-- Crear tabla para configuraciones globales de rifas (costos de creación)

BEGIN;

CREATE TABLE IF NOT EXISTS raffle_settings (
  id SERIAL PRIMARY KEY,
  prize_mode_cost_fires DECIMAL(10,2) NOT NULL DEFAULT 500 CHECK (prize_mode_cost_fires >= 0),
  company_mode_cost_fires DECIMAL(10,2) NOT NULL DEFAULT 500 CHECK (company_mode_cost_fires >= 0),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar fila por defecto solo si la tabla está vacía
INSERT INTO raffle_settings (prize_mode_cost_fires, company_mode_cost_fires)
SELECT 500, 500
WHERE NOT EXISTS (SELECT 1 FROM raffle_settings);

COMMIT;
