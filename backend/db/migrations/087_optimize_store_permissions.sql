-- 087_optimize_store_permissions.sql
-- Optimizar consultas de permisos de tienda para dashboard y POS

BEGIN;

-- 1) store_staff: búsquedas por user_id y store_id (usadas en helpers/storePermissions.js)
CREATE INDEX IF NOT EXISTS idx_store_staff_user
  ON store_staff(user_id);

CREATE INDEX IF NOT EXISTS idx_store_staff_store
  ON store_staff(store_id);

-- 2) stores: búsquedas por owner_id (usadas en permisos)
CREATE INDEX IF NOT EXISTS idx_stores_owner
  ON stores(owner_id);

-- 3) store_roles: búsquedas rápidas por store_id
CREATE INDEX IF NOT EXISTS idx_store_roles_store
  ON store_roles(store_id);

COMMIT;
