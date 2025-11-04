# 🔧 PLAN DE FIX COMPLETO SISTEMA TICTACTOE

## PROBLEMAS IDENTIFICADOS

### 1. ✅ RESUELTO - utils/xp.js no existe
**Commit:** 92f2754
**Solución:** Comentar requires de utils/xp temporalmente

### 2. 🔴 PENDIENTE - Timer múltiples mensajes
**Problema:** 
- Múltiples toasts "Se acabó el tiempo"
- Timer siempre en 0 segundos

**Archivos a revisar:**
- `frontend/src/pages/TicTacToeRoom.js` (timer component)
- `backend/socket/tictactoe.js` (timer events)

### 3. 🔴 PENDIENTE - Modal Game Over no aparece
**Problema:**
- Modal existe pero no se muestra
- Condición: `showGameOverModal && room?.status === 'finished'`

**Posibles causas:**
- Estado de sala no se actualiza a 'finished'
- showGameOverModal no se setea a true
- Error en la respuesta del backend

### 4. 🟡 EN PROCESO - Acreditación de premios
**Estado:** Fix aplicado, pendiente verificar
**Commit anterior:** 4364dda (related_id → reference)

### 5. 🔴 PENDIENTE - Sistema de revancha
**Dependencia:** Requiere que modal Game Over funcione primero

## SIGUIENTE PASO INMEDIATO

### FIX 1: Crear utils/xp.js mínimo funcional
```javascript
// backend/utils/xp.js
const logger = require('./logger');

async function awardXpBatch(awards) {
  // Implementación mínima
  logger.info('XP awards (placeholder):', { awards });
  return true;
}

module.exports = {
  awardXpBatch
};
```

### FIX 2: Revisar timer en frontend
- Verificar useEffect del timer
- Revisar eventos de socket
- Eliminar toasts duplicados

### FIX 3: Forzar modal en desarrollo
- Agregar logs para debug
- Verificar actualización de estado
- Revisar respuesta del backend al finalizar

## PRUEBAS NECESARIAS

1. ✅ Unirse a sala
2. ✅ Marcar listo
3. ✅ Iniciar partida
4. ⚠️ Hacer movimientos (error XP resuelto)
5. ❌ Ver modal ganador
6. ❌ Sistema revancha
7. ❌ Acreditación balance

## ESTADO ACTUAL
- Backend parcialmente funcional
- Frontend con problemas de visualización
- Sistema jugable pero sin feedback final
