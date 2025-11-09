# BUG #5: Validación Incorrecta de Query Param "search"

## 📋 Descripción

Error 400 al listar rifas con parámetro de búsqueda vacío, bloqueando la carga del lobby de rifas.

### Error HTTP

```
GET /api/raffles/v2?visibility[]=public&status[]=active&status[]=pending&sortBy=created&sortOrder=desc&search=

Status: 400 Bad Request

Response:
{
  "success": false,
  "message": "Invalid query parameters",
  "errors": ["\"search\" is not allowed to be empty"]
}
```

### Impacto

- ❌ Lobby de rifas no carga
- ❌ Botón "Crear Rifa" no responde (timeout)
- ❌ Listado de rifas públicas falla
- ❌ Búsqueda por código/nombre bloqueada

## 🔍 Causa Raíz

El validador Joi requería que `search` fuera un string no vacío cuando se proporcionaba:

```javascript
// ANTES (backend/modules/raffles/validators/index.js línea 265):
search: Joi.string().max(100).optional(),
```

Cuando el frontend enviaba `search=` (query param presente pero vacío), Joi lo rechazaba porque:
- `optional()` solo maneja el caso de parámetro **ausente**
- Cuando el parámetro **está presente pero vacío**, Joi aplica la validación de string
- Por defecto, Joi no permite strings vacíos a menos que se especifique explícitamente

### Frontend Envía

```
GET /api/raffles/v2?search=&visibility[]=public&...
```

El `search=` está **presente pero vacío**, por lo que Joi lo valida y lo rechaza.

## ✅ Solución

Agregar `.allow('')` para permitir explícitamente strings vacíos:

```javascript
// DESPUÉS (línea 265):
search: Joi.string().max(100).allow('').optional(),
```

### Comportamiento Correcto

- `?search=` → ✅ Permitido (string vacío)
- `?search=test` → ✅ Permitido (búsqueda normal)
- Sin parámetro search → ✅ Permitido (opcional)
- `?search=very_long_string...` → ❌ Rechazado si > 100 caracteres

## 📂 Archivos Modificados

- `backend/modules/raffles/validators/index.js` (línea 265)

## 🧪 Verificación

1. Cargar `/raffles` sin búsqueda → debe listar rifas
2. Buscar con campo vacío → debe listar todas
3. Buscar texto específico → debe filtrar
4. Verificar que botón "Crear Rifa" responde

## 🔗 Bugs Relacionados

Esta es parte de la cadena de fixes del sistema de rifas:

1. ✅ **Bug #1**: Validación `prizeMeta` condicional
2. ✅ **Bug #2**: JSON.parse en JSONB
3. ✅ **Bug #3**: Código undefined en navegación
4. ✅ **Bug #4**: Números no creados al crear rifa
5. ✅ **Bug #5**: Validación search vacío (este documento)

## ⚡ Impacto

- ✅ Lobby de rifas carga correctamente
- ✅ Búsqueda funcional con query vacío
- ✅ Botón "Crear Rifa" responde inmediatamente
- ✅ Sin errores 400 en listado

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Módulo**: Sistema de Rifas V2  
**Prioridad**: 🔴 CRÍTICA (bloqueaba todo el flujo)
