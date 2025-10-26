# 🚨 FIX CRÍTICO: Rutas Duplicadas `/api/api/`

## 🔴 PROBLEMA IDENTIFICADO

Las peticiones del frontend están yendo a `/api/api/` en lugar de `/api/`:
- ❌ GET `/api/api/economy/balance` → 404 HTML
- ❌ POST `/api/api/tictactoe/create` → 404
- ❌ GET `/api/api/tictactoe/rooms/public` → 404

## 🔍 CAUSA RAÍZ

### En producción (Railway):
- Variable de entorno: `REACT_APP_API_URL = "/api"`
- Código frontend: `axios.get('/api/economy/balance')`
- Resultado: `/api` + `/api/economy/balance` = `/api/api/economy/balance` ❌

## ✅ SOLUCIÓN

### Opción 1: Variable de Entorno Railway (RECOMENDADA)

**En Railway Dashboard:**
1. Variables → Frontend service
2. Cambiar: `REACT_APP_API_URL = "/api"` 
3. A: `REACT_APP_API_URL = ""`

### Opción 2: Cambiar Código Frontend

Cambiar todas las rutas para quitar `/api`:

```javascript
// ANTES:
axios.get('/api/economy/balance')
axios.post('/api/tictactoe/create')

// DESPUÉS:
axios.get('/economy/balance')
axios.post('/tictactoe/create')
```

## 🛠️ IMPLEMENTACIÓN INMEDIATA

### PASO 1: Crear .env para producción

**frontend/.env.production:**
```
REACT_APP_API_URL=
```

### PASO 2: Validar rutas en AuthContext

**frontend/src/contexts/AuthContext.js (línea 17):**
```javascript
// ANTES:
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// DESPUÉS (más explícito):
// En producción no usar baseURL ya que las rutas incluyen /api
const apiUrl = process.env.REACT_APP_API_URL;
if (apiUrl && apiUrl !== '') {
  axios.defaults.baseURL = apiUrl;
}
```

### PASO 3: Arreglar proxy en desarrollo

**frontend/package.json (línea 59):**
```json
// CAMBIAR:
"proxy": "http://localhost:3000"

// A:
"proxy": "http://localhost:4000"
```

## 📋 ARCHIVOS A MODIFICAR

1. **frontend/.env.production** (crear)
2. **frontend/package.json** (línea 59)
3. **frontend/src/contexts/AuthContext.js** (línea 17)

## 🔍 VERIFICACIÓN

Después del deploy:

```javascript
// Console del navegador:
fetch('/api/economy/balance', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
}).then(r => {
  console.log('URL:', r.url);
  console.log('Status:', r.status);
  return r.text();
}).then(t => console.log('Response:', t));
```

Debería mostrar:
- URL: `https://confident-bravery-production-ce7b.up.railway.app/api/economy/balance`
- Status: 200
- Response: JSON con balance

## 🚀 DEPLOY RÁPIDO

```bash
git add .
git commit -m "fix: rutas duplicadas api/api - configurar baseURL correctamente"
git push
```

## ⚠️ IMPORTANTE PARA RAILWAY

Después del push, en Railway:

1. **Frontend Service → Variables**
2. **Eliminar o vaciar:** `REACT_APP_API_URL`
3. **Redeploy** si es necesario

## 🎯 RESULTADO ESPERADO

- ✅ Balance muestra 4.75 🔥
- ✅ Crear sala funciona
- ✅ No más errores 404
- ✅ No más respuestas HTML cuando espera JSON
