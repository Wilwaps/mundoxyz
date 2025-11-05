# 🎯 PLAN: Feature "Otra Ronda" Bingo V2

**Status:** ✅ LISTO PARA IMPLEMENTAR

---

## 📋 RESUMEN

Después de finalizar partida de Bingo, modal muestra timer 30s con opciones:
- **Volver al Lobby** → Sale inmediatamente
- **Otra Ronda** → Resetea sala, nuevo host aleatorio, ajustar cartones
- **Timer expira** → Redirige automáticamente a lobby (sin log)

---

## 🎨 FRONTEND

### **1. Modal Celebración** (`BingoV2GameRoom.js`)

**Estados nuevos:**
```javascript
const [remainingTime, setRemainingTime] = useState(30);
const [isRedirecting, setIsRedirecting] = useState(false);
```

**Timer + UI:**
- Countdown 30s visible con barra de progreso
- Detener timer si usuario hace click en cualquier botón
- Auto-redirect a `/bingo` cuando llegue a 0

**Botones:**
```javascript
// Volver al Lobby (existente, mejorado)
const handleBackToLobby = () => {
  setIsRedirecting(true);
  socket.emit('bingo:leave_room', { roomCode, userId });
  navigate('/bingo');
};

// Otra Ronda (NUEVO)
const handleAnotherRound = () => {
  setIsRedirecting(true);
  socket.emit('bingo:request_new_round', { roomCode, userId });
  navigate(`/bingo/v2/room/${code}`);
};
```

---

### **2. Sala de Espera** (`BingoV2WaitingRoom.js`)

**Modificador de Cartones (reemplaza modal):**
- Input number con botones +/- siempre visible
- Rango: 1 a `max_cards_per_player`
- Mostrar costo total en tiempo real
- Botón "Actualizar/Comprar Cartones" solo si hay cambios

**Nuevo evento socket:**
```javascript
socket.on('bingo:new_round_ready', (data) => {
  setRoom(data.room); // Nuevo host, pozo = 0
  setIsReady(false);
  toast.success(`Nueva ronda. Host: ${data.room.host_name}`);
});
```

**Nuevo endpoint para ajustar cartones:**
```
POST /api/bingo/v2/rooms/:code/update-cards
Body: { cards_count: number }
```

---

## 🔧 BACKEND

### **1. Socket Event** (`socket/bingoV2.js`)

```javascript
socket.on('bingo:request_new_round', async (data) => {
  const { roomCode } = data;
  
  // Resetear sala
  const result = await BingoV2Service.resetRoomForNewRound(roomId);
  
  // Emitir a todos
  io.to(roomCode).emit('bingo:new_round_ready', {
    room: result.room,
    message: 'Nueva ronda lista'
  });
});
```

---

### **2. Servicio** (`services/bingoV2Service.js`)

**Nueva función:**
```javascript
static async resetRoomForNewRound(roomId) {
  // 1. Obtener jugadores conectados
  const players = await query(
    `SELECT * FROM bingo_v2_room_players 
     WHERE room_id = $1 AND is_connected = true`,
    [roomId]
  );
  
  // 2. Seleccionar host aleatorio
  const randomHost = players[Math.floor(Math.random() * players.length)];
  
  // 3. Resetear sala
  await query(
    `UPDATE bingo_v2_rooms SET
       status = 'waiting',
       host_id = $1,
       winner_id = NULL,
       drawn_numbers = '[]',
       total_pot = 0,
       auto_call_enabled = false,
       current_game_number = current_game_number + 1
     WHERE id = $2`,
    [randomHost.user_id, roomId]
  );
  
  // 4. Reset jugadores
  await query(
    `UPDATE bingo_v2_room_players SET
       is_ready = false,
       cards_purchased = 0,
       total_spent = 0
     WHERE room_id = $1`,
    [roomId]
  );
  
  // 5. Eliminar cartones viejos
  await query(`DELETE FROM bingo_v2_cards WHERE room_id = $1`, [roomId]);
  
  // 6. Log auditoría
  await query(
    `INSERT INTO bingo_v2_audit_logs (room_id, user_id, action, details)
     VALUES ($1, $2, 'new_round_reset', $3)`,
    [roomId, randomHost.user_id, JSON.stringify({ game_number: X })]
  );
  
  return { room: await this.getRoomDetails(roomCode) };
}
```

