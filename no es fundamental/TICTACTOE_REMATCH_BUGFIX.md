# 🐛 Bug Fix: Sistema de Revanchas en TicTacToe

**Fecha**: 29 de Octubre, 2025  
**Módulo**: La Vieja (TicTacToe)  
**Prioridad**: Alta  
**Estado**: ✅ Resuelto

---

## 🔍 Problemas Identificados

### **Problema 1: Estado desactualizado en callbacks de Socket**
**Ubicación**: `frontend/src/pages/TicTacToeRoom.js:257`

**Descripción**: 
El handler de socket `handleRematchRequest` utilizaba el valor del closure de `rematchRequested` en lugar de usar una función de actualización de estado. Esto causaba que el estado no se actualizara correctamente cuando el oponente solicitaba revancha.

**Código problemático**:
```javascript
const handleRematchRequest = (data) => {
  if (data.roomCode === code && data.playerId !== user?.id) {
    setRematchRequested({ ...rematchRequested, byOpponent: true }); // ❌ Closure desactualizado
    toast('El oponente solicita revancha');
  }
};
```

**Solución aplicada**:
```javascript
const handleRematchRequest = (data) => {
  if (data.roomCode === code && data.playerId !== user?.id) {
    setRematchRequested(prev => ({ ...prev, byOpponent: true })); // ✅ Función de actualización
    toast('El oponente solicita revancha');
  }
};
```

---

### **Problema 2: Estado desactualizado en mutation callback**
**Ubicación**: `frontend/src/pages/TicTacToeRoom.js:167`

**Descripción**: 
El callback `onSuccess` de la mutación `rematchMutation` tenía el mismo problema de closure desactualizado.

**Código problemático**:
```javascript
onSuccess: (data) => {
  if (data.rematchAccepted) {
    toast.success(`¡Revancha aceptada! Sala: ${data.newRoomCode}`);
    navigate(`/tictactoe/room/${data.newRoomCode}`);
  } else {
    setRematchRequested({ ...rematchRequested, byMe: true }); // ❌ Closure desactualizado
    toast.success('Revancha solicitada. Esperando al oponente...');
  }
}
```

**Solución aplicada**:
```javascript
onSuccess: (data) => {
  if (data.rematchAccepted) {
    toast.success(`¡Revancha aceptada! Sala: ${data.newRoomCode}`);
    navigate(`/tictactoe/room/${data.newRoomCode}`);
  } else {
    setRematchRequested(prev => ({ ...prev, byMe: true })); // ✅ Función de actualización
    toast.success('Revancha solicitada. Esperando al oponente...');
  }
}
```

---

### **Problema 3: Estado no se resetea al cambiar de sala**
**Ubicación**: `frontend/src/pages/TicTacToeRoom.js:41-48` (nuevo código)

**Descripción**: 
Cuando los jugadores aceptaban la revancha y navegaban a la nueva sala, los estados `rematchRequested`, `gameOver`, `showGameOverModal`, `board` y `timeLeft` no se reseteaban. Esto causaba que la UI mostrara información incorrecta en la nueva sala de revancha.

**Impacto**:
- Los botones de revancha aparecían inmediatamente en la nueva sala
- El modal de "Game Over" podía aparecer incorrectamente
- El tablero podía mostrar la partida anterior

**Solución aplicada**:
```javascript
// Reset states when room code changes (for rematch navigation)
useEffect(() => {
  setRematchRequested({ byMe: false, byOpponent: false });
  setGameOver(false);
  setShowGameOverModal(false);
  setBoard([[null, null, null], [null, null, null], [null, null, null]]);
  setTimeLeft(15);
}, [code]);
```

---

### **Problema 4: Backend no emitía evento de solicitud de revancha**
**Ubicación**: `backend/routes/tictactoe.js:668-673` (nuevo código)

**Descripción**: 
El backend actualizaba la base de datos cuando un jugador solicitaba revancha, pero **NO emitía el evento de socket** `room:rematch-request` para notificar al oponente. El frontend estaba esperando este evento pero nunca llegaba.

**Código faltante agregado**:
```javascript
// Emitir evento de solicitud de revancha al oponente
const io = req.app.get('io');
io.to(`tictactoe:${code}`).emit('room:rematch-request', {
  roomCode: code,
  playerId: userId
});
```

---

## ✅ Cambios Realizados

### Frontend: `frontend/src/pages/TicTacToeRoom.js`

1. **Líneas 41-48**: Agregado `useEffect` para resetear estados cuando cambia el código de sala
2. **Línea 176**: Cambiado a función de actualización de estado `prev => ({ ...prev, byMe: true })`
3. **Línea 266**: Cambiado a función de actualización de estado `prev => ({ ...prev, byOpponent: true })`

### Backend: `backend/routes/tictactoe.js`

1. **Líneas 668-673**: Agregada emisión del evento `room:rematch-request` para notificar al oponente

---

## 🧪 Pruebas Recomendadas

### Escenario 1: Revancha aceptada por ambos
1. Usuario A crea sala con apuesta de 1 Fire
2. Usuario B se une a la sala
3. Juegan hasta que termina la partida
4. **Usuario A solicita revancha** → Usuario B debe ver notificación
5. **Usuario B solicita revancha** → Ambos deben navegar automáticamente a nueva sala
6. **Verificar**: Nueva sala debe iniciar limpia, sin estado previo

### Escenario 2: Revancha solicitada pero no aceptada
1. Completar partida
2. Usuario A solicita revancha
3. **Verificar**: Usuario A ve "Esperando rival...", Usuario B ve notificación
4. Usuario B sale del juego sin aceptar
5. **Verificar**: Usuario A queda esperando correctamente

### Escenario 3: Múltiples revanchas consecutivas
1. Jugar partida inicial
2. Ambos solicitan revancha → nueva sala
3. Jugar segunda partida
4. Ambos solicitan revancha → nueva sala
5. **Verificar**: Cada sala inicia correctamente, balances se descuentan, turnos alternan

---

## 🔧 Archivos Modificados

```
frontend/src/pages/TicTacToeRoom.js  (3 cambios)
backend/routes/tictactoe.js          (1 cambio)
```

---

## 📝 Notas Técnicas

### Por qué usar funciones de actualización de estado

En React, cuando actualizas estado basado en el valor anterior dentro de callbacks (como event listeners o callbacks de mutaciones), debes usar la forma funcional de setState:

```javascript
// ❌ MAL: Usa el valor del closure (puede estar desactualizado)
setState({ ...state, newProp: value });

// ✅ BIEN: Usa el valor actual del estado
setState(prev => ({ ...prev, newProp: value }));
```

Esto es especialmente crítico en:
- Event handlers de WebSocket
- Callbacks de useEffect con dependencias limitadas
- Callbacks de mutaciones asíncronas

### Por qué resetear estado al cambiar de sala

Cuando navegas a una nueva ruta con `react-router`, el componente **NO se desmonta** si es la misma ruta con diferentes parámetros. Por ejemplo:

- `/tictactoe/room/ABC123` → `/tictactoe/room/DEF456`

El componente `TicTacToeRoom` se reutiliza, pero el parámetro `code` cambia. Por eso necesitamos un `useEffect` que escuche cambios en `code` y resetee los estados relevantes.

---

## 🚀 Próximos Pasos

1. ✅ Hacer commit de los cambios
2. ✅ Push a GitHub
3. ⏳ Railway desplegará automáticamente
4. ⏳ Probar con usuarios reales en producción
5. ⏳ Monitorear logs de errores

---

**Desarrollado por**: Cascade AI  
**Revisado por**: Equipo Tote
