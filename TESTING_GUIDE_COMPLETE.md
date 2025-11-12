# 🧪 GUÍA COMPLETA DE TESTING - Sistema Rifas V2

**Fecha:** 11 Nov 2025  
**Estado:** ✅ LISTO PARA PRUEBAS  
**Usuario Plataforma:** ✅ Verificado (Fuegos: 210.20)  
**Migración 043:** ✅ Ejecutada  
**Deploy Railway:** ✅ Activo  

---

## 📋 CHECKLIST PRE-TESTING

- [x] Migración 043 ejecutada exitosamente
- [x] Usuario plataforma existe (tg_id: 1417856820)
- [x] Wallet plataforma creado
- [x] Backend deployado en Railway
- [x] Frontend buildeado
- [x] Bugs críticos corregidos (3/3)

---

## 🎯 TESTING POR MODO DE RIFA

### 1️⃣ MODO FIRES (Automático con Fuegos)

#### TEST 1.1: Crear Rifa FIRES
```bash
URL: https://mundoxyz-production.up.railway.app
Endpoint: POST /api/raffles/v2/

Payload:
{
  "name": "TEST Rifa Fuegos",
  "description": "Rifa de prueba modo FIRES",
  "mode": "fires",
  "visibility": "public",
  "numbersRange": 10,
  "entryPrice": 20,
  "startsAt": null,
  "endsAt": null
}

✅ Esperado:
- Rifa creada exitosamente
- Host cobra 20 fuegos (comisión inicial)
- Plataforma recibe 20 fuegos
- Código único generado (ej: AB123)
- Estado: 'active'

❌ Errores posibles:
- "Balance insuficiente": Usuario no tiene 20 fuegos
- "Column telegram_id does not exist": Bug ya corregido
```

#### TEST 1.2: Comprar Número FIRES
```bash
Endpoint: POST /api/raffles/v2/:code/numbers/0/reserve
Endpoint: POST /api/raffles/v2/:code/numbers/0/purchase

✅ Esperado:
- Número reservado por 5 minutos
- Al comprar: descuenta 20 fuegos del comprador
- Pot aumenta a 20 fuegos
- Número cambia a 'sold'
- Estado: 'purchased'

Repetir para números 0-9 (10 números)
```

#### TEST 1.3: Finalización Automática FIRES
```bash
Al comprar el número 9 (último):

✅ Esperado (INSTANTÁNEO):
1. Socket emit 'raffle:drawing_scheduled'
2. Mensaje: "¡Todos los números vendidos! Sorteo en 10 segundos..."
3. ESPERAR 10 SEGUNDOS
4. Socket emit 'raffle:winner_drawn'
5. Ganador elegido aleatoriamente (0-9)
6. Distribución:
   - Ganador: 70% del pot (140 fuegos)
   - Host: 20% del pot (40 fuegos)
   - Plataforma: 10% del pot (20 fuegos)
7. Estado: 'finished'
8. Transacciones registradas en wallet_transactions

⏱️ CRÍTICO: Debe finalizar exactamente 10 seg después del último número
```

#### TEST 1.4: Verificar Distribución
```bash
Query verificación:
SELECT 
  u.username,
  w.fires_balance,
  wt.amount,
  wt.description
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
JOIN users u ON u.id = w.user_id
WHERE wt.description LIKE '%TEST Rifa Fuegos%'
ORDER BY wt.created_at DESC;

✅ Esperado:
- 3 transacciones 'credit':
  * Ganador: +140 fuegos
  * Host: +40 fuegos
  * Plataforma: +20 fuegos
- Total distribuido = 200 fuegos (pot completo)
```

---

### 2️⃣ MODO PRIZE (Con Aprobación Manual)

