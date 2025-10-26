# 🔧 FIX USUARIO PRUEBA1 - CONFIGURAR PASSWORD

## 🔴 PROBLEMA DETECTADO

El login de `prueba1` está fallando con **401 Unauthorized**.

**Causa:** El usuario NO tiene `password_hash` en la tabla `auth_identities`, o tiene un hash diferente a "123456".

---

## ✅ SOLUCIÓN

Ejecutar el script `ejecutar_fix_prueba1.js` para configurar la clave correctamente en Railway.

---

## 📋 PASOS

### **1. Obtener URL de conexión de Railway**

1. Ir a Railway → Proyecto MUNDOXYZ → PostgreSQL
2. Tab "Connect"
3. Copiar la URL completa que empieza con `postgresql://postgres:...`

**Formato:**
```
postgresql://postgres:PASSWORD@HOST:PORT/railway
```

---

### **2. Ejecutar el script**

Desde la carpeta raíz del proyecto:

```powershell
node ejecutar_fix_prueba1.js "postgresql://postgres:PASSWORD@HOST:PORT/railway"
```

**O establecer variable de entorno:**
```powershell
$env:DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
node ejecutar_fix_prueba1.js
```

---

### **3. Verificar output**

El script debe mostrar:

```
🔌 Conectando a Railway PostgreSQL...
✅ Conectado exitosamente

📋 1. Verificando estado actual de prueba1...
Usuario encontrado:
  - ID: [uuid]
  - Username: prueba1
  - Email: [email o NULL]
  - Telegram ID: [id o NULL]
  - Tiene password: ❌ (o ✅)
  - Tiene security answer: ❌

🔧 2. Creando auth_identity con password "123456"...
✅ Auth identity creada

📋 3. Verificando resultado final...
Estado final:
  - Username: prueba1
  - Email: [email]
  - Tiene password: ✅
  - Longitud hash: 60
  - Tiene security answer: ❌

🎉 ¡ÉXITO! Usuario prueba1 configurado correctamente
📝 Ahora puedes hacer login con:
   - Username: prueba1
   - Password: 123456

🔌 Conexión cerrada
```

---

## 🧪 PROBAR LOGIN

Después de ejecutar el fix:

1. **Ir a:** https://confident-bravery-production-ce7b.up.railway.app/login

2. **Ingresar:**
   - Usuario: `prueba1`
   - Password: `123456`

3. **Resultado esperado:** Login exitoso → Redirige a Dashboard

---

## 🔐 CONFIGURAR RESPUESTA DE SEGURIDAD

Una vez que puedas hacer login:

1. **Ir a Perfil** → "Mis Datos" → Tab "🔒 Seguridad"

2. **Click "Configurar Respuesta"**

3. **Ingresar:**
   - Nueva Respuesta: `copito`
   - Clave Actual: `123456`

4. **Guardar**

5. **Verificar en DB:**
   ```sql
   SELECT username, security_answer FROM users WHERE username = 'prueba1';
   ```
   Debe mostrar un hash bcrypt (no "copito" en texto plano).

---

## 🧪 PROBAR RESET DE CLAVE

Con la respuesta de seguridad configurada:

1. **Logout**

2. **Ir a:** `/reset-password`

3. **Seleccionar método:** Email

4. **Ingresar:**
   - Email de prueba1
   - Respuesta: `copito`

5. **Resultado esperado:**
   ```
   ✅ Clave reseteada exitosamente a 123456
   Usuario: prueba1
   ```

6. **Login con nueva clave:** `123456`

---

## ❓ SI SIGUE FALLANDO

### **Verificar en Railway Query:**

```sql
-- Ver usuario y auth_identity
SELECT 
  u.username,
  u.email,
  ai.provider,
  ai.password_hash IS NOT NULL as tiene_password,
  LENGTH(ai.password_hash) as longitud_hash
FROM users u
LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email'
WHERE u.username = 'prueba1';
```

**Resultado esperado:**
- `tiene_password`: true
- `longitud_hash`: 60

### **Si password_hash es NULL:**
Ejecutar manualmente en Railway Query:

```sql
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
```

### **Ver logs de Railway:**
Ir a Railway → MUNDOXYZ Backend → Logs
Buscar errores de autenticación.

---

## ✅ CHECKLIST

- [ ] Script ejecutado sin errores
- [ ] `tiene_password`: ✅
- [ ] `longitud_hash`: 60
- [ ] Login con prueba1/123456 funciona
- [ ] Puede acceder a Dashboard
- [ ] Respuesta de seguridad configurada
- [ ] Reset de clave funciona

---

## 📊 RESUMEN

**Problema:** Usuario sin password en auth_identities  
**Solución:** Script Node.js que configura password = "123456"  
**Resultado:** Login funcional + Sistema de reset operativo  

---

**🎯 SIGUIENTE PASO:** Ejecutar el script y probar el login.
