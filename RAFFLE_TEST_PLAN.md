# PLAN DE PRUEBA: Flujo Completo de Rifas (10 números)

**Fecha:** 11 Nov 2025 00:51 UTC-4
**Objetivo:** Verificar flujo completo de creación, compra y finalización de rifa
**URL:** https://mundoxyz-production.up.railway.app

---

## 🎯 ESCENARIO DE PRUEBA

### Configuración de Rifa
- **Cantidad de números:** 10 (para prueba rápida)
- **Costo por número:** 100 fuegos
- **Modo:** Premio (sin costo de creación)
- **Premio:** 1000 fuegos (10 × 100)

### Distribución Esperada
- **Total pool:** 1000 fuegos
- **Ganador:** 700 fuegos (70%)
- **Creador:** 200 fuegos (20%)
- **Plataforma:** 100 fuegos (10%)

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Fase 1: Creación de Rifa
- [ ] Navegar a `/raffles`
- [ ] Clic en "Crear Rifa"
- [ ] Configurar:
  - Números totales: 10
  - Costo: 100 fuegos
  - Modo: fires
  - Tipo: prize (sin XP requerido)
- [ ] Verificar balance antes de crear
- [ ] Clic en "Crear Rifa"
- [ ] Verificar rifa creada sin errores
- [ ] Anotar código de rifa

**Verificaciones técnicas:**
```javascript
// Console debe mostrar:
✅ POST /api/raffles - 200 OK
✅ Rifa creada con código: XXXXXX
✅ Estado: active
```

---

### Fase 2: Compra de Números (1-10)
- [ ] Entrar a la rifa creada
- [ ] Seleccionar número 1
- [ ] Clic "Proceder al Pago"
- [ ] Confirmar compra
- [ ] Repetir para números 2-10

**Verificaciones técnicas:**
```javascript
// Por cada número:
✅ POST /api/raffles/v2/{code}/numbers/{idx}/reserve - 200 OK
✅ POST /api/raffles/v2/{code}/numbers/{idx}/purchase - 200 OK
✅ Socket: raffle:number_purchased
✅ UI actualiza estado del número a "sold"
```

**Punto crítico - Número 10 (último):**
```javascript
// Al comprar el número 10:
✅ POST /api/raffles/v2/{code}/numbers/10/purchase - 200 OK
✅ Backend: checkAndFinishRaffle() ejecutado
✅ Verificar: sold === total && reserved_active === 0
✅ Socket: raffle:state_update → status: 'finished'
✅ Socket: raffle:winner_drawn
```

---

### Fase 3: Finalización Automática
- [ ] Verificar que rifa cambia a estado "finished"
- [ ] Verificar que se selecciona ganador
- [ ] Verificar que se distribuyen premios

**Verificaciones técnicas:**
```javascript
// Logs Railway deben mostrar:
✅ [RaffleServiceV2] Verificando finalización
✅ total: 10, sold: 10, reserved_active: 0
✅ [RaffleServiceV2] Todos los números vendidos - Finalizando rifa
✅ [RaffleServiceV2] Sorteo completado
✅ Ganador: {winner_number}
✅ Premio distribuido: 700 fuegos al ganador
✅ Premio distribuido: 200 fuegos al creador
✅ Premio distribuido: 100 fuegos a plataforma
```

---

### Fase 4: Verificación de Balances

**Balance Creador (antes/después):**
```
Antes: X fuegos
Después: X + 200 fuegos (comisión de creador)
```

**Balance Ganador (antes/después):**
```
Antes: Y fuegos
Costo números: -100 fuegos × cantidad comprada
Premio: +700 fuegos
Neto: +700 - (100 × cantidad)
```

**Balance Plataforma:**
```
Admin (tg_id: 1417856820)
Antes: Z fuegos
Después: Z + 100 fuegos
```

---

## 🔍 PUNTOS DE FALLA CONOCIDOS (A VERIFICAR)

### 1. Race Condition en Último Número
**Descripción:** Al comprar el último número, `checkAndFinishRaffle()` se ejecuta ANTES de que la transacción de compra haga commit.

**Síntoma:**
```
❌ reserved_active: 1 (debería ser 0)
❌ Rifa NO se finaliza automáticamente
```

