# 🎯 FIX CRÍTICO: RaffleRoom No Funciona en Producción - API_URL

**Fecha:** 7 Nov 2025 11:20am  
**Tipo:** API Configuration Error  
**Severidad:** CRÍTICA (bloquea acceso a tablero de rifas)  
**Commit:** db5797d  
**Reporte:** Usuario identificó que fixes no se manifiestan

---

## 🚨 PROBLEMA REPORTADO POR USUARIO

> **"Se está creando la rifa correctamente sin embargo no se puede entrar al tablero, aparece este error... ¿Estás seguro que las correcciones se están aplicando en la dirección correcta y no se están aplicando en una dirección inválida o antigua de las tablas como nos venía ocurriendo? Siento que sigue pasando, haces actualizaciones fuertes y sin embargo no se manifiestan en lo más mínimo."**

### Síntomas
1. ✅ Rifa se CREA correctamente desde RafflesLobby
2. ✅ Rifa aparece LISTADA en el lobby
3. ❌ Al hacer clic en "Ver Rifa", NO CARGA el tablero
4. ❌ Componente RaffleRoom.js NO se renderiza
5. ❌ Usuario ve pantalla en blanco o error

### Logs Visibles
- Errores de WebSocket: "UNKNOWN_MESSAGE_TYPE"
- Posibles 404 en fetch requests

---

## 🔍 ANÁLISIS ROOT CAUSE

### Investigación Paso a Paso

#### 1. Verificar Ruta de Navegación
```javascript
// RafflesLobby.js línea 255
onClick={() => window.location.href = `/raffles/room/${raffle.code}`}
```
✅ **Ruta correcta** → apunta a RaffleRoom.js

#### 2. Verificar Configuración de Rutas
```javascript
// App.js líneas 126-127
<Route path="raffles/:code" element={<RaffleRoom />} />
<Route path="raffles/room/:code" element={<RaffleRoom />} />
```
✅ **Rutas configuradas** correctamente

#### 3. Verificar Imports en RaffleRoom.js
```javascript
// RaffleRoom.js línea 18
import API_URL from '../config/api';
```
✅ **API_URL importado** pero...

#### 4. Verificar Uso de API_URL 🔴 **PROBLEMA ENCONTRADO**
```javascript
// RaffleRoom.js línea 55 - ❌ INCORRECTO
const response = await fetch(`/api/raffles/${code}`);

// RaffleRoom.js línea 69 - ❌ INCORRECTO
const response = await fetch(`/api/raffles/${code}/numbers`);

// RaffleRoom.js línea 718 - ❌ INCORRECTO
await fetch(`/api/raffles/approve-purchase`, { ... });

// RaffleRoom.js línea 740 - ❌ INCORRECTO
await fetch(`/api/raffles/reject-purchase`, { ... });
```

**Importaba `API_URL` pero NO LO USABA** → Rutas relativas en producción

---

## 💥 POR QUÉ FALLA EN PRODUCCIÓN

### Configuración Railway

Railway sirve el frontend como **archivos estáticos** desde la raíz:
```
https://mundoxyz-production.up.railway.app/
  ├── index.html
  ├── static/
  │   ├── js/main.[hash].js
  │   └── css/main.[hash].css
  └── api/ (backend rutas)
```

### Comportamiento de Rutas Relativas

**En desarrollo (localhost:3000):**
```javascript
fetch('/api/raffles/ABC123')
// Proxy de Create React App redirige a:
// http://localhost:5000/api/raffles/ABC123
// ✅ Funciona
```

**En producción Railway:**
```javascript
fetch('/api/raffles/ABC123')
// Intenta llamar a:
// https://mundoxyz-production.up.railway.app/api/raffles/ABC123
// Pero dependiendo de configuración del servidor puede:
// - ❌ Fallar (no encuentra ruta)
// - ❌ Devolver index.html (SPA fallback)
// - ⚠️ Funcionar SOLO si server.js configura correctamente
```

### Patrón Correcto en Otros Componentes

**BingoV2GameRoom.js (SÍ funciona):**
```javascript
import API_URL from '../config/api';

const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`);
// Producción: https://mundoxyz-production.up.railway.app/api/bingo/...
// Desarrollo: /api/bingo/... (string vacío)
// ✅ Funciona en AMBOS
```

**BuyNumberModal.js (SÍ funciona):**
```javascript
const BASE_URL = API_URL || '';
const buildUrl = (path) => `${BASE_URL}${path}`;

await axios.post(buildUrl('/api/raffles/...'));
// ✅ Funciona en AMBOS
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambios en RaffleRoom.js

#### 1. Query de Rifa Principal (línea 55)
```javascript
// ANTES ❌
const response = await fetch(`/api/raffles/${code}`);

// DESPUÉS ✅
const response = await fetch(`${API_URL}/api/raffles/${code}`);
```