#### TEST 2.1: Crear Rifa PRIZE (Sin Toggle Fuegos)
```bash
Payload:
{
  "name": "TEST Rifa Premio",
  "mode": "prize",
  "visibility": "public",
  "numbersRange": 5,
  "allowFiresPayment": false,
  "prizeImageBase64": "data:image/png;base64,iVBORw0KG...",
  "prizeMeta": {
    "prizeDescription": "iPhone 15 Pro Max",
    "prizeValue": 1200,
    "bankingInfo": {
      "accountHolder": "Juan Pérez",
      "bankCode": "0102",
      "bankName": "Banco de Venezuela",
      "accountNumber": "0102-0000-00-0000000000",
      "accountType": "ahorro",
      "idNumber": "V-12345678",
      "phone": "0414-1234567"
    }
  }
}

✅ Esperado:
- Rifa creada exitosamente
- Host cobra 500 fuegos (comisión fija modo PRIZE)
- Plataforma recibe 500 fuegos
- prize_image_base64 guardado en DB
- Datos bancarios guardados
- Estado: 'active'
```

#### TEST 2.2: Solicitar Compra (Modo PRIZE)
```bash
Endpoint: POST /api/raffles/v2/:code/numbers/0/reserve
Endpoint: POST /api/raffles/v2/:code/numbers/0/purchase
Body:
{
  "buyerData": {
    "displayName": "Carlos Gómez",
    "phone": "0424-9876543",
    "email": "carlos@example.com"
  },
  "paymentData": {
    "reference": "123456789",
    "bankCode": "0134",
    "paymentProofBase64": "data:image/png;base64,..."
  }
}

✅ Esperado:
- Solicitud creada con estado 'pending'
- Número NO marcado como 'sold' (aún)
- Comprobante base64 guardado
- Socket emit 'raffle:purchase_requested' al host
- Datos guardados en raffle_requests
```

#### TEST 2.3: Host Aprueba Solicitud
```bash
Endpoint: POST /api/raffles/v2/:code/requests/:id/approve
Headers: Authorization: Bearer <token_host>

✅ Esperado:
- Solicitud actualiza a 'approved'
- Número marca como 'sold'
- owner_id = comprador
- Socket emit 'raffle:request_approved' al comprador
- Trigger checkAndFinishRaffle()
```

#### TEST 2.4: Host Rechaza Solicitud
```bash
Endpoint: POST /api/raffles/v2/:code/requests/:id/reject
Headers: Authorization: Bearer <token_host>
Body: { "reason": "Pago no verificado" }

✅ Esperado:
- Solicitud actualiza a 'rejected'
- Razón guardada
- Número libera a 'available'
- owner_id = NULL
- Socket emit 'raffle:request_rejected' al comprador
- Comprador puede volver a intentar
```

#### TEST 2.5: Finalización Manual PRIZE
```bash
Si host aprueba todas las solicitudes (números 0-4):

✅ Esperado (10 seg después del último aprobado):
1. Socket emit 'raffle:drawing_scheduled'
2. ESPERAR 10 SEGUNDOS
3. Socket emit 'raffle:winner_drawn'
4. Ganador elegido entre aprobados
5. Estado: 'finished'
6. NO hay distribución de fuegos (es premio físico)
```

---

### 3️⃣ MODO PRIZE con TOGGLE (Pago con Fuegos)

#### TEST 3.1: Crear Rifa PRIZE con Toggle
```bash
Payload:
{
  "name": "TEST Rifa Premio + Fuegos",
  "mode": "prize",
  "visibility": "public",
  "numbersRange": 5,
  "allowFiresPayment": true,  ← ACTIVADO
  "entryPrice": 30,
  "prizeMeta": { ... }
}

✅ Esperado:
- Rifa creada con allow_fires_payment = true
- Host cobra 500 fuegos (comisión)
- Precio entrada = 30 fuegos
```

#### TEST 3.2: Comprar con Fuegos (AUTOMÁTICO)
```bash
Endpoint: POST /api/raffles/v2/:code/numbers/0/purchase

✅ Esperado:
- Descuenta 30 fuegos del comprador (INMEDIATO)
- Número marca 'sold' (sin aprobación)
- NO crea solicitud en raffle_requests
- Pot aumenta a 30 fuegos
- Funciona como modo FIRES (automático)
```

