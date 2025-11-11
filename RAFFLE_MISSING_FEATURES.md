# FUNCIONALIDADES FALTANTES - SISTEMA DE RIFAS V2

**Fecha:** 11 Nov 2025 18:20 UTC-4
**Prioridad:** CRÍTICO → MEDIO → BAJO

---

## 🔴 CRÍTICO (Implementar YA)

### 1. COMISIÓN INICIAL MODO FIRES
**Ubicación:** `backend/modules/raffles/services/RaffleServiceV2.js` → `createRaffle()`
**Requerimiento:** Host paga precio_por_número en fuegos al crear la sala
**Estado:** ❌ NO IMPLEMENTADO

### 2. TOGGLE PAGO CON FUEGOS (MODO PREMIO)
**Ubicación:** DB + Backend + Frontend
**Requerimiento:** Checkbox para permitir pago con fuegos (automático, sin aprobación)
**Estado:** ❌ NO IMPLEMENTADO

### 3. SISTEMA APROBACIÓN/RECHAZO
**Ubicación:** `routes/index.js` líneas 152-174
**Requerimiento:** Endpoints funcionales para aprobar/rechazar solicitudes
**Estado:** ❌ PLACEHOLDER (501)

### 4. MODAL PARTICIPANTES FUNCIONAL
**Ubicación:** `frontend/src/features/raffles/components/ParticipantsModal.tsx`
**Requerimiento:** Conectar con API, diferenciar host vs usuario
**Estado:** ⚠️ PLACEHOLDER BÁSICO

### 5. VALIDACIÓN BALANCE 500 FUEGOS
**Ubicación:** `RaffleServiceV2.js` → `createRaffle()`
**Requerimiento:** Descontar 500 fuegos al crear modo Premio/Empresa
**Estado:** ⚠️ SOLO EN FRONTEND

---

## 🟡 IMPORTANTE (Implementar pronto)

### 6. UPLOAD DE IMÁGENES
**Ubicación:** `routes/index.js` líneas 182-204
**Requerimiento:** Cloudinary/S3 para premios y logos
**Estado:** ❌ PLACEHOLDER (501)

### 7. FORMULARIO DATOS COMPRADOR
**Ubicación:** `PurchaseModal.tsx`
**Requerimiento:** Campos opcionales + botón "Pegar" referencia
**Estado:** ❌ NO IMPLEMENTADO

### 8. ELIMINAR PASO 3 MODAL
**Ubicación:** `CreateRaffleModal.tsx`
**Requerimiento:** Quitar selector visibilidad duplicado
**Estado:** ⚠️ DUPLICADO

### 9. RUTA LANDING EMPRESARIAL
**Ubicación:** `App.tsx` o `Routes.tsx`
**Requerimiento:** Agregar `Route path="/:code/rifa"`
**Estado:** ⚠️ COMPONENTE LISTO, FALTA RUTA

---

## 🟢 OPCIONAL (Futuro)

### 10. COMPRA/RESERVA MÚLTIPLE
**Ubicación:** `routes/index.js` líneas 122-144
**Requerimiento:** Batch operations
**Estado:** ❌ PLACEHOLDER (501)

### 11. REPORTES
**Ubicación:** `routes/index.js` líneas 212-220
**Requerimiento:** Estadísticas y exports
**Estado:** ❌ PLACEHOLDER (501)

### 12. CACHÉ REDIS
**Requerimiento:** Optimización de consultas
**Estado:** ❌ NO IMPLEMENTADO

### 13. NOTIFICACIONES TELEGRAM
**Requerimiento:** Webhook para bot
**Estado:** ❌ NO IMPLEMENTADO

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

```markdown
- [ ] 1. Comisión inicial modo FIRES
- [ ] 2. Toggle pago con fuegos + migración DB
- [ ] 3. Endpoints aprobar/rechazar
- [ ] 4. Modal participantes completo
- [ ] 5. Validación y cobro 500 fuegos backend
- [ ] 6. Upload imágenes (Cloudinary)
- [ ] 7. Formulario datos comprador
- [ ] 8. Eliminar paso 3 modal
- [ ] 9. Agregar ruta /:code/rifa
- [ ] 10. Batch operations
- [ ] 11. Sistema de reportes
- [ ] 12. Caché con Redis
- [ ] 13. Webhook Telegram
```

---

## 🎯 ESTIMACIÓN DE TIEMPO

**Crítico (1-5):** 12-15 horas
**Importante (6-9):** 8-10 horas  
**Opcional (10-13):** 10-12 horas

**TOTAL:** 30-37 horas de desarrollo
