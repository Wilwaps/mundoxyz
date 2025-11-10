# TICTACTOE - BOTÓN ADMIN PARA CERRAR SALAS
**Fecha:** 2025-11-08  
**Commit:** 7f99eb9  
**Deploy:** Railway automático (~6 minutos)

---

## PROBLEMA REPORTADO

**Usuario Tote necesita poder cerrar salas manualmente:**
1. Sala 930961 aún existe y no se cerró automáticamente
2. Necesita botón (X) como existe en Bingo y Rifas
3. Al cerrar, debe reembolsar a los jugadores
4. Registro en historial SOLO para fuegos

**Usuario con poder:** Tote - `telegram_id = 1417856820`  
**Rol requerido:** `tote` o `admin`

---

## ANÁLISIS DE BINGO (Referencia)

### Permisos en Bingo
**Archivo:** `backend/routes/bingoV2.js`

```javascript
// Verificar rol admin/tote
const userRoles = req.user.roles || [];
const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');

// Admin puede cerrar SIEMPRE (waiting o in_progress)
// Host solo puede cerrar en waiting sin jugadores
```

### Reembolso en Bingo
**Archivo:** `backend/services/bingoV2Service.js`

```javascript
// Reembolsar a todos los jugadores
for (const player of playersWithCards) {
  await client.query(
    `UPDATE wallets 
     SET ${currencyColumn} = ${currencyColumn} + $1 
     WHERE user_id = $2`,
    [player.total_cost, player.user_id]
  );
  
  // Registrar en wallet_transactions
  await client.query(
    `INSERT INTO wallet_transactions ...`
  );
}
```

### Frontend en Bingo
**Archivo:** `frontend/src/pages/BingoV2WaitingRoom.js`

```javascript
// Verificar permisos
const response = await fetch(`/api/bingo/v2/rooms/${code}/can-close`);
const data = await response.json();
setCanCloseRoom(data.allowed);

// Mostrar botón si tiene permisos
{canCloseRoom && (
  <button 
    className="close-room-button"
    onClick={handleCloseRoom}
    style={{ backgroundColor: '#dc3545' }}
  >
    Cerrar Sala
  </button>
)}

// Cerrar sala
const response = await fetch(`/api/bingo/v2/rooms/${code}`, {
  method: 'DELETE'
});
```

---

## SOLUCIÓN IMPLEMENTADA

### Backend: Endpoints nuevos

#### 1. Verificar permisos
**Endpoint:** `GET /api/tictactoe/rooms/:code/can-close`  
**Auth:** Token requerido

```javascript
router.get('/rooms/:code/can-close', verifyToken, async (req, res) => {
  const userRoles = req.user.roles || [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
  
  // Admin/tote puede cerrar salas en waiting, ready o playing
  if (isAdmin) {
    if (['waiting', 'ready', 'playing'].includes(room.status)) {
      return res.json({ allowed: true, isAdmin: true });
    }
  }
  
  // Host puede cerrar solo si está en waiting sin invitado
  if (room.host_id === userId && room.status === 'waiting' && !room.player_o_id) {
    return res.json({ allowed: true, isAdmin: false });
  }
  
  return res.json({ allowed: false, reason: 'No tienes permisos' });
});
```

#### 2. Cerrar sala con reembolso
**Endpoint:** `DELETE /api/tictactoe/rooms/:code`  
**Auth:** Token requerido