---

### **3. Nuevo Endpoint** (`routes/bingoV2.js`)

```javascript
router.post('/rooms/:code/update-cards', verifyToken, async (req, res) => {
  const { cards_count } = req.body;
  
  // Validar rango
  // Calcular diferencia de costo
  // Si aumenta: cobrar y agregar al pozo
  // Si disminuye: reembolsar y quitar del pozo
  // Actualizar cards_purchased
  // Eliminar cartones viejos
  // Generar nuevos cartones
  
  res.json({ success: true, cards: newCards });
});
```

---

## 🎨 CSS

### **BingoV2GameRoom.css**
- `.timer-container` - Timer con fondo amarillo
- `.timer-progress-bar` - Barra animada
- `.modal-actions` - Flex con 2 botones
- `.btn-secondary` - Gris para "Volver"
- `.btn-primary` - Violeta para "Otra Ronda"

### **BingoV2WaitingRoom.css**
- `.cards-manager` - Contenedor principal
- `.number-input-group` - Botones +/- con input
- `.btn-modifier` - Botones circulares
- `.cards-input` - Input centrado grande
- `.cost-info` - Info de costo total
- `.btn-update-cards` - Botón aplicar cambios

---

## 📊 SCHEMA

**NO requiere cambios en DB** - Todas las columnas necesarias ya existen:
- `bingo_v2_rooms.status` → puede volver a 'waiting'
- `bingo_v2_rooms.total_pot` → se reinicia a 0
- `bingo_v2_rooms.current_game_number` → se incrementa
- `bingo_v2_room_players.is_ready` → se resetea a false
- `bingo_v2_cards` → se eliminan y regeneran

---

## ✅ CHECKLIST IMPLEMENTACIÓN

### **Frontend:**
- [ ] Timer 30s en modal con barra de progreso
- [ ] Botón "Otra Ronda" con handler
- [ ] Evento socket `bingo:request_new_round`
- [ ] Listener `bingo:new_round_ready`
- [ ] Modificador de cartones inline
- [ ] Endpoint `update-cards` integration
- [ ] CSS para timer y modificador

### **Backend:**
- [ ] Evento socket `bingo:request_new_round`
- [ ] Función `resetRoomForNewRound()`
- [ ] Endpoint POST `/rooms/:code/update-cards`
- [ ] Lógica de reembolso/cobro diferencial
- [ ] Generación de nuevos cartones
- [ ] Logs de auditoría

### **Testing:**
- [ ] Finalizar partida → Ver modal con timer
- [ ] Timer llega a 0 → Redirige a lobby
- [ ] Click "Volver al Lobby" → Sale inmediatamente
- [ ] Click "Otra Ronda" → Va a sala de espera
- [ ] Verificar nuevo host aleatorio
- [ ] Verificar pozo en 0
- [ ] Ajustar cartones con +/-
- [ ] Comprar cartones y verificar cobro
- [ ] Todos listos → Host inicia nueva partida

---

## 🚀 ORDEN DE IMPLEMENTACIÓN

1. **CSS primero** (evita errores de clase no encontrada)
2. **Backend service** (`resetRoomForNewRound`)
3. **Backend endpoint** (`update-cards`)
4. **Backend socket** (evento `request_new_round`)
5. **Frontend modal** (timer + botones)
6. **Frontend sala espera** (modificador + listener)
7. **Testing completo**
8. **Commit y push**

---

**Tiempo estimado:** 2-3 horas  
**Complejidad:** Media  
**Impacto:** Alto (mejora retención de jugadores)
