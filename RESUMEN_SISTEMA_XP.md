# ⚡ RESUMEN: SISTEMA DE EXPERIENCIA (XP)

---

## 📊 VALORES DE XP

| Juego | XP Otorgado | Participantes |
|-------|-------------|---------------|
| **La Vieja (Tic-Tac-Toe)** | **1 XP** | Ambos jugadores |
| **Bingo** | **5 XP** | Todos los jugadores de la sala |
| **Rifa** | **10 XP** | Todos los participantes |

**💡 Nota:** XP se otorga por participación, no solo por ganar.

---

## 🗄️ CAMBIOS EN BASE DE DATOS

### Tabla `users` (3 columnas nuevas)
- `total_xp` → XP acumulado total
- `current_level` → Nivel actual
- `xp_to_next_level` → XP faltante para próximo nivel

### Nueva tabla `xp_transactions` (historial completo)
- Registra cada otorgamiento de XP
- Incluye: usuario, cantidad, juego, nivel antes/después, timestamp

### Prevención de duplicados
- `bingo_rooms.xp_awarded` (flag)
- `raffles.xp_awarded` (flag)

---

## 📈 SISTEMA DE NIVELES

**Fórmula:** XP requerido = `100 * nivel^1.5`

```
Nivel 1 → 2:    100 XP
Nivel 2 → 3:    282 XP
Nivel 3 → 4:    519 XP
Nivel 5 → 6:    866 XP
Nivel 10 → 11:  3,162 XP
```

**Progresión exponencial** = más difícil subir a niveles altos.

---

## 🔧 IMPLEMENTACIÓN BACKEND

### 1. Archivo Core: `backend/utils/xp.js`
```javascript
awardXp(userId, xpAmount, gameType, gameId, gameCode, metadata)
├─ Obtiene XP actual del usuario
├─ Calcula nuevo nivel
├─ Registra en xp_transactions
└─ Actualiza users (total_xp, current_level)
```

### 2. Integración en endpoints de juegos

**Bingo** (`backend/routes/bingo.js`)
```javascript
// Al finalizar sala
if (!room.xp_awarded) {
  await awardXpBatch([
    { userId: player1, xpAmount: 5, gameType: 'bingo', ... },
    { userId: player2, xpAmount: 5, gameType: 'bingo', ... },
    // ...
  ]);
  await markXpAwarded(roomId);
}
```

**Rifas** (`backend/routes/raffles.js`)
```javascript
// Al sortear ganador
if (!raffle.xp_awarded) {
  await awardXpBatch([
    { userId: participant1, xpAmount: 10, gameType: 'raffle', ... },
    // ...
  ]);
  await markXpAwarded(raffleId);
}
```

**Tic-Tac-Toe** (`backend/routes/games.js`)
```javascript
// Al finalizar partida
await awardXpBatch([
  { userId: player1, xpAmount: 1, gameType: 'tictactoe', ... },
  { userId: player2, xpAmount: 1, gameType: 'tictactoe', ... }
]);
```

### 3. Nuevos endpoints API

```
GET /api/profile/:userId/xp
→ { total_xp, current_level, xp_to_next_level }

GET /api/profile/:userId/xp-history?game_type=bingo&limit=50
→ { transactions: [...] }

GET /api/leaderboard/xp?limit=100
→ { leaderboard: [{ username, total_xp, rank }, ...] }
```

---

## 🎨 IMPLEMENTACIÓN FRONTEND

### 1. Context: `XpContext.js`
```javascript
const { xpData, refreshXp } = useXp();
// xpData = { total_xp, current_level, xp_to_next_level }
```

### 2. Componentes UI

**XpProgressBar** → Barra de progreso visual con nivel  
**LevelBadge** → Badge con número de nivel  
**XpGainToast** → Notificación "+5 XP ⭐" post-partida

### 3. Integraciones

- **Header:** Mostrar nivel + barra XP
- **Perfil:** Stats completos, historial de XP
- **Post-partida:** Toast con XP ganado y subida de nivel
- **Leaderboard:** Página `/leaderboard` con Top 100

---

## 📦 ARCHIVOS CREADOS

✅ `PLAN_SISTEMA_EXPERIENCIA.md` → Plan completo detallado (10 páginas)  
✅ `MIGRACION_SISTEMA_XP.sql` → Script SQL listo para Railway  
✅ `RESUMEN_SISTEMA_XP.md` → Este resumen ejecutivo  

---

## ⏱️ TIEMPO DE IMPLEMENTACIÓN

| Fase | Duración |
|------|----------|
| Backend Core | 2-3 horas |
| Integración Juegos | 2-3 horas |
| Frontend | 3-4 horas |
| Testing | 2 horas |
| Deploy | 1 hora |
| **TOTAL** | **10-13 horas** |

---

## ✅ CHECKLIST RÁPIDO

### Backend
- [ ] Ejecutar `MIGRACION_SISTEMA_XP.sql`
- [ ] Crear `backend/utils/xp.js`
- [ ] Integrar en Bingo
- [ ] Integrar en Rifas
- [ ] Integrar en Tic-Tac-Toe
- [ ] Endpoints `/xp` y `/leaderboard`

### Frontend
- [ ] `XpContext.js`
- [ ] `XpProgressBar` component
- [ ] Header con nivel
- [ ] Toast post-partida
- [ ] Página Leaderboard

### Testing
- [ ] Test cálculo niveles
- [ ] Test otorgamiento XP
- [ ] Test endpoints API

---

## 🚀 VENTAJAS DEL SISTEMA

✅ **Gamificación** → Usuarios motivados a jugar más  
✅ **Progresión visible** → Sensación de logro  
✅ **Base escalable** → Fácil agregar insignias/premios  
✅ **Métricas** → Tracking de engagement  
✅ **Trazabilidad completa** → Historial auditado  

---

## 🎯 PRÓXIMOS PASOS TRAS XP

1. **Sistema de Insignias**
   - "10 Bingos Jugados"
   - "Maestro de Rifas"
   - "Nivel 10 alcanzado"

2. **Recompensas por Nivel**
   - Nivel 5: +100 Coins
   - Nivel 10: +50 Fires
   - Nivel 20: Avatar especial

3. **Racha (Streak)**
   - Días consecutivos jugando
   - Bonus XP por racha activa

---

## 📝 CONFIRMACIÓN

**El plan está completo y listo para implementar.**

**Componentes clave:**
- ✅ XP por participación (no solo victoria)
- ✅ Historial completo auditado
- ✅ Prevención de duplicados
- ✅ Sistema de niveles exponencial
- ✅ API completa para frontend
- ✅ Escalable para insignias futuras

**¿Procedo con la implementación?** 🚀