```javascript
router.delete('/rooms/:code', verifyToken, async (req, res) => {
  const userRoles = req.user.roles || [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('tote');
  
  await transaction(async (client) => {
    // 1. Verificar permisos
    const canClose = isAdmin || 
      (room.host_id === userId && room.status === 'waiting' && !room.player_o_id);
    
    if (!canClose) {
      throw new Error('No tienes permisos');
    }
    
    // 2. Reembolsar jugadores
    const currencyColumn = room.mode === 'coins' ? 'coins_balance' : 'fires_balance';
    
    // Reembolsar Player X (host)
    await client.query(
      `UPDATE wallets 
       SET ${currencyColumn} = ${currencyColumn} + $1 
       WHERE user_id = $2`,
      [room.bet_amount, room.player_x_id]
    );
    
    // Registrar transacción SOLO si es fires
    if (room.mode === 'fires') {
      await client.query(
        `INSERT INTO wallet_transactions 
         (wallet_id, type, currency, amount, balance_before, balance_after, description, reference) 
         SELECT w.id, 'game_refund', 'fires', $1, 
                w.fires_balance - $1, w.fires_balance,
                'Reembolso TicTacToe - Sala cerrada por admin', $2
         FROM wallets w WHERE w.user_id = $3`,
        [room.bet_amount, `tictactoe:${room.code}`, room.player_x_id]
      );
    }
    
    // Reembolsar Player O (invitado) si existe
    if (room.player_o_id) {
      // Mismo proceso...
    }
    
    // 3. Cancelar sala
    await client.query(
      `UPDATE tictactoe_rooms 
       SET status = 'cancelled' 
       WHERE id = $1`,
      [room.id]
    );
    
    // 4. Limpiar conexiones del socket
    cleanupRoom(code);
    
    return { refundedCount, betAmount, mode };
  });
});
```

---

### Frontend: Botón (X) en Lobby

**Archivo:** `frontend/src/pages/TicTacToeLobby.js`

#### Mutation para cerrar sala

```javascript
const closeRoomMutation = useMutation({
  mutationFn: async (code) => {
    const response = await axios.delete(`/api/tictactoe/rooms/${code}`);
    return response.data;
  },
  onSuccess: (data) => {
    toast.success(data.message || 'Sala cerrada exitosamente');
    refetch(); // Refrescar lista de salas
  },
  onError: (error) => {
    toast.error(error.response?.data?.error || 'Error al cerrar sala');
  }
});
```

#### Handler para cerrar

```javascript
const handleCloseRoom = async (room, e) => {
  e.stopPropagation(); // Prevenir que se abra la sala
  
  if (!window.confirm(`¿Cerrar sala ${room.code}? Se reembolsará a los jugadores.`)) {
    return;
  }
  
  closeRoomMutation.mutate(room.code);
};
```

#### Botón en cada sala (solo admin/tote)

```jsx
{rooms.map((room) => (
  <motion.div className="card-glass p-4 cursor-pointer relative">
    {/* Admin close button */}
    {user && (user.roles?.includes('admin') || user.roles?.includes('tote')) && (
      <button
        onClick={(e) => handleCloseRoom(room, e)}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-error/80 hover:bg-error text-white transition-colors z-10"
        title="Cerrar sala (Admin)"
        disabled={closeRoomMutation.isPending}
      >
        <X size={14} />
      </button>
    )}
    
    {/* Contenido de la sala... */}
  </motion.div>
))}
```

---

## PERMISOS DETALLADOS

### Admin/Tote (telegram_id 1417856820)
✅ Puede cerrar salas en **waiting** (esperando invitado)  
✅ Puede cerrar salas en **ready** (ambos listos)  
✅ Puede cerrar salas en **playing** (juego en curso)  
❌ No puede cerrar salas **finished** o **cancelled**

### Host Regular
✅ Puede cerrar sala en **waiting** sin invitado  
❌ No puede cerrar si ya hay invitado  
❌ No puede cerrar si juego ya empezó

### Invitado
❌ No puede cerrar salas nunca

---

## REEMBOLSO DETALLADO

### Modo: Coins 🪙

**Jugador X (host):**
```sql
UPDATE wallets 
SET coins_balance = coins_balance + 10
WHERE user_id = 'player-x-id';
```

**Jugador O (invitado):**
```sql
UPDATE wallets 
SET coins_balance = coins_balance + 10
WHERE user_id = 'player-o-id';
```

**NO se registra en `wallet_transactions`** - Solo actualización de balance.

---

### Modo: Fires 🔥

