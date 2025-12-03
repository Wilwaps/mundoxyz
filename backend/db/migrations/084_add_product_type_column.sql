-- 084_add_product_type_column.sql
-- Agrega columna product_type a products para diferenciar Productos y Servicios

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'product'
  CHECK (product_type IN ('product', 'service'));

COMMIT;
