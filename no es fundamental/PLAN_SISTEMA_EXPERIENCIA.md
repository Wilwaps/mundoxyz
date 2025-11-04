# 📊 PLAN DE IMPLEMENTACIÓN: SISTEMA DE EXPERIENCIA (XP)

**Fecha:** 25 de Octubre, 2025  
**Versión:** 1.0  
**Estado:** ✅ Listo para aprobación

---

## 🎯 RESUMEN EJECUTIVO

### Objetivo
Sistema de experiencia (XP) que registra participación en juegos para gamificación, insignias futuras y métricas de engagement.

### Valores de XP por Juego
| Juego | XP | Razón |
|-------|-----|-------|
| **La Vieja** | 1 XP | Juego rápido |
| **Bingo** | 5 XP | Duración media, multi-jugador |
| **Rifa** | 10 XP | Mayor inversión |

### Principios
✅ XP por **participación**, no solo victoria  
✅ Registro **automático** al finalizar  
✅ **Historial completo** auditado  
✅ **Escalable** para futuros juegos

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS

### 1. Modificar tabla `users`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_to_next_level INTEGER NOT NULL DEFAULT 100;

CREATE INDEX idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX idx_users_current_level ON users(current_level DESC);
```

### 2. Nueva tabla `xp_transactions`

```sql
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL CHECK (xp_amount > 0),
  game_type VARCHAR(50) NOT NULL, -- 'tictactoe', 'bingo', 'raffle'
  game_id UUID,
  game_code VARCHAR(20),
  level_before INTEGER NOT NULL,
  level_after INTEGER NOT NULL,
  total_xp_before INTEGER NOT NULL,
  total_xp_after INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_xp_user ON xp_transactions(user_id);
CREATE INDEX idx_xp_game ON xp_transactions(game_type);
CREATE INDEX idx_xp_created ON xp_transactions(created_at DESC);
```

### 3. Marcar juegos con XP otorgado

```sql
-- Prevenir doble otorgamiento
ALTER TABLE bingo_rooms ADD COLUMN xp_awarded BOOLEAN DEFAULT FALSE;
ALTER TABLE raffles ADD COLUMN xp_awarded BOOLEAN DEFAULT FALSE;
```

---

## ⚙️ LÓGICA DE OTORGAMIENTO

### Sistema de Niveles
**Fórmula:** `XP_requerido = 100 * nivel^1.5`

| Nivel | XP Total Requerido | XP para Próximo Nivel |
|-------|-------------------|---------------------|
| 1 | 0 | 100 |
| 2 | 100 | 182 (+282 total) |
| 3 | 282 | 237 (+519 total) |
| 5 | 1,061 | 353 |
| 10 | 5,478 | 684 |

### Función Central: `awardXp()`

**Archivo:** `backend/utils/xp.js`

```javascript
const { query, transaction } = require('../db');

function calculateXpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function calculateLevelFromXp(totalXp) {
  let level = 1;
  let accumulated = 0;
  
  while (accumulated + calculateXpForLevel(level) <= totalXp) {
    accumulated += calculateXpForLevel(level);
    level++;
  }
  
  return {
    level,
    xpToNextLevel: calculateXpForLevel(level) - (totalXp - accumulated)
  };
}

