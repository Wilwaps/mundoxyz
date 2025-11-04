-- ================================================
-- MIGRACIÓN: Sistema "Mis Datos"
-- Copia y pega TODO esto en Railway PostgreSQL Query
-- ================================================

-- 1. Agregar campos a users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname) WHERE nickname IS NOT NULL;

-- 2. Crear tabla telegram_link_sessions
CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON telegram_link_sessions(link_token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user_id ON telegram_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_expires ON telegram_link_sessions(expires_at) WHERE used = FALSE;

-- 3. Crear tabla offensive_words
CREATE TABLE IF NOT EXISTS offensive_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offensive_words_word ON offensive_words(LOWER(word));

-- 4. Insertar palabras ofensivas (24 palabras)
INSERT INTO offensive_words (word) VALUES
  ('mierda'),('joder'),('puta'),('puto'),('marico'),
  ('marica'),('verga'),('coño'),('carajo'),('maldito'),
  ('pendejo'),('idiota'),('estupido'),('imbecil'),('burro'),
  ('mongolico'),('retrasado'),('zorra'),('cabron'),('hijo de puta'),
  ('hp'),('hijueputa'),('gonorrea'),('malparido')
ON CONFLICT (word) DO NOTHING;

-- 5. Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION clean_expired_telegram_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_link_sessions
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- VERIFICACIÓN (ejecuta esto después)
-- ================================================

-- Verificar columnas nuevas en users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('nickname', 'bio');

-- Verificar tabla telegram_link_sessions
SELECT COUNT(*) as telegram_sessions FROM telegram_link_sessions;

-- Verificar palabras ofensivas
SELECT COUNT(*) as palabras_ofensivas FROM offensive_words;

-- ================================================
-- Si todo está bien, deberías ver:
-- - 2 columnas (nickname, bio)
-- - 0 sesiones telegram (tabla vacía)
-- - 24 palabras ofensivas
-- ================================================
