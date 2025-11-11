# 🚀 DEPLOY COMPLETADO - GUÍA DE TESTING

**Fecha:** 11 Nov 2025 18:45 UTC-4
**Commit:** af3c2b7
**Estado:** Railway deploying (6 minutos estimados)

---

## ✅ LO QUE SE DESPLEGÓ

### Backend (889 líneas nuevas, 9 archivos)

1. **Migración 043** - Nuevos campos DB
   - `allow_fires_payment BOOLEAN`
   - `prize_image_base64 TEXT`
   - `logo_base64 TEXT`
   - `payment_proof_base64 TEXT`

2. **Sistema de Comisiones**
   - Modo FIRES: Cobra precio_por_número
   - Modo PRIZE: Cobra 500 fuegos
   - Modo EMPRESA: Cobra 500 fuegos

3. **Sistema Aprobación/Rechazo**
   - `POST /api/raffles/v2/:code/requests/:id/approve`
   - `POST /api/raffles/v2/:code/requests/:id/reject`

4. **Sistema Participantes**
   - `GET /api/raffles/v2/:code/participants`
   - Vistas diferenciadas por rol

### Frontend

1. **Tipos TypeScript** - Actualizados
2. **Hooks** - 3 nuevos hooks
3. **Helpers** - imageHelpers.ts
4. **Componentes** - ParticipantsModal básico

---

## ⏰ PASOS POST-DEPLOY (En 6 minutos)

### 1. EJECUTAR MIGRACIÓN 043 ⚠️ CRÍTICO

Una vez que Railway termine el deploy, ejecutar en la DB:

```bash
# Conectarse a Railway DB
railway login
railway link
railway run psql $DATABASE_URL

# Ejecutar migración
\i backend/db/migrations/043_raffles_complete_features.sql

# Verificar campos nuevos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'raffles' 
  AND column_name IN ('allow_fires_payment', 'prize_image_base64');

-- Debe mostrar:
-- allow_fires_payment | boolean | YES
-- prize_image_base64  | text    | YES

# Verificar índices
\d raffles
\d raffle_companies
\d raffle_requests
```

### 2. TESTING BACKEND (Postman/Insomnia)

#### Test 1: Comisión Modo FIRES

```bash
# Preparación: Usuario con 100 fuegos
GET https://mundoxyz-production.up.railway.app/api/wallet
Authorization: Bearer <token>

# Crear rifa FIRES de 20 fuegos/número
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Test Comisión FIRES",
  "mode": "fires",
  "visibility": "public",
  "numbersRange": 10,
  "entryPrice": 20
}

# Verificar balance después
GET https://mundoxyz-production.up.railway.app/api/wallet
# Balance debe ser: 80 fuegos (100 - 20)

# Verificar transacciones
SELECT * FROM wallet_transactions 
WHERE description LIKE '%Comisión apertura rifa%'
ORDER BY created_at DESC LIMIT 1;

# Verificar plataforma recibió
SELECT fires_balance FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE u.telegram_id = '1417856820';
```

#### Test 2: Cobro 500 Fuegos Modo PRIZE

```bash
# Preparación: Usuario con 600 fuegos
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Test Premio 500",
  "mode": "prize",
  "visibility": "public",
  "numbersRange": 50,
  "allowFiresPayment": true,
  "prizeMeta": {
    "prizeDescription": "iPhone 15",
    "bankingInfo": {
      "accountHolder": "Juan Perez",
      "bankCode": "0102",
      "bankName": "Banco de Venezuela",
      "accountNumber": "01020123456789",
      "accountType": "ahorro",
      "idNumber": "V-12345678",
      "phone": "04121234567"
    }
  }
}

# Verificar balance después
# Balance debe ser: 100 fuegos (600 - 500)

# Verificar en DB
SELECT * FROM wallet_transactions 
WHERE description LIKE '%Costo creación rifa modo PREMIO%'
ORDER BY created_at DESC LIMIT 1;
```

