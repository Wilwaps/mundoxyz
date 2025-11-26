-- Migration: Create store_conversations and store_conversation_messages
-- Description: Base de mensajería/tickets por tienda (clientes e hilos internos)

BEGIN;

-- Tabla principal de conversaciones de tienda
CREATE TABLE IF NOT EXISTS store_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'internal')),
    channel_key VARCHAR(50), -- Para hilos internos ("global", "cocina", etc.)
    label VARCHAR(150) NOT NULL,
    customer_id UUID REFERENCES users(id), -- Cliente asociado (solo type = 'customer')
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed', 'archived')),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id), -- Staff que creó la conversación/hilo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices y unicidad de hilos internos por tienda
CREATE INDEX IF NOT EXISTS idx_store_conversations_store_type_status
    ON store_conversations(store_id, type, status);

CREATE INDEX IF NOT EXISTS idx_store_conversations_customer
    ON store_conversations(customer_id);

CREATE INDEX IF NOT EXISTS idx_store_conversations_last_message
    ON store_conversations(store_id, last_message_at DESC);

-- Un único canal interno por (store_id, type, channel_key) cuando aplique
ALTER TABLE store_conversations
    ADD CONSTRAINT uniq_store_internal_channel
    UNIQUE (store_id, type, channel_key);


-- Mensajes dentro de cada conversación
CREATE TABLE IF NOT EXISTS store_conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES store_conversations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id), -- Staff
    author_customer_id UUID REFERENCES users(id), -- Cliente (usuario regular)
    author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('staff', 'customer', 'system')),
    message TEXT NOT NULL CHECK (char_length(message) <= 2000),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validar coherencia entre author_type y columnas de autor
ALTER TABLE store_conversation_messages
    ADD CONSTRAINT chk_store_conv_msg_author
    CHECK (
        (author_type = 'staff' AND author_user_id IS NOT NULL)
        OR (author_type = 'customer' AND author_customer_id IS NOT NULL)
        OR (author_type = 'system')
    );

CREATE INDEX IF NOT EXISTS idx_store_conv_messages_conv
    ON store_conversation_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_conv_messages_store
    ON store_conversation_messages(store_id, created_at DESC);

COMMIT;
