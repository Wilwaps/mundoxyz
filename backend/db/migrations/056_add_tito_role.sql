-- ============================================
-- MIGRACIÓN 056: Agregar rol "tito"
-- ============================================
-- Crea el rol lógico "tito" en la tabla roles si no existe.
-- ============================================

INSERT INTO roles (name, description, permissions)
SELECT 'tito', 'Rol Tito: comisiones especiales por comunidad y actividad propia', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'tito'
);
