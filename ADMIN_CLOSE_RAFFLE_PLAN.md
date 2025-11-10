# 📋 PLAN: Botón Cerrar Rifa (Solo Admin)

## 🎯 Objetivo

Permitir al usuario admin "tote" (tg_id: 1417856820) cerrar cualquier rifa desde el lobby con reembolso completo del 100% a todos los participantes.

---

## 📐 Arquitectura de Solución

### 1. **Identificación del Admin**
```javascript
// Middleware para verificar admin
const isAdminTote = (req, res, next) => {
  if (req.user.tg_id !== '1417856820') {
    return res.status(403).json({
      success: false,
      message: 'No autorizado'
    });
  }
  next();
};
```

### 2. **Endpoint Backend**
```javascript
// POST /api/raffles/v2/:code/admin-close
// Solo accesible por admin tote
```

### 3. **Flujo de Reembolsos**

#### A. Reembolsar a Compradores
```sql
-- 1. Obtener todos los números vendidos de la rifa
SELECT 
  rn.owner_id,
  rn.fire_spent + rn.coin_spent AS total_spent,
  rn.fire_spent,
  rn.coin_spent
FROM raffle_numbers rn
WHERE rn.raffle_id = $raffleId 
  AND rn.state = 'sold'
GROUP BY rn.owner_id;

-- 2. Para cada comprador:
UPDATE wallets
SET 
  fires_balance = fires_balance + $fireSpent,
  coins_balance = coins_balance + $coinSpent
WHERE user_id = $ownerId;

-- 3. Registrar transacción de reembolso
INSERT INTO wallet_transactions (
  wallet_id, type, currency, amount, 
  description, reference
) VALUES (
  $walletId, 'refund', 'fires', $fireSpent,
  'Reembolso: Rifa cerrada por admin',
  'raffle_admin_close_' || $raffleCode
);
```

#### B. Devolver Comisión del Admin al Host
```sql
-- 1. Calcular comisión enviada al admin (si aplica)
-- Las rifas modo premio envían 300/3000 fuegos al admin
SELECT 
  mode,
  is_company_mode,
  host_id
FROM raffles
WHERE id = $raffleId;

-- Si mode = 'prize':
commission = is_company_mode ? 3000 : 300;

-- 2. Transferir de admin a host
-- Admin pierde:
UPDATE wallets
SET fires_balance = fires_balance - $commission
WHERE user_id = (SELECT id FROM users WHERE tg_id = '1417856820');

-- Host recibe:
UPDATE wallets
SET fires_balance = fires_balance + $commission
WHERE user_id = $hostId;

-- 3. Registrar transacciones
INSERT INTO wallet_transactions (...) 
VALUES (..., 'refund', 'fires', $commission, 'Devolución comisión: Rifa cerrada', ...);
```

#### C. Actualizar Estado de Rifa
```sql
UPDATE raffles
SET 
  status = 'cancelled',
  finished_at = NOW()
WHERE id = $raffleId;

-- Marcar todos los números como cancelados
UPDATE raffle_numbers
SET state = 'cancelled'
WHERE raffle_id = $raffleId;
```

---

## 🎨 Frontend: Botón de Cerrar

### Ubicación: RafflesLobby o MyRaffles

```typescript
// Solo visible para admin tote
{user?.tg_id === '1417856820' && (
  <button
    onClick={() => handleAdminCloseRaffle(raffle.code)}
    className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors"
    title="Cerrar rifa (Admin)"
  >
    <X className="w-5 h-5 text-red-400" />
  </button>
)}
```

### Handler con Confirmación
```typescript
const handleAdminCloseRaffle = async (code: string) => {
  const confirmed = window.confirm(
    '⚠️ ADMIN: ¿Cerrar esta rifa?\n\n' +
    '✅ Se reembolsará el 100% a todos los compradores\n' +
    '✅ La comisión se devolverá al anfitrión\n' +
    '❌ Esta acción no se puede deshacer'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await api.adminCloseRaffle(code);
    toast.success(response.message);
    refetch(); // Actualizar lista
  } catch (error) {
    toast.error(error.response?.data?.message || 'Error cerrando rifa');
  }
};
```

---

## 🔐 Seguridad

### 1. **Triple Validación**
```javascript
// Backend:
// 1. Middleware verifyToken
// 2. Middleware isAdminTote
// 3. Verificar que rifa existe y está activa
```

### 2. **Transacciones Atómicas**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // 1. Reembolsar compradores
  // 2. Devolver comisión
  // 3. Actualizar rifa
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 3. **Logs de Auditoría**
```javascript
logger.warn('[ADMIN ACTION] Rifa cerrada', {
  adminUserId: req.user.id,
  adminTgId: req.user.tg_id,
  raffleCode,
  totalRefunded: totalAmount,
  participantsRefunded: participantsCount,
  timestamp: new Date().toISOString()
});
```

---

## 📊 Cálculos de Reembolso

### Escenario 1: Rifa Modo Fuegos
```
Rifa: 958346
Modo: fires
Precio por número: 10 fuegos
Números vendidos: 50
Pot total: 500 fuegos

Reembolsos:
- Usuario A (10 números): 100 fuegos
- Usuario B (30 números): 300 fuegos
- Usuario C (10 números): 100 fuegos

Total reembolsado: 500 fuegos
Comisión devuelta: 0 (no aplica en modo fires)
```

### Escenario 2: Rifa Modo Premio
```
Rifa: 354208
Modo: prize
Comisión pagada: 300 fuegos (al admin)
Números vendidos: 0 (gratis para usuarios)

Reembolsos:
- Usuarios: 0 (no pagaron)
- Host: 300 fuegos (devolución comisión)

Total reembolsado: 300 fuegos (del admin al host)
```

