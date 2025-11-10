# 🔍 ANÁLISIS COMPLETO: Flujo de Rifas - Estado Actual y Problemas Críticos

**Fecha**: 2025-11-10 10:21  
**Severidad**: CRÍTICA - Sistema incompleto  

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. ❌ Sistema de Expiración de Reservas NO FUNCIONA

**Estado Actual**:
- ✅ Función `cleanExpiredReservations()` existe en `RaffleServiceV2.js`
- ❌ **NO HAY SCHEDULER** que la ejecute periódicamente
- ❌ Reservas nunca expiran automáticamente
- ❌ Números quedan bloqueados indefinidamente

**Impacto**:
- Rifa 890052, número 1: reservado indefinidamente por bug
- Usuarios no pueden comprar números "fantasma" reservados
- Sistema de reservas inútil

**Solución Requerida**:
- Implementar cron job cada 30 segundos
- Emitir evento WebSocket cuando se liberen números
- Log detallado de liberaciones

---

### 2. ❌ NO EXISTE FLUJO DE FINALIZACIÓN AUTOMÁTICA

**Estado Actual**:
- ❌ No hay función `finishRaffle()` o `selectWinner()`
- ❌ Cuando se vende el último número, **NO PASA NADA**
- ❌ Rifas quedan en estado "active" indefinidamente
- ❌ Ganadores no se seleccionan
- ❌ Premios no se acreditan

**Impacto**:
- Modo FIRES: sin ganador automático
- Modo PRIZE: sin sorteo
- Usuarios esperan indefinidamente
- Sistema incompleto e inoperante

**Solución Requerida**:
1. Detectar venta del último número en `purchaseNumber()`
2. Trigger automático de finalización
3. Seleccionar ganador aleatorio
4. Acreditar premio al ganador
5. Actualizar estado a "FINISHED"
6. Emitir evento WebSocket a todos los participantes

---

### 3. ❌ NO EXISTE SISTEMA DE NOTIFICACIONES

**Estado Actual**:
- ❌ No hay tabla de mensajes/inbox
- ❌ No hay servicio de notificaciones
- ❌ Usuarios no reciben avisos de:
  - Rifa finalizada
  - Ganador anunciado
  - Premio recibido
  - Reembolsos

**Solución Requerida**:
- Crear tabla `user_messages` o `notifications`
- Servicio de notificaciones
- WebSocket real-time
- Historial persistente

---

### 4. ✅ PROBLEMA WALLET_ID CORREGIDO (Commit ce55277)

**Estado**: RESUELTO
- ✅ `purchaseNumber()` usa `wallet.id` (INTEGER)
- ❌ `cancelRaffle()` TODAVÍA tiene el bug (commit actual)

---

## 📋 FLUJO ESPERADO vs REALIDAD

### MODO FIRES (Pot compartido)

#### ESPERADO:
```
1. Usuario compra número → ✅ OK
2. Dinero va al pot → ✅ OK (commit ce55277)
3. Último número vendido → ❌ NO DETECTA
4. Sistema selecciona ganador aleatorio → ❌ NO EXISTE
5. Ganador recibe pot completo → ❌ NO ACREDITA
6. Todos reciben notificación → ❌ NO NOTIFICA
7. Rifa pasa a FINISHED → ❌ QUEDA ACTIVE
```

#### REALIDAD ACTUAL:
```
1. Usuario compra último número
2. Pago se procesa ✅
3. Pot se actualiza ✅
4. ... FIN (nada más pasa)
5. Rifa queda en "active" indefinidamente ❌
6. Usuarios esperan sin saber qué pasó ❌
```

---

### MODO PRIZE (Premio externo)

#### ESPERADO:
```
1. Organizador define premio
2. Usuarios compran números GRATIS
3. Último número → sorteo automático
4. Ganador recibe notificación
5. Organizador entrega premio manualmente
6. Sistema registra entrega
```

#### REALIDAD ACTUAL:
```
❌ Completamente no implementado
```

---

## 🛠️ IMPLEMENTACIÓN REQUERIDA

### Fase 1: URGENTE (Hoy)

#### 1.1 Scheduler de Limpieza de Reservas
```javascript
// backend/server.js o módulo aparte
setInterval(async () => {
  try {
    const expired = await raffleService.cleanExpiredReservations();
    
    // Emitir eventos WebSocket por rifa
    for (const [raffleId, numbers] of Object.entries(expired)) {
      io.to(`raffle_${raffleId}`).emit('numbers:released', {
        numbers,
        reason: 'expired'
      });
    }
  } catch (err) {
    logger.error('[Scheduler] Error limpiando reservas', err);
  }
}, 30000); // Cada 30 segundos
```