#### TEST 3.3: Finalización con Toggle
```bash
Al vender todos los números:

✅ Esperado:
- Finalización automática 10 seg
- Ganador elegido
- Distribución 70/20/10 del pot_fires
- Premio físico + dinero del pot
```

---

### 4️⃣ MODO EMPRESA (Company)

#### TEST 4.1: Crear Rifa Empresa
```bash
Payload:
{
  "name": "TEST Rifa Empresa",
  "mode": "prize",
  "visibility": "company",
  "numbersRange": 10,
  "companyConfig": {
    "companyName": "TechStore Venezuela",
    "rifNumber": "J-123456789",
    "primaryColor": "#FF5722",
    "secondaryColor": "#FFC107",
    "logoBase64": "data:image/png;base64,..  .",
    "contactEmail": "info@techstore.com",
    "contactPhone": "0212-1234567",
    "websiteUrl": "https://techstore.com"
  },
  "prizeMeta": { ... }
}

✅ Esperado:
- Rifa creada con visibility = 'company'
- Host cobra 500 fuegos (comisión empresa)
- logo_base64 guardado en raffle_companies
- Landing pública generada: /raffle/public/:code
```

#### TEST 4.2: Vista Landing Pública
```bash
URL: https://mundoxyz-production.up.railway.app/raffle/public/:code

✅ Esperado:
- Logo empresa visible
- Colores personalizados aplicados
- Información contacto mostrada
- Botón "Comprar Número"
- Grid números disponibles
- NO requiere login para ver
```

---

## 🔍 TESTING PARTICIPANTES

### TEST 5.1: Ver Participantes (FIRES/COINS)
```bash
Endpoint: GET /api/raffles/v2/:code/participants

✅ Esperado (Usuario normal):
- Lista pública de todos los participantes
- displayName visible
- telegramUsername visible (si existe)
- Números comprados visibles
- Total participantes

✅ Esperado (Host):
- Misma vista que usuario normal
- No hay solicitudes (modo FIRES es automático)
```

### TEST 5.2: Ver Solicitudes (PRIZE Host)
```bash
Endpoint: GET /api/raffles/v2/:code/participants
Headers: Authorization: Bearer <token_host>

✅ Esperado:
- Array 'requests' con solicitudes
- Cada solicitud incluye:
  * requestId
  * buyerProfile (nombre, teléfono, email)
  * numbers solicitados
  * requestData (referencia, banco, comprobante base64)
  * status (pending/approved/rejected)
  * createdAt
```

### TEST 5.3: Ver Participantes (PRIZE Usuario)
```bash
Endpoint: GET /api/raffles/v2/:code/participants
(Sin token o con token de usuario no-host)

✅ Esperado:
- Array 'participants' con solo aprobados
- Solo displayName visible
- NO se muestran datos sensibles
- NO se muestran solicitudes pendientes
```

---

## 🖼️ TESTING IMÁGENES BASE64

### TEST 6.1: Upload Imagen Premio
```bash
Frontend: CreateRaffleModal
1. Click "Seleccionar imagen del premio"
2. Elegir archivo (JPG/PNG/GIF, máx 5MB)

✅ Esperado:
- Validación tamaño (máx 5MB)
- Validación tipo (image/*)
- Conversión a base64
- Toast "Imagen cargada exitosamente"
- Label cambia a "✅ Imagen cargada"
- Base64 incluido en payload
- DB guarda en prize_image_base64
```

### TEST 6.2: Upload Logo Empresa
```bash
Frontend: CreateRaffleModal (Modo Empresa)
1. Activar toggle "Modo Empresa"
2. Expandir "Información de la Empresa"
3. Upload logo

✅ Esperado:
- Similar a imagen premio
- Guardado en raffle_companies.logo_base64
- Visible en landing pública
```

### TEST 6.3: Upload Comprobante Pago
```bash
Frontend: PurchaseModal (Modo PRIZE)
1. Solicitar número
2. Upload comprobante de pago

✅ Esperado:
- Validación y conversión base64
- Guardado en raffle_requests.payment_proof_base64
- Host puede ver imagen en ParticipantsModal
- Click "Ver Detalles" muestra imagen
```

