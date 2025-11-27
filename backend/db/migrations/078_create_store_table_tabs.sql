-- 078_create_store_table_tabs.sql
-- Crea la tabla store_table_tabs para manejar las cuentas abiertas por mesa en el POS restaurante

BEGIN;

CREATE TABLE IF NOT EXISTS store_table_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    table_label VARCHAR(50) NOT NULL,
    cart_items JSONB NOT NULL DEFAULT '[]',
    total_usdt DECIMAL(20, 2) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (store_id, table_label)
);

CREATE INDEX IF NOT EXISTS idx_store_table_tabs_store ON store_table_tabs(store_id);

COMMIT;
