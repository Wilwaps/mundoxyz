# 🎯 PLAN DE MEJORAS - TIC TAC TOE (LA VIEJA)

## 📊 ESTADO ACTUAL

**Funcionando:**
- ✅ Crear sala
- ✅ Unirse a sala
- ✅ Sistema de apuestas
- ✅ WebSocket en tiempo real

**Problemas detectados:**
- ❌ Si el host sale de la sala, no puede volver a entrar
- ❌ No hay manejo de desconexiones
- ❌ No hay transferencia de host
- ❌ No hay devolución de apuestas si sala se abandona

---

## 🔧 MEJORAS REQUERIDAS (EN ORDEN DE IMPLEMENTACIÓN)

### **FASE 1: Reconexión a Salas** (PRIORIDAD ALTA)
**Problema:** Host/jugadores no pueden volver a entrar si salen por accidente.

**Solución:**
1. Permitir que jugadores vuelvan a su sala activa
2. Verificar que el usuario es parte de la sala (player_x o player_o)
3. Restaurar estado del juego donde quedó
4. Reconectar WebSocket a la sala

**Archivos a modificar:**
- `backend/routes/tictactoe.js` - Endpoint GET `/api/tictactoe/room/:code`
- `frontend/src/pages/TicTacToeRoom.js` - Lógica de reconexión

---

### **FASE 2: Gestión de Abandono de Sala** (PRIORIDAD ALTA)

#### **2.1 Ambos jugadores salen → Eliminar sala y devolver dinero**

**Condiciones:**
- Sala en estado: `waiting`, `ready` o `playing`
- Ambos jugadores desconectados por > 30 segundos
- Partida no finalizada

**Acciones:**
1. Devolver apuesta a cada jugador
2. Registrar transacciones de devolución
3. Eliminar sala (o marcar como `cancelled`)
4. Log del evento

**Implementación:**
- Sistema de tracking de conexiones
- Timeout de 30 segundos
- Función `cancelRoomAndRefund()`

---

#### **2.2 Host sale y no hay nadie → Eliminar sala y devolver dinero**

**Condiciones:**
- Solo hay host (player_x)
- No hay player_o
- Host desconectado > 30 segundos
- Estado: `waiting` o `ready`

**Acciones:**
1. Devolver apuesta al host
2. Eliminar sala
3. Log del evento

---

#### **2.3 Host sale y hay invitado → Transferir host**

**Condiciones:**
- Hay player_o en la sala
- Host (player_x) desconectado > 30 segundos
- Estado: `waiting`, `ready` o `playing`

**Acciones:**
1. player_o se convierte en nuevo host (player_x)
2. Actualizar base de datos
3. Notificar vía WebSocket al nuevo host
4. Mantener apuestas y estado del juego

**Campos a actualizar:**
```sql
UPDATE tictactoe_rooms SET
  player_x_id = player_o_id,
  player_x_username = player_o_username,
  player_x_ready = player_o_ready,
  player_o_id = NULL,
  player_o_username = NULL,
  player_o_ready = FALSE,
  status = 'waiting'  -- Vuelve a esperar nuevo jugador
WHERE id = room_id
```

---

### **FASE 3: Sistema de Ready Mejorado** (PRIORIDAD MEDIA)

#### **3.1 Botón "Listo" para invitado**

**Estado actual:** Ambos tienen botón "Listo"

**Mejora:**
- Solo el invitado (player_o) tiene botón "Listo"
- El host ve cuando el invitado está listo
- Efecto visual: Tablero del invitado brilla cuando está listo

**Implementación:**
```javascript
// Frontend - TicTacToeRoom.js
{mySymbol === 'O' && room?.status === 'ready' && !room?.player_o_ready && (
  <button onClick={markReady} className="btn-primary animate-pulse">
    ¡Estoy Listo!
  </button>
)}

{mySymbol === 'X' && room?.player_o_ready && (
  <div className="text-success animate-pulse">
    ✓ Invitado está listo
  </div>
)}
```

**CSS para brillo:**
```css
.player-ready-glow {
  box-shadow: 0 0 20px rgba(var(--success-rgb), 0.8);
  animation: pulse-glow 1s infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(var(--success-rgb), 0.8); }
  50% { box-shadow: 0 0 30px rgba(var(--success-rgb), 1); }
}
```

---

#### **3.2 Botón "Iniciar Partida" para host**

