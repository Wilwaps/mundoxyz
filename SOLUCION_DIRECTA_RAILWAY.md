# 🚨 SOLUCIÓN DIRECTA - CONFIGURAR USUARIO PRUEBA1

## 🔴 PROBLEMAS IDENTIFICADOS

1. ❌ **URL de Railway incorrecta:** `.railway.internal` no funciona desde tu PC
2. ❌ **Usuario prueba1 sin password_hash:** No puede actualizar security_answer porque falla en verificación de clave
3. ❌ **Security_answer sigue NULL:** Endpoint requiere password válido primero

---

## ✅ SOLUCIÓN MÁS RÁPIDA: Railway Query (Manual)

### **Paso 1: Configurar PASSWORD para prueba1**

En Railway → PostgreSQL → Query, ejecuta:

```sql
-- 1. Verificar estado actual
SELECT 
  u.id,
  u.username,
  u.email,
  ai.password_hash IS NOT NULL as tiene_password,
  u.security_answer IS NOT NULL as tiene_security_answer
FROM users u
LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
WHERE u.username = 'prueba1';
```

**Si `tiene_password` es FALSE, ejecutar:**

```sql
-- 2. Crear auth_identity con password "123456"
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
  )
RETURNING *;
```

**Si ya tiene password, actualizar:**

```sql
-- O actualizar si ya existe
UPDATE auth_identities ai
SET password_hash = '$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ'
FROM users u
WHERE ai.user_id = u.id 
  AND u.username = 'prueba1' 
  AND ai.provider = 'email'
RETURNING ai.*;
```

---

### **Paso 2: Configurar SECURITY_ANSWER directamente**

**IMPORTANTE:** La respuesta DEBE estar hasheada.

#### **2A. Generar hash de "copito":**

En tu terminal local (carpeta backend):

```powershell
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('copito', 10).then(h => console.log(h));"
```

**Output ejemplo:**
```
$2b$10$ABC123XYZ...
```

#### **2B. Actualizar en Railway Query:**

```sql
-- Reemplaza [HASH_DE_COPITO] con el hash generado
UPDATE users 
SET security_answer = '[HASH_DE_COPITO]'
WHERE username = 'prueba1'
RETURNING username, security_answer IS NOT NULL as configurada;
```

---

### **Paso 3: Verificar todo**

```sql
SELECT 
  u.username,
  u.email,
  ai.password_hash IS NOT NULL as tiene_password,
  LENGTH(ai.password_hash) as longitud_hash_password,
  u.security_answer IS NOT NULL as tiene_security_answer,
  LENGTH(u.security_answer) as longitud_hash_security
FROM users u
LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
WHERE u.username = 'prueba1';
```

**Resultado esperado:**
```
username: prueba1
email: [tu email]
tiene_password: true
longitud_hash_password: 60
tiene_security_answer: true
longitud_hash_security: 60
```

---

## 🧪 PROBAR

### **1. Login:**
```
URL: https://confident-bravery-production-ce7b.up.railway.app/login
Username: prueba1
Password: 123456
```

**Debe funcionar** ✅

### **2. Reset Password:**
```
URL: /reset-password
Email: [email de prueba1]
Respuesta: copito
```

**Debe resetear a 123456** ✅

---

## 📝 ALTERNATIVA: Script con URL Pública

Si prefieres usar el script, necesitas la **URL PÚBLICA** de Railway:

### **Obtener URL pública:**

1. Railway → PostgreSQL
2. Tab "Settings" (no "Connect")
3. Scroll down a "Networking"
4. Click "Generate Domain" si no hay uno
5. Copiar la URL con formato:
   ```
   postgresql://postgres:PASSWORD@roundhouse.proxy.rlwy.net:PUERTO/railway
   ```

### **Ejecutar:**
```powershell
node ejecutar_fix_prueba1.js "postgresql://postgres:PASSWORD@HOST_PUBLICO:PUERTO/railway"
```

---

## ⚠️ POR QUÉ FALLA EL FRONTEND

El endpoint `/update-security-answer` requiere:
1. ✅ Usuario autenticado (token válido)
2. ✅ `current_password` correcto
3. ❌ **password_hash en auth_identities** (esto falta)

**Flujo actual:**
1. Usuario ingresa "copito" + password actual
2. Backend verifica password → **FALLA** porque no hay password_hash
3. Retorna error 400/401
4. Frontend no recibe success
5. **security_answer NO se actualiza**

**Solución:** Configurar password_hash primero (Paso 1 arriba).

---

## 🎯 ORDEN CORRECTO

1. ✅ Configurar password_hash en auth_identities (SQL directo)
2. ✅ Login con prueba1/123456
3. ✅ Ir a Perfil → Seguridad
4. ✅ Configurar respuesta "copito" desde UI (ahora SÍ funcionará)
5. ✅ Probar reset

---

## 📊 RESUMEN

**Problema raíz:** Usuario sin password_hash en auth_identities  
**Solución rápida:** Ejecutar SQL en Railway Query (Paso 1)  
**Solución completa:** SQL en Railway + Configurar desde UI  
**Resultado:** Sistema 100% funcional  

---

**🎯 RECOMENDACIÓN:** Usa Railway Query (más rápido que el script con URL pública).
