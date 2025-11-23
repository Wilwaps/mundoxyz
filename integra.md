# Guía de Integración de Juegos con Mundo XYZ

Este documento explica todo lo que un equipo externo necesita para **integrar un juego nuevo** en el ecosistema de **Mundo XYZ**, respetando:

- Estética y UX existentes.
- APIs y contratos de backend (auth, economía, salas, códigos).
- Cableado frontend (rutas, navegación, sockets).

Si sigues esta guía, el juego se integrará de forma coherente y funcional con el resto de la plataforma.

---

## 1. Arquitectura General de Mundo XYZ

### 1.1 Frontend

- **Framework**: React + React Router + React Query.
- **Estilos**: TailwindCSS + componentes propios (`card-glass`, `btn-primary`, etc.).
- **Contextos importantes**:
  - `AuthContext`: usuario autenticado, roles, helpers como `useAuth()`.
  - `SocketContext`: conexión Socket.IO compartida.
- **Ejecución**:
  - MiniApp de Telegram (WebApp) y navegador estándar.

### 1.2 Backend

- **Framework**: Node.js + Express.
- **BD**: PostgreSQL.
- **Tiempo real**: Socket.IO.
- **Middleware clave**:
  - `verifyToken`: valida JWT y carga `req.user`.
  - Otros para roles globales (admin, tote, etc.).

### 1.3 Economía

- Dos monedas:
  - `coins`
  - `fires`
- Tablas principales:
  - `wallets`
  - `wallet_transactions`
- Los juegos integran con la economía mediante:
  - Descuento de apuesta al crear / unirse a una sala.
  - Registro de transacciones (`type` típicos: `game_bet`, `game_prize`).
  - Acreditación de premio al finalizar.

### 1.4 Sistema Unificado de Salas

- Tabla central: `room_codes`.
  - Campos principales: `code`, `game_type`, `room_id`, `status`.
  - `game_type` soporta: `tictactoe`, `bingo`, `raffle`, `pool`, `caida` y puede ampliarse.
- Servicio backend: `RoomCodeService`.
  - `reserveCode(gameType, roomId, client?)` → genera código único de 6 dígitos.
  - `findRoomByCode(code)` → busca en `room_codes`.
  - `getRoomDetails(code)` → obtiene detalles desde la tabla específica del juego.

Cada juego define su propia tabla de salas (p.ej. `tictactoe_rooms`, `bingo_v2_rooms`, `pool_rooms`, `caida_rooms`, `mygame_rooms`, etc.).

---

## 2. Principios que Debe Respetar un Juego Nuevo

### 2.1 Usuarios y Autenticación

- Toda interacción de juego ocurre con el usuario autenticado.
- Las rutas del juego deben usar `verifyToken`.
- El frontend NO gestiona tokens manualmente: usa `AuthContext`.

### 2.2 Salas de Juego

- Cada sala tiene:
  - Un `code` de 6 dígitos (compartido con todos los juegos).
  - Un estado `status` (patrón recomendado):
    - `waiting` | `ready` | `playing` | `finished` | `cancelled`.
- El Quick Join funciona siempre a partir del `code`.

### 2.3 Economía y Apuestas

- El juego define su modo:
  - `mode`: `'coins'` | `'fires'`.
- Reglas mínimas:
  - Al **crear sala**, se descuenta la apuesta del host.
  - Al **unirse**, se descuenta la apuesta del jugador que entra.
  - El pozo se acumula en `pot_coins` o `pot_fires`.
  - Al finalizar se reparte el pozo según reglas del juego.

### 2.4 Sockets

- Canal por sala:
  - `roomName = "<gameType>:" + code` (ej: `"pool:123456"`).
- Eventos típicos:
  - `<game>:player-joined`
  - `<game>:game-started`
  - `<game>:state-updated`
  - `<game>:game-ended`
- El backend emite eventos, el frontend escucha y actualiza UI.

---

## 3. Estética y UX

### 3.1 Layout General