**Nuevo comportamiento:**
- Host selecciona modo (ya implementado al crear sala)
- Host ve botón "Iniciar Partida" cuando invitado está listo
- Al hacer click, cambia status de `ready` → `playing`

**Implementación:**
```javascript
// Frontend
{mySymbol === 'X' && room?.player_o_ready && room?.status === 'ready' && (
  <button onClick={startGame} className="btn-primary">
    🎮 Iniciar Partida
  </button>
)}
```

**Backend - Nuevo endpoint:**
```javascript
POST /api/tictactoe/room/:code/start
- Verifica que user es host (player_x)
- Verifica que player_o está ready
- Cambia status a 'playing'
- Inicia timer
- Emite evento 'game-started'
```

---

### **FASE 4: Visualización del Pot Mejorada** (PRIORIDAD BAJA)

**Problema actual:** El pot muestra el total, pero no es claro cuándo se suma la apuesta del invitado.

**Mejora:**

#### **Mientras está en "waiting" (solo host):**
```
Premio en juego: 1 🔥
(Esperando oponente)
```

#### **Cuando invitado se une (status = ready):**
```
Premio en juego: 2 🔥
Host: 1 🔥  +  Invitado: 1 🔥
```

#### **Durante el juego (status = playing):**
```
Premio Total: 2 🔥
```

**Implementación:**
```javascript
// Frontend - Header de sala
{room?.status === 'waiting' && (
  <div>
    <span className="text-xl">Premio: {room?.pot_fires || 0} 🔥</span>
    <span className="text-xs text-text/60">(Esperando oponente)</span>
  </div>
)}

{room?.status === 'ready' && (
  <div>
    <span className="text-2xl font-bold">Premio: {room?.pot_fires || 0} 🔥</span>
    <div className="text-xs">
      Host: {room?.bet_amount} 🔥 + Invitado: {room?.bet_amount} 🔥
    </div>
  </div>
)}

{room?.status === 'playing' && (
  <div className="text-2xl font-bold animate-pulse">
    Premio Total: {room?.pot_fires || 0} 🔥
  </div>
)}
```

---

## 📁 ARCHIVOS A MODIFICAR

### **Backend:**
1. `backend/routes/tictactoe.js`
   - Mejorar GET `/room/:code` (reconexión)
   - Nuevo POST `/room/:code/start` (iniciar partida)
   - Mejorar POST `/join/:code` (validaciones)

2. `backend/socket/tictactoe.js`
   - Agregar tracking de conexiones
   - Evento `player-disconnected`
   - Evento `player-reconnected`
   - Evento `host-transferred`
   - Timeout de abandono (30 seg)

3. `backend/utils/tictactoe.js`
   - Nueva función: `cancelRoomAndRefund(roomId, reason)`
   - Nueva función: `transferHost(roomId)`
   - Nueva función: `checkAbandonedRooms()`

### **Frontend:**
1. `frontend/src/pages/TicTacToeRoom.js`
   - Lógica de reconexión
   - Botón "Iniciar Partida" para host
   - Efecto brillo cuando invitado está listo
   - Mejorar visualización del pot

2. `frontend/src/pages/TicTacToeLobby.js`
   - Mostrar indicador si usuario tiene sala activa
   - Botón "Volver a mi sala"

3. `frontend/src/contexts/SocketContext.js`
   - Manejar eventos de desconexión
   - Auto-reconexión

---

## 🔄 FLUJO DE IMPLEMENTACIÓN

### **DÍA 1: Reconexión básica**
1. Permitir que jugadores vuelvan a sala activa
2. Verificar permisos (player_x o player_o)
3. Restaurar estado del juego

### **DÍA 2: Sistema de abandono**
1. Tracking de conexiones con WebSocket
2. Timeouts de 30 segundos
3. Función de devolución de apuestas

### **DÍA 3: Transferencia de host**
1. Detectar desconexión de host
2. Transferir host a player_o
3. Notificaciones

### **DÍA 4: Mejoras UX**
1. Botón "Iniciar Partida" para host
2. Efecto brillo "Listo"
3. Visualización mejorada del pot

### **DÍA 5: Testing y ajustes**
1. Probar todos los escenarios
2. Ajustar tiempos
3. Pulir animaciones

---

## 🧪 CASOS DE PRUEBA