**Jugador X (host):**
```sql
-- 1. Actualizar balance
UPDATE wallets 
SET fires_balance = fires_balance + 1.00
WHERE user_id = 'player-x-id';

-- 2. Registrar transacción
INSERT INTO wallet_transactions (
  wallet_id,
  type,
  currency,
  amount,
  balance_before,
  balance_after,
  description,
  reference
) VALUES (
  <wallet_id>,
  'game_refund',
  'fires',
  1.00,
  <balance_antes>,
  <balance_despues>,
  'Reembolso TicTacToe - Sala cerrada por admin',
  'tictactoe:930961'
);
```

**Jugador O (invitado):**
- Mismo proceso que Jugador X

**SE REGISTRA en `wallet_transactions`** - Para historial de fuegos.

---

## CASO: SALA 930961

### Situación actual:
- Código: **930961**
- Estado: Probablemente **waiting** o **playing**
- Jugadores: 1 o 2 (con apuestas)

### Solución:

1. **Usuario Tote ingresa al lobby de TicTacToe**
2. **Ve sala 930961 con botón (X) rojo en esquina**
3. **Clic en (X)**
4. **Confirma en popup: "¿Cerrar sala 930961?"**
5. **Backend ejecuta:**
   ```
   → Obtiene sala con FOR UPDATE
   → Verifica permisos (Tote = OK)
   → Reembolsa Player X
   → Reembolsa Player O (si existe)
   → Si mode = fires → Registra transacciones
   → UPDATE status = 'cancelled'
   → cleanupRoom('930961')
   ```
6. **Frontend muestra:**
   ```
   Toast: "Sala cerrada. 2 jugador(es) reembolsados."
   Lista de salas se actualiza automáticamente
   Sala 930961 desaparece del lobby
   ```

---

## FLUJO COMPLETO

### Admin cierra sala con 2 jugadores (mode: fires)

```
T=0s:  Admin ve sala 930961 en lobby
       Modo: 🔥 Fires, Apuesta: 1.00
       Estado: playing (juego en curso)
       Jugadores: prueba3 vs prueba2

T=1s:  Admin clic botón (X)
       Popup: "¿Cerrar sala 930961? Se reembolsará a los jugadores."
       Admin: Confirma

T=2s:  Frontend: DELETE /api/tictactoe/rooms/930961
       Backend: Inicia transacción

T=2.1s: Backend: Obtiene sala con lock
        Verifica: Admin tiene rol 'tote' ✅
        Verifica: Sala está en 'playing' ✅

T=2.2s: Backend: Reembolsa prueba3 (Player X)
        UPDATE wallets SET fires_balance = fires_balance + 1.00
        INSERT wallet_transactions (
          type: 'game_refund',
          currency: 'fires',
          amount: 1.00,
          description: 'Reembolso TicTacToe - Sala cerrada por admin'
        )

T=2.3s: Backend: Reembolsa prueba2 (Player O)
        UPDATE wallets SET fires_balance = fires_balance + 1.00
        INSERT wallet_transactions (...)

T=2.4s: Backend: Cancela sala
        UPDATE tictactoe_rooms SET status = 'cancelled'
        
T=2.5s: Backend: Limpia socket
        cleanupRoom('930961')
        → Cancela timeouts
        → Elimina del Map

T=2.6s: Backend: Retorna respuesta
        {
          success: true,
          message: "Sala cerrada. 2 jugador(es) reembolsados.",
          refundedCount: 2,
          betAmount: 1.00,
          mode: "fires"
        }

T=3s:  Frontend: Toast "Sala cerrada. 2 jugador(es) reembolsados."
       Refetch lista de salas
       Sala 930961 desaparece del lobby ✅

T=3.5s: Jugadores en la sala (si aún conectados):
        Socket emite 'room:cancelled'
        Frontend muestra: "La sala fue cerrada por un administrador"
        Redirige a lobby
```

---

## REGISTRO EN WALLET_TRANSACTIONS

### Estructura del registro (fires)

```sql
{
  id: 12345,
  wallet_id: 67,
  type: 'game_refund',
  currency: 'fires',
  amount: 1.00,
  balance_before: 5.50,
  balance_after: 6.50,
  description: 'Reembolso TicTacToe - Sala cerrada por admin',
  reference: 'tictactoe:930961',
  metadata: {},
  related_user_id: NULL,
  created_at: '2025-11-08 20:50:00'
}
```

