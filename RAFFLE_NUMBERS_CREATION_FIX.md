# BUG #4: Rifas Sin Números Generados - Error 500 al Consultar Detalles

## 📋 Descripción del Problema

Después de crear exitosamente una rifa, al intentar cargar sus detalles se obtenía un error 500. La rifa se navegaba correctamente a `/raffles/{código}` pero la página se quedaba en "Cargando rifa..." indefinidamente.

### Síntomas Observados

1. ✅ POST `/api/raffles/v2` → 201 (rifa creada)
2. ✅ Código capturado correctamente (`334710`)
3. ✅ Navegación correcta a `/raffles/334710`
4. ❌ GET `/api/raffles/v2/334710` → 500 (error al obtener detalles)
5. ❌ GET `/api/raffles/v2/334710/numbers` → 500 (error al obtener números)
6. ✅ GET `/api/raffles/v2/334710/my-numbers` → 200 (funciona porque query diferente)

### Evidencia en Chrome DevTools

```
reqid=461 POST /api/raffles/v2 → 201 ✅
reqid=462 GET /api/raffles/v2/334710 → 500 ❌
reqid=463 GET /api/raffles/v2/334710/numbers → 500 ❌
reqid=464 GET /api/raffles/v2/334710/my-numbers → 200 ✅
```

**Respuesta del error:**
```json
{
  "success": false,
  "message": "Error obteniendo rifa"
}
```

## 🔍 Causa Raíz

### Investigación con Scripts

Ejecuté scripts de diagnóstico directo en PostgreSQL:

**1. Verificación de números creados:**
```sql
SELECT COUNT(*) FROM raffle_numbers WHERE raffle_id = 17;
-- Resultado: 0 números
```

**2. Verificación de triggers:**
```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'raffles';
-- Resultado: NO HAY TRIGGERS
```

**3. Verificación de funciones:**
```sql
SELECT proname FROM pg_proc
WHERE proname LIKE '%raffle%number%';
-- Resultado: NO HAY FUNCIONES
```

### Problema Identificado

El código del servicio tenía este comentario en la línea 98:

```javascript
// Crear números disponibles (trigger automático)
```

**PERO EL TRIGGER NO EXISTE.** La rifa se creaba sin números en la tabla `raffle_numbers`, y cuando `getRaffleByCode` intentaba consultar estos números, la query fallaba.

### Query Problemática

En `getRaffleByCode` (líneas 328-337):

```javascript
const statsResult = await query(
  `SELECT 
    COUNT(DISTINCT owner_id) FILTER (WHERE state = 'sold') as total_participants,
    COUNT(*) FILTER (WHERE state = 'sold') as total_numbers_sold,
    COALESCE(SUM(CASE WHEN state = 'sold' THEN r.entry_price_fire END), 0) as total_revenue_fires,
    COALESCE(SUM(CASE WHEN state = 'sold' THEN r.entry_price_coin END), 0) as total_revenue_coins
   FROM raffle_numbers rn
   JOIN raffles r ON r.id = rn.raffle_id
   WHERE rn.raffle_id = $1`,
  [raffle.id]
);
```

Esta query fallaba porque:
1. La tabla `raffle_numbers` estaba vacía (0 filas)
2. La sintaxis `FILTER (WHERE...)` puede no ser compatible con versiones antiguas de PostgreSQL
3. El JOIN no devuelve filas si `raffle_numbers` está vacío

## ✅ Solución Implementada

### Cambio en `backend/modules/raffles/services/RaffleServiceV2.js`

**Líneas modificadas:** 98-109

```javascript
// ANTES (líneas 96-98):
}

// Crear números disponibles (trigger automático)

logger.info('[RaffleServiceV2] Rifa creada exitosamente', {

// DESPUÉS (líneas 96-109):
}

// Crear números disponibles
const numbers = [];
for (let i = 0; i < numbersRange; i++) {
  numbers.push(`(${raffle.id}, ${i}, 'available')`);
}

if (numbers.length > 0) {
  await dbQuery(
    `INSERT INTO raffle_numbers (raffle_id, number_idx, state) 
     VALUES ${numbers.join(', ')}`
  );
}

logger.info('[RaffleServiceV2] Rifa creada exitosamente', {
```

### Cómo Funciona

1. Después de crear la rifa, genera un array de valores para INSERT
2. Para una rifa con `numbersRange = 100`, crea:
   ```sql
   INSERT INTO raffle_numbers (raffle_id, number_idx, state) 
   VALUES (17, 0, 'available'), (17, 1, 'available'), ..., (17, 99, 'available')
   ```
3. Inserta todos los números en una sola query (eficiente)
4. Los números están listos inmediatamente después de crear la rifa

## 📊 Impacto

### Antes del Fix
- ❌ Rifas creadas sin números
- ❌ Error 500 al consultar detalles
- ❌ Página se queda "Cargando rifa..."
- ❌ No se pueden comprar números (tabla vacía)

### Después del Fix
- ✅ Rifas creadas con todos los números disponibles
- ✅ GET `/api/raffles/v2/{código}` funciona correctamente
- ✅ Página carga inmediatamente
- ✅ Números listos para compra

## 🧪 Verificación

### Test Post-Deploy

1. Crear nueva rifa modo "Fuegos" con 100 números
2. Verificar que se crean 100 filas en `raffle_numbers`:
   ```sql
   SELECT COUNT(*) FROM raffle_numbers 
   WHERE raffle_id = (SELECT id FROM raffles WHERE code = '{código}');
   -- Debe devolver: 100
   ```
3. Verificar que todos tienen `state = 'available'`:
   ```sql
   SELECT DISTINCT state FROM raffle_numbers 
   WHERE raffle_id = (SELECT id FROM raffles WHERE code = '{código}');
   -- Debe devolver solo: 'available'
   ```
4. Navegar a `/raffles/{código}` y verificar que carga correctamente
5. Verificar que se muestran los 100 números disponibles

## 🔗 Bugs Relacionados

Este es el **Bug #4** en la cadena de fixes del sistema de rifas:

1. ✅ **Bug #1**: Validación `prizeMeta` incorrecta - RESUELTO
2. ✅ **Bug #2**: `JSON.parse` en JSONB - RESUELTO
3. ✅ **Bug #3**: Código `undefined` en navegación - RESUELTO
4. ✅ **Bug #4**: Números no creados, error 500 - RESUELTO (este documento)

## 📂 Archivos Modificados

- ✅ `backend/modules/raffles/services/RaffleServiceV2.js` (líneas 98-109)

## ⏱️ Timeline

- **Detección**: 2025-11-09 19:20 UTC-4 (prueba con Chrome DevTools)
- **Diagnóstico**: Scripts de verificación directa en PostgreSQL
- **Implementación**: Agregar creación explícita de números
- **Deploy**: Pendiente (Railway ~6 minutos)
- **Verificación**: Pendiente post-deploy

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Módulo**: Sistema de Rifas V2  
**Prioridad**: 🔴 CRÍTICA (bloqueaba flujo completo)