### **Test 1: Reconexión de host**
1. Host crea sala
2. Host cierra pestaña
3. Host abre pestaña nueva
4. ✅ Host puede volver a su sala

### **Test 2: Reconexión de invitado**
1. Invitado se une a sala
2. Invitado cierra pestaña
3. Invitado abre pestaña nueva
4. ✅ Invitado puede volver a su sala

### **Test 3: Ambos abandonan**
1. Host crea sala
2. Invitado se une
3. Ambos cierran pestaña por 30+ segundos
4. ✅ Sala se elimina
5. ✅ Apuestas devueltas

### **Test 4: Solo host abandona (sin invitado)**
1. Host crea sala
2. Host espera 30+ segundos sin cerrar
3. Host cierra pestaña por 30+ segundos
4. ✅ Sala se elimina
5. ✅ Apuesta devuelta

### **Test 5: Host abandona con invitado presente**
1. Host crea sala
2. Invitado se une
3. Host cierra pestaña por 30+ segundos
4. ✅ Invitado se convierte en host
5. ✅ Sala vuelve a "waiting"
6. ✅ Apuestas se mantienen

### **Test 6: Flujo completo de "Listo" e "Iniciar"**
1. Host crea sala
2. Invitado se une
3. Invitado marca "Listo"
4. ✅ Tablero de invitado brilla
5. Host ve "Invitado está listo"
6. Host hace click "Iniciar Partida"
7. ✅ Juego comienza

---

## 📊 PRIORIDADES

### **CRÍTICO (Hacer ahora):**
1. ✅ Reconexión a salas activas
2. ✅ Devolución de apuestas si ambos abandonan

### **ALTO (Esta semana):**
3. Transferencia de host
4. Botón "Iniciar Partida" para host

### **MEDIO (Próxima semana):**
5. Efecto brillo cuando invitado listo
6. Visualización mejorada del pot

### **BAJO (Cuando haya tiempo):**
7. Animaciones adicionales
8. Sonidos
9. Estadísticas de abandono

---

## 💡 NOTAS TÉCNICAS

### **Tracking de conexiones:**
```javascript
// Backend - socket/tictactoe.js
const roomConnections = new Map();
// roomCode -> { playerX: { connected: true, lastSeen: timestamp }, playerO: {...} }

socket.on('disconnect', () => {
  // Marcar como desconectado
  // Iniciar timeout de 30 segundos
  // Si pasa el tiempo, ejecutar lógica de abandono
});

socket.on('room:join', ({ roomCode }) => {
  // Marcar como conectado
  // Cancelar timeout si existe
});
```

### **Devolución de apuestas:**
```javascript
async function refundBet(userId, mode, amount, roomCode) {
  await transaction(async (client) => {
    // 1. Actualizar balance
    await client.query(`
      UPDATE wallets 
      SET ${mode}_balance = ${mode}_balance + $1
      WHERE user_id = $2
    `, [amount, userId]);
    
    // 2. Registrar transacción
    await client.query(`
      INSERT INTO wallet_transactions 
      (wallet_id, type, currency, amount, description, reference)
      VALUES (
        (SELECT id FROM wallets WHERE user_id = $1),
        'refund', $2, $3, 
        'Devolución por sala cancelada',
        $4
      )
    `, [userId, mode, amount, roomCode]);
  });
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Fase 1: Reconexión**
- [ ] Modificar GET `/room/:code` para verificar pertenencia
- [ ] Frontend: Detectar sala activa al entrar
- [ ] Frontend: Botón "Volver a mi sala" en lobby
- [ ] Test de reconexión

### **Fase 2: Abandono**
- [ ] Sistema de tracking de conexiones
- [ ] Timeout de 30 segundos
- [ ] Función `refundBet()`
- [ ] Función `cancelRoom()`
- [ ] Test escenarios de abandono

### **Fase 3: Transferencia Host**
- [ ] Detectar desconexión de host
- [ ] Función `transferHost()`
- [ ] Actualizar base de datos
- [ ] Notificar cambio vía WebSocket
- [ ] Test transferencia

### **Fase 4: UX Mejorada**
- [ ] Botón "Iniciar Partida" solo para host
- [ ] Efecto brillo invitado listo
- [ ] Mejorar visualización pot
- [ ] Test flujo completo

---

**ESTADO:** 📋 Plan completado - Listo para implementación por fases

**PRÓXIMO PASO:** Implementar Fase 1 (Reconexión)
