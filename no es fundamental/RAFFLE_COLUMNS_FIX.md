# FIX CRÍTICO: Columnas Faltantes en Tabla Raffles
**Fecha:** 2025-11-05
**Migración:** 018
**Commit:** Pendiente

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Error 1: column r.cost_per_number does not exist
```
Error listing public raffles: error: column r.cost_per_number does not exist
    at RaffleService.listPublicRaffles (/app/backend/services/RaffleService.js:1184:28)
```

### Error 2: column "pot_fires" does not exist
```
Error getting system stats: error: column "pot_fires" does not exist
    at RaffleService.getSystemStats (/app/backend/services/RaffleService.js:1517:27)
```

### Error 3: column r.numbers_range does not exist
```
Error fetching active games: column r.numbers_range does not exist
    at /app/backend/routes/games.js:300
```

**Causa Root:** La tabla `raffles` en producción no tenía las columnas necesarias que el código ya estaba usando.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Migración 018: ALTER TABLE raffles

**Archivo:** `backend/db/migrations/018_alter_raffles_add_missing_columns.sql`

#### Columnas Económicas Añadidas:

1. **`cost_per_number`** DECIMAL(10,2) DEFAULT 10
   - Costo base por número en modo fires
   - Usado en cálculo de comisiones y precios

2. **`pot_fires`** DECIMAL(18,2) DEFAULT 0
   - Acumulador de fuegos en el pote
   - Se actualiza en cada compra (línea 688 RaffleService)

3. **`pot_coins`** DECIMAL(18,2) DEFAULT 0
   - Acumulador de monedas en el pote
   - Para futuro soporte de rifas con coins

4. **`numbers_range`** INTEGER DEFAULT 100
   - Rango total de números disponibles
   - Migra datos de `total_numbers` existente

#### Columnas de Configuración Añadidas:

5. **`visibility`** VARCHAR(20) DEFAULT 'public'
   - CHECK: 'public', 'private', 'friends'
   - Control de acceso a rifas

6. **`entry_price_fiat`** DECIMAL(10,2) DEFAULT 0
   - Precio en moneda fiat (futuro)

7. **`is_company_mode`** BOOLEAN DEFAULT FALSE
   - Indica si es rifa empresarial (3000🔥)

8. **`company_cost`** DECIMAL(10,2) DEFAULT 0
   - Costo pagado por modo empresa

9. **`close_type`** VARCHAR(20) DEFAULT 'auto_full'
   - CHECK: 'auto_full', 'manual', 'scheduled'
   - Tipo de cierre de rifa

10. **`scheduled_close_at`** TIMESTAMP
    - Fecha programada de cierre

11. **`terms_conditions`** TEXT
    - Términos y condiciones de la rifa

12. **`prize_meta`** JSONB DEFAULT '{}'
    - Metadata del premio (descripción, valor, imagen)

13. **`host_meta`** JSONB DEFAULT '{}'
    - Metadata del host

#### Status Actualizado:

**ANTES:**
```sql
CHECK (status IN ('open', 'in_progress', 'finished', 'cancelled'))
```

**DESPUÉS:**
```sql
CHECK (status IN ('pending', 'active', 'open', 'in_progress', 'drawing', 'finished', 'cancelled'))
```

**Migración de datos:**
```sql
UPDATE raffles SET status = 'pending' WHERE status = 'open';
```

---

## 📊 ÍNDICES AÑADIDOS

Para optimizar queries:

```sql
CREATE INDEX idx_raffles_visibility ON raffles(visibility);
CREATE INDEX idx_raffles_is_company ON raffles(is_company_mode);
CREATE INDEX idx_raffles_close_type ON raffles(close_type);
CREATE INDEX idx_raffles_pot_fires ON raffles(pot_fires DESC) WHERE pot_fires > 0;
```

---

## 🔧 CÓDIGO AFECTADO

### 1. RaffleService.listPublicRaffles()
**Líneas:** 1128-1205

**Usa:**
- `r.cost_per_number` (línea 1140)
- `r.pot_fires` (línea 1141)
- `r.pot_coins` (línea 1141)
- `r.numbers_range` (línea 1142)
- `r.is_company_mode` (línea 1143)

### 2. RaffleService.getSystemStats()
**Líneas:** 1514-1545

**Usa:**
- `SUM(pot_fires)` (línea 1523)
- `SUM(pot_coins)` (línea 1524)
- `is_company_mode` (línea 1525)

### 3. RaffleService.processFirePurchase()
**Líneas:** 650-694

**Actualiza:**
```sql
UPDATE raffles 
SET pot_fires = pot_fires + $1
WHERE id = $2
```

### 4. routes/games.js - Active Games
**Líneas:** 283-310

**Usa:**
- `r.numbers_range` para mostrar rango de números
- `r.pot_fires`, `r.pot_coins` para mostrar premios

---

## 📁 ARCHIVOS MODIFICADOS

