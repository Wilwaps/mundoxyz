# FIX CRÍTICO: Desajuste de Índices en Números de Rifa

**Fecha:** 11 Nov 2025 17:15 UTC-4
**Commit:** [pending]
**Severidad:** BLOQUEANTE - Impide comprar último número

---

## 🔴 PROBLEMA IDENTIFICADO

### Síntoma
Al intentar comprar el **último número** de cualquier rifa:
1. ❌ Error: **"NOT_FOUND"** status 404
2. ❌ Usuario es expulsado de la sala
3. ❌ Mensaje: "Esta rifa no existe o fue eliminada"
4. ❌ El último número NUNCA puede ser comprado

### Evidencia en Logs
```
[RaffleController] Intentando reservar número code: "786110" idx: "9"
[RaffleServiceV2] Número reservado expiresAt: "2025-11-11T21:15:08.518Z"
[RaffleController] Intentando reservar número code: "786110" idx: "10"
[RaffleServiceV2] Error reservando número code: "NOT_FOUND" status: 404
[RaffleSocket] User ... left raffle 786110
```

---

## 🔍 CAUSA ROOT

### Desajuste entre Frontend y Backend

**Backend generaba números 0-based:**
```javascript
// Línea 1145 (ANTES - INCORRECTO)
for (let i = start; i < end; i++) {
  numbers.push(`(${raffleId}, ${i}, 'available')`);
}
```

**Rifa de 10 números creaba:**
```
number_idx: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
```

**Frontend mostraba números 1-based:**
```javascript
// NumberGrid.tsx línea 133
return Array.from({ length: totalNumbers }, (_, i) => i + 1);
```

**Frontend mostraba:**
```
Números: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
```

### El Problema

```
Usuario hace click en "10":
├── Frontend envía: idx=10
├── Backend busca: WHERE number_idx = 10
├── Base de datos tiene: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
└── Error: NOT_FOUND (no existe número con idx=10) ❌
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambio en Backend

**Archivo:** `backend/modules/raffles/services/RaffleServiceV2.js`

**Línea 1145 (DESPUÉS - CORRECTO):**
```javascript
// IMPORTANTE: Números 1-based (1, 2, 3, ..., N) para coincidir con frontend
for (let i = start; i < end; i++) {
  numbers.push(`(${raffleId}, ${i + 1}, 'available')`);
}
```

**Ahora genera:**
```
number_idx: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ✅
```

---

## 🔄 FLUJO CORREGIDO

```
Usuario hace click en "10":
├── Frontend envía: idx=10
├── Backend busca: WHERE number_idx = 10
├── Base de datos tiene: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
└── ✅ Número encontrado y reservado exitosamente
```

---

## ⚠️ IMPACTO EN RIFAS EXISTENTES

### Rifas Creadas ANTES del Fix

Las rifas creadas con el bug tendrán números 0-based:
- Número mostrado "1" → DB tiene idx=0 ✅ funciona
- Número mostrado "2" → DB tiene idx=1 ✅ funciona
- ...
- Número mostrado "10" → DB tiene idx=9 ✅ funciona

**¿Por qué funcionan?**

Porque el frontend envía el número mostrado, no el índice interno. Ejemplo:
- Usuario ve "10" en pantalla
- Frontend internamente genera índice `i + 1 = 10`
- Backend busca `number_idx = 10`

**En rifas viejas:**
- DB tiene: 0, 1, 2, ..., 9 (número 10 NO existe)
- Por eso falla ❌

### Rifas Creadas DESPUÉS del Fix

Las rifas creadas después tendrán números 1-based:
- Usuario ve "10" en pantalla
- Frontend envía `idx = 10`
- Backend busca `number_idx = 10`
- DB tiene: 1, 2, 3, ..., 10
- ✅ Funciona perfectamente

---

## 📋 MIGRACIÓN DE DATOS (OPCIONAL)

Si quieres arreglar rifas existentes, puedes ejecutar:

```sql
-- Actualizar números de rifas existentes de 0-based a 1-based
UPDATE raffle_numbers
SET number_idx = number_idx + 1
WHERE raffle_id IN (
  SELECT id FROM raffles 
  WHERE created_at < '2025-11-11 21:15:00' -- Fecha del fix
  AND status = 'active'
);
```

**⚠️ CUIDADO:** Esta migración puede causar problemas si hay reservas activas.

**Recomendación:** No ejecutar migración, solo dejar que rifas viejas se completen naturalmente.

---

## 🧪 TESTING

### Test 1: Crear Nueva Rifa
```
1. Crear rifa con 10 números
2. Verificar en DB: number_idx va de 1 a 10 ✅
3. Frontend muestra: 1, 2, 3, ..., 10 ✅
```

### Test 2: Comprar Último Número
```
1. Crear rifa con 10 números
2. Comprar números 1-9
3. Comprar número 10
4. RESULTADO ESPERADO:
   ✅ Reserva exitosa
   ✅ Compra exitosa
   ✅ NO error NOT_FOUND
   ✅ Usuario NO es expulsado