**Fix esperado (Commit 453a698):**
```sql
-- Verificar que cuenta reservas activas correctamente
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold,
  SUM(CASE WHEN state = 'reserved' AND reserved_until > NOW() THEN 1 ELSE 0 END) as reserved_active
FROM raffle_numbers
WHERE raffle_id = $1
```

**Resultado esperado:**
```
✅ Solo finaliza si sold === total Y reserved_active === 0
```

---

### 2. UI Reset Durante Socket Updates
**Descripción:** Al recibir `raffle:number_purchased`, la UI hace `invalidateQueries` y resetea temporalmente a 0.

**Síntoma:**
```
❌ Números desaparecen por 1-2 segundos
❌ "Parpadeo" en la interfaz
```

**Fix esperado (refetchQueries):**
```javascript
// Usar refetchQueries en lugar de invalidateQueries
queryClient.refetchQueries([RAFFLE_QUERY_KEYS.detail(code)])
queryClient.refetchQueries([RAFFLE_QUERY_KEYS.numbers(code)])
```

**Resultado esperado:**
```
✅ Números se actualizan sin "parpadear"
✅ Datos se mantienen durante actualización
```

---

### 3. Números Propios Vendidos - Color Cyan
**Descripción:** Números comprados por el usuario y luego vendidos deben verse en cyan brillante.

**Verificación visual:**
```css
// Debe aplicar:
bg-gradient-to-br from-cyan-400 to-cyan-600
ring-2 ring-cyan-400
shadow-lg shadow-cyan-500/50
```

**Resultado esperado:**
```
✅ Números propios vendidos destacan con color turquesa brillante
✅ Anillo y sombra cyan visibles
```

---

## 📊 DATOS A RECOPILAR

### Console Logs
```javascript
// Copiar todos los logs de:
- Network tab (filtrar por /raffles)
- Console (filtrar por [Raffle])
- WebSocket frames (tab WS)
```

### Railway Logs
```
// Buscar en logs:
- [RaffleController] líneas con código de rifa
- [RaffleServiceV2] checkAndFinishRaffle
- [RaffleServiceV2] finishRaffle
- Errores con código 404 NOT_FOUND
```

### Screenshots
- [ ] Estado inicial (rifa creada)
- [ ] Números 1-9 comprados
- [ ] Número 10 (último) justo antes de comprar
- [ ] Modal de compra del número 10
- [ ] Estado final (rifa finished, ganador seleccionado)
- [ ] Balances actualizados

---

## 🎯 CRITERIOS DE ÉXITO

### ✅ Prueba EXITOSA si:
1. Rifa se crea sin errores
2. 10 números se compran sin errores
3. Al comprar el número 10, rifa se finaliza AUTOMÁTICAMENTE
4. Ganador se selecciona correctamente
5. Premios se distribuyen (700/200/100)
6. Balances se actualizan correctamente
7. NO hay errores 404 NOT_FOUND
8. NO hay "parpadeos" en la UI
9. Números propios vendidos se ven en cyan

### ❌ Prueba FALLIDA si:
1. Error 404 al comprar último número
2. Rifa NO se finaliza automáticamente
3. Race condition detected (reserved_active !== 0)
4. Premios NO se distribuyen
5. UI "parpadea" o resetea a 0
6. Errores en console o Railway logs

---

## 📝 TEMPLATE DE REPORTE

```markdown
## RESULTADO DE PRUEBA

**Fecha:** [timestamp]
**Código de rifa:** [XXXXXX]
**Usuario:** [username]

### Fase 1: Creación ✅ / ❌
- Rifa creada: [SÍ/NO]
- Errores: [ninguno / detalles]

### Fase 2: Compra Números ✅ / ❌
- Números 1-9: [OK / errores]
- Número 10 (último): [OK / error 404 / race condition]

### Fase 3: Finalización ✅ / ❌
- Auto-finalizó: [SÍ/NO]
- Ganador seleccionado: [SÍ/NO]
- Número ganador: [X]

### Fase 4: Premios ✅ / ❌
- Ganador: [+700 fuegos / error]
- Creador: [+200 fuegos / error]
- Plataforma: [+100 fuegos / error]

### Logs Console
```
[pegar logs]
```

### Logs Railway
```
[pegar logs]
```

### Screenshots
[adjuntar]

### Conclusión
[ÉXITO / FALLO] - [descripción]
```

---

**Estado:** ✅ PREPARADO PARA PRUEBA
**Siguiente paso:** Login → Crear rifa → Comprar números → Verificar
