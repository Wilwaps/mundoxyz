# 🎯 SISTEMA DE RIFAS - PLAN MAESTRO DE IMPLEMENTACIÓN

**Fecha de inicio:** 2025-11-04  
**Estado:** EN EJECUCIÓN  
**Objetivo:** Sistema completo de rifas con modo 🔥 fuegos y modo 🎁 premio

---

## 📋 REQUISITOS FUNCIONALES CONFIRMADOS

### Modo 🔥 Fuegos
- ✅ Compra directa sin CAPTCHA (solo username requerido)
- ✅ Descuento inmediato de wallet
- ✅ Números cambian a `sold` instantáneamente
- ✅ Pozo acumulado visible
- ✅ Cierre automático al vender todos los números
- ✅ Distribución: 70% ganador, 20% host, 10% plataforma
- ✅ Ganador recibe fuegos en wallet automáticamente

### Modo 🎁 Premio
- ✅ Costo de creación: **300 fuegos** (descuento inmediato al host)
- ✅ Host registra **dos métodos de cobro**:
  - **Transferencia**: banco, titular, cédula, teléfono, instrucciones
  - **Efectivo**: nota/instrucción opcional
- ✅ Comprador llena formulario extendido:
  - Username (readonly, de Telegram o autogenerado)
  - Nombre para mostrar (editable, prefill desde perfil)
  - Nombre y apellido (obligatorio)
  - Cédula (obligatoria)
  - Teléfono (obligatorio)
  - Ubicación corta (opcional)
  - Referencia de pago (solo si método = transferencia)
  - Mensaje opcional
- ✅ Números quedan en estado `reserved` (24h)
- ✅ Host recibe notificación en buzón con link a sala
- ✅ **Botón "Solicitudes pendientes"** en sala (solo para host)
- ✅ Modal de aprobación con lista de solicitudes
- ✅ Aceptar → `reserved` → `sold` + genera ticket
- ✅ Rechazar → `reserved` → `available` + nota
- ✅ Visibilidad pública: solo `display_name` o username
- ✅ Datos completos: accesibles para host y admin

### Cierre y Ganador
- ✅ Selección aleatoria de número ganador
- ✅ Notificación masiva vía buzón a todos los participantes
- ✅ Mostrar: número ganador, usuario ganador, premio
- ✅ Actualizar métricas: `raffles_played` / `raffles_won`
- ✅ Tablero histórico accesible siempre

### Admin Controls
- ✅ Botón (X) para cerrar rifa manualmente
- ✅ **NUEVO:** Al cerrar, reembolsar totalidad a todos los jugadores
- ✅ Panel con filtros/descarga de solicitudes y participantes
- ✅ Visibilidad completa de datos de compradores
- ✅ **FUTURO:** Config del costo de creación de rifas premio (300 fuegos)

---

## 🏗️ ARQUITECTURA DE DATOS

### Nuevas Tablas

#### `raffle_host_payment_methods`
```sql
CREATE TABLE raffle_host_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('transferencia', 'efectivo')),
    is_active BOOLEAN DEFAULT true,
    
    -- Para transferencia
    bank_name VARCHAR(100),
    account_holder VARCHAR(200),
    account_number VARCHAR(50),
    id_number VARCHAR(20),
    phone VARCHAR(20),
    instructions TEXT,
    
    -- Para efectivo
    pickup_instructions TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(raffle_id, method_type)
);
```

#### Extensión de `raffle_requests`
```sql
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS buyer_profile JSONB;
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS host_notes TEXT;
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE raffle_requests ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]';
```

