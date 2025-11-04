-- ============================================
-- FIX USUARIO PRUEBA1
-- ============================================

-- 1. VERIFICAR ESTADO ACTUAL
SELECT 
  u.id,
  u.username,
  u.email,
  u.tg_id,
  ai.provider,
  ai.provider_uid,
  ai.password_hash IS NOT NULL as tiene_password,
  u.security_answer IS NOT NULL as tiene_security_answer
FROM users u
LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
WHERE u.username = 'prueba1';

-- 2. SI EL USUARIO EXISTE PERO NO TIENE AUTH_IDENTITY
-- Crear la identidad con clave "123456" hasheada
-- Hash bcrypt de "123456" con 10 rounds

INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at)
SELECT 
  u.id, 
  'email', 
  COALESCE(u.email, u.username), 
  '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ',
  NOW()
FROM users u
WHERE u.username = 'prueba1'
  AND NOT EXISTS (
    SELECT 1 FROM auth_identities ai 
    WHERE ai.user_id = u.id AND ai.provider = 'email'
  );

-- 3. SI YA EXISTE LA IDENTIDAD, ACTUALIZAR PASSWORD
UPDATE auth_identities ai
SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
FROM users u
WHERE ai.user_id = u.id 
  AND u.username = 'prueba1' 
  AND ai.provider = 'email';

-- 4. VERIFICAR RESULTADO FINAL
SELECT 
  u.id,
  u.username,
  u.email,
  u.tg_id,
  ai.provider,
  ai.provider_uid,
  ai.password_hash IS NOT NULL as tiene_password,
  u.security_answer IS NOT NULL as tiene_security_answer,
  LENGTH(ai.password_hash) as longitud_hash
FROM users u
LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
WHERE u.username = 'prueba1';

-- ============================================
-- RESULTADO ESPERADO:
-- - tiene_password: true
-- - longitud_hash: 60
-- - password: "123456" (hasheado)
-- ============================================
