# FIX CRÍTICO: Limpieza de Reservas + Delay 10s en Sorteo

**Fecha:** 11 Nov 2025 00:57 UTC-4
**Commit:** [pending]
**Severidad:** CRÍTICA - Rifas no finalizan correctamente

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. Reservas No Expiran Automáticamente
**Síntoma:** 7 números quedan "reservados" indefinidamente
```
Vendidos: 2
Reservados: 7 ← BLOQUEADOS
Disponibles: 1
```

**Causa:** No se limpiaban reservas expiradas antes de verificar finalización

---

### 2. Error NOT_FOUND al Reservar
**Logs Railway:**
```
[RaffleController] Intentando reservar número code: "410798" idx: "10"
[RaffleServiceV2] Error reservando número code: "NOT_FOUND" status: 404
```

**Causa:** Rifa se marcaba como finalizada antes de liberar reservas

---

### 3. Sorteo Inmediato (Sin Delay)
**Requerimiento:** Ganador debe elegirse 10 segundos DESPUÉS de vender último número

**Antes:** Sorteo inmediato al vender último número
**Después:** Delay de 10 segundos + notificación

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambios en `checkAndFinishRaffle()`

**Archivo:** `backend/modules/raffles/services/RaffleServiceV2.js`

#### PASO 1: Limpiar Reservas Expiradas PRIMERO

```javascript
// ANTES: Solo verificaba
const checkResult = await query(
  `SELECT ... FROM raffle_numbers WHERE raffle_id = $1`,
  [raffleId]
);

// DESPUÉS: Limpia ANTES de verificar
const cleanResult = await query(
  `UPDATE raffle_numbers
   SET state = $1, owner_id = NULL, reserved_by = NULL, reserved_until = NULL
   WHERE raffle_id = $2 
     AND state = $3 
     AND reserved_until < NOW()
   RETURNING number_idx`,
  ['available', raffleId, 'reserved']
);

if (cleanResult.rows.length > 0) {
  logger.info('[RaffleServiceV2] Reservas expiradas liberadas', {
    raffleId,
    count: cleanResult.rows.length,
    numbers: cleanResult.rows.map(r => r.number_idx)
  });
}
```

**Beneficio:** Reservas expiradas se liberan AUTOMÁTICAMENTE antes de cada verificación.

---

#### PASO 2: Verificar Sin Contar Reservas Activas

```javascript
// ANTES: Contaba reserved_active con reserved_until > NOW()
SUM(CASE WHEN state = 'reserved' AND reserved_until > NOW() THEN 1 ELSE 0 END) as reserved_active

// DESPUÉS: Solo cuenta reserved (ya limpiadas las expiradas)
SUM(CASE WHEN state = 'reserved' THEN 1 ELSE 0 END) as reserved
```

**Lógica:**
1. Limpiamos expiradas
2. Las que quedan "reserved" son válidas
3. Solo finalizamos si NO hay ninguna reserva

---

#### PASO 3: Delay de 10 Segundos + Notificación

```javascript
// Solo finalizar si TODOS los números están vendidos
if (parseInt(total) === parseInt(sold) && parseInt(sold) > 0) {
  logger.info('[RaffleServiceV2] ✅ Todos los números vendidos - Programando finalización en 10 segundos', {
    raffleId
  });
  
  // Obtener código de rifa para socket
  const raffleCodeResult = await query(
    'SELECT code FROM raffles WHERE id = $1',
    [raffleId]
  );
  const raffleCode = raffleCodeResult.rows[0]?.code;
  
  // Emitir evento de sorteo programado
  if (raffleCode && global.io) {
    global.io.to(`raffle_${raffleCode}`).emit('raffle:drawing_scheduled', {
      code: raffleCode,
      drawInSeconds: 10,
      message: '¡Todos los números vendidos! Sorteo en 10 segundos...'
    });
  }
  
  // DELAY DE 10 SEGUNDOS antes de sorteo
  setTimeout(async () => {
    try {
      await this.finishRaffle(raffleId);
    } catch (err) {
      logger.error('[RaffleServiceV2] Error en finalización retrasada', err);
    }
  }, 10000); // 10 segundos
}
```

**Flujo:**
1. Se vende último número
2. Sistema detecta: `sold === total`
3. Emite socket: `raffle:drawing_scheduled`
4. **ESPERA 10 SEGUNDOS**
5. Ejecuta `finishRaffle()` → Sorteo
6. Emite socket: `raffle:winner_drawn`

---

## 📊 FLUJO COMPLETO MEJORADO

### Escenario: Rifa de 10 Números

