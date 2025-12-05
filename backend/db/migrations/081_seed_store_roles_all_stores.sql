-- 081_seed_store_roles_all_stores.sql
-- Crea roles base para todas las tiendas.
-- El rol 'waiter' solo se asigna a tiendas de tipo 'restaurante'.

BEGIN;

-- Aseguramos índice único para (store_id, role_key)
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_store_roles_store_role_key'
  ) THEN
    CREATE UNIQUE INDEX idx_store_roles_store_role_key
      ON store_roles (store_id, role_key);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- OWNER: acceso total a todas las tiendas
INSERT INTO store_roles (
  store_id,
  role_key,
  display_name,
  description,
  permissions,
  is_system,
  created_at,
  updated_at
)
SELECT
  s.id AS store_id,
  'owner' AS role_key,
  'Dueño' AS display_name,
  'Acceso total a la tienda.' AS description,
  '["*"]'::jsonb AS permissions,
  TRUE AS is_system,
  NOW() AS created_at,
  NOW() AS updated_at
FROM stores s
ON CONFLICT (store_id, role_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  permissions  = EXCLUDED.permissions,
  is_system    = EXCLUDED.is_system,
  updated_at   = NOW();

-- ADMIN: gestión avanzada
INSERT INTO store_roles (
  store_id,
  role_key,
  display_name,
  description,
  permissions,
  is_system,
  created_at,
  updated_at
)
SELECT
  s.id AS store_id,
  'admin' AS role_key,
  'Administrador' AS display_name,
  'Gestión avanzada de tienda, staff y reportes.' AS description,
  '[
     "store.roles.manage",
     "store.inventory.manage",
     "store.reports.view",
     "store.messaging.manage",
     "store.cash.view"
   ]'::jsonb AS permissions,
  TRUE AS is_system,
  NOW() AS created_at,
  NOW() AS updated_at
FROM stores s
ON CONFLICT (store_id, role_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  permissions  = EXCLUDED.permissions,
  is_system    = EXCLUDED.is_system,
  updated_at   = NOW();

-- CASHIER: caja / POS
INSERT INTO store_roles (
  store_id,
  role_key,
  display_name,
  description,
  permissions,
  is_system,
  created_at,
  updated_at
)
SELECT
  s.id AS store_id,
  'cashier' AS role_key,
  'Cajero' AS display_name,
  'Puede ver y operar la caja / POS.' AS description,
  '[
     "store.cash.open",
     "store.cash.close",
     "store.cash.view",
     "store.orders.manage"
   ]'::jsonb AS permissions,
  FALSE AS is_system,
  NOW() AS created_at,
  NOW() AS updated_at
FROM stores s
ON CONFLICT (store_id, role_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  permissions  = EXCLUDED.permissions,
  is_system    = EXCLUDED.is_system,
  updated_at   = NOW();

-- KITCHEN: cocina
INSERT INTO store_roles (
  store_id,
  role_key,
  display_name,
  description,
  permissions,
  is_system,
  created_at,
  updated_at
)
SELECT
  s.id AS store_id,
  'kitchen' AS role_key,
  'Cocina' AS display_name,
  'Puede ver y actualizar el estado de los pedidos.' AS description,
  '[
     "store.orders.view",
     "store.orders.update_status"
   ]'::jsonb AS permissions,
  FALSE AS is_system,
  NOW() AS created_at,
  NOW() AS updated_at
FROM stores s
ON CONFLICT (store_id, role_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  permissions  = EXCLUDED.permissions,
  is_system    = EXCLUDED.is_system,
  updated_at   = NOW();

-- WAITER: solo para tiendas tipo restaurante
INSERT INTO store_roles (
  store_id,
  role_key,
  display_name,
  description,
  permissions,
  is_system,
  created_at,
  updated_at
)
SELECT
  s.id AS store_id,
  'waiter' AS role_key,
  'Mesonero' AS display_name,
  'Puede gestionar pedidos de mesas / POS (modo restaurante).' AS description,
  '[
     "store.orders.manage",
     "store.tables.manage"
   ]'::jsonb AS permissions,
  FALSE AS is_system,
  NOW() AS created_at,
  NOW() AS updated_at
FROM stores s
WHERE s.store_type = 'restaurante'
ON CONFLICT (store_id, role_key) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  permissions  = EXCLUDED.permissions,
  is_system    = EXCLUDED.is_system,
  updated_at   = NOW();

COMMIT;