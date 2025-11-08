# 💳 SISTEMA DE PAGOS EXTERNOS - RIFAS PREMIO Y EMPRESA

**Sistema completo de pagos externos para rifas con modo Premio y Empresa**

---

## 📋 ÍNDICE

1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Base de Datos](#base-de-datos)
4. [Backend API](#backend-api)
5. [Frontend](#frontend)
6. [Flujo Completo](#flujo-completo)
7. [Seguridad y Permisos](#seguridad-y-permisos)
8. [Testing](#testing)

---

## 📖 DESCRIPCIÓN GENERAL

Sistema que permite a los anfitriones de rifas (modo Premio y Empresa) configurar métodos de pago externos (efectivo o pago móvil) y recibir solicitudes de compra con datos opcionales de los compradores. Incluye:

- **Datos de pago del anfitrión** (costo, método, banco, teléfono, cédula, instrucciones)
- **Solicitudes de compra con datos opcionales** del comprador
- **Modal de participantes** con nombres públicos
- **Landing público** para rifas modo Empresa (sin login)
- **Sistema de permisos** para datos sensibles

---

## 🏗️ ARQUITECTURA

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE PAGOS RIFAS                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   BACKEND    │    │   FRONTEND   │    │   DATABASE   │ │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤ │
│  │ RaffleService│◄───┤PaymentDetails│◄───┤   raffles    │ │
│  │   - update   │    │    Modal     │    │ +7 columnas  │ │
│  │   - get      │    │              │    │              │ │
│  │              │    ├──────────────┤    ├──────────────┤ │
│  ├──────────────┤    │ BuyNumber    │    │raffle_requests│
│  │  Routes API  │◄───┤    Modal     │    │ buyer_profile │
│  │ 5 endpoints  │    │              │    │              │ │
│  │              │    ├──────────────┤    └──────────────┘ │
│  │              │    │Participants  │                      │
│  │              │    │    Modal     │                      │
│  │              │    ├──────────────┤                      │
│  │              │    │ Public       │                      │
│  │              │    │  Landing     │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 BASE DE DATOS

### Migración 034: Columnas de Pago en `raffles`

```sql
ALTER TABLE raffles ADD COLUMN payment_cost_amount DECIMAL(10,2);
ALTER TABLE raffles ADD COLUMN payment_cost_currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE raffles ADD COLUMN payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'bank'));
ALTER TABLE raffles ADD COLUMN payment_bank_code VARCHAR(10);
ALTER TABLE raffles ADD COLUMN payment_phone VARCHAR(20);
ALTER TABLE raffles ADD COLUMN payment_id_number VARCHAR(30);
ALTER TABLE raffles ADD COLUMN payment_instructions TEXT;
```

### Constraints

```sql
-- Validar longitud instrucciones
CHECK (payment_instructions IS NULL OR LENGTH(payment_instructions) <= 300)

-- Validar datos completos según método
CHECK (
  payment_method IS NULL OR
  (payment_method = 'cash' AND payment_cost_amount IS NOT NULL) OR
  (payment_method = 'bank' AND payment_cost_amount IS NOT NULL AND 
   payment_bank_code IS NOT NULL AND payment_phone IS NOT NULL AND 
   payment_id_number IS NOT NULL)
)
```

### Tabla `raffle_requests` (ya existente)

Utiliza el campo `buyer_profile` JSONB para almacenar datos opcionales del comprador:

```json
{
  "display_name": "Juan Gamer",
  "full_name": "Juan Pérez",
  "phone": "0412-1234567",
  "email": "juan@email.com",
  "payment_reference": "1234"
}
```

---

## 🔧 BACKEND API

### RaffleService - Métodos Nuevos

#### 1. `updatePaymentDetails(raffleId, hostId, paymentData)`

**Descripción:** Actualizar datos de pago (solo anfitrión)

**Parámetros:**
- `raffleId` (INTEGER): ID de la rifa
- `hostId` (UUID): ID del anfitrión
- `paymentData` (Object):
  ```javascript
  {
    payment_cost_amount: 10.00,
    payment_cost_currency: 'USD',
    payment_method: 'bank', // 'cash' o 'bank'
    payment_bank_code: '0134', // Solo si bank
    payment_phone: '0412-1234567', // Solo si bank
    payment_id_number: 'V-12345678', // Solo si bank
    payment_instructions: 'Pagar antes de las 6pm'
  }
  ```

**Validaciones:**
- Usuario debe ser el anfitrión
- Rifa debe ser modo `prize` o `company`
- Si método es `bank`, requiere: bank_code, phone, id_number
- Instrucciones máximo 300 caracteres

**Retorna:** Objeto con datos actualizados

---

#### 2. `getPaymentDetails(raffleId, userId?)`

**Descripción:** Obtener datos de pago de una rifa

**Parámetros:**
- `raffleId` (INTEGER): ID de la rifa
- `userId` (UUID, opcional): ID del usuario solicitante

**Retorna:**
```javascript
{
  payment_cost_amount: 10.00,
  payment_cost_currency: 'USD',
  payment_method: 'bank',
  payment_bank_code: '0134',
  payment_phone: '0412-1234567',
  payment_id_number: 'V-12345678',
  payment_instructions: 'Pagar antes de las 6pm'
}
```

**Nota:** Datos sensibles visibles para todos (necesarios para pagar)

---

#### 3. `getParticipants(raffleId)`

**Descripción:** Obtener lista pública de participantes

**Retorna:**
```javascript
[
  {
    display_name: "Juan Gamer",
    numbers: [5, 12, 23]
  },
  {
    display_name: "María Pro",
    numbers: [8, 15]
  }
]
```

**Nota:** Solo muestra `display_name` y números comprados

---

#### 4. `getParticipantFullData(raffleId, participantRequestId, requesterId)`

**Descripción:** Obtener datos completos de un participante

**Permisos:**
- **Admin/Tote:** Pueden ver datos de cualquier participante
- **Host:** Solo puede ver datos completos del **ganador**

**Retorna:**
```javascript
{
  display_name: "Juan Gamer",
  full_name: "Juan Pérez",
  phone: "0412-1234567",
  email: "juan@email.com",
  payment_reference: "1234",
  number_idx: 42
}
```

---

### Routes API - Endpoints Nuevos

#### 1. `PUT /api/raffles/:id/payment-details`

**Auth:** Requerida  
**Descripción:** Actualizar datos de pago (solo host)

**Body:**
```json
{
  "payment_cost_amount": 10.00,
  "payment_cost_currency": "USD",
  "payment_method": "bank",
  "payment_bank_code": "0134",
  "payment_phone": "0412-1234567",
  "payment_id_number": "V-12345678",
  "payment_instructions": "Pagar antes de las 6pm"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* datos actualizados */ },
  "message": "Datos de pago actualizados correctamente"
}
```

---

#### 2. `GET /api/raffles/:id/payment-details`

**Auth:** Opcional  
**Descripción:** Obtener datos de pago

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_cost_amount": 10.00,
    "payment_method": "bank",
    // ... resto de datos
  }
}
```

---

#### 3. `GET /api/raffles/:id/participants`

**Auth:** No requerida  
**Descripción:** Lista pública de participantes

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "display_name": "Juan Gamer",
      "numbers": [5, 12, 23]
    }
  ]
}
```

---

#### 4. `GET /api/raffles/:raffleId/participant/:requestId/full-data`

**Auth:** Requerida  
**Permisos:** Admin/Tote o Host (solo ganador)

**Response:**
```json
{
  "success": true,
  "data": {
    "full_name": "Juan Pérez",
    "phone": "0412-1234567",
    "email": "juan@email.com",
    "payment_reference": "1234"
  }
}
```

---

#### 5. `GET /api/raffles/public/:code`

**Auth:** No requerida  
**Descripción:** Landing público para modo Empresa

**Response:**
```json
{
  "success": true,
  "data": {
    "raffle": { /* info rifa */ },
    "numbers": [ /* array de números */ ],
    "participants": [ /* array participantes */ ]
  }
}
```

---

## 🎨 FRONTEND

### Componentes Nuevos

#### 1. `PaymentDetailsModal.js`

**Propósito:** Editar datos de pago del anfitrión

**Props:**
- `raffleId` (number): ID de la rifa
- `currentData` (object): Datos actuales
- `onClose` (function): Callback cerrar
- `onSave` (function): Callback guardar

**Features:**
- Formulario completo con validaciones
- Lista de 23 bancos venezolanos
- Campos condicionales (cash vs bank)
- Contador 300 caracteres en instrucciones
- Validación en tiempo real

---

#### 2. `BuyNumberModal.js`

**Propósito:** Comprador solicita número con datos opcionales

**Props:**
- `raffle` (object): Objeto rifa completo
- `numberIdx` (number): Número seleccionado
- `onClose` (function): Callback cerrar
- `onSuccess` (function): Callback éxito

**Features:**
- Muestra datos de pago del anfitrión
- Formulario datos comprador (todos opcionales)
- Diseño atractivo con gradientes
- Info de pago destacada en caja especial

---

#### 3. `ParticipantsModal.js`

**Propósito:** Ver lista pública de participantes

**Props:**
- `raffleId` (number): ID de la rifa
- `onClose` (function): Callback cerrar

**Features:**
- Lista con avatares generados
- Muestra solo display_name y números
- Estados: loading, empty, populated
- Animaciones suaves

---

#### 4. `RafflePublicLanding.js`

**Propósito:** Landing público para rifas modo Empresa

**URL:** `/raffles/public/:code` (sin login)

**Features:**
- Marca de agua con logo branding
- Colores personalizables
- Estadísticas: disponibles, vendidos, reservados
- Tablero de números responsive
- Botón flotante participantes
- Footer "Powered by MundoXYZ"

---

### Integración en `RaffleRoom.js`

#### Botones en Header

```jsx
{/* Participantes */}
<button onClick={() => setShowParticipantsModal(true)}>
  <FaUsers /> Participantes
</button>

{/* Mis datos de pago (solo host premio/empresa) */}
{raffle.host_id === user?.id && (raffle.mode === 'prize' || raffle.mode === 'company') && (
  <button onClick={() => setShowPaymentDetailsModal(true)}>
    <FaDollarSign /> Mis datos de pago
  </button>
)}

{/* Enlace público (solo modo empresa) */}
{raffle.mode === 'company' && (
  <button onClick={handleCopyPublicLink}>
    <FaCopy /> Enlace público
  </button>
)}
```

---

## 🔄 FLUJO COMPLETO

### Flujo 1: Configuración de Pago (Host)

```
1. Host crea rifa modo Premio/Empresa
2. Click en "Mis datos de pago"
3. Abre PaymentDetailsModal
4. Llena formulario:
   - Costo: 10.00 USD
   - Método: Pago móvil
   - Banco: 0134 - Banesco
   - Teléfono: 0412-1234567
   - Cédula: V-12345678
   - Instrucciones: "Pagar antes de las 6pm"
5. Click "Guardar"
6. PUT /api/raffles/:id/payment-details
7. Toast: "Datos actualizados"
```

### Flujo 2: Compra de Número (Usuario)

```
1. Usuario entra a tablero de rifa
2. Click en número disponible
3. Abre BuyNumberModal
4. Ve datos de pago del host:
   - Costo: 10.00 USD
   - Método: Pago móvil
   - Banco: 0134 - Banesco
   - Teléfono: 0412-1234567
   - Cédula: V-12345678
5. Llena datos opcionales:
   - Nombre mostrar: "Juan Gamer"
   - Nombre completo: "Juan Pérez"
   - Teléfono: "0412-9999999"
   - Email: "juan@email.com"
   - Referencia: "1234"
6. Click "Enviar solicitud"
7. POST /api/raffles/:id/request-number
8. Toast: "Solicitud enviada"
```

### Flujo 3: Aprobación (Host)

```
1. Host click en "Ver solicitudes"
2. Ve lista de pendientes
3. Selecciona solicitud
4. Ve datos públicos del comprador
5. Verifica pago externamente
6. Click "Aprobar"
7. POST /api/raffles/:id/approve-request
8. Número asignado al usuario
9. Aparece en modal Participantes
```

### Flujo 4: Landing Público (Modo Empresa)

```
1. Host copia enlace público
   /raffles/public/ABC123
2. Comparte enlace (redes, WhatsApp, etc.)
3. Usuario abre enlace (sin login)
4. Ve:
   - Info de rifa con branding
   - Estadísticas
   - Tablero de números
   - Participantes
5. Usuario interesado registra y compra
```

### Flujo 5: Sorteo y Ganador

```
1. Rifa completa o host realiza sorteo
2. Sistema elige ganador aleatorio
3. Sistema envía mensaje al host con:
   - Datos completos del ganador
   - Nombre: Juan Pérez
   - Teléfono: 0412-9999999
   - Email: juan@email.com
   - Referencia: 1234
4. Host contacta al ganador
```

---

## 🔒 SEGURIDAD Y PERMISOS

### Niveles de Acceso

| Dato                    | Público | Usuario | Host | Admin/Tote |
|-------------------------|---------|---------|------|------------|
| display_name            | ✅      | ✅      | ✅   | ✅         |
| números comprados       | ✅      | ✅      | ✅   | ✅         |
| Datos de pago (host)    | ✅      | ✅      | ✅   | ✅         |
| full_name (comprador)   | ❌      | ❌      | Solo ganador | ✅ |
| phone (comprador)       | ❌      | ❌      | Solo ganador | ✅ |
| email (comprador)       | ❌      | ❌      | Solo ganador | ✅ |
| payment_reference       | ❌      | ❌      | Solo ganador | ✅ |

### Validaciones Backend

```javascript
// En getParticipantFullData()
const isAdmin = roles.includes('admin') || roles.includes('tote');
const isHost = raffle.host_id === requesterId;
const isWinner = request.user_id === raffle.winner_id;

if (!isAdmin && !(isHost && isWinner)) {
  throw new Error('Acceso denegado');
}
```

---

## 🧪 TESTING

### Checklist de Pruebas

#### Backend
- [ ] Crear rifa Premio con método efectivo
- [ ] Crear rifa Premio con método banco
- [ ] Validar constraint datos requeridos
- [ ] Editar datos de pago como host
- [ ] Intentar editar como no-host (debe fallar)
- [ ] Solicitar compra con datos completos
- [ ] Solicitar compra sin datos (solo display_name)
- [ ] Acceder a landing público sin login
- [ ] Verificar permisos Admin
- [ ] Verificar permisos Host (solo ganador)

#### Frontend
- [ ] Pestaña Pago visible solo en Prize/Company
- [ ] Validación campos requeridos según método
- [ ] Contador 300 caracteres funcional
- [ ] Modal "Mis datos de pago" solo para host
- [ ] Modal compra muestra datos correctos
- [ ] Modal participantes funcional
- [ ] Landing público con branding
- [ ] Botón copiar enlace funcional
- [ ] Responsive en mobile

---

## 📊 ESTADÍSTICAS

### Archivos Modificados/Creados

**Backend:**
- `backend/db/migrations/034_add_raffle_payment_columns.sql` (NUEVO - 132 líneas)
- `backend/services/RaffleService.js` (+293 líneas)
- `backend/routes/raffles.js` (+198 líneas)

**Frontend:**
- `frontend/src/utils/bankCodes.js` (NUEVO - 87 líneas)
- `frontend/src/components/raffles/PaymentDetailsModal.js` (NUEVO - 273 líneas)
- `frontend/src/components/raffles/PaymentDetailsModal.css` (NUEVO - 234 líneas)
- `frontend/src/components/raffles/BuyNumberModal.js` (NUEVO - 254 líneas)
- `frontend/src/components/raffles/BuyNumberModal.css` (NUEVO - 259 líneas)
- `frontend/src/components/raffles/ParticipantsModal.js` (NUEVO - 102 líneas)
- `frontend/src/components/raffles/ParticipantsModal.css` (NUEVO - 267 líneas)
- `frontend/src/pages/RafflePublicLanding.js` (NUEVO - 186 líneas)
- `frontend/src/pages/RafflePublicLanding.css` (NUEVO - 385 líneas)
- `frontend/src/App.js` (+3 líneas)
- `frontend/src/pages/RaffleRoom.js` (+98 líneas)

**Documentación:**
- `no es fundamental/DATABASE_SCHEMA_MASTER.sql` (+7 líneas comentarios)
- `RAFFLE_PAYMENT_SYSTEM.md` (ESTE ARCHIVO)

**Total:** 16 archivos, ~2,778 líneas de código nuevo

---

## 🎯 CASOS DE USO

### Caso 1: Rifa de Producto Físico

**Escenario:** Usuario vende PlayStation 5

1. Crea rifa modo Premio
2. Configura pago: $10 USD, efectivo
3. Instrucciones: "Pagar al retirar el premio"
4. Usuarios compran números
5. Sortea ganador
6. Contacta ganador para entrega

### Caso 2: Rifa Empresarial

**Escenario:** Empresa sortea iPhone

1. Crea rifa modo Empresa
2. Sube logo y colores marca
3. Configura pago: 50 VES, Banesco
4. Comparte enlace público en redes
5. Usuarios compran sin registrar
6. Landing público con branding
7. Sortea en vivo
8. Entrega premio al ganador

### Caso 3: Rifa Benéfica

**Escenario:** ONG recauda fondos

1. Crea rifa modo Premio
2. Pago: $5 USD, varios bancos
3. Instrucciones: "Captura de pantalla requerida"
4. Usuarios compran y envían capturas
5. Host aprueba manualmente
6. 100% vendido
7. Sortea ganador
8. Dona fondos recaudados

---

## 🔥 MÉTODO DE PAGO EN FUEGOS (Migración 035)

### Descripción

A partir de la **migración 035**, las rifas en modo Premio pueden aceptar **pagos en fuegos** además de efectivo y pago móvil. Los fuegos se transfieren directamente del comprador al anfitrión tras la aprobación manual.

### Base de Datos

**Nueva columna en `raffles`:**
```sql
ALTER TABLE raffles ADD COLUMN allow_fire_payments BOOLEAN DEFAULT FALSE;
```

**Nuevas columnas en `raffle_requests`:**
```sql
ALTER TABLE raffle_requests ADD COLUMN payment_method VARCHAR(20);
ALTER TABLE raffle_requests ADD COLUMN fire_amount DECIMAL(18,2) DEFAULT 0;
```

### Configuración Host

El anfitrión puede habilitar pago en fuegos desde **"Mis datos de pago"**:

```javascript
// Frontend: PaymentDetailsModal.js
{
  payment_cost_amount: 150,
  payment_cost_currency: 'USD',
  payment_method: 'cash',  // o 'bank'
  allow_fire_payments: true  // ✅ Habilita fuegos
}
```

**UI del checkbox:**
```jsx
<label>
  <input type="checkbox" name="allow_fire_payments" checked={formData.allow_fire_payments} />
  <Flame size={18} />
  Aceptar pago en fuegos (🔥)
  <small>Los fuegos se transferirán directamente a ti tras aprobar la compra</small>
</label>
```

### Compra con Fuegos

**Modal de compra (BuyNumberModal):**

El comprador ve los métodos habilitados y selecciona uno:

```jsx
{/* Opción efectivo/banco */}
<label>
  <input type="radio" value="cash" />
  Efectivo
</label>

{/* Opción fuego (solo si allow_fire_payments = true) */}
<label>
  <input type="radio" value="fire" />
  <Flame size={18} />
  Pago en fuegos (🔥 150)
  <small>Se descuentan al aprobar</small>
</label>
```

**Flujo de solicitud:**

1. Comprador selecciona método "fire"
2. Frontend valida que tenga balance suficiente
3. Se envía solicitud con `payment_method: 'fire'`
4. Backend valida:
   - Método habilitado (`allow_fire_payments = true`)
   - Balance actual del comprador
5. Reserva número y crea solicitud

**Backend validación (`processPrizePurchase`):**

```javascript
// Validar método habilitado
if (paymentMethod === 'fire' && !allow_fire_payments) {
  throw new Error('El pago con fuegos no está habilitado para esta rifa');
}

// Verificar balance
const buyerBalance = await query('SELECT fires_balance FROM wallets WHERE user_id = $1');
if (buyerBalance < cost) {
  throw new Error('Balance insuficiente');
}

// Crear solicitud
INSERT INTO raffle_requests (
  raffle_id, user_id, payment_method, fire_amount, status
) VALUES ($1, $2, 'fire', $3, 'pending');
```

### Aprobación y Transferencia

Cuando el host aprueba una solicitud con método "fire":

**Backend (`approvePurchase`):**

```javascript
// 1. Verificar balance actual del comprador
const buyerBalance = await query('SELECT fires_balance FROM wallets WHERE user_id = $1');
if (buyerBalance < fireAmount) {
  throw new Error('El comprador ya no tiene suficientes fuegos');
}

// 2. Descontar del comprador
UPDATE wallets SET fires_balance = fires_balance - $1 WHERE user_id = $2;

// 3. Acreditar al host
UPDATE wallets SET fires_balance = fires_balance + $1 WHERE user_id = $2;

// 4. Registrar transacciones (comprador y host)
INSERT INTO wallet_transactions (...);

// 5. Marcar número como vendido
UPDATE raffle_numbers SET state = 'sold', owner_id = $1;
```

**Transacciones registradas:**

| Usuario | Tipo | Monto | Descripción |
|---------|------|-------|-------------|
| Comprador | `raffle_fire_payment` | -150 🔥 | Pago rifa #123 - Número 42 |
| Host | `raffle_fire_received` | +150 🔥 | Recibido de venta Número 42 - Rifa #123 |

### Economía del Sistema

**Ejemplo: Rifa con 10 números a 150 🔥**

```
Configuración Host:
- Costo creación: 300 🔥 (a admin)
- Método: efectivo + fuegos habilitados

Ventas:
- 5 números en efectivo ($5 USD c/u)
- 5 números en fuegos (150 🔥 c/u)

Resultado Final:
- Host recibe:
  * $25 USD (efectivo)
  * 750 🔥 (de ventas con fuegos)
  * -300 🔥 (costo creación)
  * = $25 USD + 450 🔥 neto

- Plataforma (admin):
  * +300 🔥 (comisión creación)
```

### Ventajas

✅ **Flexibilidad:** Host acepta múltiples métodos  
✅ **Economía interna:** Circulación de fuegos entre usuarios  
✅ **Sin comisión extra:** Transferencia directa host ↔ comprador  
✅ **Aprobación manual:** Host controla cada venta  
✅ **Transparencia:** Comprador ve costo exacto antes de solicitar  
✅ **Historial completo:** Wallet transactions registran todo  

### Validaciones Críticas

1. **Método habilitado:** `allow_fire_payments = true`
2. **Balance al solicitar:** Comprador tiene fuegos suficientes
3. **Balance al aprobar:** Comprador aún tiene fuegos (no los gastó)
4. **Atomicidad:** Transacción completa o rollback
5. **Permisos:** Solo host puede aprobar
6. **Registro:** Wallet transactions de ambas partes

### API Endpoints Afectados

**PUT `/api/raffles/:id/payment-details`**
```json
{
  "payment_cost_amount": 150,
  "payment_cost_currency": "USD",
  "payment_method": "cash",
  "allow_fire_payments": true  // ← NUEVO
}
```

**GET `/api/raffles/:id/payment-details`**
```json
{
  "payment_cost_amount": 150,
  "payment_method": "cash",
  "allow_fire_payments": true,  // ← NUEVO
  "payment_instructions": "..."
}
```

**POST `/api/raffles/:id/request-number`**
```json
{
  "number_idx": 42,
  "buyer_profile": { ... },
  "payment_method": "fire"  // ← Nuevo valor posible
}
```

### Testing

**Caso 1: Solicitud con fuegos**
```bash
# Comprador con 200 🔥
POST /api/raffles/123/request-number
{
  "number_idx": 5,
  "payment_method": "fire"
}

# Resultado: Solicitud creada, número reservado
```

**Caso 2: Aprobación exitosa**
```bash
# Host aprueba
POST /api/raffles/approve-purchase
{ "request_id": "abc123" }

# Resultado:
# - Comprador: -150 🔥
# - Host: +150 🔥
# - Número vendido
```

**Caso 3: Balance insuficiente al aprobar**
```bash
# Comprador gastó sus fuegos mientras esperaba
# Host intenta aprobar

# Resultado: Error "El comprador ya no tiene suficientes fuegos"
```

---

## 🚀 PRÓXIMAS MEJORAS

### Fase 1 (Actual) ✅
- Sistema de pagos básico
- Modales funcionales
- Landing público
- Permisos básicos

### Fase 2 (Planificada)
- [ ] Notificaciones push al comprador (estado solicitud)
- [ ] Dashboard analytics para host
- [ ] Exportar lista compradores a Excel
- [ ] QR code para pago móvil automático
- [ ] Integración pagos automáticos (Stripe, PayPal)
- [ ] Multi-idioma (EN, PT)
- [ ] Plantillas de instrucciones pre-configuradas

### Fase 3 (Futuro)
- [ ] App móvil nativa
- [ ] Live streaming del sorteo
- [ ] Sistema de reseñas host/comprador
- [ ] Programa de afiliados
- [ ] API pública para integraciones

---

## 📞 SOPORTE

Para reportar bugs o solicitar features:
- GitHub Issues: [Crear issue](https://github.com/Wilwaps/mundoxyz/issues)
- Email: soporte@mundoxyz.com
- Discord: MundoXYZ Community

---

**Última actualización:** 2025-11-06  
**Versión:** 1.1 (Migración 035: Método de pago en fuegos + Fix reembolsos)  
**Autor:** Sistema MundoXYZ  
**Licencia:** Privada
