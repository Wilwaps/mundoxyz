# 📊 PLAN COMPLETO: SISTEMA DE EXPERIENCIA Y METAS

**Fecha:** 3 Nov 2025  
**Objetivo:** Implementar sistema completo de experiencia con historial y metas de logros  
**Prioridad:** Alta - Sin errores

---

## 🎯 FASE 1: CORRECCIÓN EXPERIENCIA (URGENTE)

### ✅ Problema Identificado
- La experiencia se muestra en Layout: `⭐ {displayExperience} XP`
- Fuente: `user?.experience || 0`
- **Verificar:** ¿Se actualiza después de juegos?

### 📋 Tareas
1. ✅ Verificar que `refreshUser()` actualiza experience después de:
   - Partidas de TicTacToe
   - Partidas de Bingo
   - Rifas finalizadas
2. ✅ Agregar invalidación de queries de usuario en eventos de experiencia
3. ✅ Testing: Ganar juego → Ver experiencia aumentar

---

## 🎯 FASE 2: MODAL HISTORIAL DE EXPERIENCIA

### 📐 Diseño del Modal
**Similar a:** Modal de historial de fuegos  
**Ubicación:** Click en badge `⭐ XP` del header

### 🏗️ Estructura del Modal

```javascript
ExperienceHistoryModal.js
├─ Header: "📊 Historial de Experiencia"
├─ Stats Card:
│  ├─ Total XP: 450
│  ├─ Nivel: 5
│  ├─ Próximo nivel: 500 XP (50 restantes)
│  └─ Barra de progreso
├─ Filtros:
│  ├─ Todo
│  ├─ Juegos
│  ├─ Rifas
│  └─ Logros
└─ Lista de transacciones:
   ├─ [+2 XP] Participar en rifa - #482913
   ├─ [+5 XP] Ganar partida TicTacToe
   ├─ [+3 XP] Ganar partida Bingo
   └─ [+10 XP] 🏆 Logro desbloqueado: Primera Victoria
```

### 📊 Campos de la Tabla

```sql
CREATE TABLE experience_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 🎨 Componente React

**Archivo:** `frontend/src/components/experience/ExperienceHistoryModal.js`

**Props:**
- `isOpen: boolean`
- `onClose: function`

**Features:**
- ✅ Paginación (20 items por página)
- ✅ Filtros por tipo
- ✅ Stats card con nivel y progreso
- ✅ Animaciones con Framer Motion
- ✅ Responsive (mobile-first)
- ✅ Iconos específicos por tipo de actividad

---

## 🎯 FASE 3: SISTEMA DE METAS Y LOGROS

### 🏆 Metas de Experiencia

```javascript
const EXPERIENCE_MILESTONES = {
  // Rifas
  CREATE_RAFFLE: {
    required: 10,
    title: "Crear Rifas",
    description: "Necesitas 10 XP para crear rifas",
    icon: "🎲",
    category: "raffle"
  },
  
  // Bingo
  AUTO_CALL_BINGO: {
    required: 400,
    title: "Auto-Canto Bingo",
    description: "Necesitas 400 XP para activar auto-canto",
    icon: "🤖",
    category: "bingo",
    feature: "auto_call"
  },
  
  BINGO_3_ROOMS: {
    required: 500,
    title: "3 Salas Simultáneas",
    description: "Necesitas 500 XP para crear 3 salas de Bingo",
    icon: "🎮",
    category: "bingo",
    feature: "multi_rooms"
  },
  
  // TicTacToe
  TICTACTOE_EXPERT: {
    required: 200,
    title: "Experto en Vieja",
    description: "Necesitas 200 XP para partidas avanzadas",
    icon: "⭕",
    category: "tictactoe"
  },
  
  // Niveles generales
  LEVEL_5: {
    required: 50,
    title: "Nivel 5",
    description: "Alcanza 50 XP",
    icon: "⭐",
    reward: "100 coins"
  },
  
  LEVEL_10: {
    required: 100,
    title: "Nivel 10",
    description: "Alcanza 100 XP",
    icon: "🌟",
    reward: "250 coins"
  },
  
  LEVEL_20: {
    required: 200,
    title: "Nivel 20",
    description: "Alcanza 200 XP",
    icon: "💫",
    reward: "500 coins + 50 fires"
  }
};
```

### 📊 Sistema de Niveles

```javascript
// utils/experienceSystem.js

