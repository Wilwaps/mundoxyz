-- Migration: Create Divorare04 Store System Tables
-- Description: Comprehensive schema for Store, Inventory, Orders, and CRM

BEGIN;

-- 1. Stores & Configuration
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'divorare04'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    owner_id UUID REFERENCES users(id),
    
    -- Configuration
    currency_config JSONB DEFAULT '{"base": "USDT", "accepted": ["USDT", "Fires", "BS"], "rates_source": "manual"}',
    settings JSONB DEFAULT '{"tax_rate": 0, "service_fee": 0, "open_hours": {}}',
    location JSONB DEFAULT '{}', -- Address, coords, geofences
    views_count BIGINT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Catalog (Products & Categories)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    sku VARCHAR(50),
    
    -- Pricing (Base in USDT)
    price_usdt DECIMAL(20, 2) NOT NULL DEFAULT 0,
    price_fires DECIMAL(20, 2), -- Optional override
    
    -- Flags
    is_menu_item BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    has_modifiers BOOLEAN DEFAULT FALSE,
    accepts_fires BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Costing (Auto-calculated from recipe)
    cost_usdt DECIMAL(20, 2) DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    group_name VARCHAR(50) NOT NULL, -- e.g., "Salsas", "Término"
    name VARCHAR(50) NOT NULL, -- e.g., "Mayo", "Bien cocido"
    price_adjustment_usdt DECIMAL(20, 2) DEFAULT 0,
    max_selection INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT FALSE
);

-- 3. Inventory & Kitchen (The "Heart")
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- kg, g, L, ml, unit
    cost_per_unit_usdt DECIMAL(20, 4) DEFAULT 0,
    current_stock DECIMAL(20, 4) DEFAULT 0,
    min_stock_alert DECIMAL(20, 4) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    quantity_required DECIMAL(20, 4) NOT NULL, -- Amount of ingredient per product unit
    UNIQUE(product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    ingredient_id UUID REFERENCES ingredients(id),
    change_amount DECIMAL(20, 4) NOT NULL,
    reason VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'waste', 'correction'
    reference_id UUID, -- Order ID or Purchase ID
    logged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Per-store counters for invoice numbers
CREATE TABLE IF NOT EXISTS store_counters (
    store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    last_invoice_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waste_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    ingredient_id UUID REFERENCES ingredients(id),
    quantity DECIMAL(20, 4) NOT NULL,
    reason TEXT, -- 'expired', 'burned', 'dropped'
    cost_loss_usdt DECIMAL(20, 2),
    logged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 4. Orders & POS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id), -- Usuario que realiza la orden (si aplica)
    customer_id UUID REFERENCES users(id), -- Cliente POS asociado (CI)
    code VARCHAR(10) NOT NULL, -- Short code for kitchen/customer
    invoice_number BIGINT, -- Consecutivo de facturación por tienda (solo números)
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('dine_in', 'pickup', 'delivery')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivering', 'completed', 'cancelled')),
    
    -- Payment
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_method JSONB DEFAULT '{}', -- Supports split: { "zelle": 10, "cash": 5, "fires": 20 }
    currency_snapshot JSONB DEFAULT '{}', -- Exchange rates at time of order
    
    -- Totals (Stored in USDT for reporting, but display varies)
    subtotal_usdt DECIMAL(20, 2) DEFAULT 0,
    tax_usdt DECIMAL(20, 2) DEFAULT 0,
    delivery_fee_usdt DECIMAL(20, 2) DEFAULT 0,
    discount_usdt DECIMAL(20, 2) DEFAULT 0,
    total_usdt DECIMAL(20, 2) DEFAULT 0,
    
    -- Meta
    table_number VARCHAR(10),
    notes TEXT,
    delivery_info JSONB, -- Address, driver_id
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    modifiers JSONB DEFAULT '[]', -- Selected modifiers
    price_at_time_usdt DECIMAL(20, 2) NOT NULL,
    cost_at_time_usdt DECIMAL(20, 2) -- For profit reporting
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    station VARCHAR(50) DEFAULT 'main', -- 'grill', 'bar', 'cold'
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. CRM & Loyalty
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id),
    total_spent_usdt DECIMAL(20, 2) DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    last_visit_at TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    UNIQUE(store_id, user_id)
);

CREATE TABLE IF NOT EXISTS store_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (store_id, user_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id),
    points_change INTEGER NOT NULL,
    reason VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_store ON products(store_id);
CREATE UNIQUE INDEX idx_products_store_sku_unique ON products(store_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE UNIQUE INDEX idx_orders_store_invoice_unique ON orders(store_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX idx_ingredients_store ON ingredients(store_id);
CREATE INDEX idx_store_customers_store ON store_customers(store_id);
CREATE INDEX idx_suppliers_store ON suppliers(store_id);
CREATE INDEX idx_purchase_invoices_store ON purchase_invoices(store_id);
CREATE INDEX idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoice_id);

COMMIT;
