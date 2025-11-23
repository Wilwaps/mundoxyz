-- Migration: Create Store Staff Table
-- Description: Links users to stores with specific roles (owner, admin, manager, seller, marketing)

BEGIN;

CREATE TYPE store_role AS ENUM ('owner', 'admin', 'manager', 'seller', 'marketing');

CREATE TABLE IF NOT EXISTS store_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role store_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user has only one role per store
    UNIQUE(store_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_store_staff_store ON store_staff(store_id);
CREATE INDEX idx_store_staff_user ON store_staff(user_id);

COMMIT;
