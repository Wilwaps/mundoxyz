-- ============================================
-- MIGRACIÓN 002: Sistema de Roles
-- ============================================
-- Descripción: Crea las tablas roles y user_roles
-- Fecha: 2025-11-04
-- ============================================

BEGIN;

-- ============================================
-- TABLA: roles
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

COMMENT ON TABLE roles IS 'Roles del sistema (user, admin, tote)';

-- ============================================
-- TABLA: user_roles
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

COMMENT ON TABLE user_roles IS 'Asignación de roles a usuarios';

-- ============================================
-- DATOS INICIALES: Roles por defecto
-- ============================================

-- Insertar roles básicos
INSERT INTO roles (name, description, permissions) VALUES
  ('user', 'Usuario regular del sistema', '{"basic_access": true}'::jsonb),
  ('admin', 'Administrador con permisos elevados', '{"basic_access": true, "admin_panel": true, "manage_users": true, "manage_games": true}'::jsonb),
  ('tote', 'Super administrador (Tote)', '{"basic_access": true, "admin_panel": true, "manage_users": true, "manage_games": true, "manage_economy": true, "full_access": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ASIGNAR ROL TOTE AUTOMÁTICAMENTE
-- ============================================

-- Si existe el usuario Tote (tg_id = 1417856820), asignarle rol tote
DO $$
DECLARE
  tote_user_id UUID;
  tote_role_id INTEGER;
  user_role_id INTEGER;
BEGIN
  -- Buscar usuario Tote por telegram ID
  SELECT id INTO tote_user_id
  FROM users
  WHERE tg_id = 1417856820
  LIMIT 1;

  -- Si existe, asignar roles
  IF tote_user_id IS NOT NULL THEN
    -- Obtener IDs de roles
    SELECT id INTO tote_role_id FROM roles WHERE name = 'tote';
    SELECT id INTO user_role_id FROM roles WHERE name = 'user';

    -- Asignar rol user si no lo tiene
    IF user_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
      VALUES (tote_user_id, user_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;

    -- Asignar rol tote
    IF tote_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
      VALUES (tote_user_id, tote_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;

      RAISE NOTICE 'Rol tote asignado al usuario con Telegram ID 1417856820';
    END IF;
  ELSE
    RAISE NOTICE 'Usuario Tote (1417856820) no encontrado. Se asignará automáticamente en primer login.';
  END IF;
END $$;

-- ============================================
-- ACTUALIZAR COLUMNA roles EN users
-- ============================================

-- Sincronizar columna roles[] con user_roles
UPDATE users u
SET roles = ARRAY(
  SELECT r.name
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = u.id
)
WHERE EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = u.id
);

-- Asegurar que todos los usuarios tengan al menos 'user'
UPDATE users
SET roles = ARRAY['user']
WHERE roles IS NULL OR roles = '{}' OR array_length(roles, 1) IS NULL;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================

DO $$
DECLARE
  roles_count INTEGER;
  user_roles_count INTEGER;
  tote_has_role BOOLEAN;
BEGIN
  -- Contar roles
  SELECT COUNT(*) INTO roles_count FROM roles;
  SELECT COUNT(*) INTO user_roles_count FROM user_roles;
  
  -- Verificar si Tote tiene su rol
  SELECT EXISTS(
    SELECT 1 
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.tg_id = 1417856820
    AND r.name = 'tote'
  ) INTO tote_has_role;

  RAISE NOTICE '✅ Migración 002 completada';
  RAISE NOTICE '📊 Roles creados: %', roles_count;
  RAISE NOTICE '📊 Asignaciones: %', user_roles_count;
  
  IF tote_has_role THEN
    RAISE NOTICE '✅ Rol tote asignado correctamente';
  ELSE
    RAISE NOTICE '⚠️  Rol tote se asignará en primer login';
  END IF;
END $$;
