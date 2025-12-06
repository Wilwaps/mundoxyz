-- 089_add_perf_indexes_round2.sql
-- Índices para reducir tiempos en mis rifas, tiendas, wallets y wallet_transactions.
-- Nota: el runner ejecuta cada archivo dentro de una transacción, por lo que no usamos CONCURRENTLY aquí.

-- Rifas por host (mis rifas)
CREATE INDEX IF NOT EXISTS idx_raffles_host_visibility_created_desc
  ON raffles (host_id, visibility, created_at DESC)
  WHERE visibility IN ('public', 'private', 'company');

-- Búsqueda de tiendas por slug
CREATE INDEX IF NOT EXISTS idx_stores_slug
  ON stores (slug);

-- Wallets por usuario (balances)
CREATE INDEX IF NOT EXISTS idx_wallets_user_id
  ON wallets (user_id);

-- Wallet transactions por fecha y wallet (active_users_7d)
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_wallet
  ON wallet_transactions (created_at, wallet_id);
