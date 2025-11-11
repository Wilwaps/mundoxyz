# 🧪 EJECUCIÓN DE PRUEBA: Rifa 10 Números - Flujo Completo

**Fecha:** 11 Nov 2025 16:39 UTC-4
**Objetivo:** Verificar flujo completo con fixes implementados
**URL:** https://mundoxyz-production.up.railway.app

---

## 📋 CONFIGURACIÓN DE PRUEBA

### Rifa a Crear
- **Tipo:** Fuegos (fires)
- **Modo:** Premio (prize)
- **Números totales:** 10
- **Costo por número:** 100 fuegos
- **Premio total:** 1000 fuegos

### Distribución Esperada
- **Ganador:** 700 fuegos (70%)
- **Creador:** 200 fuegos (20%)
- **Plataforma:** 100 fuegos (10%)

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Fase 1: Creación ✅
- [ ] Balance inicial anotado
- [ ] Rifa creada sin errores
- [ ] Código de rifa obtenido: _______
- [ ] Estado: ACTIVE
- [ ] 10 números disponibles

### Fase 2: Reserva y Compra (1-10) ✅
- [ ] Número 1: Reservado → Comprado ✅
- [ ] Número 2: Reservado → Comprado ✅
- [ ] Número 3: Reservado → Comprado ✅
- [ ] Número 4: Reservado → Comprado ✅
- [ ] Número 5: Reservado → Comprado ✅
- [ ] Número 6: Reservado → Comprado ✅
- [ ] Número 7: Reservado → Comprado ✅
- [ ] Número 8: Reservado → Comprado ✅
- [ ] Número 9: Reservado → Comprado ✅
- [ ] **Número 10 (CRÍTICO):**
  - [ ] Reservado correctamente
  - [ ] Comprado sin error NOT_FOUND
  - [ ] Socket: `raffle:drawing_scheduled` recibido
  - [ ] Mensaje: "Sorteo en 10 segundos..."

### Fase 3: Countdown 10 Segundos ⏳
- [ ] Tiempo inicio: __:__:__
- [ ] Socket recibido con drawInSeconds: 10
- [ ] No hay errores en console
- [ ] Tiempo transcurrido: ~10 segundos

### Fase 4: Sorteo y Ganador ✅
- [ ] Tiempo final: __:__:__
- [ ] Socket: `raffle:winner_drawn` recibido
- [ ] Ganador seleccionado: Número ___
- [ ] Estado rifa: FINISHED
- [ ] No hay error NOT_FOUND

### Fase 5: Distribución de Premios 💰
- [ ] **Ganador:**
  - Balance antes: ___
  - Balance después: ___
  - Premio: +700 fuegos ✅
- [ ] **Creador:**
  - Balance antes: ___
  - Balance después: ___
  - Comisión: +200 fuegos ✅
- [ ] **Plataforma:**
  - Balance antes: ___
  - Balance después: ___
  - Comisión: +100 fuegos ✅

---

## 🔍 LOGS ESPERADOS

### Backend Railway - Número 10 (Último)

```
[RaffleController] Intentando reservar número code: "XXXXX" idx: "10"
✅ [RaffleServiceV2] Número reservado exitosamente

[RaffleController] Intentando comprar número code: "XXXXX" idx: "10"
✅ [RaffleServiceV2] Limpiando reservas expiradas antes de verificar finalización
✅ [RaffleServiceV2] Reservas expiradas liberadas: count: 0 (o más si había)
✅ [RaffleServiceV2] Verificando finalización
    raffleId: XXX
    total: 10
    sold: 10
    reserved: 0
✅ [RaffleServiceV2] Todos los números vendidos - Programando finalización en 10 segundos
✅ Socket emitido: raffle:drawing_scheduled

[ESPERA 10 SEGUNDOS]

✅ [RaffleServiceV2] Ganador seleccionado
    raffleId: XXX
    winnerId: UUID
    winnerUsername: "@username"
    totalParticipants: 1
✅ Premio acreditado: 700 fuegos
✅ Comisión creador: 200 fuegos
✅ Comisión plataforma: 100 fuegos
✅ Socket emitido: raffle:winner_drawn
```

