# 🧪 PLAN DE TESTING - ETAPA 1: MODO FUEGOS

**Fecha:** 2025-11-04  
**Responsable:** Cascade AI + Usuario  
**Entorno:** Railway Production  
**URL:** https://confident-bravery-production-ce7b.up.railway.app

---

## 📋 PRE-REQUISITOS

### Usuarios de Prueba
1. **prueba1** / `123456789` (Comprador)
2. **prueba2** / `Mirame12veces.` (Host/Comprador)

### Navegadores
- Navegador normal: prueba1
- Modo incógnito: prueba2

### Chrome DevTools Activo
- Console abierta
- Network tab monitoreando
- Application > Storage verificando

---

## 🎯 CASOS DE PRUEBA

### TEST 1: Creación de Rifa Modo Fuegos

**Usuario:** prueba2 (host)  
**Objetivo:** Validar creación correcta

**Steps:**
1. Login como prueba2
2. Ir a `/games`
3. Click "Crear Rifa"
4. Configurar:
   - Nombre: "Test Modo Fuegos Etapa 1"
   - Modo: 🔥 Fuegos
   - Rango: 100 números (0-99)
   - Precio: 10 fuegos por número
   - Descripción: "Testing Etapa 1"
5. Click "Crear"

**Validaciones:**
- ✅ No se cobra fee de creación (solo modo premio)
- ✅ Rifa aparece en lista con status "pending"
- ✅ Redirect a `/games/raffle/{code}`
- ✅ Grid muestra 100 números disponibles (verde)

**Chrome DevTools:**
```
# Console
✓ Sin errores de JavaScript
✓ Log de creación exitosa

# Network
POST /api/raffles
Status: 200
Response: { success: true, data: { code: "...", status: "pending" } }

# Application > Local Storage
✓ user.fires_balance sin cambios (no se cobra)
```

---

### TEST 2: Compra Individual Sin CAPTCHA

**Usuario:** prueba1 (comprador)  
**Objetivo:** Validar compra directa modo fuegos

**Saldo inicial:** Verificar wallet de prueba1

**Steps:**
1. Login como prueba1 en navegador normal
2. Ir a la rifa creada en TEST 1
3. Click en número **5**
4. Click "Comprar Seleccionados (1)"
5. Confirmar compra

**Validaciones:**
- ✅ NO aparece CAPTCHA matemático
- ✅ Toast: "¡Compra exitosa! 1 número(s) adquirido(s)."
- ✅ Número 5 cambia a estado "sold" (azul con ícono de fuego)
- ✅ Balance de prueba1 se reduce en 10 fuegos
- ✅ Pot de rifa aumenta en 10 fuegos

**Chrome DevTools:**
```
# Console
POST /api/raffles/purchase
Payload: {
  raffle_id: "...",
  numbers: [5],
  mode: "fires"
}
Response: {
  success: true,
  message: "¡Compra exitosa! 1 número(s) adquirido(s).",
  data: { ... }
}

# Network
✓ Status 200
✓ Sin errores 400/500

# Application
localStorage.user.fires_balance: (inicial - 10)
```

---

### TEST 3: Compra Múltiple (Lote)

**Usuario:** prueba1  
**Objetivo:** Validar compra de varios números en una transacción

**Steps:**
1. En la misma rifa
2. Seleccionar números: **0, 12, 25**
3. Click "Comprar Seleccionados (3)"
4. Confirmar

**Validaciones:**
- ✅ Toast: "¡Compra exitosa! 3 número(s) adquirido(s)."
- ✅ Los 3 números cambian a "sold"
- ✅ Balance se reduce en 30 fuegos
- ✅ Pot aumenta en 30 fuegos

**Chrome DevTools:**
```
Payload: {
  raffle_id: "...",
  numbers: [0, 12, 25],
  mode: "fires"
}

Verificar transacción atómica:
- Si uno falla, ninguno se compra
- No hay estados inconsistentes
```

---

### TEST 4: Validación de Saldo Insuficiente

**Usuario:** prueba1  
**Objetivo:** Verificar que no se puede comprar sin balance

**Setup:**
1. Verificar balance actual de prueba1
2. Intentar comprar más números del que pueda pagar

**Steps:**
1. Seleccionar 50 números (costo: 500 fuegos)
2. Click "Comprar"

**Validaciones:**
- ✅ Error: "Balance insuficiente. Necesitas 500 fuegos."
- ✅ Toast rojo con mensaje de error
- ✅ Números NO se compran
- ✅ Balance NO cambia

**Chrome DevTools:**
```
# Console
Error: Balance insuficiente

# Network
POST /api/raffles/purchase
Status: 500 (o 400)
Response: {
  success: false,
  error: "Balance insuficiente. Necesitas 500 fuegos."
}
```

---

### TEST 5: Validación de Número Ya Vendido

**Usuario:** prueba2 (modo incógnito)  
**Objetivo:** Verificar que no se puede comprar número sold

**Steps:**
1. Login como prueba2 en incógnito
2. Ir a la misma rifa
3. Intentar seleccionar número **5** (ya comprado por prueba1)

**Validaciones:**
- ✅ Número 5 NO es seleccionable (disabled)
- ✅ Hover muestra "Vendido"
- ✅ Click no tiene efecto

---

