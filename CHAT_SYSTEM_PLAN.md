# Plan: Sistema de Mensajería Mejorado

**Fecha:** 2025-11-05  
**Deploy actual esperando:** 6 minutos (commit a83d186)

---

## 🎯 Objetivo

Crear sistema de chat unificado permanente con 3 canales:
- **Global:** Chat público con username y hora (NO se cierra)
- **Anónimo:** Solo mensaje sin mostrar quien (NO se cierra)
- **Sala:** Chat de cada tablero (SE CIERRA al salir)

---

## 📊 Estado Actual vs Mejorado

### Actual
- Chat solo en Bingo (`BingoV2Chat.js`)
- Botón: `💬 Chat` (grande)
- Ubicación: Fixed left
- Tabla: `bingo_v2_room_chat_messages`

### Mejorado
- Chat en toda la plataforma (`UnifiedChat.js`)
- Botón: Icono solo (50% tamaño)
- Ubicación: Fixed right
- 3 Tablas: `global_chat_messages`, `anonymous_chat_messages`, `room_chat_messages`

---

## 🗄️ Base de Datos

### Migración 030

```sql
-- Global Chat
CREATE TABLE global_chat_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anonymous Chat
CREATE TABLE anonymous_chat_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unified Room Chat
CREATE TABLE room_chat_messages (
    id SERIAL PRIMARY KEY,
    room_type VARCHAR(20) CHECK (room_type IN ('tictactoe', 'bingo', 'raffle')),
    room_code VARCHAR(6) NOT NULL,
    user_id UUID REFERENCES users(id),
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_global_chat_created ON global_chat_messages(created_at DESC);
CREATE INDEX idx_anonymous_chat_created ON anonymous_chat_messages(created_at DESC);
CREATE INDEX idx_room_chat_type_code ON room_chat_messages(room_type, room_code);
```

---

## ⚙️ Backend - Socket Events

### Archivos Nuevos
- `backend/socket/globalChat.js`
- `backend/socket/anonymousChat.js`
- `backend/socket/roomChat.js`

### Eventos Principales

**Global:**
- `global:chat_message` - Enviar mensaje
- `global:load_history` - Cargar historial
- Broadcast: `io.emit()` a todos

**Anónimo:**
- `anonymous:chat_message` - Enviar sin user
- `anonymous:load_history` - Cargar historial  
- Broadcast: `io.emit()` a todos

**Sala:**
- `room:chat_message` - Enviar en sala
- `room:join_chat` - Unirse a sala
- `room:leave_chat` - Salir de sala
- `room:load_history` - Cargar historial
- Broadcast: `io.to(roomCode)` solo sala

---

## 🎨 Frontend - Componentes

### Estructura
```
frontend/src/components/chat/
├── UnifiedChat.js          # Principal (con botón icono)
├── UnifiedChat.css
├── GlobalChatTab.js
├── AnonymousChatTab.js
├── RoomChatTab.js
└── ChatMessage.js          # Componente reutilizable
```

### UnifiedChat.js - Características Clave

1. **Botón Icono Compacto**
   - Solo icono `<MessageCircle />`
   - Tamaño: 50x50px (50% del actual)
   - Badge de no leídos
   - Fixed bottom-right

2. **Detección Automática de Sala**
   - Regex patterns: `/tictactoe/room/:code`, `/bingo/v2/:code`, `/raffles/:code`
   - Auto-join socket room
   - Auto-show pestaña "Sala"
   - Auto-hide pestaña al salir

3. **Pestañas**
   - Header con tabs: 🌍 Global, 👤 Anónimo, 🎮 Sala
   - Sala solo visible si está en tablero
   - Active state styling

4. **Persistencia**
   - Global y Anónimo siempre disponibles
   - Sala aparece/desaparece según ubicación
   - No se cierra al cambiar páginas (excepto Sala)

---

## 📅 Plan de Implementación

### Fase 1: Backend (2-3 horas)
- [  ] Crear migración 030
- [  ] Crear socket handlers (global, anonymous, room)
- [  ] Registrar en server.js
- [  ] Migrar datos existentes de bingo_v2_room_chat_messages