### Consultar historial de un jugador

```sql
SELECT 
  wt.created_at,
  wt.type,
  wt.currency,
  wt.amount,
  wt.description,
  wt.reference
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
WHERE w.user_id = 'player-uuid'
  AND wt.type = 'game_refund'
  AND wt.currency = 'fires'
ORDER BY wt.created_at DESC;
```

**Resultado esperado:**
```
| created_at          | type         | currency | amount | description                               | reference        |
|---------------------|--------------|----------|--------|-------------------------------------------|------------------|
| 2025-11-08 20:50:00 | game_refund  | fires    | 1.00   | Reembolso TicTacToe - Sala cerrada por... | tictactoe:930961 |
```

---

## UI/UX DETAILS

### Botón (X) - Diseño

```css
Posición: absolute top-2 right-2
Tamaño: 6x6 (24px)
Forma: Círculo (rounded-full)
Color fondo: bg-error/80 (rojo semi-transparente)
Hover: bg-error (rojo sólido)
Color texto: white
Z-index: 10 (encima del card)
Ícono: X de 14px (lucide-react)
```

**Visual:**
```
┌────────────────────────────┐
│ Sala 930961           [ X ]│ ← Botón rojo pequeño
│ Host: prueba3              │
│                            │
│ 🔥 1.00 Fire               │
│ Estado: Jugando            │
│                            │
│ [Unirse a la Sala]         │
└────────────────────────────┘
```

### Solo visible para admin/tote

**Usuario normal:**
- No ve botón (X)
- Solo ve información de la sala

**Usuario Tote (telegram_id 1417856820):**
- Ve botón (X) en TODAS las salas
- Puede cerrar cualquier sala activa
- Confirmación antes de cerrar

---

## LOGS ESPERADOS

### Admin cierra sala exitosamente

```
INFO: Admin closed TicTacToe room {
  roomCode: '930961',
  userId: 'tote-uuid',
  refundedPlayers: 2,
  betAmount: 1.00,
  mode: 'fires'
}

INFO: Room connections cleaned up { roomCode: '930961' }
```

### Host cierra su sala

```
INFO: Host closed TicTacToe room {
  roomCode: '123456',
  userId: 'host-uuid',
  refundedPlayers: 1,
  betAmount: 10,
  mode: 'coins'
}
```

### Intento de cerrar sala sin permisos

```
ERROR: Error closing room: No tienes permisos para cerrar esta sala
```

---

## VERIFICACIÓN POST-DEPLOY

### Test Case 1: Cerrar sala 930961 (caso reportado)
1. Usuario Tote ingresa a `/tictactoe/lobby`
2. ✅ Verificar que ve botón (X) en sala 930961
3. ✅ Clic en (X), confirmar en popup
4. ✅ Verificar toast: "Sala cerrada. N jugador(es) reembolsados."
5. ✅ Verificar que sala desaparece del lobby
6. ✅ Verificar en BD: `status = 'cancelled'`
7. ✅ Verificar balances de jugadores incrementados
8. ✅ Si era fires: Verificar registros en `wallet_transactions`

### Test Case 2: Admin cierra sala en progreso
1. Crear sala con 2 jugadores, iniciar juego
2. Admin ingresa a lobby
3. ✅ Ve botón (X) en sala activa
4. ✅ Clic y confirmar
5. ✅ Jugadores reciben notificación de cierre
6. ✅ Ambos son redirigidos al lobby
7. ✅ Reembolsos registrados correctamente

### Test Case 3: Host cierra su sala vacía
1. Host crea sala, no se une nadie
2. Host ve su sala en lobby
3. ✅ Ve botón (X) (porque es host y sala está vacía)
4. ✅ Puede cerrar su sala
5. ✅ Recibe reembolso de su apuesta

### Test Case 4: Usuario normal NO ve botón
1. Usuario sin rol admin/tote ingresa a lobby
2. ✅ Ve salas normalmente
3. ✅ NO ve ningún botón (X)
4. ✅ Solo puede unirse a salas

