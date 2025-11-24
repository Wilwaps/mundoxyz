-- Create suppliers and purchase invoices tables for store inventory module

BEGIN;

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    extra_contact JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    supplier_address_snapshot TEXT,
    contact_info JSONB,
    notes TEXT,
    total_cost_usdt DECIMAL(20, 4) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    ingredient_id UUID REFERENCES ingredients(id),
    description TEXT,
    quantity DECIMAL(20, 2) NOT NULL,
    unit_cost_usdt DECIMAL(20, 4) NOT NULL,
    total_cost_usdt DECIMAL(20, 4) NOT NULL,
    CHECK (
        (product_id IS NOT NULL AND ingredient_id IS NULL)
        OR (product_id IS NULL AND ingredient_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_store ON purchase_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoice_id);

COMMIT;
