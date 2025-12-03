-- 083_optimize_raffles_and_store_queries.sql
-- Índices de rendimiento para rifas y tienda (stores/products)

BEGIN;

-- 1) Rifas: búsquedas por host + visibility + created_at
CREATE INDEX IF NOT EXISTS idx_raffles_host_visibility_created
  ON raffles(host_id, visibility, created_at DESC);

-- 2) Números de rifa: agregados por raffle_id y estado
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle_id_state
  ON raffle_numbers(raffle_id, state);

-- 3) Productos de tienda: filtros por store_id + flags y orden por nombre
CREATE INDEX IF NOT EXISTS idx_products_store_active_menu_name
  ON products(store_id, is_active, is_menu_item, name);

COMMIT;
