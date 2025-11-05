# 🔴 ANÁLISIS EXHAUSTIVO: COLUMNAS Y TABLAS FALTANTES

**Fecha:** 2025-11-05 (7:38am UTC-4)
**Status:** ANÁLISIS COMPLETO - SIN CAMBIOS AÚN
**Fuente:** Comparación "no es fundamental/migrations" vs "DATABASE_SCHEMA_MASTER.sql"

---

## 📋 ERRORES DETECTADOS EN PRODUCCIÓN (Railway Logs)

Basado en las 9 imágenes proporcionadas:

### 1. **raffles table**
```
❌ column r.ends_at does not exist
   Code: 42703, File: parse_relation.c
```

### 2. **users table**
```
❌ column u.locale does not exist
   Code: 42703, File: parse_relation.c
```

### 3. **user_roles table**
```
❌ column ur.granted_by does not exist
   Code: 42703, File: parse_relation.c
```

### 4. **market_redeems table**
```
❌ relation "market_redeems" does not exist
   Code: 42P01, File: parse_relation.c
```

---

## 🔍 ANÁLISIS DETALLADO POR TABLA

### ✅ TABLA 1: **users**

**Esquema histórico** (`001_core.sql` línea 24-40):
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  xyz_id VARCHAR(64) UNIQUE,
  tg_id BIGINT UNIQUE,
  username VARCHAR(64),
  display_name VARCHAR(128),
  email VARCHAR(128) UNIQUE,
  phone VARCHAR(32),
  avatar_url TEXT,
  locale VARCHAR(10) DEFAULT 'es',  -- ⚠️ FALTA EN PRODUCCIÓN
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
);
```

**Schema maestro actual** (línea 21-43):
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  tg_id BIGINT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  -- ❌ FALTA: locale VARCHAR(10) DEFAULT 'es'
  ...
);
```

**COLUMNA FALTANTE:**
```sql
locale VARCHAR(10) DEFAULT 'es'
```

**ACCIÓN REQUERIDA:**
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'es';
```

---

### ✅ TABLA 2: **user_roles**

**Esquema histórico** (`001_core.sql` línea 64-70):
```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),  -- ⚠️ NOMBRE INCORRECTO EN MAESTRO
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, role_id)
);
```

**Schema maestro actual** (línea 133-140):
```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),  -- ❌ DEBERÍA SER granted_by
  UNIQUE(user_id, role_id)
);
```

**PROBLEMA:**
- El código usa `granted_by`
- El schema maestro tiene `assigned_by`
- Esta inconsistencia causa el error

**ACCIÓN REQUERIDA:**
```sql
-- Opción 1: Renombrar en DB para que coincida con código
ALTER TABLE user_roles 
RENAME COLUMN assigned_by TO granted_by;

ALTER TABLE user_roles 
RENAME COLUMN assigned_at TO granted_at;

-- Opción 2: Actualizar código para usar assigned_by (NO RECOMENDADO)
```

---

### ✅ TABLA 3: **raffles**

**Esquema histórico** (`003_raffles.sql` línea 4-29):
```sql
CREATE TABLE raffles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL,
  ...
  pot_fires DECIMAL(18,2) DEFAULT 0,
  pot_coins DECIMAL(18,2) DEFAULT 0,
  ...
  host_meta JSONB DEFAULT '{}',
  prize_meta JSONB DEFAULT '{}',
  starts_at TIMESTAMPTZ,  -- ⚠️ FALTA EN PRODUCCIÓN
  ends_at TIMESTAMPTZ,    -- ⚠️ FALTA EN PRODUCCIÓN
  drawn_at TIMESTAMPTZ,   -- ⚠️ FALTA EN PRODUCCIÓN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Schema maestro actual** (línea 218-266):
```sql
CREATE TABLE raffles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  ...
  prize_meta JSONB DEFAULT '{}',
  host_meta JSONB DEFAULT '{}',
  -- ❌ FALTAN:
  -- starts_at TIMESTAMP
  -- ends_at TIMESTAMP
  -- drawn_at TIMESTAMP
  created_at TIMESTAMP DEFAULT NOW(),
  ...
);
```