- El juego vive dentro del layout principal (`<Layout />`):
  - Fondo oscuro con efecto “glass”.
  - Barra inferior de navegación global.
  - Cabecera con título / breadcrumbs.

### 3.2 Estilo Visual

- **Colores** (aprox.):
  - Fondo: `bg-background-dark`.
  - Texto principal: `text-text` (claro).
  - Acentos: `text-accent`, `bg-accent/20`, etc.
  - Estados: `text-success`, `text-error`, `text-warning`.

- **Componentes reutilizables**:
  - Tarjetas: `card-glass`, `glass-panel`.
  - Botones:
    - Primario: `btn-primary`.
    - Secundario: `btn-secondary`, `bg-glass hover:bg-glass-hover`.
    - Pills: `rounded-full text-xs bg-*/20`.

- **Animaciones (framer-motion)**:
  - Entrada de secciones con `initial={{ opacity: 0, y: 20 }}` y `animate={{ opacity: 1, y: 0 }}`.
  - Pequeñas transiciones de escala / opacidad al hacer hover.

- **Tipografía e iconos**:
  - Misma fuente global que el resto de la app.
  - Iconos de `lucide-react` (`import { IconName } from 'lucide-react'`).

- **Mensajes y Notificaciones**:
  - Uso de `react-hot-toast` ya configurado en `App.js`.
  - Para operaciones del juego: `toast.success(...)`, `toast.error(...)`.

El nuevo juego debe reutilizar estas clases y patrones para verse coherente con `TicTacToeRoom`, `PoolRoom`, `CaidaRoom`, etc.

---

## 4. Backend: Cómo Integrar un Juego Nuevo

Supongamos que el juego se llama **MyGame** (`game_type = 'mygame'`).

### 4.1 Tabla de Salas del Juego

Ejemplo mínimo de estructura de tabla (`mygame_rooms`):

- `id` (UUID, PK).
- `code` (VARCHAR(10) o 6–10 caracteres, UNIQUE).
- `host_id` (UUID → `users.id`).
- `mode` (`coins` | `fires`).
- `bet_amount` (DECIMAL).
- `visibility` (`public` | `private`).
- `status` (`waiting`, `ready`, `playing`, `finished`, `cancelled`).
- `pot_coins`, `pot_fires`.
- Campos de estado específicos de tu juego (`game_state`, jugadores, etc.).
- `created_at`, `updated_at`, `started_at`, `finished_at`.

Se recomienda seguir como referencia las migraciones existentes:

- `backend/db/migrations/058_create_pool_game.sql`
- `backend/db/migrations/059_create_caida_game.sql`

### 4.2 Uso de RoomCodeService y room_codes

1. **Extender tipos válidos**

   - En `backend/services/roomCodeService.js`:
     - Añadir `'mygame'` a `validTypes` en `reserveCode`.
     - Añadir un `case 'mygame'` en `getRoomDetails` que lea desde `mygame_rooms`.

2. **Actualizar CHECK de BD**

   - En una nueva migración SQL (`backend/db/migrations/0XX_extend_room_codes_for_mygame.sql`):

     ```sql
     BEGIN;

     ALTER TABLE room_codes
       DROP CONSTRAINT IF EXISTS room_codes_game_type_check;

     ALTER TABLE room_codes
       ADD CONSTRAINT room_codes_game_type_check
         CHECK (game_type IN ('tictactoe', 'bingo', 'raffle', 'pool', 'caida', 'mygame'));

     COMMENT ON COLUMN room_codes.game_type
       IS 'Tipo de juego: tictactoe, bingo, raffle, pool, caida, mygame';

     COMMIT;
     ```

