# 🚨 FIX URGENTE: Restaurar Conexión Frontend-Backend

## ❌ PROBLEMA ACTUAL

Al eliminar completamente `REACT_APP_API_URL`, el frontend está intentando conectar a:
- URL incorrecta para el backend
- Las peticiones van al mismo dominio del frontend
- El backend está en un servicio separado en Railway

## ✅ SOLUCIÓN CORRECTA

### EN RAILWAY - CONFIGURAR VARIABLE CORRECTAMENTE

**Frontend Service → Variables:**

```env
REACT_APP_API_URL=https://confident-bravery-production-ce7b.up.railway.app
```

**IMPORTANTE:** 
- ⚠️ SIN la barra `/api` al final
- ✅ Solo la URL base del backend
- ✅ Esto evita la duplicación `/api/api/`

## 📋 PASOS INMEDIATOS

### 1️⃣ En Railway Dashboard:

1. **Ve a Frontend service**
2. **Click en Variables**
3. **Agregar o modificar:**
   ```
   Variable: REACT_APP_API_URL
   Value: https://confident-bravery-production-ce7b.up.railway.app
   ```
4. **Save Changes**
5. **El frontend se redeployará automáticamente**

### 2️⃣ Esperar 2-3 minutos para el rebuild

### 3️⃣ Verificar que funciona:

```javascript
// En console del navegador
console.log('API URL:', process.env.REACT_APP_API_URL);
// Debería mostrar: https://confident-bravery-production-ce7b.up.railway.app
```

## 🔍 EXPLICACIÓN TÉCNICA

### Configuración Correcta:

**Frontend (React):**
- `REACT_APP_API_URL = https://confident-bravery-production-ce7b.up.railway.app`
- Código: `axios.get('/api/economy/balance')`
- Resultado: `https://confident-bravery-production-ce7b.up.railway.app/api/economy/balance` ✅

### Lo que estaba mal antes:

**Configuración incorrecta #1:**
- `REACT_APP_API_URL = "/api"`
- Resultado: `/api/api/economy/balance` ❌ (duplicado)

**Configuración incorrecta #2:**
- `REACT_APP_API_URL = ""` (vacío)
- Resultado: Busca en el mismo dominio del frontend ❌

## ✅ VERIFICACIÓN FINAL

Después del deploy, en el navegador:

```javascript
// Login
fetch('https://confident-bravery-production-ce7b.up.railway.app/api/auth/login-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'prueba1@pruebamail.com',
    password: 'tu_password'
  })
})
.then(r => r.json())
.then(d => {
  localStorage.setItem('token', d.token);
  console.log('✅ Login exitoso');
})
.catch(e => console.log('❌ Error:', e));
```

## 🎯 RESULTADO ESPERADO

- ✅ Login funciona
- ✅ Balance se muestra correctamente
- ✅ No hay rutas duplicadas
- ✅ WebSocket conecta correctamente

---

**⚡ ACCIÓN INMEDIATA:**

Agrega en Railway Frontend Variables:
```
REACT_APP_API_URL=https://confident-bravery-production-ce7b.up.railway.app
```

NO pongas `/api` al final, solo la URL base del backend.