1. ✅ `backend/db/migrations/018_alter_raffles_add_missing_columns.sql` (NUEVO)
2. ✅ `no es fundamental/DATABASE_SCHEMA_MASTER.sql` (actualizado)

---

## 🎯 COMPATIBILIDAD

### Datos Existentes:

**`total_numbers` → `numbers_range`:**
```sql
UPDATE raffles 
SET numbers_range = total_numbers 
WHERE numbers_range IS NULL OR numbers_range = 100;
```

**`status = 'open'` → `status = 'pending'`:**
```sql
UPDATE raffles SET status = 'pending' WHERE status = 'open';
```

### Columnas Legacy Mantenidas:
- `total_numbers` - Se mantiene para compatibilidad
- `total_pot` - Se mantiene (aunque `pot_fires` + `pot_coins` es más preciso)

---

## 🧪 VERIFICACIÓN POST-DEPLOY

### Queries a Probar:

1. **Listar Rifas Públicas:**
```bash
curl https://mundoxyz-production.up.railway.app/api/raffles/public
```

**Esperado:** Lista de rifas sin error de columnas

2. **Estadísticas del Sistema:**
```bash
curl https://mundoxyz-production.up.railway.app/api/raffles/stats
```

**Esperado:** Stats con `total_fires_in_play`, `total_coins_in_play`, `company_raffles`

3. **Juegos Activos:**
```bash
curl https://mundoxyz-production.up.railway.app/api/games/active
```

**Esperado:** Rifas activas con `numbers_range` y potes

### En Railway Logs:

**Buscar:**
```
✅ Migración 018 completada: columnas añadidas a raffles
```

**NO debe aparecer:**
```
❌ column r.cost_per_number does not exist
❌ column "pot_fires" does not exist
❌ column r.numbers_range does not exist
```

---

## 📋 SCHEMA COMPLETO ACTUALIZADO

```sql
CREATE TABLE raffles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('fires', 'prize')),
  type VARCHAR(20) DEFAULT 'public',
  
  -- Precios y economía
  entry_price_fire DECIMAL(10,2) DEFAULT 0,
  entry_price_coin DECIMAL(10,2) DEFAULT 0,
  entry_price_fiat DECIMAL(10,2) DEFAULT 0,
  cost_per_number DECIMAL(10,2) DEFAULT 10,
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  
  -- Configuración de números
  total_numbers INTEGER NOT NULL CHECK (total_numbers > 0),
  numbers_range INTEGER DEFAULT 100,
  total_pot DECIMAL(10,2) DEFAULT 0,
  
  -- Ganador
  winner_number INTEGER,
  winner_id UUID REFERENCES users(id),
  
  -- Estados y visibilidad
  status VARCHAR(20) DEFAULT 'pending',
  visibility VARCHAR(20) DEFAULT 'public',
  
  -- Modo empresa
  is_company_mode BOOLEAN DEFAULT FALSE,
  company_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Configuración de cierre
  close_type VARCHAR(20) DEFAULT 'auto_full',
  scheduled_close_at TIMESTAMP,
  
  -- Metadata
  terms_conditions TEXT,
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 PROCESO DE DEPLOY

### Orden de Ejecución:

1. ✅ Crear migración 018
2. ✅ Actualizar DATABASE_SCHEMA_MASTER.sql
3. ⏳ Commit y push a GitHub
4. ⏳ Railway ejecuta migración automáticamente
5. ⏳ Verificar logs (6 minutos)
6. ⏳ Probar endpoints con Chrome DevTools
7. ⏳ Documentar resultados

---

## 💡 LECCIONES APRENDIDAS

### 1. Discrepancia entre Schema y Código
**Problema:** El código usaba columnas que no existían en DB
**Solución:** Revisar archivos en "no es fundamental" para ver esquema histórico completo

### 2. Migración vs Recreación
**Decisión:** ALTER TABLE en lugar de DROP/CREATE
**Razón:** Preservar datos existentes en producción

### 3. Doble Tracking
**`total_numbers` vs `numbers_range`:**
- Mantener ambos por compatibilidad
- Migrar datos automáticamente
- Usar `numbers_range` en código nuevo

**`total_pot` vs `pot_fires + pot_coins`:**
- `pot_fires`/`pot_coins` más preciso
- `total_pot` legacy

---

## 📞 SOPORTE

Si después del deploy persisten errores:

1. Verificar que migración 018 se ejecutó correctamente
2. Revisar logs de Railway para SQL errors
3. Ejecutar manualmente si es necesario:
```bash
psql $DATABASE_URL < backend/db/migrations/018_alter_raffles_add_missing_columns.sql
```

---

**STATUS:** ⏳ LISTO PARA COMMIT Y DEPLOY
**CONFIANZA:** 99% - Migración basada en esquema histórico verificado
**PRÓXIMA ACCIÓN:** git commit && git push
