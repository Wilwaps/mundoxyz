-- 083_add_tax_id_to_suppliers.sql
-- Añade identificador fiscal (tax_id) a proveedores

BEGIN;

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);

COMMIT;