#### 1.2 Finalización Automática
```javascript
// En RaffleServiceV2.js después de purchaseNumber()
async finishRaffleIfComplete(raffleId) {
  // Verificar si todos los números están vendidos
  const { rows } = await query(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN state = 'sold' THEN 1 ELSE 0 END) as sold
    FROM raffle_numbers
    WHERE raffle_id = $1
  `, [raffleId]);
  
  if (rows[0].total === rows[0].sold) {
    // Todos vendidos → finalizar
    return await this.finishRaffle(raffleId);
  }
}
```

#### 1.3 Selección de Ganador
```javascript
async finishRaffle(raffleId) {
  const raffle = await this.getRaffleById(raffleId);
  
  if (raffle.mode === 'fires' || raffle.mode === 'prize') {
    // Obtener participantes
    const { rows: participants } = await query(`
      SELECT DISTINCT owner_id, u.telegram_username
      FROM raffle_numbers rn
      JOIN users u ON u.id = rn.owner_id
      WHERE rn.raffle_id = $1 AND rn.state = 'sold'
    `, [raffleId]);
    
    // Seleccionar ganador aleatorio
    const winner = participants[Math.floor(Math.random() * participants.length)];
    
    // Acreditar premio
    if (raffle.mode === 'fires') {
      const prize = raffle.pot_fires || raffle.pot_coins;
      const currency = raffle.pot_fires > 0 ? 'fires' : 'coins';
      
      await this.awardPrize(winner.owner_id, prize, currency, raffleId);
    }
    
    // Actualizar rifa
    await query(`
      UPDATE raffles
      SET status = 'finished',
          winner_id = $1,
          finished_at = NOW()
      WHERE id = $2
    `, [winner.owner_id, raffleId]);
    
    // Notificar a todos
    await this.notifyRaffleFinished(raffleId, winner);
    
    return { success: true, winner };
  }
}
```

#### 1.4 Sistema de Notificaciones Básico
```javascript
// Crear tabla temporal (después migración formal)
async notifyRaffleFinished(raffleId, winner) {
  const raffle = await this.getRaffleById(raffleId);
  const { rows: participants } = await query(`
    SELECT DISTINCT owner_id
    FROM raffle_numbers
    WHERE raffle_id = $1 AND state = 'sold'
  `, [raffleId]);
  
  for (const p of participants) {
    const isWinner = p.owner_id === winner.owner_id;
    const message = isWinner
      ? `🎉 ¡Felicidades! Ganaste la rifa ${raffle.code}. Premio: ${raffle.pot_fires} 🔥`
      : `La rifa ${raffle.code} finalizó. Ganador: @${winner.telegram_username}`;
    
    // TODO: Guardar en tabla notifications
    // Por ahora: log + WebSocket
    logger.info('[Notification]', { userId: p.owner_id, message });
    
    io.to(`user_${p.owner_id}`).emit('notification', {
      type: 'raffle_finished',
      raffleId,
      winner: winner.telegram_username,
      message
    });
  }
}
```

---

### Fase 2: CORTO PLAZO (Esta semana)

1. **Tabla de notificaciones persistente**
2. **Panel de mensajes en frontend**
3. **Historial de rifas finalizadas**
4. **Estadísticas de ganadores**
5. **Sistema de reclamación de premios (modo PRIZE)**

---

## 🚨 ACCIONES INMEDIATAS

### Commit Actual (ce55277 pendiente push):
- ✅ Fix wallet_id en `cancelRaffle()`

### Próximos commits necesarios:
1. **Scheduler de reservas** (30 min)
2. **Finalización automática** (1 hora)
3. **Selección de ganador** (30 min)
4. **Notificaciones básicas** (30 min)
5. **Testing completo** (1 hora)

**Tiempo total estimado**: 3.5 horas

---

## 📊 CONFIRMACIÓN SOLICITADA

### Preguntas del usuario:

**Q1**: ¿El modo FIRES elige ganador automáticamente cuando se vende el último número?
**A**: ❌ **NO** - Actualmente no existe este flujo. Necesita implementarse.

**Q2**: ¿Todos los participantes reciben mensaje en su buzón?
**A**: ❌ **NO** - No hay sistema de mensajes/inbox. Solo WebSocket en tiempo real (si están conectados).

**Q3**: ¿Al ganador se le acredita correctamente el monto?
**A**: ❌ **NO** - No hay función que acredite el premio. Necesita implementarse.

**Q4**: ¿El flujo está correcto?
**A**: ❌ **NO** - El sistema está incompleto. Falta ~40% de la funcionalidad core.

---

## ✅ PLAN DE ACCIÓN

1. ✅ **INMEDIATO**: Commit fix wallet_id en cancelRaffle
2. 🔄 **HOY**: Implementar scheduler + finalización + ganador
3. 📅 **MAÑANA**: Tabla notificaciones + frontend inbox
4. 🧪 **TESTING**: Rifas completas end-to-end
5. 📝 **DOCS**: Actualizar documentación de flujos

---

**ESTADO GENERAL**: 🔴 Sistema incompleto - Necesita trabajo urgente antes de producción real