### Fase 2: Frontend (3-4 horas)
- [  ] Crear carpeta `/chat` y estructura
- [  ] Implementar UnifiedChat.js (lógica tabs y detección)
- [  ] Implementar GlobalChatTab.js
- [  ] Implementar AnonymousChatTab.js  
- [  ] Implementar RoomChatTab.js
- [  ] Implementar ChatMessage.js
- [  ] Crear UnifiedChat.css (botón compacto + responsive)

### Fase 3: Integración (1 hora)
- [  ] Montar UnifiedChat en Layout.js
- [  ] Remover BingoV2Chat.js de salas
- [  ] Testing en todas las páginas
- [  ] Verificar auto-show/hide pestaña Sala

### Fase 4: Testing & Deploy (1 hora)
- [  ] Test Global chat en Lobby
- [  ] Test Anónimo chat
- [  ] Test Sala chat en TicTacToe, Bingo, Rifa
- [  ] Test navegación entre páginas (persistencia)
- [  ] Test mobile responsive
- [  ] Commit y push
- [  ] Esperar 6 min + Chrome DevTools verificación

**Tiempo Total Estimado:** 7-9 horas  
**Deploy Estimado:** Mismo día

---

## ✅ Checklist Funcional

### Chat Global
- [  ] Enviar mensaje con username y hora
- [  ] Ver mensajes de todos los usuarios
- [  ] Historial persistente (últimos 50)
- [  ] No se cierra nunca
- [  ] Disponible en toda la plataforma

### Chat Anónimo
- [  ] Enviar mensaje sin revelar identidad
- [  ] Ver solo el mensaje (sin username)
- [  ] Historial persistente
- [  ] No se cierra nunca
- [  ] Disponible en toda la plataforma

### Chat Sala
- [  ] Auto-detecta cuando entras a sala (TTT, Bingo, Rifa)
- [  ] Pestaña "Sala" aparece automáticamente
- [  ] Mensajes solo visibles para usuarios en esa sala
- [  ] Muestra room type y code
- [  ] Se cierra automáticamente al salir
- [  ] Join/leave socket rooms correcto

### UI/UX
- [  ] Botón icono 50px (mitad tamaño)
- [  ] Icono MessageCircle de lucide-react
- [  ] Badge de mensajes no leídos
- [  ] Tabs responsive
- [  ] Smooth animations
- [  ] Mobile friendly
- [  ] Dark theme compatible

---

## 🔍 Puntos Críticos

### Performance
- Límite 50 mensajes historial
- Cleanup mensajes antiguos (30 días)
- Índices optimizados en created_at

### Seguridad
- Validar usuario en sala antes de enviar
- Sanitizar input (maxLength 200)
- Rate limiting por usuario

### UX
- Scroll automático a último mensaje
- Loading states
- Error handling con toasts
- Typing indicators (opcional fase 2)

---

## 📱 Responsive Design

**Desktop (>768px):**
- Botón bottom-right: 50x50px
- Chat expandido: 400x500px
- 3 tabs horizontales

**Mobile (<768px):**
- Botón bottom-right: 50x50px
- Chat expandido: Full width - 20px margin
- Tabs comprimidos
- Input adaptado

---

## 🚀 Deploy Strategy

1. Backend primero (solo migración y sockets)
2. Frontend después (componentes)
3. Testing en cada fase
4. Un solo commit final con TODO

**Mensaje Commit:**
```
feat: Sistema de Mensajería Unificado con Pestañas

- Chat Global persistente con username y hora
- Chat Anónimo sin revelar identidad
- Chat Sala auto-detecta y se cierra al salir
- Botón icono compacto (50% tamaño)
- UI responsive con tabs
- Socket handlers: globalChat, anonymousChat, roomChat
- Migración 030: 3 tablas nuevas + índices
- Componentes: UnifiedChat, GlobalChatTab, AnonymousChatTab, RoomChatTab
- Montado en Layout para toda la plataforma
```

---

**PRÓXIMO PASO:** Esperar confirmación del deploy actual (6min) y Chrome DevTools, luego comenzar Fase 1.
