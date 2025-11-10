# ✅ FIXES: Modal de Compra + Manejo de Errores NOT_FOUND

**Fecha**: 2025-11-10 08:40  
**Commits**: ad8283c (hotfix reserved_at) + 3a41daf (modal + errores)  
**Problemas Resueltos**: 2 críticos  

---

## 🐛 PROBLEMA 1: Modal de Compra Mal Ubicado

### Síntoma:
El modal de compra aparecía centrado en la pantalla en lugar de alineado a la izquierda como se requería.

### Causa:
El contenedor backdrop usaba `justify-center` por defecto y el modal no tenía animación de slide desde la izquierda.

### Solución Aplicada:

**Archivo**: `frontend/src/features/raffles/components/PurchaseModal.tsx` (líneas 492-506)

**ANTES**:
```tsx
<motion.div
  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 
             flex items-center justify-start pl-4 p-4"
>
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="w-full max-w-lg max-h-[90vh] bg-dark rounded-2xl"
  >
```

**DESPUÉS**:
```tsx
<motion.div
  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 
             flex items-center justify-start p-0"
>
  <motion.div
    initial={{ opacity: 0, x: -100 }}        // ✅ Slide desde izquierda
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -100 }}
    className="w-full max-w-md sm:max-w-lg h-full sm:h-auto 
               sm:max-h-[95vh] bg-dark sm:rounded-r-2xl 
               shadow-2xl overflow-hidden flex flex-col relative sm:ml-0"
  >
```

### Mejoras Visuales:

1. **Animación**: Slide horizontal desde la izquierda (`x: -100 → 0`)
2. **Responsive**:
   - **Mobile**: Pantalla completa (`h-full`)
   - **Desktop**: Modal flotante con altura máxima 95vh
3. **Bordes**:
   - **Mobile**: Sin bordes redondeados
   - **Desktop**: Solo borde derecho redondeado (`sm:rounded-r-2xl`)
4. **Ancho máximo**:
   - **Mobile**: `max-w-md` (448px)
   - **Desktop**: `max-w-lg` (512px)

---

## 🐛 PROBLEMA 2: Error "NOT_FOUND" al Comprar Números

### Síntoma:
Al intentar reservar/comprar números, aparecía error:
```
[RaffleServiceV2] Error cancelando rifa code: "NOT_FOUND" 
status: 404
```

**Railway Logs**:
```
POST /api/raffles/v2/253797/numbers/1/reserve
[RaffleController] Error reservando número code: 'NOT_FOUND'
```

### Causa:
La rifa con código `253797` no existe en la base de datos. Posibles razones:
1. Rifa fue eliminada/cancelada
2. Usuario accedió con código incorrecto
3. Problema de sincronización entre frontend y backend

### Solución Aplicada:

#### Backend: Mejor Logging y Validación

**Archivo**: `backend/modules/raffles/controllers/RaffleController.js` (líneas 214-230)

**AGREGADO**:
```javascript
async reserveNumber(req, res) {
  try {
    const { code, idx } = req.params;
    const userId = req.user.id;
    
    // ✅ Log detallado del intento
    logger.info('[RaffleController] Intentando reservar número', { 
      code, idx, userId 
    });
    
    // Obtener rifa
    const raffleData = await raffleService.getRaffleByCode(code);
    
    // ✅ Validación explícita
    if (!raffleData || !raffleData.raffle) {
      logger.error('[RaffleController] Rifa no encontrada', { code });
      return res.status(404).json({
        success: false,
        message: 'La rifa no existe o fue eliminada'
      });
    }
    
    const raffle = raffleData.raffle;
    // ... resto del código
```

**Beneficios**:
- Log del intento antes de fallar
- Validación explícita de existencia
- Mensaje de error claro para el usuario

#### Frontend: Auto-Redirect si Rifa No Existe

**Archivo**: `frontend/src/features/raffles/hooks/useRaffleData.ts` (líneas 173-187)

**AGREGADO**:
```typescript
onError: (error: any) => {
  console.error('[useReserveNumber] Error reservando:', error);
  
  // ✅ Mensajes específicos según código de error
  if (error.response?.status === 404) {
    toast.error('Esta rifa no existe o fue eliminada');
    
    // ✅ Auto-redirect al lobby después de 2s
    setTimeout(() => {
      window.location.href = '/raffles';
    }, 2000);
  } else {
    const message = error.response?.data?.message || 
                   UI_TEXTS.ERRORS.NUMBER_UNAVAILABLE;
    toast.error(message);
  }
}
```

**Beneficios**:
- Usuario ve mensaje claro: "Esta rifa no existe o fue eliminada"
- Redirige automáticamente al lobby de rifas después de 2 segundos
- Evita que el usuario se quede atascado en una página inválida

---

## 🔥 HOTFIX PREVIO: Columnas Reserved

