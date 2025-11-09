# BUG #3: Navegación a `/raffles/undefined` Después de Crear Rifa

## 📋 Descripción del Problema

Después de crear exitosamente una rifa en modo "Fuegos", el sistema navegaba a la URL `/raffles/undefined` en lugar de usar el código de rifa generado por el backend.

### Síntomas Observados

1. ✅ **Backend crea la rifa exitosamente** (HTTP 201)
2. ✅ **Backend devuelve el código correcto** (ej: `726332`)
3. ❌ **Frontend navega a** `/raffles/undefined`
4. ❌ **Páginas subsecuentes fallan** con 404 al intentar cargar `/api/raffles/v2/undefined`

### Evidencia del Bug

**Respuesta del backend (POST /api/raffles/v2):**
```json
{
  "success": true,
  "raffle": {
    "id": 16,
    "code": "726332",
    "name": "Test DevTools - Rifa Fuego",
    "status": "active",
    "mode": "fires",
    ...
  },
  "message": "Rifa creada exitosamente"
}
```

**Comportamiento del frontend:**
- Toast muestra: "¡Rifa creada exitosamente!" ✅
- URL resultante: `/raffles/undefined` ❌

## 🔍 Causa Raíz

### Archivo Problemático
`frontend/src/features/raffles/api/index.ts` - Función `createRaffle`

### Código Incorrecto
```typescript
export const createRaffle = async (form: CreateRaffleForm): Promise<Raffle> => {
  const { data } = await api.post<Raffle>(API_ENDPOINTS.CREATE, form);
  return data;  // ❌ data es { success, raffle, message }, no Raffle directamente
};
```

### Problema Identificado

El backend devuelve un objeto envuelto:
```typescript
{
  success: boolean,
  raffle: Raffle,
  message: string
}
```

Pero el código frontend esperaba que `data` fuera directamente un objeto `Raffle`, causando que:
1. `result.code` en `CreateRaffleModal.tsx` línea 213 fuera `undefined`
2. La navegación a `/raffles/${code}` resultara en `/raffles/undefined`

## ✅ Solución Implementada

### Cambio en `frontend/src/features/raffles/api/index.ts`

```typescript
// Crear nueva rifa
export const createRaffle = async (form: CreateRaffleForm): Promise<Raffle> => {
  const { data } = await api.post<{ success: boolean; raffle: Raffle; message: string }>(
    API_ENDPOINTS.CREATE, 
    form
  );
  return data.raffle;  // ✅ Extraer el objeto raffle del wrapper
};
```

### Cambios Realizados

1. **Tipo correcto de respuesta**: Especificar el tipo completo `{ success, raffle, message }`
2. **Extracción correcta**: Devolver `data.raffle` en lugar de `data` directamente

## 🧪 Verificación

### Antes del Fix
```
POST /api/raffles/v2 → 201 ✅
Response: { success: true, raffle: { code: "726332", ... } }
Frontend recibe: data (objeto completo)
Accede a: data.code → undefined ❌
Navega a: /raffles/undefined ❌
```

### Después del Fix
```
POST /api/raffles/v2 → 201 ✅
Response: { success: true, raffle: { code: "726332", ... } }
Frontend recibe: data.raffle (objeto Raffle)
Accede a: result.code → "726332" ✅
Navega a: /raffles/726332 ✅
```

## 📊 Impacto

### Archivos Modificados
- ✅ `frontend/src/features/raffles/api/index.ts`

### Funcionalidad Restaurada
- ✅ Navegación correcta después de crear rifa
- ✅ Carga correcta de la página de detalle de rifa
- ✅ Obtención de números disponibles
- ✅ Consulta de números del usuario

## 🔄 Flujo Correcto Post-Fix

1. Usuario completa el wizard de creación de rifa
2. Click en "Crear Rifa"
3. POST `/api/raffles/v2` → 201 con código `726332`
4. Frontend extrae `data.raffle` y accede a `result.code`
5. Navega a `/raffles/726332` ✅
6. GET `/api/raffles/v2/726332` → 200 con datos de la rifa
7. GET `/api/raffles/v2/726332/numbers` → 200 con números disponibles
8. GET `/api/raffles/v2/726332/my-numbers` → 200 con números del usuario

## 📝 Notas Técnicas

### Pattern Observado
Este bug evidencia un **desacoplamiento entre el formato de respuesta del backend y las expectativas del frontend**.

### Lección Aprendida
- Siempre verificar la estructura exacta de la respuesta del backend
- Usar tipos TypeScript precisos para las respuestas API
- Considerar estandarizar el formato de respuestas (siempre wrapper vs. siempre directo)

### Bugs Relacionados Encontrados Durante Investigación
1. ✅ **Bug #1**: Validación `prizeMeta` incorrecta para modo "Fuegos" - RESUELTO
2. ✅ **Bug #2**: `JSON.parse` en columna JSONB - RESUELTO
3. ✅ **Bug #3**: Código `undefined` en navegación - RESUELTO (este documento)

## ⏱️ Timeline

- **Detección**: 2025-11-09 19:03 UTC-4 (durante prueba con Chrome DevTools)
- **Diagnóstico**: Análisis de Network requests (reqid=34) mostró código correcto en respuesta
- **Implementación**: Modificación de `api/index.ts` para extraer `data.raffle`
- **Deploy**: Pendiente (Railway ~6 minutos)
- **Verificación**: Pendiente post-deploy

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Módulo**: Sistema de Rifas V2  
**Prioridad**: 🔴 CRÍTICA (bloqueaba flujo completo de creación)
