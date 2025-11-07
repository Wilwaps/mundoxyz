# FIX: Public Stats - wallet_transactions JOIN con wallets

**Fecha:** 7 Nov 2025 11:05am  
**Tipo:** SQL Query - Columna inexistente  
**Severidad:** MEDIA (endpoint devolvía defaults)  
**Commit:** cdaed56

---

## 🚨 PROBLEMA

### Error en Producción
```
GET /api/public/stats
Database query error:
Error obteniendo stats públicas: error: column "user_id" does not exist
  code: '42703',
  position: '30',
  line: '3716',
  file: 'parse_relation.c',
  routine: 'errorMissingColumn'
```

### Endpoint Afectado
- `GET /api/public/stats` (landing page)
- Query fallaba en línea 27 de `backend/routes/public.js`

### Síntoma
- Stats públicas devolvían datos por defecto (todos en 0)
- Landing page no mostraba estadísticas reales

---

## 🔍 CAUSA ROOT

### Query Incorrecta (ANTES)
```sql
-- ❌ INCORRECTO
SELECT COUNT(DISTINCT user_id) as active_users_7d
FROM wallet_transactions
WHERE created_at > NOW() - INTERVAL '7 days'
```

**Problema:** `wallet_transactions` NO tiene columna `user_id`

### Estructura Real de Tablas

```sql
-- wallet_transactions (transacciones)
CREATE TABLE wallet_transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL,          -- ← FK a wallets
  type VARCHAR(50) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  amount DECIMAL(20,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- wallets (balances de usuarios)
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,               -- ← Este es el que necesitamos
  coins_balance DECIMAL(20,2),
  fires_balance DECIMAL(20,2)
);
```

**Relación:** `wallet_transactions.wallet_id` → `wallets.id` → `wallets.user_id`

---

## ✅ SOLUCIÓN

### Query Corregida (DESPUÉS)
```sql
-- ✅ CORRECTO
SELECT COUNT(DISTINCT w.user_id) as active_users_7d
FROM wallet_transactions wt
INNER JOIN wallets w ON w.id = wt.wallet_id
WHERE wt.created_at > NOW() - INTERVAL '7 days'
```

### Cambios Implementados

**Archivo:** `backend/routes/public.js`

```javascript
// ANTES (líneas 25-30)
const activeUsers = await query(`
  SELECT COUNT(DISTINCT user_id) as active_users_7d
  FROM wallet_transactions
  WHERE created_at > NOW() - INTERVAL '7 days'
`);

// DESPUÉS (líneas 25-31)
const activeUsers = await query(`
  SELECT COUNT(DISTINCT w.user_id) as active_users_7d
  FROM wallet_transactions wt
  INNER JOIN wallets w ON w.id = wt.wallet_id
  WHERE wt.created_at > NOW() - INTERVAL '7 days'
`);
```

### Explicación del JOIN

1. **FROM wallet_transactions wt** - Tabla principal con transacciones
2. **INNER JOIN wallets w** - Unir con tabla de balances
3. **ON w.id = wt.wallet_id** - Relación FK
4. **COUNT(DISTINCT w.user_id)** - Contar usuarios únicos activos

---

## 📊 CONTEXTO DEL ENDPOINT

### Propósito
Proveer estadísticas públicas para landing page sin autenticación

### Otras Queries en el Endpoint

#### 1. Economía (✅ Ya correcta)
```sql
SELECT 
  SUM(fires_balance) as total_fires_circulation,
  SUM(coins_balance) as total_coins_circulation,
  COUNT(DISTINCT user_id) as total_users_with_balance
FROM wallets  -- ✅ user_id existe aquí
```

#### 2. Total Usuarios (✅ Ya correcta)
```sql
SELECT COUNT(*) as total_users
FROM users  -- ✅ Tabla directa
```

#### 3. Juegos Jugados (✅ Ya correcta)
```sql
SELECT 
  (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status = 'finished'),
  (SELECT COUNT(*) FROM raffles WHERE status = 'finished'),
  (SELECT COUNT(*) FROM tictactoe_rooms WHERE status = 'finished')
```

#### 4. Premios Distribuidos (✅ Ya correcta)
```sql
SELECT SUM(amount) as total_prizes_fires
FROM wallet_transactions
WHERE type IN ('bingo_prize', 'raffle_win', 'tictactoe_win')
  AND currency = 'fires'
```

#### 5. Juegos Activos (✅ Ya correcta)
```sql
SELECT 
  (SELECT COUNT(*) FROM bingo_v2_rooms WHERE status IN ('waiting', 'in_progress')),
  (SELECT COUNT(*) FROM raffles WHERE status IN ('open', 'active')),
  (SELECT COUNT(*) FROM tictactoe_rooms WHERE status = 'in_progress')
```

**Solo la query de usuarios activos estaba incorrecta.**

---

## 🎯 RESULTADO