#### Test 3: Balance Insuficiente

```bash
# Usuario con 10 fuegos intenta crear PRIZE
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
# Debe retornar:
# Status: 400
# Message: "Necesitas 500 fuegos para crear esta rifa. Balance actual: 10"
```

#### Test 4: Sistema de Aprobación

```bash
# 1. Usuario compra número en rifa PRIZE
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/ABC123/numbers/5/purchase
Authorization: Bearer <token_usuario>
{
  "paymentMethod": "bank",
  "buyerProfile": {
    "displayName": "Juan Pérez",
    "fullName": "Juan Pérez González",
    "phone": "+58 412 123 4567",
    "email": "juan@example.com",
    "idNumber": "V-12345678"
  },
  "requestData": {
    "reference": "123456789",
    "bankCode": "0102"
  }
}

# 2. Host ve solicitudes
GET https://mundoxyz-production.up.railway.app/api/raffles/v2/ABC123/participants
Authorization: Bearer <token_host>

# Debe retornar:
{
  "requests": [
    {
      "requestId": 1,
      "buyerProfile": { ... },
      "status": "pending",
      "numbers": [5]
    }
  ]
}

# 3. Host aprueba
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/ABC123/requests/1/approve
Authorization: Bearer <token_host>

# Debe retornar:
{
  "success": true,
  "message": "Solicitud aprobada exitosamente",
  "numberIdx": 5
}

# 4. Verificar número vendido
SELECT state, owner_id FROM raffle_numbers
WHERE raffle_id = (SELECT id FROM raffles WHERE code = 'ABC123')
  AND number_idx = 5;
-- state debe ser 'sold'

# 5. Host rechaza otra solicitud
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/ABC123/requests/2/reject
Authorization: Bearer <token_host>
{
  "reason": "Datos de pago incorrectos"
}

# Verificar número vuelve a disponible
SELECT state FROM raffle_numbers
WHERE raffle_id = (SELECT id FROM raffles WHERE code = 'ABC123')
  AND number_idx = 3;
-- state debe ser 'available'
```

#### Test 5: Participantes Público

```bash
# Usuario normal ve participantes
GET https://mundoxyz-production.up.railway.app/api/raffles/v2/ABC123/participants
Authorization: Bearer <token_usuario>

# Modo FIRES: debe retornar
{
  "participants": [
    {
      "displayName": "Usuario1",
      "telegramUsername": "@user1",
      "numbers": [1, 2, 5]
    }
  ],
  "totalParticipants": 5
}

# Modo PRIZE: debe retornar solo aprobados
{
  "participants": [
    {
      "displayName": "Juan Pérez",
      "numbers": [5]
    }
  ],
  "totalParticipants": 1
}
```

---

## 🔍 VERIFICACIONES SQL

```sql
-- 1. Verificar comisiones cobradas
SELECT 
  u.telegram_username,
  wt.description,
  wt.amount,
  wt.created_at
FROM wallet_transactions wt
JOIN wallets w ON wt.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE wt.type IN ('raffle_creation_fee', 'raffle_platform_fee')
ORDER BY wt.created_at DESC
LIMIT 10;

-- 2. Verificar balance plataforma
SELECT 
  u.telegram_id,
  u.telegram_username,
  w.fires_balance,
  w.coins_balance
FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE u.telegram_id = '1417856820';

-- 3. Verificar rifas con nuevos campos
SELECT 
  code,
  name,
  mode,
  visibility,
  allow_fires_payment,
  CASE 
    WHEN prize_image_base64 IS NOT NULL THEN 'Tiene imagen'
    ELSE 'Sin imagen'
  END as imagen_estado
FROM raffles
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verificar solicitudes de pago
SELECT 
  r.code as raffle_code,
  rr.status,
  rr.buyer_profile->>'displayName' as buyer,
  rr.request_data->>'reference' as referencia,
  rr.created_at
FROM raffle_requests rr
JOIN raffles r ON rr.raffle_id = r.id
ORDER BY rr.created_at DESC
LIMIT 10;
```

