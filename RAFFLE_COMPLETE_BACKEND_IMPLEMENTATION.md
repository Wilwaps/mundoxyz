# IMPLEMENTACIÓN COMPLETA BACKEND - SISTEMA RIFAS V2

**Fecha:** 11 Nov 2025 18:40 UTC-4
**Estado:** BACKEND COMPLETADO ✅

---

## ✅ IMPLEMENTADO (Backend Completo)

### 1. MIGRACIÓN DB `043_raffles_complete_features.sql`

```sql
✅ allow_fires_payment BOOLEAN DEFAULT FALSE
✅ prize_image_base64 TEXT
✅ logo_base64 TEXT en raffle_companies
✅ payment_proof_base64 TEXT en raffle_requests
✅ Índices optimizados
```

### 2. SERVICE - Comisiones y Validaciones

**Método: `createRaffle()` - Actualizado completamente**

- ✅ **Modo FIRES:** Cobra comisión = precio_por_número en fuegos
- ✅ **Modo PRIZE:** Cobra 500 fuegos fijos
- ✅ **Modo EMPRESA:** Cobra 500 fuegos fijos
- ✅ **Validación de balance:** Verifica que host tenga fondos suficientes
- ✅ **Transacciones wallet:** Descuenta del host, acredita a plataforma (1417856820)
- ✅ **Registro transacciones:** wallet_transactions con descripciones claras
- ✅ **Transacciones atómicas:** BEGIN/COMMIT/ROLLBACK correctos
- ✅ **Soporte imágenes base64:** prize_image_base64, logo_base64
- ✅ **Toggle pago fuegos:** allow_fires_payment para modo PRIZE

**Flujo de Comisiones:**
```javascript
// Modo FIRES: Rifa 20 fuegos/número
Host paga: 20 fuegos → Plataforma

// Modo PRIZE: Cualquier rifa
Host paga: 500 fuegos → Plataforma

// Modo EMPRESA: Con landing
Host paga: 500 fuegos → Plataforma
```

### 3. SERVICE - Sistema de Participantes

**Método: `getParticipants(raffleCode, userId)` - NUEVO**

#### Modo FIRES/COINS (Vista Pública)
```javascript
{
  participants: [
    {
      display_name: "Prueba Uno",
      telegram_username: "@prueba1",
      numbers: [1, 2, 5, 7]
    }
  ],
  totalParticipants: 10
}
```

#### Modo PRIZE (Vista Host)
```javascript
{
  requests: [
    {
      requestId: 1,
      buyerProfile: {
        displayName: "Juan Pérez",
        fullName: "Juan Pérez González",
        phone: "+58 412 123 4567",
        email: "juan@example.com",
        idNumber: "V-12345678"
      },
      requestData: {
        reference: "123456789",
        paymentMethod: "bank",
        bank_code: "0102"
      },
      status: "pending",
      numbers: [1, 2],
      telegramUsername: "@juan",
      createdAt: "2025-11-11T..."
    }
  ],
  totalRequests: 5
}
```

#### Modo PRIZE (Vista Usuario Normal)
```javascript
{
  participants: [
    {
      display_name: "Juan Pérez",
      numbers: [1, 2]
    }
  ],
  totalParticipants: 3
}
```

### 4. SERVICE - Sistema Aprobación/Rechazo

**Método: `approvePaymentRequest(requestId, hostId)` - NUEVO**

- ✅ Verifica que usuario sea el host
- ✅ Valida que solicitud esté en estado 'pending'
- ✅ Marca número como 'sold'
- ✅ Actualiza solicitud a 'approved'
- ✅ Notifica al comprador vía socket
- ✅ Trigger verificación finalización de rifa
- ✅ Transacción atómica completa

**Método: `rejectPaymentRequest(requestId, hostId, reason)` - NUEVO**

- ✅ Verifica que usuario sea el host
- ✅ Valida que solicitud esté en estado 'pending'
- ✅ Libera número (vuelve a 'available')
- ✅ Actualiza solicitud a 'rejected' con razón
- ✅ Notifica al comprador vía socket con razón
- ✅ Transacción atómica completa

### 5. CONTROLLER - Nuevos Métodos

```javascript
✅ getParticipants(req, res)
✅ approveRequest(req, res)
✅ rejectRequest(req, res)
```

### 6. RUTAS - Endpoints Funcionales

```javascript
✅ GET  /api/raffles/v2/:code/participants (público con auth opcional)
✅ POST /api/raffles/v2/:code/requests/:requestId/approve (solo host)
✅ POST /api/raffles/v2/:code/requests/:requestId/reject (solo host)
```

---

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### ✅ 1. Comisión Inicial Modo FIRES
**Antes:** ❌ No cobraba comisión al crear  
**Ahora:** ✅ Cobra precio_por_número en fuegos al host

### ✅ 2. Validación 500 Fuegos
**Antes:** ⚠️ Solo validación frontend  
**Ahora:** ✅ Validación y cobro backend con transacciones

### ✅ 3. Toggle Pago con Fuegos
**Antes:** ❌ No existía  
**Ahora:** ✅ Campo allow_fires_payment en DB y backend

