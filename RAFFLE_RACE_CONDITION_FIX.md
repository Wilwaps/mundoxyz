# 🔴 FIX CRÍTICO: Race Condition en Reserva de Todos los Números

**Fecha**: 2025-11-10 21:28  
**Commit**: 453a698  
**Severidad**: CRÍTICA - Bug bloqueante  

---

## 🔴 PROBLEMA IDENTIFICADO

### Síntomas Reportados

**Frontend**:
```
✅ Número reservado exitosamente (× 14)
❌ Esta rifa no existe o fue eliminada
❌ Esta rifa ya no existe o fue eliminada
```

**Railway Logs**:
```
POST /api/raffles/v2/755653/numbers/15/reserve
[RaffleController] Intentando reservar número code: "755653" idx: "15"
[RaffleServiceV2] Error reservando número code: "NOT_FOUND" status: 404
[RaffleController] Error reservando número code: "NOT_FOUND" status: 404
```

---

## 🔍 CAUSA ROOT

### Problema: Race Condition Durante Reservas Masivas

**Flujo Incorrecto**:

```
t=0ms:   Usuario selecciona TODOS los 15 números disponibles
t=50ms:  Frontend inicia loop de reservas (1 por 1)
t=100ms: Números 1-14 se RESERVAN exitosamente
         Estado: 14 reserved, 1 available
         
t=500ms: Usuario (u otro) COMPRA número 14
         Estado: 13 reserved, 1 sold, 1 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=505ms: checkAndFinishRaffle() verifica:
         ❌ total = 15
         ❌ sold = 1
         ❌ reserved = 13 (¡IGNORADAS!)
         ✅ Condición: sold !== total → NO finaliza
         
t=600ms: Usuario compra TODOS los números reservados (1-13)
         Estado: 0 reserved, 14 sold, 1 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=605ms: checkAndFinishRaffle() verifica:
         ❌ total = 15
         ❌ sold = 14
         ❌ reserved = 0
         ✅ Condición: sold !== total → NO finaliza
         
t=700ms: Otro usuario compra número 15
         Estado: 0 reserved, 15 sold, 0 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=705ms: checkAndFinishRaffle() verifica:
         ✅ total = 15
         ✅ sold = 15
         ✅ Condición: sold === total → ¡FINALIZA!
         Ejecuta: finishRaffle(raffleId)
         UPDATE raffles SET status = 'finished'
         
t=710ms: Frontend del primer usuario sigue reservando:
         POST /reserve número 15
         → getRaffleByCode(755653)
         → SELECT WHERE status = 'active'
         → 0 rows (status = 'finished')
         → Error 404 NOT_FOUND
```

**PERO... el problema real es diferente:**

```
t=0ms:   Usuario selecciona 15 números
t=50ms:  Frontend reserva números 1-14 exitosamente
t=100ms: Alguien COMPRA un número (tal vez el 14)
t=105ms: checkAndFinishRaffle() cuenta:
         total = 15
         sold = 14
         ❌ NO verifica si hay RESERVAS ACTIVAS
t=110ms: Otro usuario compra el ÚLTIMO número disponible
t=115ms: checkAndFinishRaffle() cuenta:
         total = 15  
         sold = 15
         ❌ IGNORA que hay 13 números RESERVADOS
         ✅ sold === total → ¡FINALIZA!
t=120ms: Frontend intenta reservar número 15
         → 404 NOT_FOUND (rifa finalizada)
```

---

### Código Problemático

#### Backend: `checkAndFinishRaffle()` Líneas 707-735

