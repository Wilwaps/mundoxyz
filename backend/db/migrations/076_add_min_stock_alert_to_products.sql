BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS product_stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('low_stock', 'out_of_stock')),
  stock INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
