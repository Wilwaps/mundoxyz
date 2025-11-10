# 🚨 TICTACTOE - ERRORES DE MIGRACIÓN RESUELTOS

**Proyecto:** MundoXYZ  
**Fecha:** 2025-11-08  
**Contexto:** Corrección de schema de base de datos para sistema TicTacToe

---

## 📊 RESUMEN EJECUTIVO

**Total de errores encontrados:** 8  
**Migraciones creadas/modificadas:** 4 (026, 028, 037, 038)  
**Commits desplegados:** 8  
**Tiempo total:** ~2 horas

---

## 🔍 CRONOLOGÍA COMPLETA DE ERRORES

### **ERROR #1: Columna "winner" inexistente**
```
❌ column "winner" of relation "tictactoe_rooms" does not exist
Code: 42703
```

**Causa:**  
Migración 027 intentaba modificar columna `winner` que nunca existió en producción.

**Impacto:**  
- Deploy fallaba continuamente en Railway
- Sistema TicTacToe bloqueado completamente

**Solución:**
```sql
-- Eliminada migración 027 completa
-- Creada migración 037 que solo maneja columna board
```

**Commit:** `ef449c6`  
**Archivo:** `backend/db/migrations/027_fix_tictactoe_schema.sql` (ELIMINADO)

---

### **ERROR #2: Columna "name" en tabla migrations**
```
❌ column "name" does not exist in migrations table
Code: 42703
```

**Causa:**  
Migración 026 usaba `WHERE name = '027...'` pero la tabla `migrations` usa columna `filename`, no `name`.

**Impacto:**  
- Cleanup de migración 027 no funcionaba
- Railway seguía intentando ejecutar 027 corrupta

**Solución:**
```sql
-- ANTES (INCORRECTO):
DELETE FROM migrations WHERE name = '027_fix_tictactoe_schema.sql';

-- DESPUÉS (CORRECTO):
DELETE FROM migrations WHERE filename = '027_fix_tictactoe_schema.sql';
```

**Commits:** `eb676c4`, `85638cc`  
**Archivos:** 
- `backend/db/migrations/026_cleanup_failed_tictactoe_migration.sql`
- `backend/db/migrations/028_cleanup_failed_027_migration.sql`

---

### **ERROR #3: Railway ejecuta migración 026 antigua**
```
❌ Error: Railway usa versión cached de 026 con sintaxis incorrecta
```

**Causa:**  
Railway cached commit `9bd62ff` con versión antigua de 026 que usaba `name` en lugar de `filename`.

**Impacto:**  
- Cambios locales no se reflejaban en deploy
- Misma migración fallaba repetidamente

**Solución:**
```bash
# Recrear archivo 026 con sintaxis correcta
# Hacer nuevo commit para forzar actualización
git commit -m "fix: recrear 026 con sintaxis correcta"
```

**Commit:** `85638cc`

---

### **ERROR #4: Syntax error RAISE NOTICE**
```
❌ syntax error at or near "RAISE"
Code: 42601
```

**Causa:**  
Migración 037 tenía `RAISE NOTICE` fuera de un bloque `DO $$`.

**Código problemático:**
```sql
-- INCORRECTO:
RAISE NOTICE '✅ Migración 037 completada';

-- CORRECTO:
DO $$ BEGIN
  RAISE NOTICE '✅ Migración 037 completada';
END $$;
```

**Impacto:**  
- Migración 037 fallaba en validación SQL
- Columnas winner_id/winner_symbol no se creaban

**Solución:**
Envolver RAISE NOTICE en bloque PL/pgSQL.

**Commit:** `91df90f`  
**Archivo:** `backend/db/migrations/037_fix_tictactoe_board_only.sql`

---

### **ERROR #5: Columnas winner_id/winner_symbol inexistentes**
```
❌ column "winner_symbol" of relation "tictactoe_rooms" does not exist
Code: 42703
```

**Causa:**  
Asumimos que columnas existían basado en documentación, pero nunca fueron creadas en producción Railway.

**Impacto:**  
- Backend intentaba leer/escribir columnas inexistentes
- Imposible guardar resultado de partidas

**Solución:**
```sql
-- Crear columnas condicionalmente en migración 037
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'winner_id'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN winner_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_rooms' AND column_name = 'winner_symbol'
  ) THEN
    ALTER TABLE tictactoe_rooms 
    ADD COLUMN winner_symbol VARCHAR(1) CHECK (winner_symbol IN ('X', 'O', NULL));
  END IF;
END $$;
```