### Escenario 3: Rifa Modo Premio Empresa
```
Rifa: XXXXX
Modo: prize + company
Comisión pagada: 3000 fuegos (al admin)
Números vendidos: 0

Reembolsos:
- Usuarios: 0
- Host empresa: 3000 fuegos

Total reembolsado: 3000 fuegos
```

---

## 🔄 Flujo Completo

### 1. **Admin Click en (X)**
```
1. Frontend: handleAdminCloseRaffle(code)
2. Confirmación del usuario
3. POST /api/raffles/v2/:code/admin-close
```

### 2. **Backend Procesa**
```
1. Verificar admin (middleware)
2. Iniciar transacción
3. Obtener participantes y gastos
4. Reembolsar cada participante:
   - UPDATE wallets
   - INSERT wallet_transactions
5. Si modo prize:
   - Calcular comisión (300 o 3000)
   - Transferir de admin a host
   - INSERT wallet_transactions
6. UPDATE raffles (status = cancelled)
7. UPDATE raffle_numbers (state = cancelled)
8. Log de auditoría
9. COMMIT transacción
10. Emitir evento socket (opcional)
```

### 3. **Respuesta al Frontend**
```json
{
  "success": true,
  "message": "Rifa cerrada exitosamente",
  "summary": {
    "participantsRefunded": 3,
    "totalFiresRefunded": 500,
    "totalCoinsRefunded": 0,
    "commissionReturned": 300,
    "hostRefunded": true
  }
}
```

---

## 📂 Archivos a Modificar

### Backend
1. **routes/raffles.js**
   - Agregar: `POST /:code/admin-close` con middleware isAdminTote

2. **controllers/RaffleController.js**
   - Nuevo método: `adminCloseRaffle(req, res)`

3. **services/RaffleServiceV2.js**
   - Nuevo método: `adminCloseRaffle(raffleId, adminUserId)`

4. **middleware/auth.js**
   - Nuevo middleware: `isAdminTote(req, res, next)`

### Frontend
5. **features/raffles/api/index.ts**
   - Nuevo: `adminCloseRaffle(code: string): Promise<CloseRaffleResponse>`

6. **features/raffles/pages/RafflesLobby.tsx**
   - Agregar botón (X) condicional
   - Handler `handleAdminCloseRaffle`

7. **features/raffles/pages/MyRaffles.tsx**
   - Mismo botón (X) para rifas propias

---

## 🧪 Testing

### Casos de Prueba

1. **Usuario normal intenta cerrar rifa**
   - ❌ Debe rechazar con 403 Forbidden

2. **Admin cierra rifa sin participantes**
   - ✅ Status = cancelled
   - ✅ No reembolsos de números
   - ✅ Devuelve comisión si aplica

3. **Admin cierra rifa con participantes modo fires**
   - ✅ Todos reciben 100% de fuegos gastados
   - ✅ Balances correctos
   - ✅ Transacciones registradas

4. **Admin cierra rifa modo premio**
   - ✅ Host recibe devolución de 300/3000 fuegos
   - ✅ Admin pierde comisión
   - ✅ Log de auditoría completo

5. **Error en medio del proceso**
   - ✅ ROLLBACK ejecutado
   - ✅ No se pierde dinero
   - ✅ Estados consistentes

---

## ⚠️ Consideraciones Críticas

### 1. **Prevención de Abuso**
```javascript
// Limitar a rifas activas solamente
if (raffle.status !== 'active' && raffle.status !== 'pending') {
  throw new Error('Solo se pueden cerrar rifas activas o pendientes');
}
```

### 2. **Validación de Balance Admin**
```javascript
// Verificar que admin tiene suficiente para devolver comisión
const adminWallet = await getWalletByTgId('1417856820');
if (adminWallet.fires_balance < commissionToReturn) {
  throw new Error('Admin no tiene suficiente balance para devolver comisión');
}
```

### 3. **Notificaciones a Usuarios**
```javascript
// Opcional: Notificar a todos los participantes
for (const participant of participants) {
  await notifyUser(participant.userId, {
    type: 'raffle_closed',
    raffleCode,
    refundAmount,
    message: 'La rifa ha sido cerrada. Se ha reembolsado tu inversión.'
  });
}
```

---

## 📈 Métricas de Éxito

- ✅ Admin puede cerrar cualquier rifa activa
- ✅ Reembolsos 100% correctos
- ✅ Comisiones devueltas sin pérdidas
- ✅ Estados consistentes en BD
- ✅ Logs completos para auditoría
- ✅ UI clara con confirmación
- ✅ No se pierde dinero en el sistema

---

## 🚀 Orden de Implementación

### Fase 1: Backend Base (1h)
1. Crear middleware `isAdminTote`
2. Crear servicio `adminCloseRaffle`
3. Agregar ruta con middleware

### Fase 2: Lógica de Reembolsos (2h)
4. Implementar reembolso a compradores
5. Implementar devolución comisión
6. Agregar transacciones y logs

### Fase 3: Frontend (1h)
7. API layer en frontend
8. Botón (X) en lobby
9. Handler con confirmación

### Fase 4: Testing (1h)
10. Pruebas manuales en Railway
11. Verificar balances
12. Logs de auditoría

**Total estimado: 5 horas**

---

## 📝 Documentación Adicional

### Variables Clave
```javascript
const ADMIN_TG_ID = '1417856820';
const PRIZE_COMMISSION = 300;
const COMPANY_COMMISSION = 3000;
```

### Estados de Rifa
```typescript
enum RaffleStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled' // ← Nuevo estado
}
```

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Prioridad**: 🔴 ALTA  
**Módulo**: Sistema de Rifas V2 - Admin Tools
