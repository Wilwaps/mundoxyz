const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (!connectionString) {
    console.error('ERROR: Debes definir DATABASE_URL o DATABASE_PUBLIC_URL en las variables de entorno.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    const sql = `
BEGIN;

CREATE TABLE IF NOT EXISTS product_modifier_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifier_id UUID NOT NULL REFERENCES product_modifiers(id) ON DELETE CASCADE,
    stock DECIMAL(20, 2) NOT NULL DEFAULT 0,
    reserved DECIMAL(20, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (product_id, modifier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_modifier_stock_store ON product_modifier_stock(store_id);
CREATE INDEX IF NOT EXISTS idx_product_modifier_stock_product ON product_modifier_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_product_modifier_stock_modifier ON product_modifier_stock(modifier_id);

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS modifier_id UUID REFERENCES product_modifiers(id);

COMMIT;`;

    await client.query(sql);
    console.log('✅ Migration de product_modifier_stock aplicada correctamente.');
  } catch (err) {
    console.error('❌ Error aplicando migration de product_modifier_stock:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