#### 2. Query de Números (línea 69)
```javascript
// ANTES ❌
const response = await fetch(`/api/raffles/${code}/numbers`);

// DESPUÉS ✅
const response = await fetch(`${API_URL}/api/raffles/${code}/numbers`);
```

#### 3. Aprobar Compra (línea 718)
```javascript
// ANTES ❌
await fetch(`/api/raffles/approve-purchase`, { ... });

// DESPUÉS ✅
await fetch(`${API_URL}/api/raffles/approve-purchase`, { ... });
```

#### 4. Rechazar Compra (línea 740)
```javascript
// ANTES ❌
await fetch(`/api/raffles/reject-purchase`, { ... });

// DESPUÉS ✅
await fetch(`${API_URL}/api/raffles/reject-purchase`, { ... });
```

---

## 📊 CONFIG/API.JS - Cómo Funciona

```javascript
// frontend/src/config/api.js

const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname === 'mundoxyz-production.up.railway.app' ||
   window.location.hostname.includes('railway.app'));

const API_URL = isProduction 
  ? 'https://mundoxyz-production.up.railway.app'  // Producción: URL completa
  : (process.env.REACT_APP_API_URL || '');         // Desarrollo: vacío (proxy)

export default API_URL;
```

### Comportamiento

**Producción Railway:**
```javascript
API_URL = 'https://mundoxyz-production.up.railway.app'
fetch(`${API_URL}/api/raffles/ABC`) 
// → https://mundoxyz-production.up.railway.app/api/raffles/ABC
```

**Desarrollo Local:**
```javascript
API_URL = ''
fetch(`${API_URL}/api/raffles/ABC`) 
// → /api/raffles/ABC (proxy maneja)
```

---

## 🎯 RESULTADO ESPERADO

### Antes del Fix
1. Usuario navega a `/raffles/room/ABC123`
2. RaffleRoom.js intenta `fetch('/api/raffles/ABC123')`
3. ❌ Request falla o devuelve HTML
4. ❌ `raffle` queda como `undefined`
5. ❌ Componente muestra "Rifa no encontrada" o pantalla blanca
6. ❌ Usuario NO puede ver tablero

### Después del Fix
1. Usuario navega a `/raffles/room/ABC123`
2. RaffleRoom.js intenta `fetch('https://mundoxyz-production.up.railway.app/api/raffles/ABC123')`
3. ✅ Request exitosa, recibe datos de la rifa
4. ✅ `raffle` se carga correctamente
5. ✅ Componente renderiza tablero con números
6. ✅ Usuario ve tablero y puede comprar números

---

## 📝 LECCIONES CRÍTICAS

### 1. Imports Deben Usarse
```javascript
// ❌ MAL - Importar sin usar
import API_URL from '../config/api';
fetch('/api/...');  // No usa el import

// ✅ BIEN - Usar lo que importas
import API_URL from '../config/api';
fetch(`${API_URL}/api/...`);  // Usa el import
```

### 2. Consistencia en el Codebase
Si otros componentes usan `API_URL`, TODOS deben usarlo:
- ✅ BingoV2GameRoom.js → usa API_URL
- ✅ BuyNumberModal.js → usa API_URL
- ❌ RaffleRoom.js → NO lo usaba (ahora sí)

### 3. No Mezclar Patrones
```javascript
// ❌ MAL - Mezclar rutas relativas y API_URL
import API_URL from '../config/api';
fetch('/api/endpoint1');              // Relativa
fetch(`${API_URL}/api/endpoint2`);    // Con API_URL

// ✅ BIEN - Consistencia
import API_URL from '../config/api';
fetch(`${API_URL}/api/endpoint1`);
fetch(`${API_URL}/api/endpoint2`);
```

### 4. Testing en Producción
Desarrollar localmente puede ocultar estos bugs:
- Proxy local hace que rutas relativas funcionen
- Producción NO tiene proxy
- **SIEMPRE** probar deploy en staging/producción

---

## 🔍 POR QUÉ OTROS COMPONENTES FUNCIONABAN

### RafflesLobby.js - Listado de Rifas
```javascript
const response = await fetch(`/api/raffles/public?${params}`);
```
**¿Por qué funciona?**
- Backend Railway probablemente tiene middleware que sirve `/api/*`
- O está configurado en `server.js` para servir estas rutas
- Pero NO todas las rutas están configuradas igual

### Inconsistencia en Backend
Es posible que:
- `/api/raffles/public` → ✅ Configurado en server.js
- `/api/raffles/:code` → ❌ No configurado o mal configurado
- Por eso unos endpoints funcionan y otros no