---

## 📊 MÉTRICAS A VERIFICAR

### Antes del Deploy
- [ ] Balance usuario test: 1000 fuegos
- [ ] Balance plataforma: X fuegos

### Después de Tests
- [ ] Balance usuario test: 1000 - 20 - 500 = 480 fuegos
- [ ] Balance plataforma: X + 20 + 500 fuegos
- [ ] 2 rifas creadas (FIRES + PRIZE)
- [ ] 1 solicitud aprobada
- [ ] 1 solicitud rechazada
- [ ] Transacciones registradas correctamente

---

## ⚠️ PROBLEMAS POTENCIALES Y SOLUCIONES

### Error: "Wallet del host no encontrado"
**Causa:** Usuario no tiene wallet  
**Solución:** Crear wallet:
```sql
INSERT INTO wallets (user_id, fires_balance, coins_balance)
VALUES ((SELECT id FROM users WHERE telegram_id = '123'), 1000, 1000);
```

### Error: "Usuario de plataforma no encontrado"
**Causa:** No existe user con telegram_id = '1417856820'  
**Solución:** Crear usuario plataforma:
```sql
INSERT INTO users (telegram_id, telegram_username, display_name)
VALUES ('1417856820', 'mundoxyz_platform', 'Plataforma MundoXYZ');

INSERT INTO wallets (user_id, fires_balance, coins_balance)
VALUES ((SELECT id FROM users WHERE telegram_id = '1417856820'), 0, 0);
```

### Error: Column "allow_fires_payment" does not exist
**Causa:** Migración 043 no ejecutada  
**Solución:** Ejecutar migración (ver paso 1)

---

## 🎯 CHECKLIST FINAL

### Post-Deploy Inmediato
- [ ] Railway deploy completado (check logs)
- [ ] Migración 043 ejecutada
- [ ] Campos nuevos verificados en DB
- [ ] Usuario plataforma existe

### Testing Backend
- [ ] Test comisión FIRES
- [ ] Test cobro 500 fuegos
- [ ] Test balance insuficiente
- [ ] Test aprobación solicitud
- [ ] Test rechazo solicitud
- [ ] Test participantes host
- [ ] Test participantes usuario

### Testing Frontend (Cuando se complete)
- [ ] CreateRaffleModal: toggle pago fuegos
- [ ] CreateRaffleModal: upload imágenes
- [ ] PurchaseModal: formulario datos
- [ ] ParticipantsModal: lista y acciones

---

## 📝 LOGS A REVISAR

```bash
# Railway logs
railway logs

# Buscar errores en creación de rifas
railway logs | grep "RaffleServiceV2"

# Buscar transacciones wallet
railway logs | grep "wallet_transactions"

# Buscar aprobaciones
railway logs | grep "Solicitud aprobada"
```

---

## ✅ PRÓXIMOS PASOS (Una vez validado backend)

1. **Completar ParticipantsModal.tsx** (1 hora)
   - Conectar con useParticipants
   - Lista según modo
   - Botones aprobar/rechazar
   - Modal detalles

2. **Actualizar CreateRaffleModal.tsx** (1 hora)
   - Toggle allow_fires_payment
   - Upload imagen premio
   - Upload logo empresa
   - Eliminar paso 3

3. **Actualizar PurchaseModal.tsx** (30 min)
   - Formulario datos comprador
   - Botón "Pegar" referencia
   - Upload comprobante

4. **Testing E2E Completo** (30 min)
   - Flujo FIRES completo
   - Flujo PRIZE con aprobación
   - Flujo EMPRESA con landing

---

**Estado:** ⏳ Esperando Railway deploy (~6 min desde 18:45)  
**Siguiente:** Ejecutar migración 043 + Testing backend  
**Tiempo estimado testing:** 30-45 minutos
