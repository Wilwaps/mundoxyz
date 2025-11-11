# FIX CRÍTICO: No Se Puede Comprar Último Número de Rifa

**Fecha:** 11 Nov 2025 16:53 UTC-4
**Commit:** [pending]
**Severidad:** BLOQUEANTE - Impide completar rifas

---

## 🔴 PROBLEMA REPORTADO

### Síntoma
Al intentar comprar el **último número** de una rifa (número 10 de 10):
1. ❌ Usuario es expulsado de la sala
2. ❌ Mensaje: "Ya terminó" / "Already finished"
3. ❌ La rifa queda incompleta (9/10 vendidos)
4. ❌ NO se elige ganador
5. ❌ Sistema bloqueado

### Evidencia
```
GET /api/raffles/v2/410798/numbers
[RaffleServiceV2] User 4c6af114-8074-48f3-9abc-cd2194a8d01f left raffle 410798
```

**Rifa 636823 (prueba automatizada):**
- Vendidos: 9/10
- Falta: Número 10
- Estado: ACTIVA pero no permite comprar el último

---

## 🔍 CAUSA ROOT

### Condición Incorrecta en `checkAndFinishRaffle()`

**Archivo:** `backend/modules/raffles/services/RaffleServiceV2.js`

**Línea 749 (ANTES - INCORRECTO):**
```javascript
if (parseInt(total) === parseInt(sold) && parseInt(sold) > 0) {
  // Finalizar rifa
}
```

**Problema:** La condición **NO** verifica que `reserved === 0`.

### Flujo Problemático

```
Usuario compra número 9:
├── POST /purchase → sold=9, reserved=0
├── setImmediate(checkAndFinishRaffle)
│   ├── Limpia reservas expiradas
│   ├── Cuenta: sold=9, total=10, reserved=0
│   └── sold !== total → NO finaliza ✅

Usuario RÁPIDAMENTE compra número 10:
├── POST /reserve → sold=9, reserved=1
│
├── [RACE CONDITION]
│   checkAndFinishRaffle() del número 9 aún ejecutándose
│   ├── Limpia reservas (puede limpiar #10 si hubo latencia)
│   ├── Cuenta: sold=9 o 10, reserved=0
│   └── Si sold=10 → FINALIZA PREMATURAMENTE ❌
│
├── POST /purchase del #10
│   └── Error: Rifa ya está 'finished' ❌
│
└── Usuario expulsado ❌
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambio 1: Verificar `reserved === 0`

**Línea 749 (DESPUÉS - CORRECTO):**
```javascript
if (parseInt(total) === parseInt(sold) && 
    parseInt(sold) > 0 && 
    parseInt(reserved) === 0) {  // ← NUEVO
  logger.info('[RaffleServiceV2] ✅ Todos los números vendidos y sin reservas...');
  // Finalizar rifa
}
```

**Beneficio:** Ahora el sistema **NO finalizará** si hay reservas activas.

---

### Cambio 2: Logging Mejorado

**Líneas 779-788:**
```javascript
} else {
  const disponibles = parseInt(total) - parseInt(sold) - parseInt(reserved);
  logger.info('[RaffleServiceV2] Rifa aún no completa', {
    raffleId,
    total: parseInt(total),
    vendidos: parseInt(sold),
    reservados: parseInt(reserved),
    disponibles: disponibles,
    razon: parseInt(reserved) > 0 
      ? 'Hay reservas activas pendientes' 
      : 'Faltan números por vender'
  });
}
```

**Beneficio:** Logs más claros para debugging.

---

## 🔄 FLUJO CORREGIDO

```
Usuario compra número 9:
├── POST /purchase → sold=9, reserved=0
├── setImmediate(checkAndFinishRaffle)
│   ├── Limpia reservas expiradas
│   ├── Cuenta: sold=9, total=10, reserved=0
│   ├── Verifica: sold (9) === total (10) && reserved (0) === 0?
│   └── NO → Faltan números por vender ✅

