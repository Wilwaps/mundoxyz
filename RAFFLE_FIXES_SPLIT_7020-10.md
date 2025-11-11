# IMPLEMENTACIÓN: Fix Sorteo + Split 70/20/10 + Costos

**Fecha:** 11 Nov 2025 18:00 UTC-4
**Commit:** [pending]
**Severidad:** CRÍTICO - Sistema de distribución de premios

---

## 🔴 PROBLEMAS CORREGIDOS

### 1. Error "pool is not defined" en sorteo
**Síntoma:** Al completar todos los números, el sorteo fallaba después de 10 segundos
**Causa:** `finishRaffle` usaba `pool.connect()` sin tener `pool` en scope
**Solución:** Cambiar a `getClient()` del módulo db

### 2. Falta de split en modo FIRES
**Síntoma:** El 100% del pot iba al ganador
**Requerido:** 70% ganador / 20% host / 10% plataforma
**Solución:** Implementar distribución con transacciones separadas

### 3. Costo de creación desactualizado
**Síntoma:** Cobro de 300 fuegos para modo Premio
**Requerido:** 500 fuegos
**Solución:** Actualizar constante PRIZE_MODE_CREATION_COST

---

## ✅ CAMBIOS IMPLEMENTADOS

### Archivo: `backend/modules/raffles/services/RaffleServiceV2.js`

#### 1. Importación de ID de plataforma
```javascript
// ID de la plataforma (Telegram)
const PLATFORM_TELEGRAM_ID = '1417856820';
```

#### 2. Fix del client en finishRaffle
```javascript
// ANTES ❌
const client = await pool.connect();

// DESPUÉS ✅
const client = await getClient();
```

#### 3. Distribución 70/20/10 en modo FIRES
```javascript
if (raffle.raffle_mode === RaffleMode.FIRES) {
  // Modo FIRES: Split 70% ganador, 20% host, 10% plataforma
  const totalPot = raffle.pot_fires || 0;
  winnerPrize = Math.floor(totalPot * 0.7);
  hostReward = Math.floor(totalPot * 0.2);
  platformCommission = totalPot - winnerPrize - hostReward; // El resto para evitar pérdidas por redondeo
}
```

#### 4. Transacciones separadas
```javascript
// 1. PREMIO AL GANADOR (70%)
await client.query(
  `INSERT INTO wallet_transactions
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   VALUES ($1, 'raffle_prize', $2, $3, $4, $5, $6, $7)`,
  [/* ... */]
);

// 2. RECOMPENSA AL HOST (20%)
await client.query(
  `INSERT INTO wallet_transactions
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   VALUES ($1, 'raffle_host_reward', $2, $3, $4, $5, $6, $7)`,
  [/* ... */]
);

// 3. COMISIÓN A LA PLATAFORMA (10%)
await client.query(
  `INSERT INTO wallet_transactions
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   VALUES ($1, 'raffle_platform_commission', $2, $3, $4, $5, $6, $7)`,
  [/* ... */]
);
```

### Archivo: `backend/modules/raffles/types/index.js`

#### Nuevas constantes de sistema
```javascript
// Costos de creación y comisiones
PRIZE_MODE_CREATION_COST: 500, // Fuegos para crear rifa modo Premio
COMPANY_MODE_CREATION_COST: 500, // Fuegos para crear rifa modo Empresa
FIRES_MODE_PLATFORM_FEE_MULTIPLIER: 1, // Comisión = precio por número × 1

// Distribución del pot en modo FIRES
FIRES_WINNER_PERCENTAGE: 0.70, // 70% para el ganador
FIRES_HOST_PERCENTAGE: 0.20, // 20% para el host
FIRES_PLATFORM_PERCENTAGE: 0.10 // 10% para la plataforma
```

---

## 🔄 FLUJOS ACTUALIZADOS

### Crear Rifa Modo FIRES
```
1. Host define precio por número (ej: 20 fuegos)
2. Sistema cobra comisión inicial: 20 fuegos → plataforma
3. Rifa creada con 100 números
4. Cada compra va al pot
5. Al finalizar:
   - 70% del pot → Ganador
   - 20% del pot → Host
   - 10% del pot → Plataforma
```

### Crear Rifa Modo PREMIO
```
1. Host define premio físico/externo
2. Sistema cobra 500 fuegos al host → plataforma
3. Rifa creada
4. Participantes pagan por transferencia o fuegos (si está habilitado)
5. Host aprueba/rechaza pagos
6. Al finalizar: ganador recibe el premio físico
```

