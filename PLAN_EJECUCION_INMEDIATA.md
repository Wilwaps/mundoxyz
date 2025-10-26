# 🎯 PLAN DE EJECUCIÓN INMEDIATA - TIC TAC TOE

## 📋 RESUMEN DE REQUERIMIENTOS

Basándome en tu feedback, organizé todas las mejoras necesarias en **4 fases prioritarias**:

---

## 🔥 FASE 1: RECONEXIÓN A SALAS (CRÍTICO)

### **Problema:**
Si saliste por accidente, no puedes volver aunque seas el host.

### **Solución:**
✅ Permitir que cualquier jugador (host o invitado) pueda volver a su sala activa.

### **Implementación:**
1. Modificar endpoint GET `/api/tictactoe/room/:code`
2. Verificar que el usuario pertenece a la sala (player_x o player_o)
3. Restaurar estado del juego
4. Reconectar WebSocket

### **Tiempo estimado:** 2-3 horas

---

## 💰 FASE 2: GESTIÓN DE ABANDONO (CRÍTICO)

### **Escenarios:**

#### **2.1 Ambos jugadores salen:**
- ✅ Sala se elimina
- ✅ Dinero devuelto a ambos
- ⏱️ Timeout: 30 segundos

#### **2.2 Solo host sale (sin invitado):**
- ✅ Sala se elimina
- ✅ Dinero devuelto al host
- ⏱️ Timeout: 30 segundos

#### **2.3 Host sale con invitado presente:**
- ✅ Invitado se convierte en nuevo host (player_x)
- ✅ Sala vuelve a status "waiting"
- ✅ Dinero se mantiene en el pot
- ⏱️ Timeout: 30 segundos

### **Implementación:**
1. Sistema de tracking de conexiones en WebSocket
2. Timeouts de 30 segundos
3. Funciones: `refundBet()`, `cancelRoom()`, `transferHost()`
4. Eventos: `player-disconnected`, `host-transferred`

### **Tiempo estimado:** 4-6 horas

---

## 🎮 FASE 3: SISTEMA DE READY MEJORADO (IMPORTANTE)

### **Cambios:**

#### **Para el Invitado (Player O):**
- ✅ Botón "¡Estoy Listo!"
- ✅ Al hacer click, su tablero **brilla** (efecto glow)
- ✅ Notifica al host

#### **Para el Host (Player X):**
- ✅ Ve cuando invitado está listo
- ✅ Botón "🎮 Iniciar Partida" (solo cuando invitado ready)
- ✅ Al hacer click, comienza el juego

### **Implementación:**
1. Nuevo endpoint POST `/api/tictactoe/room/:code/start`
2. CSS para efecto brillo
3. Lógica en frontend para mostrar botones según rol

### **Tiempo estimado:** 2-3 horas

---

## 📊 FASE 4: VISUALIZACIÓN DEL POT (PULIDO)

### **Mostrar claramente cuánto hay en juego:**

#### **Estado "waiting" (solo host):**
```
Premio en juego: 1 🔥
(Esperando oponente)
```

#### **Estado "ready" (invitado se unió):**
```
Premio en juego: 2 🔥
Host: 1 🔥  +  Invitado: 1 🔥
```

#### **Estado "playing" (juego activo):**
```
PREMIO TOTAL: 2 🔥
```

### **Implementación:**
1. Componente visual mejorado
2. Animaciones según estado
3. Claridad en origen del dinero

### **Tiempo estimado:** 1-2 horas

---

## 📅 CRONOGRAMA PROPUESTO

### **HOY (Sesión 1 - 3 horas):**
- ✅ FASE 1: Reconexión a salas
- ⚠️ Test básico de reconexión

### **HOY (Sesión 2 - 4 horas):**
- ✅ FASE 2: Gestión de abandono (parte 1)
  - Sistema de tracking
  - Devolución de dinero si ambos abandonan
- ⚠️ Test de abandono

### **MAÑANA (Sesión 1 - 3 horas):**
- ✅ FASE 2: Gestión de abandono (parte 2)
  - Transferencia de host
  - Casos edge
- ⚠️ Test de transferencia

### **MAÑANA (Sesión 2 - 2 horas):**
- ✅ FASE 3: Sistema Ready mejorado
- ⚠️ Test flujo completo

### **PASADO MAÑANA (1-2 horas):**
- ✅ FASE 4: Visualización del pot
- ✅ Pulido final
- ⚠️ Test completo de todos los flujos

---

## 🎯 ORDEN DE EJECUCIÓN (PASO A PASO)

### **PASO 1: Reconexión básica** ⏱️ 30 min
```
Backend:
- Modificar GET /api/tictactoe/room/:code
- Verificar si user es player_x o player_o
- Permitir acceso si es parte de la sala
```

### **PASO 2: UI de reconexión** ⏱️ 30 min
```
Frontend:
- Detectar si usuario tiene sala activa
- Mostrar botón "Volver a mi sala" en lobby
- Redirigir automáticamente si está en sala activa
```

### **PASO 3: Tracking de conexiones** ⏱️ 1 hora
```
Backend Socket:
- Map de conexiones por sala
- Eventos connect/disconnect
- Timestamps de última actividad
```