```
Usuario compra número 1-9:
├── POST /api/raffles/v2/{code}/numbers/{idx}/purchase
├── checkAndFinishRaffle()
│   ├── Limpia reservas expiradas
│   ├── Verifica: sold (9) !== total (10)
│   └── No finaliza ✅
└── Socket: raffle:number_purchased

Usuario compra número 10 (último):
├── POST /api/raffles/v2/{code}/numbers/10/purchase
├── checkAndFinishRaffle()
│   ├── Limpia reservas expiradas (7 liberadas ✅)
│   ├── Verifica: sold (10) === total (10) ✅
│   ├── Socket: raffle:drawing_scheduled (10s countdown)
│   └── setTimeout(10000)
│       ├── [ESPERA 10 SEGUNDOS] ⏳
│       ├── finishRaffle(raffleId)
│       ├── Selecciona ganador
│       ├── Distribuye premios
│       └── Socket: raffle:winner_drawn ✅
└── Socket: raffle:number_purchased
```

---

## 🎯 EVENTOS SOCKET

### Nuevo Evento: `raffle:drawing_scheduled`

**Emitido:** Cuando se vende último número

**Payload:**
```javascript
{
  code: "410798",
  drawInSeconds: 10,
  message: "¡Todos los números vendidos! Sorteo en 10 segundos..."
}
```

**Frontend puede:**
- Mostrar countdown
- Bloquear UI temporalmente
- Animación de "preparando sorteo"

---

### Evento Existente: `raffle:winner_drawn`

**Emitido:** Después de 10 segundos, cuando sorteo completa

**Payload:**
```javascript
{
  code: "410798",
  winner: {
    userId: "...",
    username: "...",
    number: 7
  },
  prize: 700
}
```

---

## 🧪 TESTING REQUERIDO

### Caso 1: Reservas Expiradas Se Liberan
```
1. Crear rifa 10 números
2. Reservar números 2-8 (sin comprar)
3. Esperar 5 minutos (expirar)
4. Comprar número 1
   → checkAndFinishRaffle() libera 2-8 ✅
5. Números 2-8 deben estar "disponibles"
```

---

### Caso 2: Delay de 10 Segundos Funciona
```
1. Crear rifa 10 números
2. Comprar números 1-9
3. Comprar número 10
   → Socket: raffle:drawing_scheduled ✅
   → Logs: "Programando finalización en 10 segundos"
4. [ESPERAR 10 SEGUNDOS]
5. Socket: raffle:winner_drawn ✅
6. Premios distribuidos ✅
```

---

### Caso 3: No Hay Error NOT_FOUND
```
1. Crear rifa 10 números
2. Comprar todos los números
3. Verificar logs:
   ❌ NO debe aparecer: "Error reservando número code: NOT_FOUND"
   ✅ Debe aparecer: "Reservas expiradas liberadas"
   ✅ Debe aparecer: "Programando finalización en 10 segundos"
```

---

## 📦 ARCHIVOS MODIFICADOS

**Backend:**
- `backend/modules/raffles/services/RaffleServiceV2.js`
  - Líneas 705-777: `checkAndFinishRaffle()` reescrito
  - PASO 1: Limpieza de reservas
  - PASO 2: Verificación simplificada
  - PASO 3: Socket + setTimeout 10s

---

## 🚀 DEPLOY

### Commit
```bash
git add backend/modules/raffles/services/RaffleServiceV2.js
git commit -m "fix CRITICO: limpiar reservas expiradas + delay 10s en sorteo"
git push
```

**Railway:** Auto-deploy ~6 min

---

## ✅ CRITERIOS DE ÉXITO

### Backend ✅
- [ ] Reservas expiradas se liberan automáticamente
- [ ] Delay de 10 segundos funciona
- [ ] Socket `raffle:drawing_scheduled` emitido
- [ ] No hay error NOT_FOUND en logs
- [ ] Premios se distribuyen correctamente

### Frontend (Pendiente)
- [ ] Escuchar evento `raffle:drawing_scheduled`
- [ ] Mostrar countdown de 10 segundos
- [ ] Bloquear compras durante countdown
- [ ] Mostrar ganador después de delay

---

## 📝 NOTAS TÉCNICAS

### setTimeout vs setInterval
**Elección:** `setTimeout` (una vez)

**Razón:** Solo necesitamos ejecutar el sorteo UNA VEZ después de 10 segundos.

---

### Limpieza de Reservas
**Cuándo:** En cada llamada a `checkAndFinishRaffle()`

**Por qué:** 
- Asegura que solo números verdaderamente disponibles se cuenten
- Previene race conditions
- Libera números bloqueados automáticamente

---

### Transacciones
**Importante:** `finishRaffle()` usa transacción (`BEGIN/COMMIT`)

**Garantiza:**
- Atomicidad en distribución de premios
- Rollback si algo falla
- Consistencia de datos

---

**Estado:** ✅ IMPLEMENTADO EN BACKEND
**Pendiente:** Frontend countdown (opcional, mejora UX)
**Deploy:** Listo para push
