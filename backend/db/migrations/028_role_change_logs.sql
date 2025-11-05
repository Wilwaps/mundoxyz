-- Migración 028: Tabla de auditoría para cambios de roles
-- Registra todos los cambios de roles realizados por usuarios tote

BEGIN;

-- Crear tabla de auditoría de cambios de roles
CREATE TABLE IF NOT EXISTS role_change_logs (
  id SERIAL PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('add', 'remove')),
  role_name VARCHAR(50) NOT NULL,
  previous_roles JSONB DEFAULT '[]',
  new_roles JSONB DEFAULT '[]',
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_role_change_logs_target_user ON role_change_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_changed_by ON role_change_logs(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_created_at ON role_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_action ON role_change_logs(action);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_role_name ON role_change_logs(role_name);

-- Comentarios para documentación
COMMENT ON TABLE role_change_logs IS 'Auditoría de cambios de roles realizados por usuarios tote';
COMMENT ON COLUMN role_change_logs.target_user_id IS 'Usuario al que se le modificaron los roles';
COMMENT ON COLUMN role_change_logs.changed_by_user_id IS 'Usuario tote que realizó el cambio';
COMMENT ON COLUMN role_change_logs.action IS 'Acción realizada: add (agregar) o remove (remover)';
COMMENT ON COLUMN role_change_logs.role_name IS 'Nombre del rol que se agregó o removió';
COMMENT ON COLUMN role_change_logs.previous_roles IS 'Roles que tenía el usuario antes del cambio';
COMMENT ON COLUMN role_change_logs.new_roles IS 'Roles que tiene el usuario después del cambio';

COMMIT;