```

### Test 3: Rifa Completa
```
1. Crear rifa con 10 números
2. Comprar TODOS los números (1-10)
3. RESULTADO ESPERADO:
   ✅ Todos los números se compran
   ✅ Socket: raffle:drawing_scheduled
   ✅ Espera 10 segundos
   ✅ Ganador seleccionado
   ✅ Premios distribuidos
```

---

## 📦 ARCHIVOS MODIFICADOS

**Backend:**
- `backend/modules/raffles/services/RaffleServiceV2.js`
  - Línea 1145: Cambio de `${i}` a `${i + 1}`

**Documentación:**
- `RAFFLE_INDEX_MISMATCH_FIX.md` (este archivo)

---

## 🚀 DEPLOY

### Commit
```bash
git add backend/modules/raffles/services/RaffleServiceV2.js
git add RAFFLE_INDEX_MISMATCH_FIX.md
git commit -m "fix CRITICO: números 1-based para coincidir con frontend + evitar NOT_FOUND en último número"
git push
```

**Railway:** Auto-deploy ~6 min

---

## ✅ CHECKLIST POST-DEPLOY

### Crear Nueva Rifa (10 números)
- [ ] Crear rifa
- [ ] Verificar en Railway logs: números insertados 1-10
- [ ] Verificar frontend muestra: 1-10
- [ ] Click en número 1 → reserva exitosa
- [ ] Click en número 10 → reserva exitosa ✅ **ESTE ES EL TEST CRÍTICO**

### Comprar Último Número
- [ ] Comprar números 1-9
- [ ] Comprar número 10
- [ ] Verificar NO error NOT_FOUND
- [ ] Verificar usuario NO es expulsado
- [ ] Verificar sorteo se programa

### Rifa 636823 (Pendiente)
Esta rifa tiene el bug (números 0-9 en DB). Opciones:
1. **Cancelar y crear nueva** (recomendado)
2. Dejar que se complete naturalmente (número 10 fallará)
3. Migración manual (arriesgado)

**Recomendación:** Cancelar 636823 y crear nueva rifa de prueba.

---

## 💡 LECCIONES APRENDIDAS

### 1. Consistencia de Índices
**Siempre** usar la misma base de indexación en frontend y backend:
- 0-based: más común en programación
- 1-based: más intuitivo para usuarios

**Decisión:** Usar **1-based** para rifas (mejor UX).

### 2. Validación de Límites
Agregar tests que verifiquen:
```javascript
// Test: Último número debe existir
expect(numbers[totalNumbers - 1]).toBeDefined();
expect(numbers[0]).toBeDefined();
```

### 3. Logs Detallados
Los logs actuales fueron CRUCIALES para identificar el bug:
```
Intentando reservar número idx: "10"
Error: NOT_FOUND
```

---

## 🎯 CONCLUSIÓN

**Problema:**
- Desajuste de índices entre frontend (1-based) y backend (0-based)
- Último número NUNCA podía ser comprado

**Fix:**
- Cambio de `${i}` a `${i + 1}` en generación de números
- Ahora backend genera números 1-based igual que frontend

**Resultado esperado:**
- ✅ Todos los números (1-N) pueden ser comprados
- ✅ No más error NOT_FOUND en último número
- ✅ Rifas se completan correctamente

---

**Estado:** ✅ LISTO PARA DEPLOY
**Impacto:** CRÍTICO - Desbloquea compra de último número
**Testing:** REQUERIDO - Verificar rifa completa de 10 números