3. **Crear sala usando RoomCodeService**

   - En tu ruta `/api/mygame/create`:

     ```js
     const RoomCodeService = require('../services/roomCodeService');

     router.post('/create', verifyToken, async (req, res) => {
       // ... validaciones, manejo de wallet, etc. dentro de una transaction
       const result = await transaction(async (client) => {
         const roomId = uuidv4();

         const roomResult = await client.query(
           `INSERT INTO mygame_rooms (id, code, host_id, mode, bet_amount, visibility, status, pot_coins, pot_fires)
            VALUES ($1, 'TEMP', $2, $3, $4, $5, 'waiting', $6, $7)
            RETURNING *`,
           [roomId, userId, mode, betAmount, visibility,
            mode === 'coins' ? betAmount : 0,
            mode === 'fires' ? betAmount : 0]
         );

         const room = roomResult.rows[0];

         // Reservar código único en room_codes
         const code = await RoomCodeService.reserveCode('mygame', roomId, client);
         await client.query('UPDATE mygame_rooms SET code = $1 WHERE id = $2', [code, roomId]);
         room.code = code;

         return room;
       });

       res.json({ success: true, room: result });
     });
     ```

### 4.3 Rutas estándar del juego

Para integrarse “como un nativo”, un juego debería exponer al menos:

1. **Crear sala**

   - `POST /api/mygame/create`
   - Auth: `verifyToken`.
   - Body: `{ mode, bet_amount, visibility }`.
   - Hace: validaciones, descuento de apuesta, creación en `mygame_rooms`, reserva de código.

2. **Unirse por código**

   - `POST /api/mygame/join/:code`
   - Auth: `verifyToken`.
   - Hace: buscar sala, verificar cupo y estado, descontar apuesta, actualizar pozo y estado, emitir evento socket `mygame:player-joined`.

3. **Obtener detalles de sala**

   - `GET /api/mygame/room/:code`
   - Auth: `verifyToken`.
   - Responde con todos los datos que el frontend necesita para renderizar la partida.

4. **Iniciar partida**

   - `POST /api/mygame/room/:code/start`
   - Auth: `verifyToken`.
   - Normalmente sólo el host puede iniciar.
   - Actualiza `status`, inicializa `game_state` y emite `mygame:game-started`.

5. **Acciones del juego**

   - Rutas según reglas: `/api/mygame/room/:code/move`, `/play`, etc.
   - Deben ejecutarse en transacciones para mantener consistencia de estado y economía.

6. **Finalizar partida y pago de premio**

   - Al determinar ganador(es):
     - Actualizar sala a `finished`.
     - Calcular premio(s) y aplicar a `wallets`, registrando `wallet_transactions`.
     - Emitir eventos socket `mygame:game-ended`.

### 4.4 Integración con `/api/rooms/find/:code` (Quick Join)

En `backend/routes/rooms.js` ya existe:

- `GET /api/rooms/find/:code`
  - Llama `RoomCodeService.getRoomDetails(code)`.
  - Según `game_type`, construye `redirect_url`.

Para soportar `mygame`, añadir en el `switch`:

```js
case 'mygame':
  redirectUrl = `/mygame/room/${code}`;
  break;
```

---

## 5. Frontend: Cómo Cablear el Juego

### 5.1 Rutas en React Router

En `frontend/src/App.js`, dentro del bloque protegido (`<Route path="/" element={<ProtectedRoute>...`):

```jsx
<Route path="mygame/lobby" element={<MyGameLobby />} />
<Route path="mygame/room/:code" element={<MyGameRoom />} />
```

### 5.2 Entrada en Pantalla de Juegos

En `frontend/src/pages/Games.js`:

- Añadir una tarjeta similar a las de Pool / Caída:
  - Ícono SVG representativo.
  - Texto del juego.
  - Contador de salas activas (si se desea, a partir de `/api/games/list`).
  - `onClick={() => navigate('/mygame/lobby')}`.

### 5.3 Componente `MyGameLobby`

Responsabilidades típicas:

- Mostrar:
  - Explicación breve del juego.
  - Balance de monedas del usuario.
- Permitir:
  - Crear sala (formulario: modo, apuesta, visibilidad).
  - Listar salas actuales (si el diseño lo requiere).
  - Quick Join por código (usando `/api/rooms/find/:code`).

