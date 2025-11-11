# FIX URGENTE: Migración 027 - Orden Incorrecto

**Fecha:** 11 Nov 2025 00:16 UTC-4
**Commit Fix:** `4dcc8c4`
**Severidad:** BLOQUEANTE - Deploy fallando

---

## 🔴 ERROR IDENTIFICADO

### Error en Railway
```
❌ Error in 027_add_90_in_5x5_mode_and_restrict_british.sql: 
check constraint "bingo_v2_rooms_british_fullcard_check" 
of relation "bingo_v2_rooms" is violated by some row

Code: 23514
Table: bingo_v2_rooms
Constraint: bingo_v2_rooms_british_fullcard_check
```

### Causa Root
La migración intentaba agregar el constraint **ANTES** de actualizar las filas existentes:

```sql
-- ❌ ORDEN INCORRECTO (ANTES):
-- 3. Agregar constraint
ALTER TABLE bingo_v2_rooms
  ADD CONSTRAINT bingo_v2_rooms_british_fullcard_check ...

-- 4. Actualizar filas
UPDATE bingo_v2_rooms
  SET pattern_type = 'fullcard'
  WHERE mode = '90' AND pattern_type != 'fullcard';
```

**Problema:** PostgreSQL valida el constraint contra **todas las filas** al momento de agregarlo. Si hay filas con `mode='90'` y `pattern_type != 'fullcard'`, el constraint falla.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Reordenar Pasos
```sql
-- ✅ ORDEN CORRECTO (DESPUÉS):
-- 3. PRIMERO: Actualizar filas existentes
UPDATE bingo_v2_rooms
  SET pattern_type = 'fullcard'
  WHERE mode = '90' AND pattern_type != 'fullcard';

-- 4. LUEGO: Agregar constraint (ahora no hay filas que lo violen)
ALTER TABLE bingo_v2_rooms
  ADD CONSTRAINT bingo_v2_rooms_british_fullcard_check
  CHECK (
    (mode != '90') OR 
    (mode = '90' AND pattern_type = 'fullcard')
  );
```

### Flujo Correcto
1. ✅ DROP constraint antiguo `bingo_v2_rooms_mode_check`
2. ✅ ADD constraint nuevo con `'75', '90', '90-in-5x5'`
3. ✅ **UPDATE filas existentes** (forzar fullcard en modo '90')
4. ✅ **ADD constraint británico** (ahora no hay conflictos)

---

## 📦 Archivo Modificado

**`backend/db/migrations/027_add_90_in_5x5_mode_and_restrict_british.sql`**

### Cambios
- Líneas 18-22: UPDATE movido ANTES del ADD CONSTRAINT
- Líneas 24-30: ADD CONSTRAINT movido DESPUÉS del UPDATE
- Comentarios aclaratorios agregados

---

## 🧪 Testing

### Validación Local
- ✅ Sintaxis SQL correcta
- ✅ Orden lógico de operaciones

### Validación en Producción (Pendiente)
Railway ejecutará la migración en orden correcto:
1. Actualizará filas primero
2. Agregará constraint después
3. Sin errores de violación

---

## 🚀 Deploy

**Commit:** `4dcc8c4`
```
fix: reordenar migración 027 - UPDATE antes de ADD CONSTRAINT
1 file changed
```

**Push:** ✅ Exitoso  
**Railway:** Auto-deploy en ~6 minutos  

---

## ✅ Checklist Post-Deploy

- [ ] Railway logs: `✅ Migration 027 completed successfully`
- [ ] Sin errores de constraint violation
- [ ] Crear sala modo `'90-in-5x5'` funciona
- [ ] Modo británico solo permite fullcard

---

## 📝 Lección Aprendida

**Regla de Oro para Migraciones:**
> Siempre actualizar datos ANTES de agregar constraints restrictivos.

**Orden correcto:**
1. DROP constraints antiguos
2. Modificar estructura (ADD COLUMN, etc.)
3. **ACTUALIZAR datos existentes**
4. **AGREGAR nuevos constraints**
5. COMMIT

**Orden incorrecto:**
1. ❌ Agregar constraint
2. ❌ Actualizar datos (ya falló)

---

**Estado:** ✅ CORREGIDO - Esperando deploy
**ETA:** ~6 minutos desde 00:16
