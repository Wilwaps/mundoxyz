# ⚠️ CONFIGURACIÓN URGENTE EN RAILWAY

## 🚨 ACCIÓN REQUERIDA INMEDIATAMENTE

Para que el sistema funcione correctamente, debes hacer estos cambios en Railway:

---

## 1️⃣ ELIMINAR VARIABLE DE ENTORNO

### En Railway Dashboard:

1. **Ve a tu proyecto en Railway**
2. **Click en "Frontend" service** (no el Backend)
3. **Click en "Variables"** (pestaña superior)
4. **Buscar:** `REACT_APP_API_URL`
5. **Acción:**
   - Si existe con valor `/api` → **ELIMINAR** o dejar **VACÍA**
   - Si no existe → No hacer nada

---

## 2️⃣ VERIFICAR DEPLOY

1. **Pestaña "Deployments"**
2. **Último commit debe ser:** `aa0e1ba`
3. **Mensaje:** "fix: rutas duplicadas api/api"
4. **Status:** Building → Deploying → Active

---

## 3️⃣ DESPUÉS DEL DEPLOY (2-3 minutos)

### Verificar en el navegador:

```javascript
// F12 → Console
// Limpiar todo
localStorage.clear();
sessionStorage.clear();

// Recargar
location.href = '/login';
```

### Login con:
- Email: `prueba1@pruebamail.com`
- Password: [tu password]

### Verificar que funciona:

```javascript
// Test de balance
fetch('/api/economy/balance', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(r => r.json())
.then(d => console.log('✅ Balance:', d))
.catch(e => console.log('❌ Error:', e));
```

**Debe mostrar:**
```javascript
✅ Balance: {
  fires_balance: 4.75,
  coins_balance: 0
}
```

---

## 4️⃣ CREAR SALA LA VIEJA

1. Ir a `/tictactoe/lobby`
2. Click en **"Crear Sala"**
3. Seleccionar **"Fires"**
4. Click **"Crear Sala"**

**Debe funcionar sin errores 404**

---

## 📋 CHECKLIST DE VERIFICACIÓN

- [ ] Variable `REACT_APP_API_URL` eliminada o vacía en Railway
- [ ] Deploy activo con commit `aa0e1ba`
- [ ] Login funciona correctamente
- [ ] Balance muestra `4.75 fires`
- [ ] Crear sala funciona sin error 404
- [ ] WebSocket conecta sin errores

---

## ❌ SI ALGO FALLA

### Si aún ves rutas `/api/api/`:

1. **Verifica que Railway NO tenga** `REACT_APP_API_URL = "/api"`
2. **Fuerza redeploy** en Railway
3. **Clear cache** del navegador completamente

### Si el balance muestra 0:

1. **Logout y login** nuevamente
2. **Verifica el usuario** es `prueba1`
3. **Ejecuta el test** de balance arriba

---

## 🎯 RESULTADO ESPERADO

✅ Sin errores 404
✅ Balance muestra 4.75 🔥
✅ Crear sala funciona
✅ WebSocket conecta
✅ Sin rutas duplicadas `/api/api/`

---

## 📝 CAMBIOS REALIZADOS

### Commit: `aa0e1ba`

1. **frontend/.env.production** - Variable vacía
2. **frontend/package.json** - Proxy a puerto 4000
3. **AuthContext.js** - Manejo mejorado de baseURL
4. **SocketContext.js** - URL correcta para WebSocket

---

**⏰ IMPORTANTE:** Hacer estos cambios AHORA para que funcione.
