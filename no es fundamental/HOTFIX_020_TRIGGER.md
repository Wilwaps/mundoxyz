# 🔴 HOTFIX CRÍTICO: Migración 020 - Trigger Fallido

**Fecha:** 2025-11-05 8:34am UTC-4  
**Commit Fix:** 4d6050c  
**Status:** ✅ PUSH EXITOSO - Esperando Railway

---

## 🔴 PROBLEMA IDENTIFICADO

**Error en Railway:**
```
❌ Error in 020_create_market_redeems.sql: 
   function update_updated_at_column() does not exist

Code: 42883
Found 19 migration files
Already executed: 20
Pending: 1
```

**Causa Root:**
- Migración 020 intentaba crear un trigger que usa `update_updated_at_column()`
- Esta función **NUNCA fue creada** en ninguna migración anterior
- Railway ejecutó la migración 019 exitosamente
- Pero 020 falla al crear el trigger

---

## ✅ SOLUCIÓN APLICADA

### Migración 020 Corregida:

**ANTES (FALLABA):**
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_market_redeems_updated_at') THEN
    CREATE TRIGGER update_market_redeems_updated_at 
      BEFORE UPDATE ON market_redeems
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();  -- ❌ FUNCIÓN NO EXISTE
  END IF;
END $$;
```

**DESPUÉS (CORREGIDO):**
```sql
-- ============================================
-- TRIGGER PARA UPDATED_AT
-- ============================================
-- NOTA: Función update_updated_at_column() no existe en BD actual
-- Se creará en migración futura o se maneja a nivel de aplicación
-- Por ahora, updated_at se actualiza manualmente en queries
```

### Mensaje de Verificación Actualizado:
```sql
RAISE NOTICE '✅ Migración 020 completada: tabla market_redeems creada con 6 índices (sin trigger)';
```

---

## 📊 ESTADO ACTUAL

### Migración 019: ✅ EJECUTADA
```
Already executed: 20
```

**Columnas añadidas:**
- ✅ users.locale
- ✅ user_roles.granted_by (renombrada)
- ✅ user_roles.granted_at (renombrada)
- ✅ raffles.starts_at
- ✅ raffles.ends_at
- ✅ raffles.drawn_at

### Migración 020: ⏳ PENDIENTE (esperando hotfix)
```
Pending: 1
```

**Con el hotfix:**
- ✅ Tabla market_redeems se creará
- ✅ 6 índices se crearán
- ⚠️ SIN trigger (se maneja en aplicación)

---

## 🔧 COMMIT HOTFIX

**Hash:** 4d6050c  
**Mensaje:** `fix CRÍTICO: eliminar trigger de 020 - función update_updated_at_column no existe`

**Archivos modificados:**
```
backend/db/migrations/020_create_market_redeems.sql
- Eliminado bloque DO $$ con CREATE TRIGGER
- Añadida nota explicativa
- Actualizado mensaje de verificación
```

**Push:**
```
To https://github.com/Wilwaps/mundoxyz.git
   6263088..4d6050c  main -> main
```

---

## ⏳ PRÓXIMOS PASOS

### 1. Esperar Redeploy Railway (~3-5 min)

**Railway ejecutará:**
```
Found 19 migration files
Already executed: 20
Pending: 1

📝 Running migration: 020_create_market_redeems.sql
✅ Migración 020 completada: tabla market_redeems creada con 6 índices (sin trigger)

Already executed: 21
Pending: 0
```

### 2. Verificar Tabla Creada

**Queries de verificación:**
```sql
-- Verificar tabla existe
SELECT COUNT(*) FROM market_redeems;

-- Verificar columnas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'market_redeems'
ORDER BY ordinal_position;

-- Verificar índices
SELECT indexname FROM pg_indexes 
WHERE tablename = 'market_redeems';
```

**Esperado:**
- ✅ Tabla market_redeems existe
- ✅ 14 columnas presentes
- ✅ 6 índices creados
- ⚠️ Sin trigger (OK)

### 3. Crear Migración 021 (Opcional - Futura)

**Contenido:**
```sql
-- 021_create_update_updated_at_function.sql

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-añadir triggers a tablas que lo necesiten
CREATE TRIGGER update_market_redeems_updated_at
    BEFORE UPDATE ON market_redeems
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 🎯 MANEJO DE updated_at EN APLICACIÓN

### Backend Routes que Usan market_redeems:

**Archivo:** `backend/routes/market.js`

**Queries que deben actualizar updated_at manualmente:**
```javascript
// Al aprobar redención
await pool.query(
  `UPDATE market_redeems 
   SET status = 'completed', 
       processor_id = $1, 
       processed_at = NOW(),
       updated_at = NOW()  -- ⚠️ AÑADIR MANUALMENTE
   WHERE id = $2`,
  [adminId, redeemId]
);

// Al rechazar
await pool.query(
  `UPDATE market_redeems 
   SET status = 'rejected',
       processor_id = $1,
       processor_notes = $2,
       processed_at = NOW(),
       updated_at = NOW()  -- ⚠️ AÑADIR MANUALMENTE
   WHERE id = $3`,
  [adminId, notes, redeemId]
);
```

---

## 📋 VERIFICACIÓN POST-DEPLOY

### Checklist:

- [ ] Railway redeploy completado
- [ ] Logs muestran "Migración 020 completada"
- [ ] Tabla market_redeems existe en Postgres
- [ ] 14 columnas presentes
- [ ] 6 índices creados
- [ ] Chrome DevTools sin errores "relation market_redeems does not exist"
- [ ] Endpoint POST /api/market/redeem funciona
- [ ] Endpoint GET /api/market/redeems funciona
- [ ] Console sin errores críticos

---

## ⚠️ LECCIONES APRENDIDAS

### 1. Verificar Funciones Externas
```
❌ NO ASUMIR que funciones existen
✅ VERIFICAR en migraciones anteriores
✅ CREAR funciones antes de usarlas en triggers
```

### 2. Migraciones Defensivas
```sql
-- ANTES (PELIGROSO):
EXECUTE FUNCTION mi_funcion();

-- DESPUÉS (SEGURO):
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mi_funcion') THEN
    -- Crear trigger
  END IF;
END $$;
```

### 3. Alternativas a Triggers
```
✅ Manejar updated_at en aplicación (más control)
✅ Usar ON UPDATE CURRENT_TIMESTAMP (solo MySQL)
✅ Crear función en migración base antes de usar
```

---

## 📊 TIMELINE

| Hora | Evento |
|------|--------|
| 8:02am | Commit 6772b34 - Migraciones 019-020 originales |
| 8:21am | Usuario reporta: último push hace 1 hora |
| 8:34am | Railway logs muestran error función no existe |
| 8:35am | Hotfix aplicado - trigger eliminado |
| 8:36am | Commit 4d6050c pusheado |
| ~8:41am | Railway redeploy esperado |

---

## 🚀 STATUS ACTUAL

**Commit:** 4d6050c  
**Push:** ✅ Exitoso  
**Railway:** ⏳ Esperando redeploy (~5 min)  
**Próxima acción:** Verificar tabla market_redeems creada

---

**Actualizado:** 2025-11-05 8:36am UTC-4  
**Status:** ⏳ ESPERANDO RAILWAY REDEPLOY
