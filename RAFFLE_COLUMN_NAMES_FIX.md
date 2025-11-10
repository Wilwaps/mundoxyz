# BUG #6: Nombres Incorrectos de Columnas en raffle_numbers

## 📋 Descripción

Error 500 al cargar detalles de rifas debido a uso de columnas inexistentes en la tabla `raffle_numbers`.

### Error SQL

```
column "reserved_at" does not exist
HINT: Perhaps you meant to reference the column "rn.reserved_by"
```

### Impacto

- ❌ Detalles de rifa no cargan (500 error)
- ❌ Listado de números no funciona
- ❌ Sistema de reservas bloqueado
- ❌ Interfaz de usuario queda en "Cargando..."

## 🔍 Causa Raíz

El código usaba nombres de columnas que no coinciden con el schema real de producción definido en la migración 036.

### Schema Real (Migración 036):
```sql
ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_by UUID REFERENCES users(id);

ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;
```

### Columnas que el Código Intentaba Usar:
```javascript
// ❌ INCORRECTO
reserved_at           → No existe
reservation_expires_at → No existe

// ✅ CORRECTO (según migración 036)
reserved_by           → Existe (UUID)
reserved_until        → Existe (TIMESTAMP)
```

## ✅ Solución

Corregir todos los queries SQL y mapeos para usar los nombres correctos de columnas.

### 1. Query SELECT de Números (líneas 314-338)

**ANTES:**
```javascript
SELECT 
  number_idx as idx,
  state,
  owner_id,
  u.username as owner_username,
  reserved_at,          // ❌ No existe
  purchased_at
FROM raffle_numbers rn
LEFT JOIN users u ON rn.owner_id = u.id

numbers = numbersResult.rows.map(n => ({
  reservedAt: n.reserved_at,    // ❌ No existe
  purchasedAt: n.purchased_at
}));
```

**DESPUÉS:**
```javascript
SELECT 
  number_idx as idx,
  state,
  owner_id,
  u.username as owner_username,
  reserved_by,          // ✅ Correcto
  reserved_until,       // ✅ Correcto
  purchased_at
FROM raffle_numbers rn
LEFT JOIN users u ON rn.owner_id = u.id

numbers = numbersResult.rows.map(n => ({
  reservedBy: n.reserved_by,       // ✅ Correcto
  reservedUntil: n.reserved_until, // ✅ Correcto
  purchasedAt: n.purchased_at
}));
```

### 2. Query Verificar Estado (línea 385-390)

**ANTES:**
```sql
SELECT state, owner_id, reserved_at  -- ❌ No existe
FROM raffle_numbers
WHERE raffle_id = $1 AND number_idx = $2
FOR UPDATE
```

**DESPUÉS:**
```sql
SELECT state, owner_id, reserved_by, reserved_until  -- ✅ Correcto
FROM raffle_numbers
WHERE raffle_id = $1 AND number_idx = $2
FOR UPDATE
```

### 3. Update Extender Reserva (líneas 405-410)

**ANTES:**
```sql
UPDATE raffle_numbers
SET reserved_at = NOW(),           -- ❌ No existe
    reservation_expires_at = $1    -- ❌ No existe
WHERE raffle_id = $2 AND number_idx = $3
```

**DESPUÉS:**
```sql
UPDATE raffle_numbers
SET reserved_until = $1  -- ✅ Correcto
WHERE raffle_id = $2 AND number_idx = $3
```

### 4. Update Reservar Número (líneas 428-433)

**ANTES:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = $2, 
    reserved_at = NOW(),           -- ❌ No existe
    reservation_expires_at = $3    -- ❌ No existe
WHERE raffle_id = $4 AND number_idx = $5
```

**DESPUÉS:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = $2, 
    reserved_by = $3,      -- ✅ Correcto
    reserved_until = $4    -- ✅ Correcto
WHERE raffle_id = $5 AND number_idx = $6
```

**Nota:** `reserved_by` también recibe `userId` para tracking de quién hizo la reserva.

### 5. Update Liberar Reserva (líneas 461-468)

**ANTES:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = NULL, 
    reserved_at = NULL,           -- ❌ No existe
    reservation_expires_at = NULL -- ❌ No existe
WHERE raffle_id = $2 AND number_idx = $3 
  AND owner_id = $4 AND state = $5
```

**DESPUÉS:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = NULL, 
    reserved_by = NULL,      -- ✅ Correcto
    reserved_until = NULL    -- ✅ Correcto
WHERE raffle_id = $2 AND number_idx = $3 
  AND owner_id = $4 AND state = $5
```

### 6. Limpieza de Reservas Expiradas (líneas 497-502)

**ANTES:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = NULL, 
    reserved_at = NULL,           -- ❌ No existe
    reservation_expires_at = NULL -- ❌ No existe
WHERE state = $2 AND reservation_expires_at < NOW()  -- ❌ No existe
```

**DESPUÉS:**
```sql
UPDATE raffle_numbers
SET state = $1, 
    owner_id = NULL, 
    reserved_by = NULL,      -- ✅ Correcto
    reserved_until = NULL    -- ✅ Correcto
WHERE state = $2 AND reserved_until < NOW()  -- ✅ Correcto
```

## 📂 Archivos Modificados

- `backend/modules/raffles/services/RaffleServiceV2.js` (6 queries corregidas)

## 🧪 Verificación

1. Acceder a `/raffles` → debe listar rifas sin errores
2. Click en "Ver Detalles" de cualquier rifa → debe cargar correctamente
3. Verificar en logs de Railway:
   - ✅ No más errores `column "reserved_at" does not exist`
   - ✅ Queries ejecutan correctamente
4. Probar reserva de números (si implementado en frontend)

## 🔗 Bugs Relacionados

Esta es parte de la cadena de fixes del sistema de rifas:

1. ✅ **Bug #1**: Validación `prizeMeta` condicional
2. ✅ **Bug #2**: JSON.parse en JSONB
3. ✅ **Bug #3**: Código undefined en navegación
4. ✅ **Bug #4**: Números no creados al crear rifa
5. ✅ **Bug #5**: Validación search vacío
6. ✅ **Bug #6**: Nombres incorrectos de columnas (este documento)

## 📊 Schema Completo de raffle_numbers

```sql
CREATE TABLE raffle_numbers (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  number_idx INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'available' CHECK (state IN ('available', 'sold', 'reserved')),
  owner_id UUID REFERENCES users(id),
  purchased_at TIMESTAMP,
  reserved_by UUID REFERENCES users(id),        -- Migración 036
  reserved_until TIMESTAMP WITH TIME ZONE,      -- Migración 036
  UNIQUE(raffle_id, number_idx)
);
```

## ⚡ Impacto

- ✅ Detalles de rifas cargan correctamente
- ✅ Listado de números funcional
- ✅ Sistema de reservas operativo (backend listo)
- ✅ Sin errores 500 en queries SQL
- ✅ Limpieza de reservas expiradas funciona

## 📝 Lección Aprendida

**Siempre verificar schema real de producción antes de implementar features.**

En este caso:
1. Migración 036 creó `reserved_by` y `reserved_until`
2. Código asumió `reserved_at` y `reservation_expires_at`
3. No se consultó el schema antes de implementar

**Prevención:**
- Revisar carpeta `backend/db/migrations/` para ver schema actual
- Consultar `DATABASE_SCHEMA_MASTER.sql` para referencia
- Nunca asumir nombres de columnas sin verificar

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Módulo**: Sistema de Rifas V2  
**Prioridad**: 🔴 CRÍTICA (bloqueaba todo el sistema de rifas)