### TEST 6: Actualización en Tiempo Real (Socket)

**Objetivo:** Validar WebSocket updates

**Setup:**
1. Navegador 1: prueba1 en la rifa
2. Navegador 2 (incógnito): prueba2 en la misma rifa

**Steps:**
1. En Navegador 1 (prueba1): Comprar número **42**
2. Observar Navegador 2 (prueba2)

**Validaciones:**
- ✅ Número 42 se actualiza a "sold" en Navegador 2 SIN refrescar
- ✅ Pot se actualiza en ambos navegadores
- ✅ Latencia < 2 segundos

**Chrome DevTools (Navegador 2):**
```
# Console
Socket event: raffle:update
Data: { raffleId, numbers: [{ number_idx: 42, state: "sold", ... }] }
```

---

### TEST 7: Cierre Automático al Completar

**Objetivo:** Validar que rifa se cierra automáticamente

**Steps:**
1. Comprar TODOS los números restantes (distribuir entre prueba1 y prueba2)
2. Observar cuando se compra el último número

**Validaciones:**
- ✅ Status cambia a "finished"
- ✅ Se selecciona un ganador aleatorio
- ✅ Toast: "¡Rifa finalizada! Ganador: número X"
- ✅ Distribución de premios:
  - 70% del pot al ganador
  - 20% al host (prueba2)
  - 10% a la plataforma
- ✅ Experiencia +2 a todos los participantes

**Chrome DevTools:**
```
# Console
POST /api/raffles/close (automático)
Response: {
  winner: { userId, number, prize },
  distributions: [...]
}

# Validar wallets
SELECT * FROM wallets WHERE user_id IN (prueba1, prueba2);
```

---

### TEST 8: Validación de Tickets Digitales

**Objetivo:** Verificar generación de tickets

**Steps:**
1. Ir a perfil de prueba1
2. Click "Mis Tickets"
3. Buscar tickets de la rifa de prueba

**Validaciones:**
- ✅ Todos los números comprados tienen ticket
- ✅ Cada ticket muestra: número, fecha, rifa, status
- ✅ QR code único por ticket
- ✅ Botón "Descargar PDF"

---

## 🔍 VALIDACIONES TÉCNICAS (DevTools)

### Base de Datos (Railway Console)

```sql
-- 1. Verificar números vendidos
SELECT 
    number_idx, state, owner_id, sold_at
FROM raffle_numbers
WHERE raffle_id = '{raffle_id}'
ORDER BY number_idx;

-- 2. Verificar compras
SELECT 
    u.username, rp.number, rp.cost_amount, rp.created_at
FROM raffle_purchases rp
JOIN users u ON rp.user_id = u.id
WHERE rp.raffle_id = '{raffle_id}'
ORDER BY rp.created_at;

-- 3. Verificar pot
SELECT pot_fires, pot_coins, status, winner_id
FROM raffles
WHERE id = '{raffle_id}';

-- 4. Verificar wallets
SELECT 
    u.username, w.fires_balance, w.coins_balance
FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE u.username IN ('prueba1', 'prueba2');
```

### Logs del Servidor (Railway)

```
# Buscar logs de compras
raffleService.purchaseNumbers
processFirePurchase
Compra modo fuegos completada

# Verificar transacciones
BEGIN
COMMIT
(no debe haber ROLLBACK)

# Verificar distribución
distributePrizes
70% winner, 20% host, 10% platform
```

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Objetivo | Estado |
|---------|----------|--------|
| Compras exitosas | 100% sin CAPTCHA | ⏳ |
| Tiempo de respuesta | < 500ms | ⏳ |
| Errores de transacción | 0 | ⏳ |
| Actualizaciones socket | < 2s latencia | ⏳ |
| Balance consistente | 100% correcto | ⏳ |
| Distribución premios | ± 0.01 fuegos | ⏳ |

---

## ⚠️ PROBLEMAS CONOCIDOS A OBSERVAR

1. **getRaffleDetails al final de compra**
   - Puede causar rollback si schema no coincide
   - Verificar que retorna correctamente

2. **Race conditions en compras simultáneas**
   - Dos usuarios comprando mismo número
   - Debe usar wallet locks

3. **Pot calculations**
   - Verificar que sumen correctamente
   - Sin fuegos "perdidos" o duplicados

---

## 📝 REPORTE FINAL

Al completar todos los tests, documentar:

### ✅ Tests Pasados
- [ ] TEST 1: Creación
- [ ] TEST 2: Compra individual
- [ ] TEST 3: Compra múltiple
- [ ] TEST 4: Saldo insuficiente
- [ ] TEST 5: Número vendido
- [ ] TEST 6: Socket updates
- [ ] TEST 7: Cierre automático
- [ ] TEST 8: Tickets digitales

### 🐛 Bugs Encontrados
```
1. [Descripción]
   - Severidad: Alta/Media/Baja
   - Reproducción: [pasos]
   - Fix propuesto: [solución]
```

### 📸 Screenshots
- Guardar capturas de consola con errores
- Screenshots de grid antes/después de compra
- Evidencia de distribución de premios

---

**Próximo paso:** Ejecutar migración y comenzar testing  
**Duración estimada:** 30-45 minutos  
**Criterio de éxito:** Todos los tests pasan sin errores críticos ✅