### Crear Rifa Modo EMPRESA
```
1. Empresa define premio
2. Sistema cobra 500 fuegos → plataforma
3. Rifa con landing personalizada
4. Mismo flujo que modo PREMIO
```

---

## 🧪 TESTING REQUERIDO

### Test 1: Sorteo automático
```bash
# Crear rifa de 10 números
# Comprar todos los números
# Esperar 10 segundos
# Verificar:
✅ NO error "pool is not defined"
✅ Sorteo se ejecuta
✅ Ganador seleccionado
```

### Test 2: Distribución 70/20/10 (Modo FIRES)
```bash
# Crear rifa modo FIRES
# Precio: 100 fuegos por número
# Vender 10 números = 1000 fuegos pot
# Al finalizar verificar en DB:
✅ Ganador recibe: 700 fuegos
✅ Host recibe: 200 fuegos
✅ Plataforma recibe: 100 fuegos
```

### Test 3: Costo creación 500 fuegos
```bash
# Crear rifa modo PREMIO
# Verificar:
✅ Se descuentan 500 fuegos del host
✅ Plataforma (1417856820) recibe 500 fuegos
✅ Si balance < 500: error "Saldo insuficiente"
```

---

## 📊 QUERIES DE VERIFICACIÓN

### Verificar distribución del último sorteo
```sql
SELECT 
  wt.type,
  wt.currency,
  wt.amount,
  wt.description,
  u.telegram_username
FROM wallet_transactions wt
JOIN wallets w ON wt.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE wt.reference LIKE 'raffle_%'
  AND wt.created_at > NOW() - INTERVAL '1 hour'
ORDER BY wt.created_at DESC;
```

### Verificar balance de plataforma
```sql
SELECT 
  u.telegram_id,
  u.telegram_username,
  w.fires_balance
FROM users u
JOIN wallets w ON w.user_id = u.id
WHERE u.telegram_id = '1417856820';
```

---

## 🚀 DEPLOY

### Build y commit
```bash
# Frontend
cd frontend
npm run build

# Commit
git add backend/modules/raffles/services/RaffleServiceV2.js
git add backend/modules/raffles/types/index.js
git add RAFFLE_FIXES_SPLIT_7020-10.md
git commit -m "fix: sorteo automático + split 70/20/10 modo FIRES + costos 500"
git push
```

**Railway:** Auto-deploy ~6 min

---

## ✅ CHECKLIST POST-DEPLOY

### Funcionalidad crítica
- [ ] Crear rifa 10 números
- [ ] Comprar todos los números
- [ ] Verificar sorteo automático (10s después)
- [ ] NO error "pool is not defined"
- [ ] Ganador recibe notificación

### Distribución modo FIRES
- [ ] Crear rifa modo FIRES (100 fuegos/número)
- [ ] Completar rifa
- [ ] Verificar en DB: 70% ganador
- [ ] Verificar en DB: 20% host
- [ ] Verificar en DB: 10% plataforma

### Costos actualizados
- [ ] Crear rifa modo PREMIO
- [ ] Verificar cobro 500 fuegos (no 300)
- [ ] Verificar recepción plataforma

---

## 💡 PRÓXIMOS PASOS

1. **Landing Empresarial Premium**
   - Diseño minimalista con colores personalizados
   - Logo como marca de agua al 15%
   - Información en tiempo real
   - URL: `/{codigo}/rifa`

2. **Modal de Participantes**
   - "Vendidos" → "Participantes" clickeable
   - Vista por rol (host vs usuario)
   - Aprobación/rechazo de pagos

3. **Toggle Pago con Fuegos**
   - Opción en modo Premio
   - Pago automático sin aprobación
   - Host recibe 100% sin comisión

---

## 🎯 CONCLUSIÓN

**Problemas resueltos:**
- ✅ Error "pool is not defined" en sorteo
- ✅ Distribución 70/20/10 implementada
- ✅ Costos actualizados a 500 fuegos
- ✅ Transacciones separadas con descripciones claras

**Estado:** LISTO PARA TESTING EN PRODUCCIÓN

---

**Nota:** Este sistema ahora mantiene la economía balanceada:
- Ganadores reciben premios justos (70%)
- Hosts tienen incentivo para crear rifas (20%)
- Plataforma se sustenta (10% + costos iniciales)
