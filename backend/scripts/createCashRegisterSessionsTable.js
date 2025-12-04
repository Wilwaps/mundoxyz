const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (!connectionString) {
    console.error('❌ No DATABASE_URL ni DATABASE_PUBLIC_URL definido en el entorno');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    const sql = `
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id),
        opened_by UUID NOT NULL REFERENCES users(id),
        closed_by UUID REFERENCES users(id),

        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ,

        opening_balance JSONB NOT NULL,
        closing_totals JSONB,
        payment_breakdown JSONB,
        cash_breakdown JSONB,

        expected_cash_total NUMERIC(18,4),
        actual_cash_total  NUMERIC(18,4),
        discrepancy        NUMERIC(18,4),

        notes TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        version INTEGER NOT NULL DEFAULT 1,

        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_status
        ON cash_register_sessions (store_id, status);
    `;

    await client.query(sql);
    console.log('✅ Tabla cash_register_sessions creada/actualizada correctamente');
  } catch (err) {
    console.error('❌ Error creando tabla cash_register_sessions:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