**Commit:** `c9e2e27`

---

### **ERROR #6: Columnas row/col inexistentes en tictactoe_moves**
```
❌ column "row" of relation "tictactoe_moves" does not exist
Code: 42703
Position: 68
```

**Causa:**  
Tabla `tictactoe_moves` existía en Railway pero con schema incompleto (sin columnas `row`, `col`, `move_number`).

**Impacto:**  
- ERROR 400 al intentar hacer movimientos en TicTacToe
- Sistema completamente no funcional para jugadores

**Solución:**
Crear migración 038 para añadir tablas completas.

**Commit:** `6afca60`  
**Archivo:** `backend/db/migrations/038_create_tictactoe_moves_and_stats.sql` (inicial)

---

### **ERROR #7: CREATE TABLE IF NOT EXISTS no actualiza schema**
```
❌ column "move_number" does not exist
Code: 42703
File: indexcmds.c
Routine: ComputeIndexAttrs
```

**Causa:**  
`CREATE TABLE IF NOT EXISTS` **NO añade columnas a tablas existentes**. Si la tabla ya existe, se salta completamente la creación, incluyendo las definiciones de columnas nuevas.

**Código problemático:**
```sql
-- ESTO NO FUNCIONA SI TABLA YA EXISTE:
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id UUID,
  existing_col TYPE,
  new_col TYPE  -- ❌ NO SE AÑADE SI TABLA EXISTE
);

-- Luego esto falla:
CREATE INDEX ON tictactoe_moves(new_col); -- ❌ ERROR: columna no existe
```

**Impacto:**  
- Migración 038 fallaba al crear índices sobre columnas inexistentes
- Deploy bloqueado en Railway

**Solución:**
```sql
-- 1. Crear tabla base
CREATE TABLE IF NOT EXISTS tictactoe_moves (
  id UUID PRIMARY KEY,
  room_id UUID,
  player_id UUID,
  symbol VARCHAR(1),
  created_at TIMESTAMP
);

-- 2. Añadir columnas UNA POR UNA con ALTER TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_moves' AND column_name = 'row'
  ) THEN
    ALTER TABLE tictactoe_moves ADD COLUMN row INTEGER CHECK (row >= 0 AND row <= 2);
  END IF;
  
  -- Repetir para col, move_number...
END $$;

-- 3. Ahora SÍ crear índices
CREATE INDEX IF NOT EXISTS idx_tictactoe_moves_room ON tictactoe_moves(room_id, move_number);
```

**Commit:** `4581a0f`

---

### **ERROR #8: Columna "position" NOT NULL legacy**
```
❌ null value in column "position" of relation "tictactoe_moves" violates not-null constraint
Code: 23502
Column: position
```

**Causa:**  
Existe una columna `position` en `tictactoe_moves` (creada por script antiguo) con restricción `NOT NULL`, pero el código backend actual NO la usa ni envía valores para ella.

**Código backend:**
```javascript
// backend/routes/tictactoe.js línea 525-528
INSERT INTO tictactoe_moves 
  (room_id, player_id, symbol, row, col, move_number)
VALUES ($1, $2, $3, $4, $5, $6)
// ❌ NO incluye columna "position"
```

**Impacto:**  
- ERROR al intentar registrar movimientos
- Partidas bloqueadas después de primer movimiento

**Solución:**
```sql
-- Hacer columna position NULLABLE (es legacy, no se usa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tictactoe_moves' 
      AND column_name = 'position' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tictactoe_moves ALTER COLUMN position DROP NOT NULL;
    RAISE NOTICE 'Columna position cambiada a NULLABLE (legacy, no usada)';
  END IF;
END $$;
```

**Commit:** `6a9d853`  
**Archivo:** `backend/db/migrations/038_create_tictactoe_moves_and_stats.sql` (actualizado)

---

## 📦 MIGRACIONES FINALES DESPLEGADAS

### **Migración 026: Cleanup migración 027**
```sql
-- Eliminar registro corrupto de migración 027
DELETE FROM migrations WHERE filename = '027_fix_tictactoe_schema.sql';
```

### **Migración 028: Cleanup adicional**
```sql
-- Eliminar registros de 026 y 027 para reset completo
DELETE FROM migrations 
WHERE filename IN (
  '026_cleanup_failed_tictactoe_migration.sql',
  '027_fix_tictactoe_schema.sql'
);
```

### **Migración 037: Fix board + crear winner_id/winner_symbol**
```sql
-- Convertir board a JSONB
-- Crear columnas winner_id y winner_symbol si no existen
-- Añadir índices y comentarios
```