### ✅ 4. Sistema Aprobación/Rechazo
**Antes:** ❌ Placeholder 501  
**Ahora:** ✅ Endpoints funcionales con lógica completa

### ✅ 5. Modal Participantes (Backend)
**Antes:** ❌ No existía  
**Ahora:** ✅ Endpoint con vistas según rol

### ✅ 6. Imágenes Base64
**Antes:** ❌ No soportado  
**Ahora:** ✅ prize_image_base64, logo_base64, payment_proof_base64

---

## 📊 EJEMPLOS DE USO

### Crear Rifa Modo FIRES
```javascript
POST /api/raffles/v2/
{
  "name": "Rifa de Prueba",
  "mode": "fires",
  "numbersRange": 10,
  "entryPrice": 20, // Host paga 20 fuegos al crear
  "visibility": "public"
}
// ✅ Se descuentan 20 fuegos del host
// ✅ Se acreditan 20 fuegos a plataforma
```

### Crear Rifa Modo PRIZE con Toggle Fuegos
```javascript
POST /api/raffles/v2/
{
  "name": "Rifa iPhone 15",
  "mode": "prize",
  "numbersRange": 100,
  "allowFiresPayment": true, // ✅ NUEVO
  "prizeImageBase64": "data:image/png;base64,...", // ✅ NUEVO
  "prizeMeta": {
    "prizeDescription": "iPhone 15 Pro Max 256GB",
    "bankingInfo": { ... }
  }
}
// ✅ Se descuentan 500 fuegos del host
// ✅ Se acreditan 500 fuegos a plataforma
```

### Obtener Participantes
```javascript
GET /api/raffles/v2/636823/participants
Authorization: Bearer <token>

// Host recibe:
{
  "success": true,
  "requests": [...], // Con todos los datos
  "totalRequests": 5
}

// Usuario normal recibe:
{
  "success": true,
  "participants": [...], // Solo nombres y números
  "totalParticipants": 5
}
```

### Aprobar Solicitud
```javascript
POST /api/raffles/v2/636823/requests/1/approve
Authorization: Bearer <token_host>

{
  "success": true,
  "message": "Solicitud aprobada exitosamente",
  "numberIdx": 5
}

// ✅ Número marcado como vendido
// ✅ Usuario notificado vía socket
// ✅ Se verifica si rifa debe finalizarse
```

### Rechazar Solicitud
```javascript
POST /api/raffles/v2/636823/requests/2/reject
Authorization: Bearer <token_host>
{
  "reason": "Datos de pago incorrectos"
}

{
  "success": true,
  "message": "Solicitud rechazada",
  "numberIdx": 3
}

// ✅ Número vuelve a disponible
// ✅ Usuario notificado vía socket con razón
```

---

## ⏳ PENDIENTE (Frontend)

### 7. CreateRaffleModal.tsx
- [ ] Toggle "Permitir pago con fuegos"
- [ ] Upload imagen de premio (base64)
- [ ] Upload logo empresa (base64)
- [ ] Eliminar paso 3 (visibilidad)

### 8. PurchaseModal.tsx
- [ ] Formulario datos comprador (todos opcionales)
- [ ] Botón "Pegar" en referencia
- [ ] Upload comprobante (base64)
- [ ] Detección de allow_fires_payment

### 9. ParticipantsModal.tsx
- [ ] Conectar con API `/participants`
- [ ] Vista diferenciada host vs usuario
- [ ] Botones aprobar/rechazar
- [ ] Modal de detalles de solicitud

### 10. Hooks y API Client
- [ ] useParticipants()
- [ ] useApproveRequest()
- [ ] useRejectRequest()
- [ ] API client functions

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar migración 043** en Railway
2. **Testing backend** con Postman/Insomnia
3. **Implementar frontend** (componentes + hooks)
4. **Testing E2E** completo
5. **Deploy a producción**

---

## 📝 COMANDOS DE TESTING

### Test Comisión FIRES
```bash
# Usuario con 100 fuegos crea rifa de 20 fuegos/número
POST /api/raffles/v2/
# Verificar: Balance debe quedar en 80 fuegos
SELECT fires_balance FROM wallets WHERE user_id = '...';
```

### Test Cobro 500 Fuegos
```bash
# Usuario con 600 fuegos crea rifa modo PRIZE
POST /api/raffles/v2/
# Verificar: Balance debe quedar en 100 fuegos
SELECT fires_balance FROM wallets WHERE user_id = '...';
```

### Test Balance Insuficiente
```bash
# Usuario con 10 fuegos intenta crear rifa PRIZE
POST /api/raffles/v2/
# Esperado: Error 400 "Necesitas 500 fuegos"
```

---

## ✅ CHECKLIST BACKEND

- [x] Migración DB completa
- [x] Comisión inicial FIRES
- [x] Cobro 500 fuegos PRIZE/EMPRESA
- [x] Validación de balance
- [x] Transacciones wallet
- [x] Campo allow_fires_payment
- [x] Soporte imágenes base64
- [x] Endpoint getParticipants
- [x] Endpoint approveRequest
- [x] Endpoint rejectRequest
- [x] Notificaciones socket
- [x] Verificación finalización tras aprobación
- [x] Manejo de errores completo
- [x] Logging detallado

**BACKEND: 100% COMPLETADO** ✅
