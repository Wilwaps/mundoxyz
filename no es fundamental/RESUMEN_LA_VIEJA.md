# ⚡ RESUMEN: IMPLEMENTACIÓN JUEGO "LA VIEJA"

**Fecha:** 25 de Octubre, 2025  
**Estado:** ✅ Listo para implementar

---

## 🎯 CARACTERÍSTICAS

| Aspecto | Especificación |
|---------|----------------|
| **Jugadores** | 2 (1v1) |
| **Duración por Turno** | 15 segundos |
| **Modo:** | Selector (Coins / Fires) |
| **Apuesta Coins:** | Input numérico (1-1000) - Si elige Coins |
| **Apuesta Fires:** | Fijo 1 Fire (no editable) - Si elige Fires |
| **Comisión Casa** | Sin comisión (0%) |
| **Premio Ganador** | 100% del pot total |
| **Empate** | 50% cada jugador |
| **XP** | 1 XP a ambos jugadores |

---

## 🗄️ BASE DE DATOS

### Tabla: `tictactoe_rooms`
```sql
- id, code (6 chars), host_id
- mode (coins/fires), bet_amount
- status (waiting/ready/playing/finished)
- player_x_id, player_o_id (X=host, O=invitado)
- player_x_ready, player_o_ready
- current_turn ('X' o 'O')
- board (JSONB 3x3)
- moves_history (JSONB)
- winner_id, winner_symbol, winning_line, is_draw
- pot_coins, pot_fires, prize_*
- xp_awarded (bool)
- timestamps (created, started, finished, expires)
```

### Tabla: `tictactoe_moves`
```sql
- id, room_id, player_id
- symbol, row, col, move_number
- created_at
```

### Tabla: `tictactoe_stats`
```sql
- user_id
- games_played/won/lost/draw
- current_streak, best_streak
- total_coins/fires won/lost
- avg_game_duration, fastest_win
```

---

## 🔧 BACKEND

### Endpoints (`/api/tictactoe`)

```
POST   /create                  → Crear sala
POST   /join/:code              → Unirse a sala
POST   /room/:code/ready        → Marcar listo
POST   /room/:code/move         → Hacer jugada (con timer 15 seg)
GET    /rooms/public            → Listar salas públicas
GET    /room/:code              → Detalles de sala
DELETE /room/:code/leave        → Salir de sala
POST   /room/:code/timeout      → Manejar timeout de turno
```

### Flujo Económico

**Al unirse:**
```javascript
// Siempre deducir apuesta (no hay modo gratis)
const betAmount = mode === 'fires' ? 1 : requestedBetAmount;
await deductBalance(userId, mode, betAmount);
await addToPot(roomId, mode, betAmount);
```

**Validaciones:**
- Balance suficiente (siempre requerido)
- Modo Coins: apuesta entre 1-1,000
- Modo Fires: apuesta fija en 1 (no editable)

**Al finalizar:**
```javascript
const potTotal = room.pot_coins || room.pot_fires;
// Sin comisión - 100% al ganador

if (winnerId) {
  await addBalance(winnerId, currency, potTotal);
} else {
  // Empate: 50% cada uno
  await addBalance(playerXId, currency, potTotal / 2);
  await addBalance(playerOId, currency, potTotal / 2);
}
```

### Otorgar XP

```javascript
if (gameOver && !room.xp_awarded) {
  await awardXpBatch([
    { userId: playerXId, xpAmount: 1, gameType: 'tictactoe', ... },
    { userId: playerOId, xpAmount: 1, gameType: 'tictactoe', ... }
  ]);
  await markXpAwarded(roomId);
}
```

---

## 🎨 FRONTEND

### Páginas

**`/lobby`** - TicTacToeLobby.js
- Botón "Crear Sala" (modal)
- Lista salas públicas disponibles
- Filtros por modo (todos/coins/fires)

**`/tictactoe/:code`** - TicTacToeRoom.js
- Header (código, modo, pot)
- Panel jugadores (X vs O, listo, turno)
- Tablero 3x3 interactivo
- Animaciones (símbolos, línea ganadora)
- Modal resultado (ganador, premio, XP)