export const getLevelFromXP = (xp) => {
  return Math.floor(xp / 10) + 1;
};

export const getXPForNextLevel = (xp) => {
  const currentLevel = getLevelFromXP(xp);
  return currentLevel * 10;
};

export const getProgressToNextLevel = (xp) => {
  const nextLevelXP = getXPForNextLevel(xp);
  const currentLevelXP = (getLevelFromXP(xp) - 1) * 10;
  const xpInCurrentLevel = xp - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return {
    current: xpInCurrentLevel,
    required: xpNeededForLevel,
    percentage: (xpInCurrentLevel / xpNeededForLevel) * 100,
    remaining: xpNeededForLevel - xpInCurrentLevel
  };
};

export const getUnlockedFeatures = (xp) => {
  return Object.entries(EXPERIENCE_MILESTONES)
    .filter(([key, milestone]) => xp >= milestone.required)
    .map(([key, milestone]) => ({
      key,
      ...milestone
    }));
};

export const getLockedFeatures = (xp) => {
  return Object.entries(EXPERIENCE_MILESTONES)
    .filter(([key, milestone]) => xp < milestone.required)
    .map(([key, milestone]) => ({
      key,
      ...milestone,
      remaining: milestone.required - xp
    }));
};
```

### 🎨 Componente de Metas

**Archivo:** `frontend/src/components/experience/ExperienceMilestones.js`

```jsx
const ExperienceMilestones = ({ userXP }) => {
  const unlockedFeatures = getUnlockedFeatures(userXP);
  const lockedFeatures = getLockedFeatures(userXP);
  
  return (
    <div className="space-y-4">
      <h3>🔓 Desbloqueadas ({unlockedFeatures.length})</h3>
      {unlockedFeatures.map(feature => (
        <MilestoneCard 
          key={feature.key}
          {...feature}
          unlocked={true}
        />
      ))}
      
      <h3>🔒 Bloqueadas ({lockedFeatures.length})</h3>
      {lockedFeatures.map(feature => (
        <MilestoneCard 
          key={feature.key}
          {...feature}
          unlocked={false}
        />
      ))}
    </div>
  );
};
```

---

## 🎯 FASE 4: REGISTRO DE EXPERIENCIA

### 📝 Backend Service

**Archivo:** `backend/services/experienceService.js`

```javascript
class ExperienceService {
  constructor(pool) {
    this.pool = pool;
  }
  
  async awardExperience(userId, amount, type, description, reference = null) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Actualizar experiencia del usuario
      await client.query(
        'UPDATE users SET experience = experience + $1 WHERE id = $2',
        [amount, userId]
      );
      