**COLUMNAS FALTANTES:**
```sql
starts_at TIMESTAMP
ends_at TIMESTAMP
drawn_at TIMESTAMP
```

**ACCIÓN REQUERIDA:**
```sql
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMP;

-- Añadir índice para búsquedas por fechas
CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) 
WHERE ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) 
WHERE starts_at IS NOT NULL;
```

---

### ✅ TABLA 4: **market_redeems** (TABLA COMPLETA FALTANTE)

**Esquema histórico** (`002_economy.sql` línea 115-141):
```sql
CREATE TABLE IF NOT EXISTS market_redeems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fires_amount DECIMAL(18,2) NOT NULL DEFAULT 100 CHECK (fires_amount > 0),
  fiat_amount DECIMAL(18,2),
  currency_code VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  cedula VARCHAR(20),
  phone VARCHAR(32),
  bank_code VARCHAR(10),
  bank_name VARCHAR(128),
  bank_account VARCHAR(64),
  payment_method VARCHAR(32),
  transaction_id VARCHAR(128),
  proof_url TEXT,
  notes TEXT,
  processor_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  processor_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at);
```

**Schema maestro actual:**
```
❌ TABLA COMPLETA NO EXISTE
```

**ACCIÓN REQUERIDA:**
```sql
-- Crear tabla completa market_redeems
-- Ver migración 002_economy.sql líneas 115-165
```

---

## 📊 RESUMEN DE CAMBIOS NECESARIOS

### Columnas a Añadir:

| Tabla | Columna | Tipo | Default | Notas |
|-------|---------|------|---------|-------|
| **users** | locale | VARCHAR(10) | 'es' | Idioma preferido del usuario |
| **raffles** | starts_at | TIMESTAMP | NULL | Fecha inicio de rifa |
| **raffles** | ends_at | TIMESTAMP | NULL | Fecha fin de rifa |
| **raffles** | drawn_at | TIMESTAMP | NULL | Fecha sorteo realizado |

### Columnas a Renombrar:

| Tabla | Columna Actual | Columna Correcta | Notas |
|-------|---------------|-----------------|-------|
| **user_roles** | assigned_by | granted_by | Código usa granted_by |
| **user_roles** | assigned_at | granted_at | Consistencia nomenclatura |

### Tablas a Crear:

| Tabla | Descripción | Archivo Referencia |
|-------|-------------|-------------------|
| **market_redeems** | Redenciones de fires por dinero fiat | 002_economy.sql líneas 115-165 |

### Índices a Añadir:

```sql
-- Para raffles
CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) WHERE starts_at IS NOT NULL;

-- Para market_redeems (al crear tabla)
CREATE INDEX IF NOT EXISTS idx_market_redeems_user ON market_redeems(user_id);
CREATE INDEX IF NOT EXISTS idx_market_redeems_status ON market_redeems(status);
CREATE INDEX IF NOT EXISTS idx_market_redeems_created ON market_redeems(created_at);
```

---

## 🎯 PLAN DE MIGRACIÓN PROPUESTO

### Migración 019: Añadir columnas faltantes a users, user_roles, raffles

```sql
-- 1. users: añadir locale
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'es';

COMMENT ON COLUMN users.locale IS 'Idioma preferido del usuario (es, en, pt)';

-- 2. user_roles: renombrar columnas para consistencia con código
ALTER TABLE user_roles 
RENAME COLUMN assigned_by TO granted_by;

ALTER TABLE user_roles 
RENAME COLUMN assigned_at TO granted_at;

-- 3. raffles: añadir columnas de timing
ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;

ALTER TABLE raffles 
ADD COLUMN IF NOT EXISTS drawn_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_raffles_ends_at ON raffles(ends_at) 
WHERE ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raffles_starts_at ON raffles(starts_at) 
WHERE starts_at IS NOT NULL;

COMMENT ON COLUMN raffles.starts_at IS 'Fecha/hora programada de inicio';
COMMENT ON COLUMN raffles.ends_at IS 'Fecha/hora programada de cierre';
COMMENT ON COLUMN raffles.drawn_at IS 'Fecha/hora en que se realizó el sorteo';
```

