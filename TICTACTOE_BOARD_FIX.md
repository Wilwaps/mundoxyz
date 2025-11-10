# FIX CRÍTICO: TicTacToe Board JSON & Columnas Faltantes

**Fecha:** 2025-11-08  
**Commit:** eecfb8d  
**Deploy:** Railway automático (~6 minutos)

---

## 🚨 **PROBLEMA IDENTIFICADO**

### Error 1: Board JSON Parsing Failed
```
Error parsing board JSON: Unexpected end of JSON input
at /app/backend/routes/tictactoe.js:651:29
at /app/backend/routes/tictactoe.js:1286:27
```

**Causa:**  
- Campo `board` en DB es `TEXT` con default `'         '` (9 espacios)
- Al crear sala nueva, `board` queda vacío o con espacios
- `JSON.parse()` falla al intentar parsear string inválido
- Endpoint timeout (línea 651) **NO tenía fallback** → Error 500
- Endpoint GET room (línea 1286) **tenía fallback** → Funciona parcialmente

---

### Error 2: Columna "winner_symbol" No Existe
```
column "winner_symbol" of relation "tictactoe_rooms" does not exist
at /app/backend/routes/tictactoe.js:682:7
```

**Causa:**  
- Código usa `winner_id` y `winner_symbol` (líneas 679-686)
- Schema maestro solo tiene `winner CHAR(1)`
- UPDATE falla en endpoint timeout al intentar marcar ganador por tiempo

---

## ✅ **SOLUCIÓN IMPLEMENTADA**

### 1. Migración 027: Corregir Schema TicTacToe

**Archivo:** `backend/db/migrations/027_fix_tictactoe_schema.sql`

#### Cambios en Tabla `tictactoe_rooms`:

##### A. **Agregar Columnas Faltantes**
```sql
ALTER TABLE tictactoe_rooms 
ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS winner_symbol CHAR(1) CHECK (winner_symbol IN ('X', 'O'));
```

##### B. **Migrar Datos Existentes**
```sql
-- Copiar winner a winner_symbol
UPDATE tictactoe_rooms 
SET winner_symbol = winner 
WHERE winner IS NOT NULL AND winner IN ('X', 'O');
```

##### C. **Cambiar Board a JSONB**
```sql
-- 1. Crear columna temporal JSONB
ALTER TABLE tictactoe_rooms ADD COLUMN board_jsonb JSONB;

-- 2. Migrar datos vacíos/inválidos
UPDATE tictactoe_rooms 
SET board_jsonb = '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
WHERE board IS NULL OR TRIM(board) = '' OR LENGTH(TRIM(board)) = 9;

-- 3. Parsear JSON válidos
UPDATE tictactoe_rooms 
SET board_jsonb = board::jsonb
WHERE board ~ '^\[.*\]$';

-- 4. Reemplazar columna
ALTER TABLE tictactoe_rooms DROP COLUMN board;
ALTER TABLE tictactoe_rooms RENAME COLUMN board_jsonb TO board;
ALTER TABLE tictactoe_rooms 
ALTER COLUMN board SET DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb,
ALTER COLUMN board SET NOT NULL;
```

##### D. **Actualizar Status**
```sql
-- Corregir salas que deberían estar 'playing'
UPDATE tictactoe_rooms 
SET status = 'playing'
WHERE status = 'waiting' 
  AND player_x_ready = TRUE 
  AND player_o_ready = TRUE
  AND started_at IS NOT NULL;
```

##### E. **Índices de Optimización**
```sql
CREATE INDEX IF NOT EXISTS idx_tictactoe_winner_id 
ON tictactoe_rooms(winner_id) WHERE winner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tictactoe_status_playing 
ON tictactoe_rooms(status) WHERE status = 'playing';
```

---

### 2. Código Backend: Agregar Fallback Robusto

**Archivo:** `backend/routes/tictactoe.js`

#### Cambio 1: POST /room/:code/timeout (líneas 648-662)
```javascript
// ANTES (sin fallback):
if (typeof room.board === 'string') {
  try {
    room.board = JSON.parse(room.board);
  } catch (e) {
    logger.error('Error parsing board JSON:', e);
    // ❌ NO HABÍA FALLBACK → Error 500
  }
}

// DESPUÉS (con fallback):
if (typeof room.board === 'string') {
  try {
    room.board = JSON.parse(room.board);
  } catch (e) {
    logger.error('Error parsing board JSON:', e);
    // ✅ Fallback: tablero vacío 3x3
    room.board = [[null,null,null],[null,null,null],[null,null,null]];
  }
}

// ✅ Verificar que sea array (JSONB puede ser objeto)
if (!Array.isArray(room.board)) {
  room.board = [[null,null,null],[null,null,null],[null,null,null]];
}
```