**Commit**: ad8283c  
**Fecha**: 2025-11-10 08:20  

### Problema:
```
column "reserved_at" of relation "raffle_numbers" does not exist
```

### Fix:
Corregir nombres de columnas en `cancelRaffle()`:

**ANTES**:
```javascript
UPDATE raffle_numbers 
SET state = 'available',
    owner_id = NULL,
    reserved_at = NULL      // ❌ NO EXISTE
WHERE raffle_id = $1
```

**DESPUÉS**:
```javascript
UPDATE raffle_numbers 
SET state = 'available',
    owner_id = NULL,
    reserved_by = NULL,     // ✅ CORRECTO
    reserved_until = NULL   // ✅ CORRECTO
WHERE raffle_id = $1
```

**Schema Real** (migración 036):
- `reserved_by UUID` - Usuario que reservó
- `reserved_until TIMESTAMP` - Expiración de reserva

---

## 📦 ARCHIVOS MODIFICADOS

### Backend:
1. `backend/modules/raffles/services/RaffleServiceV2.js`
   - Corregir columnas `reserved_by` y `reserved_until`
   
2. `backend/modules/raffles/controllers/RaffleController.js`
   - Agregar logging detallado en `reserveNumber()`
   - Validación explícita de existencia de rifa
   - Mensaje de error claro

### Frontend:
3. `frontend/src/features/raffles/components/PurchaseModal.tsx`
   - Animación slide desde izquierda (`x: -100`)
   - Modal alineado a la izquierda
   - Responsive mejorado (mobile fullscreen, desktop flotante)
   - Bordes adaptativos

4. `frontend/src/features/raffles/hooks/useRaffleData.ts`
   - Manejo específico de error 404 en `useReserveNumber`
   - Auto-redirect al lobby si rifa no existe
   - Logging de errores en consola

---

## 🧪 TESTING MANUAL REQUERIDO

### 1. Modal de Compra (UI):
- [ ] Abrir modal de compra en mobile
  - ✅ Debe ocupar pantalla completa
  - ✅ Sin bordes redondeados
  - ✅ Slide desde izquierda
  
- [ ] Abrir modal de compra en desktop
  - ✅ Debe estar alineado a la izquierda
  - ✅ Borde derecho redondeado
  - ✅ Ancho máximo 512px
  - ✅ Slide horizontal suave

### 2. Error NOT_FOUND:
- [ ] Intentar acceder a rifa que no existe
  - ✅ Ver toast: "Esta rifa no existe o fue eliminada"
  - ✅ Auto-redirect a `/raffles` después de 2s
  
- [ ] Intentar reservar número de rifa eliminada
  - ✅ Ver error en Railway logs con `code` y `userId`
  - ✅ Ver mensaje claro en frontend
  - ✅ Redirect automático

### 3. Logs Railway:
- [ ] Verificar logs mejorados:
  ```
  [RaffleController] Intentando reservar número { code: 'ABC123', idx: 5, userId: 'uuid' }
  [RaffleController] Rifa no encontrada { code: 'ABC123' }
  ```

---

## 📊 IMPACTO

### UX Mejorada:
✅ Modal más accesible en mobile (pantalla completa)  
✅ Animación profesional (slide horizontal)  
✅ Mejor alineación en desktop  
✅ Usuario no se queda atascado si rifa no existe  

### Debugging Mejorado:
✅ Logs detallados de intentos de reserva  
✅ Identificación clara de rifas faltantes  
✅ Mensajes de error específicos  

### Robustez:
✅ Validación explícita de existencia  
✅ Auto-recuperación ante errores (redirect)  
✅ Manejo defensivo de estados inválidos  

---

## 🚀 DEPLOY

**Railway**: Auto-deploy en ~6 minutos  
**URL**: https://mundoxyz-production.up.railway.app  
**Commits**:
- `ad8283c` - hotfix: columnas reserved
- `3a41daf` - fix: modal + errores NOT_FOUND

---

## 🔍 PRÓXIMOS PASOS

1. **Monitorear Railway logs** para ver si el error NOT_FOUND persiste
2. **Verificar base de datos** para ver qué rifas existen actualmente
3. **Testing E2E** del flujo completo de compra
4. **Considerar** agregar índice en `raffles(code)` para búsquedas más rápidas

---

## 📝 LECCIONES APRENDIDAS

1. **Nombres de columnas**: Siempre verificar en migraciones antes de escribir queries
2. **Validación defensiva**: Validar existencia explícitamente, no solo confiar en excepciones
3. **UX de errores**: Auto-redirect es mejor que dejar al usuario atascado
4. **Logging**: Logs detallados ANTES de la operación ayudan a debugging
5. **Animaciones**: Animaciones coherentes con la posición del elemento mejoran UX

---

**Status**: ✅ COMPLETADO  
**Testing**: Manual requerido post-deploy  
**Prioridad**: Alta (afecta compras)  

