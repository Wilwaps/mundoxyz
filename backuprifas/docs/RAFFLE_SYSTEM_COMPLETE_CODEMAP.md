# 📊 CODEMAP COMPLETO - SISTEMA RIFAS ACTUAL

## 🔴 ARCHIVOS A MOVER A BACKUP

### BACKEND - Archivos Core:
```
backend/
├── routes/raffles.js              (1248 líneas)
├── services/RaffleService.js      (2489 líneas)
├── socket/raffles.js              (117 líneas)
```

### FRONTEND - Páginas:
```
frontend/src/pages/
├── RaffleRoom.js                  (911 líneas)
├── RafflesLobby.js                (525 líneas)
├── RafflePublicLanding.js         (VERIFICAR)
```

### FRONTEND - Componentes:
```
frontend/src/components/raffles/
├── CreateRaffleModal.js           (1220 líneas)
├── BuyNumberModal.js              (469 líneas)
├── NumberGrid.js                  (483 líneas)
├── PaymentDetailsModal.js         (VERIFICAR)
├── ParticipantsModal.js          (VERIFICAR)
├── BuyNumberModal.css            (VERIFICAR)
└── (otros componentes raffle)
```

### FRONTEND - Componentes adicionales:
```
frontend/src/components/raffle/    (carpeta alternativa)
├── CancelRaffleModal.js          (VERIFICAR)
└── (otros)
```

## 🔴 REFERENCIAS A ELIMINAR

### 1. backend/server.js
```javascript
// ELIMINAR:
const raffleRoutes = require('./routes/raffles');
app.use('/api/raffles', raffleRoutes);

// ELIMINAR inicialización socket:
const RaffleSocketHandler = require('./socket/raffles');
global.raffleSocket = new RaffleSocketHandler(io);
io.on('connection', (socket) => {
    global.raffleSocket.setupListeners(socket);
});
```

### 2. frontend/src/App.js o Router
```javascript
// ELIMINAR imports:
import RaffleRoom from './pages/RaffleRoom';
import RafflesLobby from './pages/RafflesLobby';
import RafflePublicLanding from './pages/RafflePublicLanding';

// ELIMINAR rutas:
<Route path="/raffles/lobby" element={<RafflesLobby />} />
<Route path="/raffles/:code" element={<RaffleRoom />} />
<Route path="/raffles/public/:code" element={<RafflePublicLanding />} />
```

### 3. frontend/src/components/Navigation o Menu
```javascript
// ELIMINAR links:
<Link to="/raffles/lobby">Rifas</Link>
// O cualquier botón/link a rifas
```

### 4. frontend/src/contexts/SocketContext.js
```javascript
// ELIMINAR eventos:
socket.on('raffle:*', ...)
socket.emit('join-raffle', ...)
socket.emit('leave-raffle', ...)
```

## 🔴 TABLAS DE BASE DE DATOS (NO ELIMINAR - SOLO DOCUMENTAR)

```sql
-- Tablas principales:
raffles
raffle_numbers
raffle_companies
raffle_requests
raffle_winners
raffle_payment_details

-- Triggers y funciones:
trigger_create_raffle_numbers()
trigger_update_raffle_progress()
```

## 🔴 DOCUMENTACIÓN A MOVER

```
RAFFLE_*.md
FIX_RAFFLE*.md
PLAN_RAFFLE*.md
RIFAS_*.md
Documentacion rifa/
```

## 🟡 VERIFICACIONES POST-LIMPIEZA

1. **Backend NO debe tener:**
   - Referencias a RaffleService
   - Rutas /api/raffles
   - Socket handlers de rifas
   - Global.raffleSocket

2. **Frontend NO debe tener:**
   - Imports de componentes raffle
   - Rutas a /raffles/*
   - Referencias en navegación
   - Queries de raffles

3. **Package.json NO debe tener:**
   - Dependencias específicas de rifas (si las hay)

## 🟢 ESTRUCTURA FINAL DESPUÉS DE LIMPIEZA

```
MUNDOXYZ/
├── backuprifas/                    # TODO EL SISTEMA VIEJO
│   ├── backend/
│   │   ├── routes/
│   │   │   └── raffles.js
│   │   ├── services/
│   │   │   └── RaffleService.js
│   │   └── socket/
│   │       └── raffles.js
│   ├── frontend/
│   │   ├── pages/
│   │   │   ├── RaffleRoom.js
│   │   │   ├── RafflesLobby.js
│   │   │   └── RafflePublicLanding.js
│   │   └── components/
│   │       ├── raffles/
│   │       │   └── (todos los componentes)
│   │       └── raffle/
│   │           └── (todos los componentes)
│   └── docs/
│       └── (toda la documentación)
├── backend/                        # LIMPIO SIN RIFAS
│   ├── server.js                  # SIN referencias a rifas
│   ├── routes/                    # SIN raffles.js
│   └── services/                  # SIN RaffleService.js
└── frontend/                       # LIMPIO SIN RIFAS
    └── src/
        ├── App.js                 # SIN rutas de rifas
        └── components/            # SIN carpetas raffles/raffle