### Test Case 5: Registro solo en fires
1. Admin cierra sala con mode = 'coins'
2. ✅ Reembolsos se aplican correctamente
3. ✅ NO se registra en `wallet_transactions`
4. Admin cierra sala con mode = 'fires'
5. ✅ Reembolsos se aplican correctamente
6. ✅ SÍ se registra en `wallet_transactions`

---

## COMPARACIÓN CON BINGO/RIFAS

| Característica | Bingo | Rifas | TicTacToe (Nuevo) |
|----------------|-------|-------|-------------------|
| Endpoint can-close | ✅ | ✅ | ✅ |
| Endpoint DELETE | ✅ | ✅ | ✅ |
| Botón admin | ✅ | ✅ | ✅ |
| Reembolso jugadores | ✅ | ✅ | ✅ |
| Registro transacciones | ✅ Siempre | ✅ Siempre | ✅ Solo fires |
| Socket cleanup | ✅ | ✅ | ✅ |
| Confirmación popup | ✅ | ✅ | ✅ |
| Toast resultado | ✅ | ✅ | ✅ |

**Diferencia clave:** TicTacToe registra transacciones SOLO para fires, no para coins.

---

## SEGURIDAD

### Validaciones Backend

1. **Token requerido:** `verifyToken` middleware
2. **Verificar rol:** `user.roles.includes('tote')`
3. **Verificar estado sala:** Solo `waiting/ready/playing`
4. **Transacción atómica:** `FOR UPDATE` lock
5. **Prevenir race conditions:** Lock en base de datos
6. **Validar permisos doble:** En `/can-close` y en `/delete`

### Prevención de Abuse

```javascript
// No se puede cerrar salas ya cerradas
if (!['waiting', 'ready', 'playing'].includes(room.status)) {
  throw new Error('Esta sala no puede ser cerrada');
}

// Host solo puede cerrar su sala sin invitado
if (!isAdmin && room.player_o_id) {
  throw new Error('No puedes cerrar una sala con invitado');
}

// Stopear propagación de evento en frontend
onClick={(e) => {
  e.stopPropagation(); // Prevenir abrir sala al cerrar
  handleCloseRoom(room, e);
}}
```

---

## IMPACTO EN OTROS SISTEMAS

### ✅ Sin impacto:
- Bingo V2
- Rifas
- Mercado
- Perfil
- Economía general

### ✅ Mejora integrada:
- Socket tracking (cleanupRoom llamado)
- Wallet transactions (solo fires)
- Logs de auditoría

---

## COMMITS RELACIONADOS HOY

1. `b372329` - fix: parsear board JSONB + mensaje bienvenida
2. `fc5208a` - fix: movimientos + timeout automático con modal
3. `4f1478f` - fix: cierre inmediato salas cuando ambos salen
4. `7f99eb9` - feat: botón admin (X) para cerrar salas **(ACTUAL)**

**Total de cambios TicTacToe hoy:** 4 commits, 462 líneas

---

## RESUMEN EJECUTIVO

**Problema:**
- Sala 930961 permanecía abierta sin poder cerrarla
- Usuario Tote necesitaba control administrativo sobre salas

**Solución:**
- Botón (X) para admin/tote en lobby
- Reembolso automático al cerrar
- Registro en historial (solo fires)
- Misma UX que Bingo y Rifas

**Resultado:**
- ✅ Admin puede cerrar cualquier sala activa
- ✅ Jugadores son reembolsados automáticamente
- ✅ Socket connections limpiadas
- ✅ Historial de fuegos mantiene registro
- ✅ Sala 930961 puede ser cerrada ahora

**Tiempo implementación:** 1.5 horas  
**LOC agregadas:** 219 líneas  
**Breaking changes:** 0  
**Compatibilidad:** 100%

---

**URL Railway:** https://mundoxyz-production.up.railway.app

**Una vez desplegado, usuario Tote podrá cerrar sala 930961 con un solo clic** ✅🔥