### **PASO 4: Timeouts de abandono** ⏱️ 1 hora
```
Backend:
- Timer de 30 segundos al desconectar
- Verificar estado de sala
- Ejecutar acción según caso:
  * Ambos fuera → cancelar y devolver
  * Solo host fuera (sin invitado) → cancelar y devolver
  * Host fuera (con invitado) → transferir host
```

### **PASO 5: Devolución de apuestas** ⏱️ 1 hora
```
Backend Utils:
- Función refundBet(userId, mode, amount, roomCode)
- Actualizar balance en wallets
- Registrar transacción de devolución
- Marcar sala como cancelled
```

### **PASO 6: Transferencia de host** ⏱️ 1 hora
```
Backend:
- Detectar que hay player_o activo
- Copiar player_o → player_x
- Limpiar player_o
- Cambiar status a 'waiting'
- Notificar via WebSocket
```

### **PASO 7: Botón "Iniciar" para host** ⏱️ 45 min
```
Backend:
- Endpoint POST /room/:code/start
- Verificar que user es host
- Verificar que player_o ready
- Cambiar status a 'playing'
- Emitir evento game-started

Frontend:
- Mostrar botón solo si user es host
- Mostrar solo si invitado ready
- Llamar endpoint al hacer click
```

### **PASO 8: Efecto brillo "Listo"** ⏱️ 30 min
```
Frontend:
- CSS para efecto glow
- Aplicar clase cuando player_o_ready = true
- Animación pulse suave
```

### **PASO 9: Visualización pot mejorada** ⏱️ 30 min
```
Frontend:
- Componente según estado de sala
- Mostrar desglose cuando hay invitado
- Animaciones según fase
```

### **PASO 10: Testing completo** ⏱️ 1 hora
```
- Test reconexión host
- Test reconexión invitado
- Test ambos abandonan
- Test solo host abandona
- Test transferencia host
- Test flujo ready → iniciar → jugar
- Test visualización pot en cada fase
```

---

## ✅ CRITERIOS DE ÉXITO

### **FASE 1:**
- [x] Host puede salir y volver a su sala
- [x] Invitado puede salir y volver a su sala
- [x] Estado del juego se preserva

### **FASE 2:**
- [x] Si ambos abandonan (30 seg), sala se elimina y dinero devuelto
- [x] Si solo host abandona (sin invitado), sala se elimina y dinero devuelto
- [x] Si host abandona (con invitado), invitado se vuelve host

### **FASE 3:**
- [x] Invitado tiene botón "Listo"
- [x] Tablero de invitado brilla cuando está listo
- [x] Host ve estado del invitado
- [x] Host tiene botón "Iniciar Partida"
- [x] Juego comienza solo cuando host inicia

### **FASE 4:**
- [x] Pot muestra origen del dinero claramente
- [x] Actualización visual según fase de la sala
- [x] Animaciones apropiadas

---

## 📊 PRIORIZACIÓN

### **CRÍTICO (hacer primero):**
1. ⭐⭐⭐ Reconexión a salas
2. ⭐⭐⭐ Devolución de dinero si ambos abandonan
3. ⭐⭐⭐ Devolución si solo host abandona

### **ALTO (hacer después):**
4. ⭐⭐ Transferencia de host
5. ⭐⭐ Botón "Iniciar" para host

### **MEDIO (si hay tiempo):**
6. ⭐ Efecto brillo "Listo"
7. ⭐ Visualización pot mejorada

---

## 🚀 COMENZAR AHORA

### **Lo primero que haré:**

1. **Modificar backend para permitir reconexión** (30 min)
2. **Agregar UI de reconexión en frontend** (30 min)
3. **Test básico** (15 min)
4. **Commit y push** ✅

### **Luego continuaré con:**

5. **Sistema de tracking de conexiones** (1 hora)
6. **Timeouts de abandono** (1 hora)
7. **Devolución de apuestas** (1 hora)
8. **Test intermedio** (30 min)
9. **Commit y push** ✅

---

## 📝 ESTRUCTURA DE COMMITS

```
feat: permitir reconexión a salas activas de TicTacToe
feat: agregar tracking de conexiones y timeouts de abandono
feat: implementar devolución de apuestas al cancelar sala
feat: agregar transferencia de host cuando abandona
feat: botón Iniciar Partida solo para host
feat: efecto brillo cuando invitado está listo
feat: mejorar visualización del pot según estado de sala
```

---

## 🎯 RESULTADO FINAL

Después de implementar todas las fases:

✅ Jugadores pueden salir y volver sin problemas
✅ Dinero protegido - siempre se devuelve si hay abandono
✅ Sistema justo de transferencia de host
✅ UX clara con roles definidos (host inicia, invitado se prepara)
✅ Visualización transparente del dinero en juego

---

**ESTADO:** 📋 Plan completo y organizado - Listo para comenzar implementación

**PRÓXIMA ACCIÓN:** Implementar FASE 1 - PASO 1 (Reconexión backend)

**¿Comenzamos?** 🚀