      // Registrar transacción
      await client.query(
        `INSERT INTO experience_transactions 
         (user_id, amount, type, description, reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, amount, type, description, reference]
      );
      
      // Verificar logros desbloqueados
      const userResult = await client.query(
        'SELECT experience FROM users WHERE id = $1',
        [userId]
      );
      
      const newXP = userResult.rows[0].experience;
      const unlockedMilestones = this.checkMilestones(newXP);
      
      await client.query('COMMIT');
      
      return {
        success: true,
        newXP,
        unlockedMilestones
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getHistory(userId, { limit = 50, offset = 0, type = null }) {
    const query = type
      ? `SELECT * FROM experience_transactions 
         WHERE user_id = $1 AND type = $2 
         ORDER BY created_at DESC 
         LIMIT $3 OFFSET $4`
      : `SELECT * FROM experience_transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`;
    
    const params = type 
      ? [userId, type, limit, offset]
      : [userId, limit, offset];
    
    const result = await this.pool.query(query, params);
    
    return result.rows;
  }
  
  checkMilestones(xp) {
    // Implementar lógica de verificación de logros
    return [];
  }
}
```

### 🔌 API Endpoints

**Archivo:** `backend/routes/experience.js`

```javascript
// GET /api/experience/history
router.get('/history', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { limit, offset, type } = req.query;
  
  const history = await experienceService.getHistory(userId, {
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    type
  });
  
  res.json({ history });
});

// GET /api/experience/milestones
router.get('/milestones', verifyToken, async (req, res) => {
  const userXP = req.user.experience || 0;
  
  const unlocked = getUnlockedFeatures(userXP);
  const locked = getLockedFeatures(userXP);
  
  res.json({ unlocked, locked, userXP });
});

// GET /api/experience/stats
router.get('/stats', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const userXP = req.user.experience || 0;
  
  const stats = {
    totalXP: userXP,
    level: getLevelFromXP(userXP),
    progress: getProgressToNextLevel(userXP),
    unlockedCount: getUnlockedFeatures(userXP).length,
    lockedCount: getLockedFeatures(userXP).length
  };
  
  res.json({ stats });
});
```

---

## 🎯 FASE 5: INTEGRACIÓN EN JUEGOS

### 🎮 Actualizar Servicios Existentes

**TicTacToe:**
```javascript
// En distributePrizes()
await experienceService.awardExperience(
  winnerId,
  5,
  'tictactoe_win',
  'Victoria en La Vieja',
  roomCode
);

// Ambos jugadores (participación)
await experienceService.awardExperience(
  playerId,
  1,
  'tictactoe_play',
  'Participación en La Vieja',
  roomCode
);
```

**Bingo:**
```javascript
// Ganador
await experienceService.awardExperience(
  winnerId,
  3,
  'bingo_win',
  'Victoria en Bingo',
  roomCode
);

// Participantes
await experienceService.awardExperience(
  playerId,
  1,
  'bingo_play',
  'Participación en Bingo',
  roomCode
);
```

**Rifas:**
```javascript
// Ya implementado - mantener
await client.query(`
  UPDATE users 
  SET experience = experience + 2
  WHERE id IN (
    SELECT DISTINCT purchased_by 
    FROM raffle_numbers 
    WHERE raffle_id = $1 AND status = 'purchased'
  )
`, [raffleId]);

// Agregar transacción de experiencia
await experienceService.awardExperience(
  userId,
  2,
  'raffle_participation',
  'Participación en rifa',
  raffleCode
);
```

---

## 🎯 FASE 6: VALIDACIONES CON EXPERIENCIA

### 🔐 Middleware de Validación

**Archivo:** `backend/middleware/experienceCheck.js`

```javascript
const requireExperience = (requiredXP) => {
  return (req, res, next) => {
    const userXP = req.user?.experience || 0;
    
    if (userXP < requiredXP) {
      return res.status(403).json({
        error: `Necesitas ${requiredXP} XP. Tienes ${userXP} XP.`,
        required: requiredXP,
        current: userXP,
        remaining: requiredXP - userXP
      });
    }
    
    next();
  };
};
```

### 🎲 Aplicar en Rutas

**Rifas:**
```javascript
router.post('/create', 
  verifyToken, 
  requireExperience(10),  // ← NUEVO
  async (req, res) => {
    // Crear rifa
  }
);
```

**Bingo:**
```javascript
router.post('/auto-call/enable',
  verifyToken,
  requireExperience(400),  // ← NUEVO
  async (req, res) => {
    // Activar auto-canto
  }
);
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ FASE 1: Corrección (INMEDIATO)
- [ ] Verificar refreshUser() después de juegos
- [ ] Testing en TicTacToe
- [ ] Testing en Bingo
- [ ] Testing en Rifas

### ✅ FASE 2: Migración DB
- [ ] Crear migración `011_experience_system.sql`
- [ ] Tabla `experience_transactions`
- [ ] Deploy y verificar

### ✅ FASE 3: Backend
- [ ] Crear `services/experienceService.js`
- [ ] Crear `routes/experience.js`
- [ ] Crear `middleware/experienceCheck.js`
- [ ] Crear `utils/experienceSystem.js`
- [ ] Testing de endpoints

### ✅ FASE 4: Frontend Components
- [ ] Crear `components/experience/ExperienceHistoryModal.js`
- [ ] Crear `components/experience/ExperienceMilestones.js`
- [ ] Crear `components/experience/ProgressBar.js`
- [ ] Crear `components/experience/MilestoneCard.js`
- [ ] Testing de componentes

### ✅ FASE 5: Integración UI
- [ ] Modificar Layout.js (click en badge XP)
- [ ] Agregar modal de experiencia
- [ ] Testing responsive
- [ ] Testing animaciones

### ✅ FASE 6: Integración Juegos
- [ ] Actualizar TicTacToe service
- [ ] Actualizar Bingo service
- [ ] Actualizar Rifas service
- [ ] Testing de otorgamiento de XP

### ✅ FASE 7: Validaciones
- [ ] Aplicar requireExperience en rifas
- [ ] Aplicar requireExperience en bingo
- [ ] Testing de restricciones
- [ ] Mensajes de error claros

### ✅ FASE 8: Testing Final
- [ ] Test E2E: Ganar juego → Ver XP → Ver historial
- [ ] Test: Desbloquear milestone
- [ ] Test: Intentar crear rifa sin XP
- [ ] Test: Responsive en mobile
- [ ] Test: Performance (queries optimizadas)

---

## 🎨 DISEÑO UI/UX

### 🎨 Colores y Estilos

```css
/* Experience Badge */
.badge-experience {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #1a1a1a;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-weight: bold;
  box-shadow: 0 4px 6px rgba(255, 215, 0, 0.3);
}

/* Progress Bar */
.xp-progress-bar {
  background: linear-gradient(90deg, #FFD700 0%, #FFA500 100%);
  height: 8px;
  border-radius: 4px;
  transition: width 0.5s ease;
}

/* Milestone Card - Unlocked */
.milestone-unlocked {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: 2px solid #34d399;
}

/* Milestone Card - Locked */
.milestone-locked {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  opacity: 0.6;
}
```

### 🎬 Animaciones

```javascript
// Framer Motion Variants
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.2 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.15 }
  }
};

const milestoneVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: i => ({
    x: 0,
    opacity: 1,
    transition: { delay: i * 0.05 }
  })
};
```

---

## 📊 ESTRUCTURA DE ARCHIVOS FINAL

```
backend/
├── db/migrations/
│   └── 011_experience_system.sql
├── services/
│   └── experienceService.js
├── routes/
│   └── experience.js
├── middleware/
│   └── experienceCheck.js
└── utils/
    └── experienceSystem.js

frontend/src/
├── components/experience/
│   ├── ExperienceHistoryModal.js
│   ├── ExperienceMilestones.js
│   ├── ProgressBar.js
│   └── MilestoneCard.js
├── utils/
│   └── experienceSystem.js
└── components/
    └── Layout.js (modificado)
```

---

## 🎯 ORDEN DE EJECUCIÓN

1. **DÍA 1 (HOY):** 
   - ✅ Fase 1: Corrección urgente
   - ✅ Fase 2: Migración DB
   - ✅ Commit & Push

2. **DÍA 2:**
   - ✅ Fase 3: Backend completo
   - ✅ Testing de endpoints
   - ✅ Commit & Push

3. **DÍA 3:**
   - ✅ Fase 4: Frontend components
   - ✅ Fase 5: Integración UI
   - ✅ Commit & Push

4. **DÍA 4:**
   - ✅ Fase 6: Integración juegos
   - ✅ Fase 7: Validaciones
   - ✅ Commit & Push

5. **DÍA 5:**
   - ✅ Fase 8: Testing final
   - ✅ Pulir detalles
   - ✅ Deploy producción

---

## ✅ CRITERIOS DE ÉXITO

- [ ] Modal de experiencia funciona perfectamente
- [ ] Historial muestra todas las transacciones
- [ ] Sistema de metas es claro y visual
- [ ] Experiencia se otorga correctamente en todos los juegos
- [ ] Validaciones funcionan (ej: 10 XP para crear rifa)
- [ ] UI es responsive y hermosa
- [ ] Animaciones son fluidas
- [ ] Performance es óptima
- [ ] Sin errores en consola
- [ ] Testing completo pasado

---

**📌 NOTA IMPORTANTE:**
Este plan está diseñado para implementación SIN ERRORES.  
Cada fase debe completarse y testearse antes de pasar a la siguiente.

**🎯 META:** Sistema de experiencia robusto, visual y motivador para los usuarios.