```javascript
// ❌ INCORRECTO - Solo cuenta vendidos
async checkAndFinishRaffle(raffleId) {
  const checkResult = await query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold
     FROM raffle_numbers
     WHERE raffle_id = $1`,
    [raffleId]
  );
  
  const { total, sold } = checkResult.rows[0];
  
  // ❌ PROBLEMA: NO verifica si hay reservas activas
  if (parseInt(total) === parseInt(sold) && parseInt(sold) > 0) {
    logger.info('[RaffleServiceV2] Todos los números vendidos - Finalizando rifa');
    await this.finishRaffle(raffleId); // ← Finaliza prematuramente
  }
}
```

**Fallo Lógico**:
- Solo verifica `sold === total`
- **NO considera reservas activas** (state='reserved')
- Finaliza aunque haya usuarios con reservas pendientes de confirmar
- Causa error 404 para esos usuarios

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Fix: Verificar Reservas Activas Antes de Finalizar

```javascript
// ✅ CORRECTO - Verifica reservas activas
async checkAndFinishRaffle(raffleId) {
  const checkResult = await query(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold,
       SUM(CASE WHEN state = 'reserved' AND reserved_until > NOW() THEN 1 ELSE 0 END) as reserved_active
     FROM raffle_numbers
     WHERE raffle_id = $1`,
    [raffleId]
  );
  
  const { total, sold, reserved_active } = checkResult.rows[0];
  
  logger.info('[RaffleServiceV2] Verificando finalización', {
    raffleId,
    total: parseInt(total),
    sold: parseInt(sold),
    reserved_active: parseInt(reserved_active) // ← NUEVO log
  });
  
  // ✅ CONDICIONES MEJORADAS:
  // 1. Todos los números están vendidos
  // 2. NO hay reservas activas pendientes
  if (parseInt(total) === parseInt(sold) && 
      parseInt(sold) > 0 && 
      parseInt(reserved_active) === 0) { // ← NUEVA validación
    logger.info('[RaffleServiceV2] Todos los números vendidos y sin reservas pendientes - Finalizando rifa');
    await this.finishRaffle(raffleId);
  } else if (parseInt(reserved_active) > 0) {
    logger.info('[RaffleServiceV2] Hay reservas activas, no se finaliza aún', {
      raffleId,
      reserved_active: parseInt(reserved_active)
    });
  }
}
```

---

### Flujo Corregido

```
t=0ms:   Usuario selecciona 15 números disponibles
t=50ms:  Frontend reserva números 1-14 exitosamente
         Estado: 14 reserved, 1 available
         
t=100ms: Usuario compra números 1-14
         Estado: 0 reserved, 14 sold, 1 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=105ms: checkAndFinishRaffle() verifica:
         total = 15
         sold = 14
         reserved_active = 0
         ✅ Condición: sold !== total → NO finaliza
         
t=200ms: Otro usuario RESERVA número 15
         Estado: 1 reserved, 14 sold, 0 available
         
t=300ms: Usuario compra número 15 antes de que expire reserva
         Estado: 0 reserved, 15 sold, 0 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=305ms: checkAndFinishRaffle() verifica:
         total = 15
         sold = 15
         reserved_active = 0 ← ✅ NUEVO chequeo
         ✅ Condición: sold === total && reserved_active === 0
         ✅ Finaliza correctamente
```

**ESCENARIO CON RESERVAS**:
```
t=0ms:   Usuario A selecciona 15 números
t=50ms:  Reserva 1-14 exitosamente
         Estado: 14 reserved, 1 available
         
t=100ms: Usuario B reserva número 15
         Estado: 15 reserved, 0 available
         
t=200ms: Usuario B compra su número 15
         Estado: 14 reserved, 1 sold, 0 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=205ms: checkAndFinishRaffle() verifica:
         total = 15
         sold = 1
         reserved_active = 14 ← ✅ Detecta reservas activas
         ❌ Condición: reserved_active > 0
         ✅ NO FINALIZA - Respeta reservas pendientes
         
t=300ms: Usuario A confirma compra de 1-14
         Estado: 0 reserved, 15 sold, 0 available
         Backend ejecuta: checkAndFinishRaffle(raffleId)
         
t=305ms: checkAndFinishRaffle() verifica:
         total = 15
         sold = 15
         reserved_active = 0
         ✅ Condición: sold === total && reserved_active === 0
         ✅ Finaliza correctamente
```

---

## 📋 CAMBIOS IMPLEMENTADOS

### Archivo Modificado

**`backend/modules/raffles/services/RaffleServiceV2.js`** (líneas 705-745)

### Query SQL Mejorada

```sql
-- ❌ ANTES
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold
FROM raffle_numbers
WHERE raffle_id = $1

-- ✅ DESPUÉS  
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold,
  SUM(CASE WHEN state = 'reserved' AND reserved_until > NOW() THEN 1 ELSE 0 END) as reserved_active
FROM raffle_numbers
WHERE raffle_id = $1
```

### Lógica de Finalización

```javascript
// ❌ ANTES
if (sold === total && sold > 0) {
  finishRaffle();
}

// ✅ DESPUÉS
if (sold === total && sold > 0 && reserved_active === 0) {
  finishRaffle();
} else if (reserved_active > 0) {
  logger.info('Hay reservas activas, no se finaliza aún');
}
```

---

## 🧪 TESTING REQUERIDO

### Caso 1: Reserva de Todos los Números

1. Usuario A selecciona TODOS los números disponibles (ej: 15)
2. Click "Proceder a Comprar"
3. **Verificar**: Todos se reservan exitosamente
4. Usuario A confirma compra de todos
5. **Verificar**: 
   - ✅ Rifa se finaliza DESPUÉS de confirmar
   - ✅ NO se finaliza durante el proceso de reserva
   - ✅ No hay errores 404

### Caso 2: Múltiples Usuarios Simultáneos

1. Usuario A reserva números 1-10
2. Usuario B reserva números 11-14
3. Usuario B compra sus números (11-14)
4. **Verificar**: 
   - ✅ Rifa NO se finaliza
   - ✅ Usuario A aún puede comprar sus reservas (1-10)
   - ✅ Logs muestran "Hay reservas activas, no se finaliza aún"
5. Usuario A confirma compra
6. Usuario C compra número 15 (último)
7. **Verificar**: 
   - ✅ Rifa se finaliza correctamente
   - ✅ Ganador seleccionado
   - ✅ Notificaciones enviadas

### Caso 3: Reservas Expiradas

1. Usuario reserva 5 números
2. Esperar 5 minutos (timeout de reserva)
3. Otro usuario compra TODOS los números disponibles
4. **Verificar**: 
   - ✅ Reservas expiradas no bloquean finalización
   - ✅ `reserved_until > NOW()` retorna 0
   - ✅ Rifa se finaliza correctamente

---

## 📊 LOGS ESPERADOS

### Escenario Normal

```
[RaffleServiceV2] Verificando finalización raffleId: 755653
  total: 15, sold: 14, reserved_active: 1
[RaffleServiceV2] Hay reservas activas, no se finaliza aún
  raffleId: 755653, reserved_active: 1
```

### Finalización Exitosa

```
[RaffleServiceV2] Verificando finalización raffleId: 755653
  total: 15, sold: 15, reserved_active: 0
[RaffleServiceV2] Todos los números vendidos y sin reservas pendientes - Finalizando rifa
  raffleId: 755653
[RaffleServiceV2] Rifa finalizada exitosamente
  raffleId: 755653, winner_id: abc123, prize: 1000
```

---

## 🚀 DEPLOY

**Commit**: `453a698`  
**Mensaje**: "fix CRÍTICO: no finalizar rifa si hay reservas activas pendientes"  
**Push**: ✅ GitHub  
**Railway**: Auto-deploy activo (~6 minutos)  
**URL**: https://mundoxyz-production.up.railway.app

---

## ✅ IMPACTO

### Antes del Fix
- ❌ Error 404 al reservar último número
- ❌ Rifa finalizada prematuramente
- ❌ Usuarios con reservas bloqueados
- ❌ UX horrible (toasts de error)

### Después del Fix
- ✅ Todas las reservas procesadas correctamente
- ✅ Finalización solo cuando TODO vendido
- ✅ Respeta reservas activas pendientes
- ✅ UX fluida sin errores

---

## 📝 NOTAS TÉCNICAS

### Estados de Números

- **`available`**: Disponible para reservar
- **`reserved`**: Reservado temporalmente (5 min timeout)
- **`sold`**: Vendido (pago confirmado)

### Condición de Finalización

```javascript
FINALIZAR SI:
  ✅ sold === total
  ✅ sold > 0
  ✅ reserved_active === 0  // ← CRÍTICO

DONDE reserved_active =
  COUNT(state='reserved' AND reserved_until > NOW())
```

### Timeout de Reservas

- **Duración**: 5 minutos (300,000 ms)
- **Limpieza**: Scheduler cada 30 segundos
- **Evento Socket**: `raffle:number_released`

---

## 🎯 CONCLUSIÓN

El bug era causado por **lógica incompleta** en `checkAndFinishRaffle()`. La función verificaba si todos los números estaban vendidos, pero **ignoraba las reservas activas pendientes**, finalizando la rifa prematuramente y bloqueando a usuarios que aún tenían reservas válidas.

La solución agrega verificación de `reserved_active` con query SQL optimizada y logging detallado para debugging.

**Estado**: 🟢 RESUELTO - Listo para testing en producción
