# BUG #2: JSON.parse Error en prize_meta (PostgreSQL JSONB)

**Fecha:** 9 Nov 2025 6:10pm  
**Detectado con:** Railway Logs + Chrome DevTools  
**Commit Fix:** `08cf0ff`  
**Severidad:** CRÍTICA - Bloqueaba creación de rifas después de fix validador

---

## 🔴 PROBLEMA DETECTADO

Después de corregir el validador Joi (Bug #1), la creación de rifas en modo FUEGO falló con **HTTP 500** en el servidor.

**Error en Railway Logs:**
```
SyntaxError: "[object Object]" is not valid JSON at JSON.parse (<anonymous>) 
at RaffleServiceV2.formatRaffleResponse (/app/backend/modules/raffles/services/RaffleServiceV2.js:580:43) 
at RaffleServiceV2.createRaffle (/app/backend/modules/raffles/services/RaffleServiceV2.js:107:19)
```

**Timestamp:** 2025-11-09 22:08:55

---

## 🔍 CAUSA RAÍZ

### **Archivo:** `backend/modules/raffles/services/RaffleServiceV2.js`

**Código problemático (línea 580):**
```javascript
prizeMeta: raffle.prize_meta ? JSON.parse(raffle.prize_meta) : null,
```

**Problema:**
1. El código asume que `prize_meta` es un **string JSON**
2. En PostgreSQL, columnas tipo **JSONB** son devueltas como **objetos JavaScript** por el driver `pg`
3. Al intentar `JSON.parse("[object Object]")`, genera el error: `"[object Object]" is not valid JSON`

**Secuencia del error:**
```javascript
// En createRaffle (línea 74):
prizeMeta ? JSON.stringify(prizeMeta) : null
// ↓ Se guarda como JSONB en PostgreSQL

// Al leer desde DB, PostgreSQL JSONB → Objeto JavaScript automáticamente
raffle.prize_meta = { prizeType: 'product', ... }  // Ya es objeto

// En formatRaffleResponse (línea 580 ANTES):
JSON.parse(raffle.prize_meta)
// ↓ Intenta parsear un objeto
JSON.parse("[object Object]")  // ❌ FALLA
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

**Verificar tipo antes de parsear:**

```javascript
// ANTES (línea 580):
prizeMeta: raffle.prize_meta ? JSON.parse(raffle.prize_meta) : null,

// DESPUÉS (líneas 580-582):
prizeMeta: raffle.prize_meta 
  ? (typeof raffle.prize_meta === 'string' ? JSON.parse(raffle.prize_meta) : raffle.prize_meta)
  : null,
```

**Lógica:**
```javascript
if (raffle.prize_meta) {
  if (typeof raffle.prize_meta === 'string') {
    // Es string JSON → parsear
    return JSON.parse(raffle.prize_meta);
  } else {
    // Ya es objeto → retornar directamente
    return raffle.prize_meta;
  }
} else {
  return null;
}
```

---

## 📊 COMPORTAMIENTO CORRECTO

### **Al CREAR rifa (línea 74):**
```javascript
INSERT INTO raffles (..., prize_meta) 
VALUES (..., $14)
```
**Valor:** `JSON.stringify(prizeMeta)` → String JSON guardado en columna JSONB

### **Al LEER rifa:**
**PostgreSQL JSONB → Driver pg → Objeto JavaScript automáticamente**

```javascript
// PostgreSQL almacena:
prize_meta: '{"prizeType":"product","prizeDescription":"..."}'

// Driver pg devuelve:
raffle.prize_meta = {
  prizeType: 'product',
  prizeDescription: '...',
  bankingInfo: {...}
}
// ↑ Ya es objeto, NO es string
```

### **En formatRaffleResponse (DESPUÉS del fix):**
```javascript
typeof raffle.prize_meta === 'string' 
  ? JSON.parse(raffle.prize_meta)  // Si es string (raro con JSONB)
  : raffle.prize_meta               // Si ya es objeto (caso normal) ✓
```

---

## 🎯 CASOS SOPORTADOS

**Con el fix, el código ahora maneja ambos casos:**

### **Caso 1: PostgreSQL JSONB** (normal)
```javascript
// DB devuelve objeto directamente
raffle.prize_meta = { prizeType: 'product' }
typeof raffle.prize_meta === 'object'  // true
→ Retorna raffle.prize_meta directamente ✓
```

### **Caso 2: PostgreSQL TEXT/VARCHAR** (legacy si existe)
```javascript
// DB devuelve string JSON
raffle.prize_meta = '{"prizeType":"product"}'
typeof raffle.prize_meta === 'string'  // true
→ JSON.parse(raffle.prize_meta) ✓
```

---

## 📝 CAMBIOS TÉCNICOS

### **Archivo Modificado:**
- `backend/modules/raffles/services/RaffleServiceV2.js`

### **Líneas Cambiadas:**
- **Antes:** 580 (1 línea)
- **Después:** 580-582 (3 líneas)

### **Diferencia:**
```diff
- prizeMeta: raffle.prize_meta ? JSON.parse(raffle.prize_meta) : null,
+ prizeMeta: raffle.prize_meta 
+   ? (typeof raffle.prize_meta === 'string' ? JSON.parse(raffle.prize_meta) : raffle.prize_meta)
+   : null,
```

---

## 🧪 TESTING POST-DEPLOY

### **Test: Crear Rifa Modo Fuego**

**Request:**
```json
POST /api/raffles/v2
{
  "mode": "fires",
  "prizeMeta": {
    "prizeDescription": "",
    "bankingInfo": {...}
  }
}
```

**Flujo esperado:**
1. ✅ Validador Joi acepta prizeMeta opcional en modo FIRES
2. ✅ `JSON.stringify(prizeMeta)` → Guarda en DB
3. ✅ PostgreSQL JSONB → Objeto al leer
4. ✅ `formatRaffleResponse` detecta que ya es objeto
5. ✅ Retorna objeto directamente (sin JSON.parse)
6. ✅ Rifa creada exitosamente

---

## 🔗 RELACIÓN CON BUG #1

### **Bug #1: Validador Joi**
- **Problema:** prizeMeta requerido siempre
- **Fix:** prizeMeta condicional según modo
- **Commit:** `163bd8c`

### **Bug #2: JSON.parse**
- **Problema:** Intentar parsear objeto ya parseado
- **Fix:** Verificar tipo antes de parsear
- **Commit:** `08cf0ff`

**Ambos bugs debían corregirse para que la creación funcione:**
1. Bug #1 bloqueaba request en **validación** (HTTP 400)
2. Bug #2 bloqueaba request en **formateo de respuesta** (HTTP 500)

---

## 🚀 DEPLOYMENT

**Commit:** `08cf0ff`  
**Mensaje:** "fix: JSON.parse error en prize_meta - verificar si ya es objeto antes de parsear (PostgreSQL JSONB)"  
**Branch:** main  
**Status:** ✅ Pushed to GitHub  
**Railway:** Deploy automático en curso  
**ETA:** ~6:16pm (6 minutos desde las 6:10pm)

---

## 📚 LECCIONES APRENDIDAS

### **Problema General:**
PostgreSQL JSONB columns son devueltas como objetos JavaScript por el driver `pg`, no como strings JSON.

### **Solución General:**
Siempre verificar tipo antes de `JSON.parse()`:

```javascript
const parseIfNeeded = (value) => {
  if (!value) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
};

// Uso:
prizeMeta: parseIfNeeded(raffle.prize_meta),
companyConfig: parseIfNeeded(raffle.company_config),
```

### **Aplicable a:**
- ✅ Cualquier columna JSONB/JSON en PostgreSQL
- ✅ `prize_meta`, `company_config`, metadata columns
- ✅ Evitar asunciones sobre formato de datos

### **Best Practice:**
```javascript
// ❌ MAL - Asume que siempre es string:
data: JSON.parse(column)

// ✅ BIEN - Verifica tipo:
data: typeof column === 'string' ? JSON.parse(column) : column

// ✅ MEJOR - Función helper:
data: parseIfNeeded(column)
```

---

## 🔍 IMPACTO DEL FIX

### **Antes del Fix:**
- ❌ Validador corregido pero creación aún falla
- ❌ HTTP 500 en formatRaffleResponse
- ❌ Error: `"[object Object]" is not valid JSON`
- 🔴 **Severity:** Sistema de rifas 100% no funcional

### **Después del Fix:**
- ✅ Validador funciona correctamente
- ✅ formatRaffleResponse maneja objetos JSONB
- ✅ Creación de rifas debe funcionar completamente
- 🟢 **Severity:** Bug resuelto (pending testing)

---

## ✅ ESTADO FINAL

- ✅ Bug identificado con Railway logs
- ✅ Causa raíz localizada (JSON.parse de objeto)
- ✅ Fix implementado (type check)
- ✅ Commit y push exitoso
- ✅ Documentación completa generada
- ⏳ Pendiente: Deploy Railway (~6 minutos)
- ⏳ Pendiente: 3er intento de creación con Chrome DevTools

---

**Después de este deploy, el sistema de rifas debería estar 100% funcional para crear rifas en modo FUEGOS.** 🎉

**Próximo paso:** Esperar 6 minutos y reintentar creación de rifa con Chrome DevTools para confirmar que ambos bugs están resueltos.
