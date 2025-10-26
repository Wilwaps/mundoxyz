# 🔐 INSTRUCCIONES: CONFIGURAR RESPUESTA DE SEGURIDAD

## ✅ FIXES APLICADOS (Commit dbe739c)

1. **Fix backend:** Cambiado `telegram_id` a `tg_id` en búsqueda
2. **Fix frontend:** Color de texto negro en inputs de ResetPassword
3. **Deploy:** Railway deployando ahora (~3-5 min)

---

## 📋 CÓMO CONFIGURAR RESPUESTA DE SEGURIDAD CORRECTAMENTE

### **OPCIÓN 1: Desde el Perfil (Recomendada)**

1. **Login** como usuario `prueba1` (con la clave actual)
   
2. **Ir a Perfil** → Click "Mis Datos"

3. **Tab "🔒 Seguridad"**
   - Verás: "Estado actual: ❌ No configurada"
   - Click "Configurar Respuesta"

4. **Ingresar datos:**
   - Nueva Respuesta de Seguridad: `copito`
   - Confirma con tu Clave Actual: `[tu clave actual]`
   - Click "Guardar"

5. **Verificar en DB:**
   ```sql
   SELECT username, security_answer FROM users WHERE username = 'prueba1';
   ```
   - Debe mostrar un HASH (no texto plano)
   - Ejemplo: `$2b$10$ABC...XYZ`

---

### **OPCIÓN 2: Directamente en DB (Solo si Opción 1 falla)**

**⚠️ IMPORTANTE:** La respuesta DEBE estar hasheada, NO en texto plano.

#### **Paso 1: Generar hash de "copito"**

Desde terminal en la carpeta `backend`:

```bash
node generar_hash.js
```

O crea un archivo temporal:
```javascript
// temp_hash.js
const bcrypt = require('bcryptjs');
bcrypt.hash('copito', 10).then(hash => console.log(hash));
```

Ejecutar:
```bash
node temp_hash.js
```

**Output ejemplo:**
```
$2b$10$rKJ5VqXZ9p0qU5H7YxGkQ.vYxLqJZ8QZ8xqH0YxGkQ.vYxLqJZ8QZ
```

#### **Paso 2: Actualizar en Railway PostgreSQL**

```sql
UPDATE users 
SET security_answer = '$2b$10$[TU_HASH_AQUI]'
WHERE username = 'prueba1';
```

**✅ Verificar:**
```sql
SELECT username, security_answer FROM users WHERE username = 'prueba1';
```

Debe mostrar el hash completo.

---

## 🧪 PROBAR SISTEMA DE RESET

### **Después del deploy (esperar 3-5 min):**

1. **Ir a:** https://confident-bravery-production-ce7b.up.railway.app/reset-password

2. **Seleccionar método:** Email

3. **Ingresar:**
   - Email: `[email de prueba1]`
   - Respuesta de Seguridad: `copito` (en minúsculas)

4. **Click "Reiniciar Clave"**

5. **Resultado esperado:**
   ```
   ✅ Clave reseteada exitosamente a 123456
   Usuario: prueba1
   ```

6. **Login con:**
   - Username: `prueba1`
   - Password: `123456`

---

## 🐛 SI SIGUE FALLANDO

### **Debug con Network Tab:**

1. **F12** → Tab "Network"
2. Intentar reset de clave
3. Click en request `reset-password-request`
4. Ver Response:
   - Si dice "Datos incorrectos" → Email no encontrado
   - Si dice "Respuesta incorrecta" → Hash no coincide
   - Si dice "No configurada" → security_answer es NULL

### **Logs de Railway:**

Ver logs en Railway para identificar el error exacto.

---

## 📊 VERIFICACIÓN COMPLETA

### **1. Verificar columna en DB:**
```sql
SELECT 
  username,
  email,
  tg_id,
  security_answer IS NOT NULL as tiene_respuesta,
  LENGTH(security_answer) as longitud_hash
FROM users 
WHERE username = 'prueba1';
```

**Resultado esperado:**
```
username  | email              | tg_id | tiene_respuesta | longitud_hash
----------|--------------------| ------|-----------------|---------------
prueba1   | prueba1@email.com  | NULL  | true            | 60
```

### **2. Probar comparación manual:**

En backend, crear archivo temporal:
```javascript
// test_compare.js
const bcrypt = require('bcryptjs');

const hashFromDB = '$2b$10$[HASH_DE_LA_DB]';
const userInput = 'copito';

bcrypt.compare(userInput, hashFromDB).then(match => {
  console.log('¿Coincide?', match); // Debe ser true
});
```

---

## ✅ CHECKLIST FINAL

- [ ] Deploy completado en Railway
- [ ] Migración 002_security_answer.sql ejecutada
- [ ] Usuario prueba1 tiene security_answer hasheada (no NULL)
- [ ] Inputs en /reset-password se ven en negro
- [ ] Reset funciona con email + respuesta
- [ ] Después de reset, clave es 123456
- [ ] Puede hacer login con nueva clave

---

**🎯 SIGUIENTE PASO:** Esperar deploy y probar flujo completo.