### Respuesta del Endpoint (Estructura)
```json
{
  "success": true,
  "data": {
    "economy": {
      "totalFiresCirculation": "15000.00",
      "totalCoinsCirculation": "5000.00",
      "usersWithBalance": 42
    },
    "users": {
      "total": 50,
      "active7Days": 15  // ← Este valor ahora es correcto
    },
    "games": {
      "playedLast30Days": { "bingo": 10, "raffles": 5, "tictactoe": 8 },
      "activeNow": { "bingo": 2, "raffles": 3, "tictactoe": 1 }
    },
    "prizes": {
      "distributedLast30Days": "25000.00"
    }
  },
  "timestamp": "2025-11-07T15:05:00.000Z"
}
```

---

## 📝 LECCIONES APRENDIDAS

### 1. Verificar Relaciones FK
**NUNCA asumir que una tabla tiene columna directa:**
```javascript
// ❌ MAL - Asumir que wallet_transactions tiene user_id
SELECT user_id FROM wallet_transactions

// ✅ BIEN - Verificar schema y hacer JOIN si necesario
SELECT w.user_id FROM wallet_transactions wt
INNER JOIN wallets w ON w.id = wt.wallet_id
```

### 2. Consultar DATABASE_SCHEMA_MASTER.sql
Antes de escribir queries:
```bash
grep -A 10 "CREATE TABLE wallet_transactions" no\ es\ fundamental/DATABASE_SCHEMA_MASTER.sql
```

### 3. Patrón de FK Wallet
Este sistema usa patrón estándar:
```
users (id UUID)
  ↓
wallets (user_id UUID, id SERIAL)
  ↓
wallet_transactions (wallet_id INTEGER)
```

**Para obtener user_id desde wallet_transactions SIEMPRE hacer JOIN.**

### 4. Testing de Queries
Al escribir queries SQL complejas:
1. Verificar schema de tablas involucradas
2. Identificar relaciones FK
3. Probar query localmente primero
4. Usar Railway logs para debugging

---

## 🔄 PATRÓN SIMILAR EN CODEBASE

### Queries Correctas (Para Referencia)

#### A. Transacciones de un usuario específico
```sql
-- ✅ CORRECTO
SELECT wt.*
FROM wallet_transactions wt
INNER JOIN wallets w ON w.id = wt.wallet_id
WHERE w.user_id = $1
ORDER BY wt.created_at DESC
```

#### B. Balance actual de usuario
```sql
-- ✅ CORRECTO - Acceso directo
SELECT coins_balance, fires_balance
FROM wallets
WHERE user_id = $1
```

#### C. Usuarios con más transacciones
```sql
-- ✅ CORRECTO - JOIN para contar
SELECT w.user_id, u.username, COUNT(*) as tx_count
FROM wallet_transactions wt
INNER JOIN wallets w ON w.id = wt.wallet_id
INNER JOIN users u ON u.id = w.user_id
GROUP BY w.user_id, u.username
ORDER BY tx_count DESC
```

---

## 🚀 VERIFICACIÓN POST-DEPLOY

### 1. Probar Endpoint
```bash
curl https://mundoxyz-production.up.railway.app/api/public/stats
```

Verificar que:
- ✅ `success: true`
- ✅ `users.active7Days` tiene valor real (> 0)
- ✅ No aparece error en logs Railway

### 2. Logs Railway
Buscar:
- ✅ `GET /api/public/stats` sin errores
- ❌ NO debe aparecer "column user_id does not exist"

### 3. Frontend Landing
Si hay landing page que consume estas stats:
- Verificar que stats se muestren correctamente
- active7Days debe mostrar número real, no 0

---

## 📋 CHECKLIST PREVENCIÓN

Al escribir queries con wallet_transactions:

- [ ] Verificar si necesito user_id
- [ ] Si necesito user_id, hacer JOIN con wallets
- [ ] Consultar schema en DATABASE_SCHEMA_MASTER.sql
- [ ] Probar query localmente antes de commit
- [ ] Verificar FK constraints (wallet_id → wallets.id)
- [ ] Agregar alias claros (wt, w, u)
- [ ] Usar INNER JOIN para garantizar datos válidos

---

## 🔗 RELACIONADO

### Categoría: Nombres de Columnas Incorrectos
Este fix entra en la categoría de errores documentados en:
- `MEMORY[fc17bbcb]` - Fixes críticos tontos
- Similar a: `coins` vs `coins_balance` (commit ef13d53)
- Similar a: `total_numbers` vs `numbers_range` (commit f18db02)

### Diferencia Clave
Este caso es más sutil porque:
- No es un nombre incorrecto de columna
- Es una **relación FK mal interpretada**
- La columna SÍ existe, pero en otra tabla
- Requiere JOIN, no solo cambio de nombre

---

## ✅ STATUS

- [x] Problema identificado (column user_id does not exist)
- [x] Schema verificado (wallet_transactions usa wallet_id)
- [x] JOIN implementado correctamente
- [x] Commit realizado (cdaed56)
- [x] Push a main
- [ ] Deploy Railway completado (esperando...)
- [ ] Endpoint `/api/public/stats` verificado
- [ ] Stats públicas funcionales

**IMPACTO:** Landing page mostrará estadísticas reales de usuarios activos
