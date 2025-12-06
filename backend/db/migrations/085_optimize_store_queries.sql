-- 085_optimize_store_queries.sql
-- Optimización de consultas de tienda para reducir lentitud en dashboard/POS

BEGIN;

-- 1) Productos por tienda: filtros combinados usados por POS y dashboard
CREATE INDEX IF NOT EXISTS idx_products_store_active_menu_name
  ON products(store_id, is_active, is_menu_item, name);

-- 2) Órdenes por tienda y estado: usados en kitchen y dashboard
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders(store_id, status, created_at DESC);

-- 3) Items de órdenes por order_id para consultas rápidas de detalles
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

-- 4) Clientes de tienda (store_customers) para búsquedas en POS
CREATE INDEX IF NOT EXISTS idx_store_customers_store_user
  ON store_customers(store_id, user_id);

-- 5) Ingredientes de tienda para inventario
CREATE INDEX IF NOT EXISTS idx_ingredients_store_current_stock
  ON ingredients(store_id, current_stock);

COMMIT;