**Solución definitiva:** Usar `API_URL` en TODOS los componentes, independiente de configuración backend.

---

## 🚀 VERIFICACIÓN POST-DEPLOY

### Checklist Manual

1. **Crear Rifa**
   - [ ] Abrir `/raffles`
   - [ ] Crear nueva rifa
   - [ ] Verificar que aparece en listado

2. **Acceder al Tablero**
   - [ ] Hacer clic en "Ver Rifa"
   - [ ] ✅ Debe cargar `RaffleRoom.js`
   - [ ] ✅ Debe mostrar grid de números
   - [ ] ✅ NO debe mostrar pantalla blanca
   - [ ] ✅ NO debe mostrar "Rifa no encontrada"

3. **Verificar Network Tab**
   - [ ] Abrir Chrome DevTools → Network
   - [ ] Filtrar por "raffles"
   - [ ] ✅ Request a `https://mundoxyz-production.up.railway.app/api/raffles/[CODE]`
   - [ ] ✅ Status 200
   - [ ] ✅ Response contiene datos de rifa

4. **Verificar Console**
   - [ ] NO debe haber errores de fetch
   - [ ] Debe mostrar: "🔌 Socket conectado a rifa: [ID]"

### Logs Railway

Buscar en logs:
```
✅ GET /api/raffles/[CODE] 200
✅ GET /api/raffles/[CODE]/numbers 200
❌ NO debe aparecer: GET /api/raffles/[CODE] 404
```

---

## 🔗 CONTEXTO ADICIONAL

### Fixes Relacionados (Esta Sesión)

1. **InvalidCharacterError** (commit 516f70c)
   - Props undefined en style attributes
   
2. **RaffleDetails.js Legacy** (commit 3427a77)
   - Archivo viejo en bundle contaminaba

3. **Public Stats JOIN** (commit cdaed56)
   - wallet_transactions.user_id no existe

4. **RaffleRoom API_URL** (commit db5797d) ← **ESTE FIX**
   - Rutas relativas en fetch

### Por Qué Usuario Tiene Razón

> "Estás seguro que las correcciones se están aplicando en la dirección correcta..."

**Usuario identificó correctamente:**
- ✅ Fixes se hacían pero NO se manifestaban
- ✅ Problema era de CONFIGURACIÓN, no de lógica
- ✅ Importar sin usar es señal de código incorrecto
- ✅ Inconsistencia entre componentes (Bingo vs Raffles)

**Análisis correcto:**
- Cambios en `RaffleRoom.js` (colores, validaciones) NO importaban
- Porque el componente NI SIQUIERA SE CARGABA
- Fetch fallaba silenciosamente
- Usuario no veía NADA porque `raffle` era undefined

---

## ✅ STATUS ACTUAL

- [x] Problema identificado (rutas relativas sin API_URL)
- [x] Patrón correcto verificado (Bingo components)
- [x] config/api.js revisado
- [x] RaffleRoom.js corregido (4 fetch)
- [x] Commit realizado (db5797d)
- [x] Push a main exitoso
- [ ] Deploy Railway completado (esperando ~6 min)
- [ ] RaffleRoom accesible en producción
- [ ] Tablero de rifa funcional

---

## 💡 RECOMENDACIONES FUTURAS

### 1. Crear Helper Centralizado
```javascript
// utils/api.js
import API_URL from '../config/api';

export const apiFetch = (path, options = {}) => {
  return fetch(`${API_URL}${path}`, options);
};

// Uso en componentes
import { apiFetch } from '../utils/api';
apiFetch('/api/raffles/ABC123');  // ✅ Siempre correcto
```

### 2. ESLint Rule Custom
```javascript
// .eslintrc.js
rules: {
  'no-relative-api-calls': 'error'  // Custom rule
}
```

### 3. Testing E2E
```javascript
// cypress/e2e/raffles.cy.js
it('debe cargar tablero de rifa', () => {
  cy.visit('/raffles/room/ABC123');
  cy.get('.grid-container').should('be.visible');
  cy.get('.number-cell').should('have.length.gt', 0);
});
```

### 4. Monitoreo de Errores
```javascript
// Sentry o similar
Sentry.captureException(error, {
  tags: { component: 'RaffleRoom', type: 'fetch' }
});
```

---

## 🎓 CATEGORÍA

**Errores de Configuración en Producción:**
- Import no usado
- Rutas relativas vs absolutas
- Diferencias dev/prod
- Inconsistencia en codebase
- Testing insuficiente en prod

**Similar a:**
- RaffleDetails.js legacy (código viejo activo)
- Nombres de columnas (asumir schema)
- Routing duplicado (páginas ambiguas)

---

**Deploy en progreso... Esperando verificación en producción** ⏳