#### Métricas de Usuario
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS raffles_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS raffles_won INTEGER DEFAULT 0;
```

---

## 📦 ETAPAS DE IMPLEMENTACIÓN

### ✅ Etapa 0: Preparación [PENDIENTE]
- [ ] Crear migraciones para nuevas tablas
- [ ] Ejecutar migraciones en local y Railway
- [ ] Validar schema con queries de prueba
- [ ] Backup de BD antes de cambios

### 🔥 Etapa 1: Flujo Modo Fuegos [PENDIENTE]
**Backend:**
- [ ] Simplificar validación en `/api/raffles/purchase`
- [ ] Refactorizar `purchaseNumber` para omitir CAPTCHA en fires
- [ ] Soportar compra de múltiples números en un solo request
- [ ] Garantizar transacciones atómicas

**Frontend:**
- [ ] Actualizar payload en `RaffleDetails.js`
- [ ] Mejorar feedback de compra (loading, success, error)
- [ ] Socket updates para grid en tiempo real

**Testing:**
- [ ] Pruebas con 2 usuarios (prueba1/prueba2)
- [ ] Validar descuento correcto
- [ ] Verificar cierre automático

### 🎁 Etapa 2: Configuración Modo Premio [PENDIENTE]
**Backend:**
- [ ] Endpoint `POST /api/raffles/payment-methods` (CRUD)
- [ ] Cobro de 300 fuegos al crear rifa prize
- [ ] Validar que host tenga saldo suficiente

**Frontend:**
- [ ] Sección en `CreateRaffleModal` para datos de cobro
- [ ] Toggle transferencia/efectivo
- [ ] Validaciones y preview

**Testing:**
- [ ] Crear rifa prize con ambos métodos
- [ ] Validar descuento de 300 fuegos
- [ ] Verificar datos guardados correctamente

### 🛒 Etapa 3: Compra Modo Premio [PENDIENTE]
**Backend:**
- [ ] Extender `processPrizePurchase` con nuevo payload
- [ ] Guardar `buyer_profile` completo en JSONB
- [ ] Crear notificación en buzón para host
- [ ] Socket event para "número reservado"

**Frontend:**
- [ ] Modal de compra con formulario completo
- [ ] Mostrar datos bancarios del host
- [ ] Condicional para referencia (transferencia) vs mensaje (efectivo)
- [ ] Validaciones en tiempo real

**Testing:**
- [ ] Compra con transferencia (con referencia)
- [ ] Compra con efectivo (sin referencia)
- [ ] Verificar notificación al host
- [ ] Validar datos guardados

### ✅ Etapa 4: Aprobación/Rechazo [PENDIENTE]
**Backend:**
- [ ] Endpoint `GET /api/raffles/:id/requests` (listar solicitudes)
- [ ] Mejorar `approvePurchase` para aceptar nota
- [ ] Mejorar `rejectPurchase` para aceptar motivo
- [ ] Notificar comprador tras aprobación/rechazo
- [ ] Historial de cambios en JSONB

**Frontend:**
- [ ] Botón "Solicitudes pendientes" (solo host)
- [ ] Modal con tabla de solicitudes
- [ ] Botones aceptar/rechazar + textarea
- [ ] Actualización optimista del grid

**Testing:**
- [ ] Aprobar solicitud → número cambia a sold
- [ ] Rechazar solicitud → número vuelve a available
- [ ] Verificar notificaciones
- [ ] Validar historial

### 🏁 Etapa 5: Cierre y Ganador [PENDIENTE]
**Backend:**
- [ ] Refinar `closeRaffleAndSelectWinner`
- [ ] Diferenciar distribución fires vs registro prize
- [ ] Notificaciones masivas a participantes
- [ ] Actualizar métricas `raffles_played` / `raffles_won`
- [ ] **NUEVO:** `cancelRaffleWithRefund` para admin

**Frontend:**
- [ ] UI para mostrar ganador en sala finalizada
- [ ] Tabs "Activas" / "Finalizadas" en perfil
- [ ] Tablero histórico siempre accesible
- [ ] Botón (X) admin para cerrar con reembolso

**Testing:**
- [ ] Cierre automático modo fires
- [ ] Cierre manual host
- [ ] Cierre admin con reembolso total
- [ ] Validar notificaciones masivas
- [ ] Verificar métricas actualizadas

### 📬 Etapa 6: Notificaciones y Perfil [PENDIENTE]
**Backend:**
- [ ] Plantilla buzón "Solicitud compra rifa"
- [ ] Plantilla buzón "Rifa finalizada"
- [ ] Endpoints para historial de rifas del usuario
- [ ] Filtros y paginación

**Frontend:**
- [ ] Sección "Mis Rifas" en perfil
- [ ] Contadores jugadas/ganadas
- [ ] Lista con tabs activas/finalizadas
- [ ] Click para reabrir tablero

**Testing:**
- [ ] Verificar notificaciones correctas
- [ ] Validar contadores
- [ ] Navegación a historiales

### 🔧 Etapa 7: Admin Panel [PENDIENTE]
**Backend:**
- [ ] Endpoint `GET /api/admin/raffles` (filtros, paginación)
- [ ] Endpoint `GET /api/admin/raffles/:id/requests` (descargar CSV)
- [ ] Endpoint `POST /api/admin/raffles/:id/cancel` (con reembolso)
- [ ] Logs de auditoría

**Frontend:**
- [ ] Panel admin con tabla de rifas
- [ ] Filtros: estado, host, modo, fecha
- [ ] Botón (X) cerrar rifa con confirmación
- [ ] Descarga CSV de participantes/solicitudes

**Testing:**
- [ ] Cerrar rifa y verificar reembolso total
- [ ] Descargar CSV
- [ ] Validar logs

### 🧪 Etapa 8: QA Final [PENDIENTE]
- [ ] Suite de tests automatizados (Jest + Supertest)
- [ ] Pruebas de carga (simular 10+ usuarios comprando)
- [ ] Validación Chrome DevTools en Railway
- [ ] Revisión de código y refactor
- [ ] Documentación técnica completa

---

## 🎯 ESTRUCTURA DE PAYLOAD

### POST /api/raffles/purchase (Modo Fuegos)
```json
{
  "raffle_id": "uuid",
  "numbers": [0, 5, 12],  // Array de índices
  "mode": "fires"
}
```

### POST /api/raffles/purchase (Modo Premio)
```json
{
  "raffle_id": "uuid",
  "numbers": [3],
  "mode": "prize",
  "buyer_profile": {
    "username": "user123",
    "display_name": "Juan Pérez",
    "full_name": "Juan Carlos Pérez García",
    "id_number": "V-12345678",
    "phone": "+58412-1234567",
    "location": "Caracas, Venezuela"
  },
  "payment_method": "transferencia",  // o "efectivo"
  "payment_reference": "REF-123456",   // solo si transferencia
  "message": "Pago realizado desde Banco XYZ"
}
```

### POST /api/raffles/approve-purchase
```json
{
  "request_id": "uuid",
  "note": "Pago verificado correctamente"
}
```

### POST /api/raffles/reject-purchase
```json
{
  "request_id": "uuid",
  "reason": "Referencia no encontrada en sistema bancario"
}
```

### POST /api/admin/raffles/:id/cancel
```json
{
  "admin_id": "uuid",
  "reason": "Violación de términos de servicio"
}
```

---

## 🛡️ GARANTÍAS DE CALIDAD

### Transaccionalidad
- Todas las operaciones críticas usan `BEGIN` / `COMMIT` / `ROLLBACK`
- Locks en wallet para evitar race conditions
- Validaciones antes de cada mutación

### Seguridad
- `buyer_profile` solo visible para host/admin (middleware de autorización)
- Validación de roles antes de aprobar/rechazar
- Sanitización de inputs
- Rate limiting en endpoints de compra

### Performance
- Índices en columnas clave (`raffle_id`, `state`, `owner_id`, `status`)
- Socket.io para updates en tiempo real (evita polling)
- Paginación en listados grandes
- Cache de rifas públicas (Redis opcional)

### UX
- Skeleton loaders en todas las cargas
- Animaciones suaves (framer-motion)
- Feedback inmediato (toast notifications)
- Actualizaciones optimistas donde sea posible
- Mobile-first responsive

### Auditoría
- Logs estructurados en todos los endpoints críticos
- Historial JSONB en `raffle_requests` con timestamps
- Tracking de admin actions
- Exportación CSV para compliance

---

## 📊 MÉTRICAS DE ÉXITO

- [ ] ✅ Modo fuegos: compra exitosa en < 2 segundos
- [ ] ✅ Modo premio: reserva exitosa en < 3 segundos
- [ ] ✅ Aprobación/rechazo: actualización en < 1 segundo
- [ ] ✅ Notificaciones: entregadas en < 5 segundos
- [ ] ✅ Cierre automático: ejecutado inmediatamente tras última venta
- [ ] ✅ Reembolso admin: procesado en < 10 segundos
- [ ] ✅ Zero errores de schema en producción
- [ ] ✅ 100% de transacciones atómicas
- [ ] ✅ UI responsive < 1920px y > 360px
- [ ] ✅ Lighthouse score > 90

---

## 📝 CHECKLIST FINAL ANTES DE DEPLOY

- [ ] Todas las migraciones ejecutadas sin errores
- [ ] Tests E2E pasando (modo fires y prize)
- [ ] Validación manual con 2 usuarios en Railway
- [ ] Logs de auditoría funcionando
- [ ] Notificaciones en buzón operativas
- [ ] Reembolso admin testeado
- [ ] Documentación actualizada
- [ ] Commit message descriptivo
- [ ] README con instrucciones de uso
- [ ] Backup de BD pre-deploy

---

**Compromiso:** Cada línea de código será escrita con excelencia, cada función testeada exhaustivamente, cada flujo validado end-to-end. Este sistema será robusto, elegante y digno de admiración.

**Próximo paso:** Iniciar Etapa 0 - Preparación de base de datos.