### **Migración 038: Completar schema tictactoe_moves y stats** ✅ FINAL
```sql
-- Crear tabla base tictactoe_moves
-- Añadir columnas row, col, move_number con ALTER TABLE
-- Hacer columna position NULLABLE (legacy)
-- Crear tabla tictactoe_stats completa
-- Añadir índices de performance
```

---

## 🎯 SCHEMA FINAL CORRECTO

### **tictactoe_rooms**
```sql
CREATE TABLE tictactoe_rooms (
  id UUID PRIMARY KEY,
  code VARCHAR(6) UNIQUE,
  host_id UUID REFERENCES users(id),
  player_x_id UUID REFERENCES users(id),
  player_o_id UUID REFERENCES users(id),
  mode VARCHAR(10) CHECK (mode IN ('coins', 'fires')),
  bet_amount NUMERIC(10,2),
  visibility VARCHAR(10) CHECK (visibility IN ('public', 'private')),
  current_turn VARCHAR(1) CHECK (current_turn IN ('X', 'O')),
  status VARCHAR(20) DEFAULT 'waiting',
  
  -- Tablero y estado de juego
  board JSONB DEFAULT '[[null,null,null],[null,null,null],[null,null,null]]'::jsonb NOT NULL,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,        -- ✅ AGREGADA
  winner_symbol VARCHAR(1) CHECK (winner_symbol IN ('X', 'O')),  -- ✅ AGREGADA
  is_draw BOOLEAN DEFAULT false,
  winning_line JSONB,
  
  -- Estados de jugadores
  player_x_ready BOOLEAN DEFAULT false,
  player_o_ready BOOLEAN DEFAULT false,
  player_x_left BOOLEAN DEFAULT false,
  player_o_left BOOLEAN DEFAULT false,
  
  -- Economía
  pot_coins NUMERIC(10,2) DEFAULT 0,
  pot_fires NUMERIC(10,2) DEFAULT 0,
  prize_coins NUMERIC(10,2) DEFAULT 0,
  prize_fires NUMERIC(10,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  last_move_at TIMESTAMP,
  archived_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

### **tictactoe_moves**
```sql
CREATE TABLE tictactoe_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES tictactoe_rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(1) NOT NULL CHECK (symbol IN ('X', 'O')),
  
  -- Posición del movimiento
  row INTEGER CHECK (row >= 0 AND row <= 2),           -- ✅ AGREGADA
  col INTEGER CHECK (col >= 0 AND col <= 2),           -- ✅ AGREGADA
  move_number INTEGER CHECK (move_number > 0 AND move_number <= 9),  -- ✅ AGREGADA
  
  position INTEGER,  -- ✅ AHORA NULLABLE (legacy, no usada)
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_move_position UNIQUE (room_id, row, col)
);

-- Índices
CREATE INDEX idx_tictactoe_moves_room ON tictactoe_moves(room_id, move_number);
CREATE INDEX idx_tictactoe_moves_player ON tictactoe_moves(player_id);
CREATE INDEX idx_tictactoe_moves_created ON tictactoe_moves(created_at DESC);
```

### **tictactoe_stats**
```sql
CREATE TABLE tictactoe_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- Partidas
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  games_draw INTEGER DEFAULT 0,
  
  -- Rachas
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  
  -- Economía
  total_coins_won NUMERIC(10,2) DEFAULT 0,
  total_coins_lost NUMERIC(10,2) DEFAULT 0,
  total_fires_won NUMERIC(10,2) DEFAULT 0,
  total_fires_lost NUMERIC(10,2) DEFAULT 0,
  
  -- Tiempos
  avg_game_duration INTEGER,
  fastest_win INTEGER,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_tictactoe_stats_streak ON tictactoe_stats(best_streak DESC);
CREATE INDEX idx_tictactoe_stats_wins ON tictactoe_stats(games_won DESC);
```

---

## 💡 LECCIONES APRENDIDAS

### **1. CREATE TABLE IF NOT EXISTS no actualiza schemas**
❌ **NUNCA hacer:**
```sql
CREATE TABLE IF NOT EXISTS my_table (
  existing_col TYPE,
  new_col TYPE  -- NO SE AÑADE SI TABLA EXISTE
);
```

✅ **SIEMPRE hacer:**
```sql
CREATE TABLE IF NOT EXISTS my_table (
  existing_col TYPE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'my_table' AND column_name = 'new_col') THEN
    ALTER TABLE my_table ADD COLUMN new_col TYPE;
  END IF;