### Componentes

- `Symbol` → Animación X y O
- `WinningLine` → Línea ganadora
- `PlayerCard` → Info jugador
- `GameOverModal` → Resultado final

### WebSocket Events

```javascript
socket.on('room:player-joined')
socket.on('room:player-ready')
socket.on('room:game-started')
socket.on('room:move-made')
socket.on('room:game-over')
```

---

## 📦 MIGRACIÓN SQL

**Archivo:** `MIGRACION_LA_VIEJA.sql`

```sql
CREATE TABLE tictactoe_rooms (...);
CREATE TABLE tictactoe_moves (...);
CREATE TABLE tictactoe_stats (...);

-- Índices para performance
CREATE INDEX idx_tictactoe_rooms_code ...
CREATE INDEX idx_tictactoe_rooms_status ...
CREATE INDEX idx_tictactoe_rooms_visibility ...
```

---

## ⏱️ CRONOGRAMA

| Fase | Duración | Tareas |
|------|----------|--------|
| **DB + Migración** | 1 hora | SQL, ejecutar en Railway |
| **Backend Core** | 3-4 horas | Rutas, lógica juego, economía |
| **Backend XP** | 30 min | Integración awardXp() |
| **Frontend Lobby** | 2 horas | Lista salas, crear sala |
| **Frontend Juego** | 4-5 horas | Tablero, turnos, animaciones |
| **WebSocket** | 2 horas | Tiempo real |
| **Testing** | 2 horas | Pruebas completas |
| **Deploy** | 1 hora | Push y verificar |
| **TOTAL** | **15-17 horas** | |

---

## ✅ ARCHIVOS A CREAR

### Backend
- [ ] `backend/routes/tictactoe.js` (endpoints)
- [ ] `backend/utils/tictactoe.js` (lógica juego)
- [ ] `backend/socket/tictactoe.js` (eventos WebSocket)

### Frontend
- [ ] `frontend/src/pages/TicTacToeLobby.js`
- [ ] `frontend/src/pages/TicTacToeRoom.js`
- [ ] `frontend/src/components/tictactoe/Board.js`
- [ ] `frontend/src/components/tictactoe/Cell.js`
- [ ] `frontend/src/components/tictactoe/Symbol.js`
- [ ] `frontend/src/components/tictactoe/WinningLine.js`
- [ ] `frontend/src/components/tictactoe/PlayerCard.js`
- [ ] `frontend/src/components/tictactoe/GameOverModal.js`
- [ ] `frontend/src/components/tictactoe/CreateRoomModal.js`

### SQL
- [ ] `MIGRACION_LA_VIEJA.sql`

---

## 🚀 VENTAJAS DEL SISTEMA

✅ **Economía directa** → 2 modos (Coins 1-1000, Fires fijo 1)  
✅ **Sin comisión** → 100% al ganador (más justo)  
✅ **Timer por turno** → 15 seg (partidas dinámicas)  
✅ **XP integrado** → 1 XP por partida  
✅ **Salas públicas/privadas** → Flexibilidad  
✅ **Tiempo real** → WebSocket para UX fluida  
✅ **Estadísticas** → Tracking completo por jugador  
✅ **Escalable** → Base para torneos futuros

---

## 📝 PRÓXIMOS PASOS

1. **¿Aprobar plan?** → Confirmar especificaciones
2. **Ejecutar migración SQL** → Crear tablas en Railway
3. **Implementar backend** → Endpoints, lógica y timer
4. **Implementar frontend** → UI y WebSocket
5. **Testing completo** → 2 modos, economía sin comisión, timer, XP
6. **Deploy a producción** → Push GitHub → Railway

---

**¿Procedo con la implementación modular?** 🚀

**Orden sugerido:**
1. Migración SQL (15 min)
2. Backend core sin XP (3 horas)
3. Integración XP (30 min)
4. Frontend básico (4 horas)
5. WebSocket (2 horas)
6. Pulir y testing (2 horas)