Usuario compra número 10:
├── POST /reserve → sold=9, reserved=1
│   └── checkAndFinishRaffle()
│       ├── Limpia reservas expiradas
│       ├── Cuenta: sold=9, total=10, reserved=1
│       ├── Verifica: reserved (1) === 0?
│       └── NO → Hay reservas activas pendientes ✅
│
├── POST /purchase → sold=10, reserved=0
│   └── checkAndFinishRaffle()
│       ├── Limpia reservas expiradas
│       ├── Cuenta: sold=10, total=10, reserved=0
│       ├── Verifica: sold (10) === total (10) && reserved (0) === 0?
│       └── SÍ ✅ → PROGRAMAR SORTEO EN 10 SEGUNDOS
│           ├── Socket: raffle:drawing_scheduled
│           ├── [ESPERA 10 SEGUNDOS]
│           ├── finishRaffle(raffleId)
│           ├── Selecciona ganador
│           ├── Distribuye premios
│           └── Socket: raffle:winner_drawn ✅
```

---

## 🧪 TESTING ESPERADO

### Caso 1: Compra Rápida del Último Número
```
1. Crear rifa 10 números
2. Comprar números 1-9 rápidamente
3. Comprar número 10 INMEDIATAMENTE después de #9
4. RESULTADO ESPERADO:
   ✅ Número 10 se reserva
   ✅ Número 10 se compra
   ✅ Socket: raffle:drawing_scheduled
   ✅ Espera 10 segundos
   ✅ Ganador seleccionado
   ✅ Premios distribuidos
```

### Caso 2: Compra con Reserva Activa
```
1. Crear rifa 10 números
2. Comprar números 1-9
3. Usuario A reserva número 10 (no compra)
4. Usuario B intenta comprar otro número
5. RESULTADO ESPERADO:
   ✅ checkAndFinishRaffle() NO finaliza
   ✅ Logs: "Hay reservas activas pendientes"
   ✅ Rifa sigue ACTIVE
```

### Caso 3: Reserva Expira
```
1. Crear rifa 10 números
2. Comprar números 1-9
3. Usuario A reserva número 10
4. Esperar 5 minutos (expiración)
5. Usuario B compra otro número
6. RESULTADO ESPERADO:
   ✅ Limpieza libera número 10
   ✅ checkAndFinishRaffle() NO finaliza
   ✅ Logs: "Faltan números por vender"
```

---

## 📊 LOGS ESPERADOS (POST-FIX)

### Compra Número 9
```
[RaffleServiceV2] Comprando número
  raffleId: XXX, numberIdx: 9, userId: YYY
[RaffleServiceV2] Limpiando reservas expiradas
[RaffleServiceV2] Verificando finalización
  total: 10, sold: 9, reserved: 0
[RaffleServiceV2] Rifa aún no completa
  vendidos: 9, reservados: 0, disponibles: 1
  razon: "Faltan números por vender"
```

### Compra Número 10 - Reserva
```
[RaffleServiceV2] Reservando número
  raffleId: XXX, numberIdx: 10, userId: YYY
[RaffleServiceV2] Limpiando reservas expiradas
[RaffleServiceV2] Verificando finalización
  total: 10, sold: 9, reserved: 1
[RaffleServiceV2] Rifa aún no completa
  vendidos: 9, reservados: 1, disponibles: 0
  razon: "Hay reservas activas pendientes" ← CLAVE
```

### Compra Número 10 - Confirmación
```
[RaffleServiceV2] Comprando número
  raffleId: XXX, numberIdx: 10, userId: YYY
[RaffleServiceV2] Limpiando reservas expiradas
[RaffleServiceV2] Verificando finalización
  total: 10, sold: 10, reserved: 0
[RaffleServiceV2] ✅ Todos los números vendidos y sin reservas
  Programando finalización en 10 segundos
[Socket] Emitido: raffle:drawing_scheduled
[10 segundos después]
[RaffleServiceV2] Ganador seleccionado
  winnerId: ZZZ, prize: 7 fuegos