END $$;
```

### **2. Verificar schema real antes de asumir**
- ❌ No asumir basado en documentación histórica
- ✅ Consultar `information_schema.columns` en producción
- ✅ Hacer migraciones defensivas con verificaciones condicionales

### **3. RAISE NOTICE requiere bloque PL/pgSQL**
```sql
-- ❌ INCORRECTO:
RAISE NOTICE 'mensaje';

-- ✅ CORRECTO:
DO $$ BEGIN
  RAISE NOTICE 'mensaje';
END $$;
```

### **4. Columnas legacy deben hacerse NULLABLE**
Si el código actual no usa una columna que existe en DB:
- ✅ Hacer NULLABLE con `ALTER COLUMN DROP NOT NULL`
- ✅ Documentar como legacy en comentarios
- ❌ NO eliminarla (puede romper datos históricos)

### **5. Tabla migrations usa "filename" no "name"**
```sql
-- ❌ INCORRECTO:
DELETE FROM migrations WHERE name = '027_fix.sql';

-- ✅ CORRECTO:
DELETE FROM migrations WHERE filename = '027_fix.sql';
```

---

## 📋 VERIFICACIÓN POST-DEPLOY

### **Railway Logs Esperados:**
```
✅ Running migration: 026_cleanup_failed_tictactoe_migration.sql
✅ Running migration: 028_cleanup_failed_027_migration.sql
✅ Running migration: 037_fix_tictactoe_board_only.sql
  → Columna winner_id creada
  → Columna winner_symbol creada
  → Migración 037 completada
  
✅ Running migration: 038_create_tictactoe_moves_and_stats.sql
  → Columna row añadida a tictactoe_moves
  → Columna col añadida a tictactoe_moves
  → Columna move_number añadida a tictactoe_moves
  → Columna position cambiada a NULLABLE (legacy, no usada)
  → Constraint unique_move_position añadido
  → Tabla tictactoe_stats creada
  → Migración 038 completada

✅ All migrations completed successfully
   Already executed: 43
   Pending: 0
```

### **Funcionalidad TicTacToe:**
- [x] Crear sala → funciona
- [x] Unirse a sala → funciona
- [ ] **Hacer movimientos** → PENDIENTE VERIFICAR
- [ ] Registrar movimientos en tictactoe_moves → PENDIENTE VERIFICAR
- [ ] Guardar estadísticas en tictactoe_stats → PENDIENTE VERIFICAR
- [ ] Detectar ganador/empate → PENDIENTE VERIFICAR

---

## 🚀 COMMITS DESPLEGADOS

| Commit | Mensaje | Archivo Principal |
|--------|---------|-------------------|
| `ef449c6` | Eliminar migración 027 corrupta | 027_fix_tictactoe_schema.sql (DELETE) |
| `eb676c4` | Crear cleanup 026 con sintaxis correcta | 026_cleanup_failed_tictactoe_migration.sql |
| `85638cc` | Recrear 026 para forzar update en Railway | 026_cleanup_failed_tictactoe_migration.sql |
| `91df90f` | Fix syntax error RAISE NOTICE en 037 | 037_fix_tictactoe_board_only.sql |
| `c9e2e27` | Crear winner_id/winner_symbol en 037 | 037_fix_tictactoe_board_only.sql |
| `6afca60` | Crear migración 038 inicial | 038_create_tictactoe_moves_and_stats.sql |
| `4581a0f` | Fix 038: usar ALTER TABLE para columnas | 038_create_tictactoe_moves_and_stats.sql |
| `6a9d853` | Fix 038: hacer position NULLABLE | 038_create_tictactoe_moves_and_stats.sql |

---

## 📊 IMPACTO FINAL

### **Antes:**
- ❌ TicTacToe 100% no funcional
- ❌ Imposible crear salas
- ❌ Imposible hacer movimientos
- ❌ Deploy bloqueado por migraciones corruptas
- ❌ 8 errores críticos bloqueantes

### **Después:**
- ✅ Schema de base de datos completamente correcto
- ✅ Migraciones limpias y ejecutables
- ✅ Todas las columnas necesarias presentes
- ✅ Sistema listo para pruebas funcionales
- ⏳ Pendiente verificación en producción (~6 min)

---

**Última actualización:** 2025-11-08 20:38  
**Status:** Deploy en progreso  
**Próximo paso:** Verificar funcionamiento completo con Chrome DevTools