---

## 🔔 TESTING NOTIFICACIONES SOCKET

### TEST 7.1: Socket Drawing Scheduled
```javascript
// Frontend debe escuchar:
socket.on('raffle:drawing_scheduled', (data) => {
  console.log(data);
  // { code, drawInSeconds: 10, message: "..." }
  // Mostrar countdown timer
});

✅ Esperado:
- Emitido al vender último número
- Todos los usuarios en la sala reciben
- drawInSeconds = 10
```

### TEST 7.2: Socket Winner Drawn
```javascript
socket.on('raffle:winner_drawn', (data) => {
  console.log(data);
  // { code, winnerNumber, winnerUsername, prize }
});

✅ Esperado:
- Emitido 10 seg después
- Número ganador visible
- Username ganador visible (si no anónimo)
```

### TEST 7.3: Socket Request Approved/Rejected
```javascript
socket.on('raffle:request_approved', (data) => {
  // Notifica al comprador
});

socket.on('raffle:request_rejected', (data) => {
  // Notifica al comprador con razón
});

✅ Esperado:
- Solo recibe el comprador afectado
- Datos completos en payload
```

---

## 📊 TESTING BASE DE DATOS

### Query 1: Verificar Comisiones Plataforma
```sql
SELECT 
  SUM(wt.amount) as total_comisiones,
  COUNT(*) as num_transacciones
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
JOIN users u ON u.id = w.user_id
WHERE u.tg_id = '1417856820'
  AND wt.type = 'credit'
  AND wt.description LIKE '%comisión%';
```

### Query 2: Verificar Split 70/20/10
```sql
SELECT 
  r.code,
  r.pot_fires,
  (
    SELECT SUM(wt.amount) 
    FROM wallet_transactions wt 
    WHERE wt.description LIKE '%' || r.code || '%'
      AND wt.type = 'credit'
  ) as total_distribuido
FROM raffles r
WHERE r.status = 'finished'
  AND r.raffle_mode = 'fires'
ORDER BY r.created_at DESC
LIMIT 5;

-- total_distribuido debe = pot_fires
```

### Query 3: Verificar Imágenes Base64
```sql
SELECT 
  code,
  LENGTH(prize_image_base64) as img_size_bytes,
  CASE 
    WHEN prize_image_base64 LIKE 'data:image/%' THEN 'Valid'
    ELSE 'Invalid'
  END as format_check
FROM raffles
WHERE prize_image_base64 IS NOT NULL;
```

---

## 🚨 CASOS DE ERROR A PROBAR

### ERROR 1: Balance Insuficiente
```bash
Crear rifa con usuario que tiene < 20 fuegos (FIRES)

✅ Esperado:
- Status 400
- Error: "Balance insuficiente"
- NO se crea la rifa
- NO se cobra nada
```

### ERROR 2: Número Ya Vendido
```bash
Intentar comprar número ya vendido

✅ Esperado:
- Status 409
- Error: "Número no disponible"
- NO se cobra
```

### ERROR 3: Reserva Expirada
```bash
Reservar número, esperar >5 min, intentar comprar

✅ Esperado:
- Status 400
- Error: "Reserva expirada"
- Número se libera automáticamente
```

### ERROR 4: Usuario No es Host
```bash
Usuario normal intenta aprobar solicitud

✅ Esperado:
- Status 403
- Error: "No autorizado"
```

### ERROR 5: Imagen Muy Grande
```bash
Intentar upload imagen >5MB

✅ Esperado:
- Frontend bloquea antes de enviar
- Toast error: "Imagen muy grande (máx 5MB)"
- NO se sube
```

---

## 📝 CHECKLIST TESTING COMPLETO

