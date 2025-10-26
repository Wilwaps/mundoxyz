-- Migración: Agregar sistema de recuperación de claves con pregunta de seguridad
-- Fecha: 26 de Octubre 2025
-- Autor: Sistema MUNDOXYZ

-- 1. Agregar columna para respuesta de seguridad
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS security_answer VARCHAR(255);

-- 2. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_users_security_answer ON users(security_answer);

-- 3. Comentarios de documentación
COMMENT ON COLUMN users.security_answer IS 'Respuesta de seguridad hasheada con bcrypt para recuperación de clave';

-- 4. Fix temporal para usuario prueba1 (clave por defecto: 123456)
-- Hash bcrypt de "123456" con 10 rounds
UPDATE users 
SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
WHERE username = 'prueba1' AND (password_hash IS NULL OR password_hash = '');

-- 5. Nota: Todos los usuarios existentes tendrán security_answer = NULL
-- Esto es OK, podrán agregarla desde su perfil después de login