### Frontend Console - Eventos Socket

```javascript
✅ Socket connected to raffle_XXXXX
✅ raffle:number_purchased (× 10)
✅ raffle:drawing_scheduled {
    code: "XXXXX",
    drawInSeconds: 10,
    message: "¡Todos los números vendidos! Sorteo en 10 segundos..."
}
✅ [10 segundos después]
✅ raffle:winner_drawn {
    code: "XXXXX",
    winner: {
        userId: "...",
        username: "...",
        number: X
    },
    prize: 700
}
✅ raffle:state_update { status: "finished" }
```

---

## ❌ ERRORES A DETECTAR

### NO debe aparecer:
```
❌ Error reservando número code: "NOT_FOUND"
❌ Esta rifa no existe o fue eliminada
❌ Race condition detected
❌ Premios no distribuidos
❌ Socket timeout
❌ Transaction rollback
```

---

## 📊 MÉTRICAS A MEDIR

### Tiempos
- **Reserva + Compra número 1-9:** ~X segundos cada uno
- **Reserva + Compra número 10:** ~X segundos
- **Delay countdown:** **DEBE SER 10 segundos ± 1s**
- **Total desde compra #10 hasta ganador:** ~10-12 segundos

### Transacciones
- **Total gastado:** 1000 fuegos (10 × 100)
- **Total recibido (ganador):** 700 fuegos
- **Total recibido (creador):** 200 fuegos
- **Total recibido (plataforma):** 100 fuegos
- **Balance:** 1000 = 700 + 200 + 100 ✅

---

## 🎯 CRITERIOS DE ÉXITO

### ✅ PRUEBA EXITOSA SI:
1. ✅ Rifa creada sin errores
2. ✅ 10 números comprados sin error NOT_FOUND
3. ✅ Al comprar #10: Socket `drawing_scheduled` recibido
4. ✅ Countdown de 10 segundos funciona
5. ✅ Ganador seleccionado automáticamente
6. ✅ Premios distribuidos correctamente (700/200/100)
7. ✅ NO hay errores en console ni Railway
8. ✅ Estado final: FINISHED

### ❌ PRUEBA FALLIDA SI:
1. ❌ Error NOT_FOUND al reservar/comprar
2. ❌ Socket `drawing_scheduled` NO recibido
3. ❌ Countdown NO es de 10 segundos
4. ❌ Ganador NO seleccionado
5. ❌ Premios NO distribuidos
6. ❌ Errores en logs Railway

---

## 📝 TEMPLATE DE RESULTADOS

### RESULTADO FINAL

**Estado:** [ ] ÉXITO / [ ] FALLO

**Código de rifa:** _______

**Tiempo total:** ___ minutos ___ segundos

### Observaciones:
```
[Anotar aquí cualquier comportamiento inesperado, errores, warnings, etc.]
```

### Logs Console (Críticos):
```javascript
[Pegar logs relevantes]
```

### Logs Railway (Críticos):
```
[Pegar logs relevantes]
```

### Screenshots:
1. [ ] Rifa con 9 números comprados
2. [ ] Momento de comprar número 10
3. [ ] Mensaje "Sorteo en 10 segundos"
4. [ ] Ganador anunciado
5. [ ] Balances actualizados

---

## 🔧 COMANDOS ÚTILES

### Verificar Socket en Console
```javascript
// Ver eventos socket
window.addEventListener('message', (e) => console.log('Socket:', e));

// Ver estado de conexión
console.log('Socket connected:', socket?.connected);
```

### Verificar Balances
```javascript
// En Railway logs, buscar:
grep "Premio acreditado" logs
grep "Comisión" logs
grep "Balance before/after" logs
```

---

**Estado:** 🔄 EN EJECUCIÓN
**Inicio:** 16:39 UTC-4