### Migración 020: Crear tabla market_redeems

```sql
-- Copiar todo el contenido de 002_economy.sql líneas 115-165
-- Tabla market_redeems completa con índices y triggers
```

---

## 🔄 ACTUALIZACIÓN SCHEMA MAESTRO

Después de aplicar migraciones, actualizar `DATABASE_SCHEMA_MASTER.sql`:

### 1. Tabla users (línea ~33):
```sql
-- AÑADIR DESPUÉS DE avatar_url:
locale VARCHAR(10) DEFAULT 'es',
```

### 2. Tabla user_roles (línea ~136-138):
```sql
-- CAMBIAR:
assigned_at TIMESTAMP DEFAULT NOW(),
assigned_by UUID REFERENCES users(id),

-- POR:
granted_at TIMESTAMP DEFAULT NOW(),
granted_by UUID REFERENCES users(id),
```

### 3. Tabla raffles (línea ~259):
```sql
-- AÑADIR ANTES DE created_at:
starts_at TIMESTAMP,
ends_at TIMESTAMP,
drawn_at TIMESTAMP,
```

### 4. Añadir tabla market_redeems completa:
```sql
-- Después de fire_requests o antes de direct_gifts
-- Tabla completa con todos sus índices
```

---

## 📁 ARCHIVOS DE REFERENCIA

Para crear las migraciones correctas, consultar:

1. **`no es fundamental/migrations/001_core.sql`**
   - Líneas 24-40: users completo
   - Líneas 64-70: user_roles completo

2. **`no es fundamental/migrations/002_economy.sql`**
   - Líneas 115-165: market_redeems completo

3. **`no es fundamental/migrations/003_raffles.sql`**
   - Líneas 4-29: raffles completo

---

## ⚠️ ADVERTENCIAS CRÍTICAS

### 1. **NO hacer DROP de columnas existentes**
- `assigned_by` → `granted_by` es RENAME, no DROP+ADD
- `assigned_at` → `granted_at` es RENAME, no DROP+ADD

### 2. **Verificar datos existentes antes de renombrar**
```sql
-- Ver si hay datos en assigned_by
SELECT COUNT(*) FROM user_roles WHERE assigned_by IS NOT NULL;
```

### 3. **market_redeems puede tener datos en otras tablas**
- Verificar que no haya FKs rotas
- Revisar código que usa market_redeems

### 4. **Migraciones idempotentes**
- Usar `IF NOT EXISTS` en todos los ALTER TABLE
- Usar `IF EXISTS` en todos los RENAME COLUMN

---

## 📌 SIGUIENTE PASO

**ESPERAR CONFIRMACIÓN DEL USUARIO** antes de:

1. Crear migración 019 (columnas faltantes)
2. Crear migración 020 (tabla market_redeems)
3. Actualizar DATABASE_SCHEMA_MASTER.sql
4. Commit y push a GitHub
5. Deploy a Railway

---

## 🔍 VERIFICACIÓN POST-DEPLOY

Endpoints que deberían funcionar después:

```bash
# Perfiles con locale
GET /api/profile/:userId

# User roles con granted_by
GET /api/users/:userId/roles

# Rifas con ends_at
GET /api/raffles/active

# Market redeems
GET /api/market/redeems
POST /api/market/redeem
```

Railway logs debe mostrar:
```
✅ Migración 019 completada: columnas añadidas
✅ Migración 020 completada: tabla market_redeems creada
Already executed: 20
Pending: 0
```

---

**STATUS:** 📊 ANÁLISIS COMPLETO
**CONFIANZA:** 100% - Basado en archivos históricos verificados
**ACCIÓN PENDIENTE:** Esperar aprobación del usuario para proceder