```

---

## 🔒 PROTECCIONES ADICIONALES

### Ya Implementadas

1. **`finishRaffle()` verifica estado:**
```javascript
// Línea 821
if (raffle.status !== RaffleStatus.ACTIVE) {
  logger.warn('Rifa no está activa');
  await client.query('ROLLBACK');
  return; // ← Sale sin hacer nada
}
```

2. **Limpieza de reservas antes de verificar:**
```javascript
// Línea 715
AND reserved_until < NOW() // ← Solo expiradas
```

3. **Transacciones atómicas:**
```javascript
// Línea 803
await client.query('BEGIN');
// ... operaciones ...
await client.query('COMMIT');
```

---

## 🚨 LIMITACIONES CONOCIDAS

### Race Condition Teórica Residual

Si dos usuarios intentan comprar el MISMO último número al MISMO tiempo:

```
Usuario A: Reserva #10
Usuario B: Intenta reservar #10 → Error "Not available"
Usuario A: Compra #10 → Éxito
```

**Esto es ESPERADO y CORRECTO.** Solo un usuario puede comprar cada número.

---

## 📦 ARCHIVOS MODIFICADOS

**Backend:**
- `backend/modules/raffles/services/RaffleServiceV2.js`
  - Línea 749: Agregado `&& parseInt(reserved) === 0`
  - Líneas 779-788: Logging mejorado con `razon`

---

## 🚀 DEPLOY

### Commit
```bash
git add backend/modules/raffles/services/RaffleServiceV2.js
git commit -m "fix CRITICO: verificar reserved=0 antes de finalizar rifa"
git push
```

**Railway:** Auto-deploy ~6 min

---

## ✅ CHECKLIST POST-DEPLOY

### Backend
- [ ] Railway logs sin errores
- [ ] Crear rifa de 10 números
- [ ] Comprar números 1-9
- [ ] Logs: "Faltan números por vender"
- [ ] Comprar número 10:
  - [ ] Logs: "Hay reservas activas pendientes"
  - [ ] Logs: "Todos los números vendidos y sin reservas"
  - [ ] Socket: `raffle:drawing_scheduled`
  - [ ] Espera 10 segundos
  - [ ] Ganador seleccionado
  - [ ] Premios distribuidos

### Rifa 636823 (Pendiente)
- [ ] Completar compra del número 10
- [ ] Verificar sorteo funciona
- [ ] Verificar distribución de premios (7/2/1 fuegos)

---

## 💡 MEJORAS FUTURAS (OPCIONAL)

### 1. Lock de Finalización
Prevenir múltiples ejecuciones simultáneas de `checkAndFinishRaffle()`:

```javascript
static finalizingRaffles = new Set();

async checkAndFinishRaffle(raffleId) {
  if (this.finalizingRaffles.has(raffleId)) {
    return; // Ya está finalizando
  }
  
  this.finalizingRaffles.add(raffleId);
  try {
    // ... lógica actual ...
  } finally {
    this.finalizingRaffles.delete(raffleId);
  }
}
```

### 2. Queue de Finalizaciones
Usar un job queue (Bull, BullMQ) para procesar finalizaciones de forma secuencial.

### 3. Database Lock
Usar `FOR UPDATE` en la query de verificación:

```sql
SELECT * FROM raffles WHERE id = $1 FOR UPDATE
```

---

## 🎯 CONCLUSIÓN

**Fix implementado:**
- ✅ Verifica `reserved === 0` antes de finalizar
- ✅ Logging mejorado para debugging
- ✅ Protege contra finalización prematura

**Resultado esperado:**
- ✅ Usuarios pueden comprar el último número sin ser expulsados
- ✅ Sorteo se programa correctamente después de vender todos los números
- ✅ Sistema completamente funcional

---

**Estado:** ✅ LISTO PARA DEPLOY
**Impacto:** CRÍTICO - Desbloquea sistema de rifas
**Testing:** REQUERIDO - Verificar en producción con rifa 636823