### Backend
- [ ] Crear rifa FIRES (comisión 20 fuegos)
- [ ] Crear rifa PRIZE sin toggle (comisión 500 fuegos)
- [ ] Crear rifa PRIZE con toggle (comisión 500 fuegos)
- [ ] Crear rifa EMPRESA (comisión 500 fuegos)
- [ ] Comprar números modo FIRES (automático)
- [ ] Solicitar números modo PRIZE (manual)
- [ ] Aprobar solicitud (host)
- [ ] Rechazar solicitud (host con razón)
- [ ] Finalización automática 10 seg FIRES
- [ ] Finalización automática 10 seg PRIZE
- [ ] Distribución 70/20/10 correcta
- [ ] Comisiones plataforma correctas
- [ ] Usuario plataforma recibe fuegos

### Frontend
- [ ] CreateRaffleModal 3 pasos funciona
- [ ] Toggle "Modo Empresa" funciona
- [ ] Upload imagen premio funciona
- [ ] Toggle "Permitir pago fuegos" funciona
- [ ] ParticipantsModal vista FIRES muestra todos
- [ ] ParticipantsModal vista PRIZE host muestra solicitudes
- [ ] ParticipantsModal vista PRIZE user muestra aprobados
- [ ] Botón "Aprobar" funciona
- [ ] Botón "Rechazar" abre modal razón
- [ ] Modal "Ver Detalles" muestra comprobante
- [ ] Countdown 10 segundos visible
- [ ] Ganador se muestra correctamente

### Database
- [ ] Migración 043 columnas creadas
- [ ] Índices creados correctamente
- [ ] Usuario plataforma existe
- [ ] Wallet plataforma existe
- [ ] Transacciones registradas correctamente
- [ ] Imágenes base64 guardadas
- [ ] Solicitudes guardadas con datos completos

### Socket.io
- [ ] Event 'raffle:drawing_scheduled' emitido
- [ ] Event 'raffle:winner_drawn' emitido
- [ ] Event 'raffle:request_approved' recibido
- [ ] Event 'raffle:request_rejected' recibido
- [ ] Countdown timer funciona

---

## 🔧 TROUBLESHOOTING

### Problema: "Column telegram_id does not exist"
**Solución:** ✅ Ya corregido en commit `9d8bf00`

### Problema: "Column r.company_id does not exist"
**Solución:** ✅ Ya corregido en commit `f1d27b6`

### Problema: Finalización no ocurre tras 10 seg
**Verificar:**
1. Logs backend: `[RaffleServiceV2] ✅ Todos los números vendidos`
2. setTimeout se ejecuta: `[RaffleServiceV2] Error en finalización retrasada`
3. finishRaffle() completa sin errores

### Problema: Comisiones no se acreditan
**Verificar:**
1. Usuario plataforma existe: `node scripts/verify-platform-user.js`
2. Query busca por tg_id (NO telegram_id)
3. Transacción completa sin rollback

### Problema: Imagen no se muestra
**Verificar:**
1. Base64 tiene prefijo: `data:image/png;base64,`
2. Columna TEXT en DB (no VARCHAR limitado)
3. Frontend usa `<img src={base64String} />`

---

## 📞 CONTACTO SOPORTE

**Bugs detectados:** Reportar con:
- Modo de rifa (FIRES/PRIZE/EMPRESA)
- Paso exacto donde ocurrió
- Logs backend (si disponible)
- Screenshot (si es UI)

**Logs importantes:**
```bash
# Backend logs en Railway
railway logs

# Buscar errores
railway logs | grep ERROR

# Buscar rifas
railway logs | grep RaffleServiceV2
```

---

## ✅ CRITERIOS DE ÉXITO

### Rifa considerada EXITOSA si:
1. ✅ Se crea sin errores
2. ✅ Comisión se cobra correctamente
3. ✅ Números se venden/aprueban
4. ✅ Finaliza automáticamente en 10 seg
5. ✅ Ganador se elige correctamente
6. ✅ Distribución split correcta
7. ✅ Comisiones plataforma correctas
8. ✅ Notificaciones socket funcionan
9. ✅ UI muestra todo correctamente
10. ✅ Base datos consistente

---

**Versión:** 2.0  
**Última actualización:** 11 Nov 2025  
**Estado:** ✅ LISTO PARA TESTING  

🎉 **¡BUENA SUERTE CON LAS PRUEBAS!** 🚀