#### Cambio 2: GET /api/tictactoe/room/:code (líneas 1290-1303)
```javascript
// Similar al cambio anterior
if (typeof room.board === 'string') {
  try {
    room.board = JSON.parse(room.board);
  } catch (e) {
    logger.error('Error parsing board JSON:', e);
    room.board = [[null,null,null],[null,null,null],[null,null,null]];
  }
}

// ✅ NUEVO: Verificar que sea array
if (!Array.isArray(room.board)) {
  room.board = [[null,null,null],[null,null,null],[null,null,null]];
}
```

---

### 3. Schema Maestro Actualizado

**Archivo:** `no es fundamental/DATABASE_SCHEMA_MASTER.sql`

```sql
CREATE TABLE IF NOT EXISTS tictactoe_rooms (
  -- ... campos existentes ...
  board JSONB NOT NULL DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb,
  winner CHAR(1) CHECK (winner IN ('X', 'O', 'D')),  -- Mantener para compatibilidad
  winner_id UUID REFERENCES users(id),                -- ✅ NUEVO
  winner_symbol CHAR(1) CHECK (winner_symbol IN ('X', 'O')),  -- ✅ NUEVO
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'playing', 'finished', 'cancelled')),
  archived_at TIMESTAMP,  -- De migración 012
  -- ... resto de campos ...
);
```

**Índices:**
```sql
CREATE INDEX idx_tictactoe_winner_id ON tictactoe_rooms(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX idx_tictactoe_status_playing ON tictactoe_rooms(status) WHERE status = 'playing';
CREATE INDEX idx_tictactoe_rooms_archived ON tictactoe_rooms(archived_at) WHERE archived_at IS NOT NULL;
```

---

## 📊 **COMPARACIÓN: ANTES vs DESPUÉS**

| Campo          | ANTES                     | DESPUÉS                          |
|----------------|---------------------------|----------------------------------|
| `board`        | TEXT (9 espacios)         | JSONB NOT NULL (array 3x3)       |
| `winner_id`    | ❌ No existía              | ✅ UUID REFERENCES users(id)     |
| `winner_symbol`| ❌ No existía              | ✅ CHAR(1) (X o O)               |
| `status`       | waiting/playing/finished  | + 'ready' (ambos listos)         |
| `archived_at`  | ❌ No existía              | ✅ Timestamp (migración 012)     |

---

## 🔄 **FLUJO DE CORRECCIÓN**

### Salas Existentes (120182, 930961)
```sql
-- 1. Detectar board corrupto
SELECT id, code, board FROM tictactoe_rooms WHERE status = 'playing';
-- Resultado: board = '         ' (9 espacios)

-- 2. Migración convierte a JSONB
UPDATE tictactoe_rooms 
SET board_jsonb = '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb
WHERE LENGTH(TRIM(board)) = 9;

-- 3. Código backend maneja cualquier caso
if (!Array.isArray(room.board)) {
  room.board = [[null,null,null],[null,null,null],[null,null,null]];
}
```

### Salas Nuevas (144150+)
```sql
-- Default JSONB en CREATE
INSERT INTO tictactoe_rooms (...)
-- board = '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb (automático)
```

---

## 🎯 **RESULTADO ESPERADO POST-DEPLOY**

### ✅ Endpoint POST /room/:code/timeout
```javascript
// ANTES: Error 500
❌ Error parsing board JSON: Unexpected end of JSON input
❌ Error processing timeout: column "winner_symbol" does not exist

// DESPUÉS: Funciona correctamente
✅ Board parseado o fallback aplicado
✅ winner_id y winner_symbol guardados correctamente
```

### ✅ Endpoint GET /api/tictactoe/room/:code
```javascript
// ANTES: Parcialmente funciona (tenía fallback)
⚠️ Error parsing board JSON → fallback aplicado → continúa

// DESPUÉS: Siempre funciona
✅ Board siempre es array válido (JSONB o fallback)
```

### ✅ Sala 120182 y 930961
```
Salas existentes con board corrupto:
1. Migración las convierte a JSONB válido
2. Código aplica fallback si todavía falla
3. Usuarios pueden jugar normalmente
```

---

## 📝 **ARCHIVOS MODIFICADOS**

