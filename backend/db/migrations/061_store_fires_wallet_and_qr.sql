-- Migration: Store fires wallet and QR payment fields
-- Description: Adds fires wallet balance per store, store wallet transactions, and QR session fields for orders

BEGIN;

-- 1) Add fires wallet balance to stores
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS fires_wallet_balance DECIMAL(20, 2) NOT NULL DEFAULT 0;

-- 2) Store wallet transactions (incoming/outgoing fires for each store)
CREATE TABLE IF NOT EXISTS store_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id), -- Cliente o dueño implicado
    order_id UUID REFERENCES orders(id),
    type VARCHAR(50) NOT NULL, -- 'qr_payment_in', 'owner_withdraw', 'manual_adjustment', etc.
    amount_fires DECIMAL(20, 2) NOT NULL, -- Positivo = entra a la tienda, negativo = sale
    balance_after DECIMAL(20, 2), -- Saldo de la billetera de tienda después de este movimiento (opcional)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_wallet_tx_store ON store_wallet_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_wallet_tx_order ON store_wallet_transactions(order_id);

-- 3) QR payment session fields on orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS qr_session_id UUID,
ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_fires DECIMAL(20, 2);

COMMIT;