Uso de herramientas:

- `useAuth()` para obtener `user`.
- `useQuery` / `useMutation` de React Query para API.
- `toast` para feedback.

### 5.4 Componente `MyGameRoom`

Responsabilidades típicas:

1. **Carga inicial**

   - Obtener `code` desde `useParams()`.
   - Llamar `GET /api/mygame/room/:code`.
   - Manejar estados de cargando / error.

2. **Sockets**

   - Con `useContext(SocketContext)` obtener la instancia de `socket`.
   - Unirse al canal `mygame:${code}` en `useEffect`.
   - Escuchar eventos (`player-joined`, `game-started`, `state-updated`, etc.) y actualizar estado local.

3. **UI**

   - Header con:
     - Nombre del juego.
     - Código de sala.
     - Modo y apuesta.
   - Lista de jugadores (host + oponentes / participantes).
   - Zona principal del juego (tablero, cartas, bolas, etc.).
   - Botones de acción (Listo, Iniciar, Abandonar, etc.).

4. **Estados de sala**

   - Condicionar la UI a `room.status`:
     - `waiting`: lobby interno (esperando más jugadores).
     - `ready`: a la espera de que el host inicie.
     - `playing`: vista de juego activa.
     - `finished`: mostrar resultado y acciones posteriores.

5. **Navegación**

   - Usar `useNavigate()` para volver al lobby o a otras pantallas al finalizar.

---

## 6. Flujo Completo de Usuario (Resumen)

1. El usuario entra a **Games** y selecciona el nuevo juego.
2. Es dirigido a `/mygame/lobby`.
3. Crea una sala:
   - Frontend → `POST /api/mygame/create`.
   - Backend crea la entrada en `mygame_rooms`, reserva código con `RoomCodeService` y responde con `room.code`.
   - Frontend navega a `/mygame/room/:code`.
4. Otros jugadores pueden:
   - Entrar al mismo lobby.
   - Usar Quick Join (`/api/rooms/find/:code`), que devolverá redirección a `/mygame/room/:code`.
5. Los jugadores se unen, marcan `ready` etc., el host inicia la partida.
6. El juego se desarrolla mediante sockets y endpoints específicos.
7. Al finalizar:
   - Se actualiza la sala y se paga premio(s).
   - Se emite evento `mygame:game-ended`.
   - El frontend muestra resultados y ofrece volver al lobby.

---

## 7. Entregables Esperados de un Integrador Externo

Para que la integración con Mundo XYZ sea completa, el equipo externo debe entregar:

1. **Backend (dentro de este repositorio)**
   - Archivo de rutas Express: `backend/routes/mygame.js` con:
     - `POST /api/mygame/create`
     - `POST /api/mygame/join/:code`
     - `GET /api/mygame/room/:code`
     - `POST /api/mygame/room/:code/start`
     - Endpoints adicionales del juego.
   - Migración SQL en `backend/db/migrations/` para `mygame_rooms` (y tablas auxiliares).
   - Extensión de `RoomCodeService` y `room_codes` para `game_type = 'mygame'`.
   - Extensión de `backend/routes/rooms.js` para soportar Quick Join de `mygame`.

2. **Frontend (dentro de este repositorio)**
   - Componentes React:
     - `frontend/src/pages/MyGameLobby.js`
     - `frontend/src/pages/MyGameRoom.js`
   - Actualización de rutas en `frontend/src/App.js`.
   - Tarjeta en `frontend/src/pages/Games.js` para acceder a `MyGameLobby`.
   - Uso de `AuthContext`, `SocketContext`, React Query y estilos existentes.

3. **Estética / UX**
   - Reutilización de clases Tailwind y componentes globales.
   - Animaciones con framer-motion en línea con el resto de la app.
   - Mensajería de errores y éxitos consistente con Mundo XYZ.

Siguiendo esta guía, cualquier juego nuevo puede integrarse a Mundo XYZ de forma homogénea y sin romper la experiencia existente.