async function awardXp(userId, xpAmount, gameType, gameId, gameCode, metadata = {}) {
  return await transaction(async (client) => {
    // 1. Obtener estado actual
    const user = await client.query(
      'SELECT total_xp, current_level FROM users WHERE id = $1',
      [userId]
    );
    
    if (user.rows.length === 0) throw new Error('Usuario no encontrado');
    
    const { total_xp: xpBefore, current_level: levelBefore } = user.rows[0];
    
    // 2. Calcular nuevo estado
    const xpAfter = xpBefore + xpAmount;
    const { level: levelAfter, xpToNextLevel } = calculateLevelFromXp(xpAfter);
    
    // 3. Registrar transacción
    await client.query(
      `INSERT INTO xp_transactions 
       (user_id, xp_amount, game_type, game_id, game_code, 
        level_before, level_after, total_xp_before, total_xp_after, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, xpAmount, gameType, gameId, gameCode, 
       levelBefore, levelAfter, xpBefore, xpAfter, JSON.stringify(metadata)]
    );
    
    // 4. Actualizar usuario
    await client.query(
      `UPDATE users 
       SET total_xp = $1, current_level = $2, xp_to_next_level = $3
       WHERE id = $4`,
      [xpAfter, levelAfter, xpToNextLevel, userId]
    );
    
    return {
      xp_awarded: xpAmount,
      total_xp: xpAfter,
      level_before: levelBefore,
      level_after: levelAfter,
      leveled_up: levelAfter > levelBefore
    };
  });
}

async function awardXpBatch(awards) {
  const results = [];
  for (const award of awards) {
    try {
      const result = await awardXp(
        award.userId, award.xpAmount, award.gameType, 
        award.gameId, award.gameCode, award.metadata
      );
      results.push({ ...result, userId: award.userId });
    } catch (error) {
      results.push({ userId: award.userId, error: error.message });
    }
  }
  return results;
}

module.exports = { awardXp, awardXpBatch, calculateLevelFromXp };
```

---

## 🎮 INTEGRACIÓN POR JUEGO

### 1. Bingo (5 XP)

**Ubicación:** `backend/routes/bingo.js` - Endpoint que finaliza partida

```javascript
const { awardXpBatch } = require('../utils/xp');

// Al finalizar sala
const room = await client.query(
  'SELECT id, xp_awarded FROM bingo_rooms WHERE code = $1',
  [code]
);

if (room.rows[0].xp_awarded) {
  return res.status(400).json({ error: 'XP ya otorgado' });
}

// Marcar XP otorgado
await client.query(
  'UPDATE bingo_rooms SET xp_awarded = TRUE, status = \'finished\' WHERE id = $1',
  [room.rows[0].id]
);

// Obtener participantes
const players = await client.query(
  'SELECT user_id FROM bingo_players WHERE room_id = $1',
  [room.rows[0].id]
);

// Otorgar 5 XP a cada uno
const awards = players.rows.map(p => ({
  userId: p.user_id,
  xpAmount: 5,
  gameType: 'bingo',
  gameId: room.rows[0].id,
  gameCode: code,
  metadata: { won: p.user_id === winnerId }
}));

const results = await awardXpBatch(awards);
```

### 2. Rifas (10 XP)

**Ubicación:** `backend/routes/raffles.js` - Endpoint que sortea

```javascript
// Al sortear ganador
const raffle = await client.query(
  'SELECT id, xp_awarded FROM raffles WHERE code = $1',
  [code]
);

if (raffle.rows[0].xp_awarded) {
  return res.status(400).json({ error: 'XP ya otorgado' });
}

// Marcar XP otorgado
await client.query(
  'UPDATE raffles SET xp_awarded = TRUE, status = \'completed\' WHERE id = $1',
  [raffle.rows[0].id]
);

// Obtener participantes
const participants = await client.query(
  'SELECT user_id FROM raffle_participants WHERE raffle_id = $1',
  [raffle.rows[0].id]
);

// Otorgar 10 XP
const awards = participants.rows.map(p => ({
  userId: p.user_id,
  xpAmount: 10,
  gameType: 'raffle',
  gameId: raffle.rows[0].id,
  gameCode: code,
  metadata: { won: p.user_id === winnerId }
}));

const results = await awardXpBatch(awards);
```

### 3. Tic-Tac-Toe (1 XP)

**Ubicación:** `backend/routes/games.js` o nuevo `backend/routes/tictactoe.js`

```javascript
// Al finalizar partida
const awards = [
  {
    userId: player1_id,
    xpAmount: 1,
    gameType: 'tictactoe',
    gameId: roomId,
    gameCode: roomId.slice(0, 8),
    metadata: { won: winner_id === player1_id }
  },
  {
    userId: player2_id,
    xpAmount: 1,
    gameType: 'tictactoe',
    gameId: roomId,
    gameCode: roomId.slice(0, 8),
    metadata: { won: winner_id === player2_id }
  }
];

const results = await awardXpBatch(awards);
```

---

## 🔌 NUEVOS ENDPOINTS API

### Profile XP

**Archivo:** `backend/routes/profile.js`

```javascript
// GET /api/profile/:userId/xp
router.get('/:userId/xp', optionalAuth, async (req, res) => {
  const result = await query(
    `SELECT total_xp, current_level, xp_to_next_level FROM users WHERE id = $1`,
    [req.params.userId]
  );
  res.json(result.rows[0]);
});

// GET /api/profile/:userId/xp-history
router.get('/:userId/xp-history', verifyToken, async (req, res) => {
  const { limit = 50, offset = 0, game_type } = req.query;
  
  let query = 'SELECT * FROM xp_transactions WHERE user_id = $1';
  const params = [req.params.userId];
  
  if (game_type) {
    query += ' AND game_type = $2';
    params.push(game_type);
  }
  
  query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await query(query, params);
  res.json({ transactions: result.rows });
});
```

### Leaderboard

**Nuevo archivo:** `backend/routes/leaderboard.js`

```javascript
const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/leaderboard/xp
router.get('/xp', async (req, res) => {
  const result = await query(
    `SELECT 
       username, display_name, avatar_url, total_xp, current_level,
       RANK() OVER (ORDER BY total_xp DESC) as rank
     FROM users
     WHERE is_active = TRUE
     ORDER BY total_xp DESC
     LIMIT 100`
  );
  res.json({ leaderboard: result.rows });
});

module.exports = router;
```

**Registrar en `backend/server.js`:**
```javascript
const leaderboardRoutes = require('./routes/leaderboard');
app.use('/api/leaderboard', leaderboardRoutes);
```

---

## 📦 PLAN DE MIGRACIÓN

### Archivo: `MIGRACION_SISTEMA_XP.sql`

```sql
-- ================================================
-- MIGRACIÓN: Sistema de Experiencia (XP)
-- ================================================

BEGIN;

-- 1. Agregar columnas a users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_to_next_level INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_current_level ON users(current_level DESC);

-- 2. Crear tabla xp_transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL CHECK (xp_amount > 0),
  game_type VARCHAR(50) NOT NULL,
  game_id UUID,
  game_code VARCHAR(20),
  level_before INTEGER NOT NULL,
  level_after INTEGER NOT NULL,
  total_xp_before INTEGER NOT NULL,
  total_xp_after INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_game ON xp_transactions(game_type);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON xp_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_game_id ON xp_transactions(game_id);

-- 3. Agregar flags xp_awarded
ALTER TABLE bingo_rooms ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN DEFAULT FALSE;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bingo_xp ON bingo_rooms(xp_awarded) WHERE status = 'finished';
CREATE INDEX IF NOT EXISTS idx_raffles_xp ON raffles(xp_awarded) WHERE status IN ('completed', 'finished');

COMMIT;

-- ================================================
-- VERIFICACIÓN
-- ================================================
SELECT 'users columns' as check, column_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('total_xp', 'current_level', 'xp_to_next_level');

SELECT 'xp_transactions table' as check, COUNT(*) FROM xp_transactions;

SELECT 'bingo xp_awarded' as check, column_name 
FROM information_schema.columns 
WHERE table_name = 'bingo_rooms' AND column_name = 'xp_awarded';
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### Backend
- [ ] Crear `backend/utils/xp.js` con funciones de cálculo y otorgamiento
- [ ] Ejecutar `MIGRACION_SISTEMA_XP.sql` en Railway
- [ ] Integrar `awardXpBatch()` en `backend/routes/bingo.js`
- [ ] Integrar `awardXpBatch()` en `backend/routes/raffles.js`
- [ ] Integrar `awardXpBatch()` en `backend/routes/games.js` (Tic-Tac-Toe)
- [ ] Agregar endpoints XP en `backend/routes/profile.js`
- [ ] Crear `backend/routes/leaderboard.js` y registrar ruta

### Frontend
- [ ] Crear `frontend/src/contexts/XpContext.js`
- [ ] Componente `XpProgressBar.js` (barra de progreso)
- [ ] Componente `LevelBadge.js` (insignia de nivel)
- [ ] Agregar XP en Header (nivel + barra)
- [ ] Página Leaderboard `/leaderboard`
- [ ] Mostrar XP ganado en toast post-partida

### Testing
- [ ] Test unitario: `calculateLevelFromXp()`
- [ ] Test integración: otorgar XP en Bingo
- [ ] Test integración: otorgar XP en Rifa
- [ ] Test integración: subida de nivel
- [ ] Test endpoint: `GET /api/profile/:id/xp`
- [ ] Test endpoint: `GET /api/leaderboard/xp`

---

## ⏱️ CRONOGRAMA ESTIMADO

| Fase | Duración | Tareas |
|------|----------|--------|
| **Fase 1: Backend Core** | 2-3 horas | Migración SQL, `xp.js`, endpoints |
| **Fase 2: Integración Juegos** | 2-3 horas | Hooks en Bingo, Rifas, Tic-Tac-Toe |
| **Fase 3: Frontend** | 3-4 horas | Context, componentes, UI |
| **Fase 4: Testing** | 2 horas | Pruebas unitarias e integración |
| **Fase 5: Deploy** | 1 hora | Push a GitHub, deploy Railway |
| **TOTAL** | **10-13 horas** | |

---

## 🚀 PRÓXIMOS PASOS (FUTURO)

1. **Sistema de Insignias**
   - Tabla `badges` (nombre, descripción, icono, condición)
   - Tabla `user_badges` (badges desbloqueados)
   - Badges por nivel, victorias, racha, juegos jugados

2. **Recompensas por Nivel**
   - Coins/Fires al subir de nivel
   - Multiplicadores de XP temporales
   - Acceso a salas VIP

3. **Estadísticas Avanzadas**
   - XP por día/semana/mes
   - Gráficos de progresión
   - Comparación con amigos

4. **Racha (Streak)**
   - Días consecutivos jugando
   - Bonus XP por racha activa

---

## ✅ CONFIRMACIÓN PARA INICIAR

Este plan cubre:
- ✅ Almacenamiento de XP en `users`
- ✅ Historial completo en `xp_transactions`
- ✅ Otorgamiento automático post-partida
- ✅ Sistema de niveles escalable
- ✅ Prevención de doble otorgamiento
- ✅ API completa para frontend
- ✅ Base para insignias futuras

**¿Procedo con la implementación?** 🚀