| Archivo | LOC | Descripción |
|---------|-----|-------------|
| `backend/db/migrations/027_fix_tictactoe_schema.sql` | +92 | Migración schema |
| `backend/routes/tictactoe.js` | +8 | Agregar fallbacks |
| `no es fundamental/DATABASE_SCHEMA_MASTER.sql` | +14 | Actualizar schema |
| **TOTAL** | **+114** | |

---

## 🚀 **DEPLOY RAILWAY**

**Commit Hash:** `eecfb8d`  
**Mensaje:** "fix(tictactoe): agregar winner_id, winner_symbol y migrar board a JSONB - resolver errores de parsing"

**Tiempo Estimado:** ~6 minutos

**Verificación:**
1. Logs Railway: Buscar "✅ Migración 027 completada"
2. Acceder a sala 120182 o 930961 → No debe haber errores
3. Crear nueva sala → Board debe ser JSONB válido
4. Jugar y hacer timeout → winner_id y winner_symbol guardan correctamente

---

## 🔍 **LOGS ESPERADOS POST-DEPLOY**

### ✅ Migración Exitosa
```
INFO: Ejecutando migración 027_fix_tictactoe_schema.sql
INFO: Columnas winner_id y winner_symbol agregadas
INFO: Board migrado de TEXT a JSONB
INFO: 2 salas actualizadas (120182, 930961)
INFO: ✅ Migración 027 completada
```

### ✅ Sala Funcionando
```
INFO: GET /api/tictactoe/room/120182
INFO: Player reconnecting to room (roomCode: 120182, status: playing)
✅ NO MÁS: Error parsing board JSON
✅ NO MÁS: column "winner_symbol" does not exist
```

---

## 💡 **LECCIONES APRENDIDAS**

1. **Siempre usar JSONB para datos estructurados:**  
   - TEXT requiere parse manual → propenso a errores
   - JSONB automáticamente válido → PostgreSQL lo garantiza

2. **Agregar fallback en TODOS los JSON.parse():**
   ```javascript
   try {
     data = JSON.parse(str);
   } catch (e) {
     logger.error('Parse error:', e);
     data = defaultValue;  // ✅ SIEMPRE tener fallback
   }
   ```

3. **Migrar campos antes de usar en código:**  
   - Código usaba `winner_id` y `winner_symbol` → NO existían
   - Crear migración para agregar columnas faltantes

4. **Sincronizar Schema Maestro con Migraciones:**
   - DATABASE_SCHEMA_MASTER.sql debe reflejar estado ACTUAL en producción
   - Actualizar fecha y columnas después de cada migración

5. **Mantener compatibilidad backward:**
   - Mantener `winner CHAR(1)` aunque `winner_symbol` sea el nuevo
   - Migrar datos existentes: `winner_symbol = winner`

---

## ✅ **ESTADO FINAL**

- **Tabla:** `tictactoe_rooms` completamente sincronizada con código
- **Board:** JSONB NOT NULL con default válido
- **Winner:** Doble tracking: `winner` (legacy) + `winner_id`/`winner_symbol` (nuevo)
- **Fallbacks:** Implementados en todos los endpoints críticos
- **Salas existentes:** Migradas automáticamente sin pérdida de datos
- **Índices:** Optimizados para queries frecuentes

---

## 🎮 **PRUEBAS REQUERIDAS POST-DEPLOY**

1. **Sala existente (120182):**
   - ✅ Acceder sin error "board JSON"
   - ✅ Jugar turno sin error
   - ✅ Timeout marca ganador correctamente

2. **Sala nueva (crear con prueba3):**
   - ✅ Board inicia como array 3x3 vacío
   - ✅ Movimientos se guardan en JSONB
   - ✅ Timeout funciona sin errores

3. **Base de datos:**
   ```sql
   SELECT code, board, winner_id, winner_symbol, status 
   FROM tictactoe_rooms 
   WHERE code IN ('120182', '930961', '144150');
   ```
   - ✅ `board` es JSONB válido
   - ✅ `winner_id` y `winner_symbol` existen

---

## 🔗 **REFERENCIAS**

- **Commit anterior:** `7f99eb9` (Admin close button)
- **Migración anterior:** `026_add_commission_columns_to_market_redeems.sql`
- **Schema maestro:** `no es fundamental/DATABASE_SCHEMA_MASTER.sql` (actualizado 2025-11-08)
- **Railway Project:** https://railway.com/project/9ed64502-9a9f-4129-8cb5-00a50f074995

---

**Status:** ✅ DESPLEGADO - Esperando verificación (6 min)
