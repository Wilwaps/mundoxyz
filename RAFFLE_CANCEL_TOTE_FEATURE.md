# ✅ FEATURE: Botón Cancelar Rifas para Rol Tote + Reembolso Automático

**Fecha**: 2025-11-10 07:50  
**Usuario Objetivo**: Tote (tg_id: 1417856820)  
**Objetivo**: Permitir cancelar rifas con reembolso automático a compradores desde el pot  
**Commit**: 9bee32d  

---

## 📋 RESUMEN EJECUTIVO

### Funcionalidad Implementada:
✅ Sistema completo de cancelación de rifas con reembolso automático  
✅ Botón visible para rol "Tote" + usuario específico (tg_id 1417856820)  
✅ Backend transaccional con rollback automático  
✅ Socket real-time para notificar cancelación  
✅ UI con confirmación y feedback visual  

---

## 🎯 PERMISOS DE CANCELACIÓN

### Pueden cancelar rifas:
1. **Host de la rifa** (creador original)
2. **Admin** (rol `admin`)
3. **Rol Tote** (rol `Tote`)
4. **Usuario específico** (tg_id `1417856820`)

### Restricciones:
- ❌ No se puede cancelar rifa FINISHED (finalizada)
- ❌ No se puede cancelar rifa ya CANCELLED
- ✅ Se puede cancelar rifa PENDING o ACTIVE

---

## 🔧 BACKEND IMPLEMENTATION

### Archivo: `RaffleServiceV2.js`

#### Método: `cancelRaffle(code)`

**Flujo transaccional**:
```javascript
BEGIN TRANSACTION

1. Obtener rifa y validar estado
   - Buscar por code
   - Validar no sea CANCELLED
   - Validar no sea FINISHED

2. Obtener números vendidos agrupados por comprador
   SELECT owner_id, COUNT(*), SUM(precio)
   FROM raffle_numbers
   WHERE state='sold' AND owner_id IS NOT NULL
   GROUP BY owner_id

3. Para cada comprador:
   - Calcular monto a reembolsar
   - UPDATE wallets: acreditar reembolso
   - INSERT wallet_transactions: registrar reembolso
   - Log individual por comprador

4. Actualizar rifa:
   - status = 'cancelled'
   - pot_fires = 0
   - pot_coins = 0
   - updated_at = NOW()

5. Liberar todos los números:
   - state = 'available'
   - owner_id = NULL
   - reserved_at = NULL

COMMIT TRANSACTION

Return:
{
  success: true,
  refundedUsers: N,
  totalRefunded: MONTO
}
```

**Validaciones**:
- ✅ Rifa existe
- ✅ Estado permite cancelación
- ✅ Wallets tienen suficiente espacio (sin límite superior)
- ✅ Transacciones se registran correctamente

**Logging**:
```javascript
logger.info('[RaffleServiceV2] Iniciando cancelación de rifa', { code });
logger.info('[RaffleServiceV2] Números vendidos encontrados', { buyers, totalNumbers });
logger.info('[RaffleServiceV2] Reembolso procesado', { userId, amount, currency });
logger.info('[RaffleServiceV2] Rifa cancelada exitosamente', { refundedUsers });
```

**Manejo de errores**:
- ROLLBACK automático si falla cualquier operación
- Error logs detallados
- Códigos de error específicos

---

### Archivo: `RaffleController.js`

#### Método: `cancelRaffle(req, res)`

**Validación de permisos**:
```javascript
const isHost = raffle.raffle.hostId === userId;
const isAdmin = req.user.roles?.includes('admin');
const isTote = req.user.roles?.includes('Tote');
const isToteUser = userTgId === '1417856820';

if (!isHost && !isAdmin && !isTote && !isToteUser) {
  return res.status(403).json({
    success: false,
    message: 'No tienes permisos para cancelar esta rifa'
  });
}
```

**Socket event**:
```javascript
io.to(`raffle-${code}`).emit('raffle:cancelled', { code });
```

**Response**:
```json
{
  "success": true,
  "message": "Rifa cancelada exitosamente"
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### Archivo: `RaffleRoom.tsx`

#### Botón UI:
```tsx
{/* Botón visible para: host, admin, Tote, tg_id 1417856820 */}
{(user?.id === raffle.hostId || 
  user?.roles?.includes('admin') || 
  user?.roles?.includes('Tote') ||
  (user as any)?.tg_id === '1417856820') &&
  raffle.status !== RaffleStatus.FINISHED &&
  raffle.status !== RaffleStatus.CANCELLED && (
  <button
    onClick={handleCancelRaffle}
    disabled={cancelRaffle.isPending}
    className="p-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
    title="Cancelar rifa y reembolsar compradores"
  >
    <Trash2 className="w-5 h-5 text-red-400" />
  </button>
)}
```

#### Handler: `handleCancelRaffle()`
```typescript
const handleCancelRaffle = async () => {
  const confirmCancel = window.confirm(
    '⚠️ ¿Estás seguro de cancelar esta rifa?\n\n' +
    'Esto hará lo siguiente:\n' +
    '• Se reembolsarán todos los compradores desde el pot\n' +
    '• La rifa quedará marcada como CANCELADA\n' +
    '• No se podrá revertir esta acción\n\n' +
    '¿Deseas continuar?'
  );
  
  if (!confirmCancel) return;
  
  try {
    await cancelRaffle.mutateAsync(code);
    toast.success('Rifa cancelada exitosamente. Todos los compradores fueron reembolsados.');
    setTimeout(() => navigate('/raffles'), 2000);
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Error al cancelar la rifa');
  }
};
```

#### Socket listener:
```typescript
socket.on('raffle:cancelled', handleRaffleCancelled);

const handleRaffleCancelled = useCallback((data: any) => {
  toast.error('⚠️ Esta rifa ha sido cancelada. Serás reembolsado automáticamente.', {
    duration: 6000
  });
  setTimeout(() => {
    navigate('/raffles');
  }, 3000);
}, [navigate]);
```

---

## 💰 FLUJO DE REEMBOLSO

### Ejemplo: Rifa con 5 compradores

**Estado inicial**:
```
Rifa ID: 123, Code: ABC100
Pot: 500 fuegos
Números vendidos: 50 (10 c/u × 5 usuarios)

Usuario A: compró 10 números × 10 fuegos = 100 fuegos
Usuario B: compró 15 números × 10 fuegos = 150 fuegos
Usuario C: compró 8 números × 10 fuegos = 80 fuegos
Usuario D: compró 12 números × 10 fuegos = 120 fuegos
Usuario E: compró 5 números × 10 fuegos = 50 fuegos
```

**Proceso de cancelación**:
```sql
-- 1. Query agrupa por comprador
SELECT owner_id, COUNT(*), SUM(entry_price)
FROM raffle_numbers
WHERE raffle_id=123 AND state='sold'
GROUP BY owner_id

Resultado:
A | 10 | 100
B | 15 | 150
C | 8  | 80
D | 12 | 120
E | 5  | 50

-- 2. Para cada usuario:
UPDATE wallets SET fires_balance = fires_balance + 100 WHERE user_id = A
UPDATE wallets SET fires_balance = fires_balance + 150 WHERE user_id = B
UPDATE wallets SET fires_balance = fires_balance + 80 WHERE user_id = C
UPDATE wallets SET fires_balance = fires_balance + 120 WHERE user_id = D
UPDATE wallets SET fires_balance = fires_balance + 50 WHERE user_id = E

-- 3. Registrar transacciones:
INSERT INTO wallet_transactions (wallet_id, type, currency, amount, description, reference)
VALUES 
  (A, 'refund', 'fires', 100, 'Reembolso por cancelación de rifa ABC100', 'raffle_cancel_ABC100'),
  (B, 'refund', 'fires', 150, 'Reembolso por cancelación de rifa ABC100', 'raffle_cancel_ABC100'),
  ...

-- 4. Actualizar rifa:
UPDATE raffles SET status='cancelled', pot_fires=0, pot_coins=0 WHERE id=123

-- 5. Liberar números:
UPDATE raffle_numbers SET state='available', owner_id=NULL WHERE raffle_id=123
```

**Estado final**:
```
Rifa ID: 123, Code: ABC100
Status: CANCELLED
Pot: 0 fuegos
Números vendidos: 0

Usuario A: balance += 100 fuegos
Usuario B: balance += 150 fuegos
Usuario C: balance += 80 fuegos
Usuario D: balance += 120 fuegos
Usuario E: balance += 50 fuegos

Total reembolsado: 500 fuegos ✅
```

---

## 🔒 SEGURIDAD

### Validaciones Backend:
1. ✅ Token JWT válido requerido
2. ✅ Usuario autenticado
3. ✅ Permisos verificados (host/admin/Tote/tg_id específico)
4. ✅ Estado de rifa validado
5. ✅ Transacción atómica (rollback si falla)

### Validaciones Frontend:
1. ✅ Botón visible solo para usuarios autorizados
2. ✅ Confirmación explícita del usuario
3. ✅ Deshabilitado mientras procesa (isPending)
4. ✅ Feedback visual de errores

---

## 📊 LOGS Y MONITOREO

### Backend logs esperados:
```
[RaffleServiceV2] Iniciando cancelación de rifa { code: 'ABC100' }
[RaffleServiceV2] Números vendidos encontrados { code: 'ABC100', buyers: 5, totalNumbers: 50 }
[RaffleServiceV2] Reembolso procesado { code: 'ABC100', userId: 'uuid-A', amount: 100, currency: 'fires' }
[RaffleServiceV2] Reembolso procesado { code: 'ABC100', userId: 'uuid-B', amount: 150, currency: 'fires' }
...
[RaffleServiceV2] Rifa cancelada exitosamente { code: 'ABC100', refundedUsers: 5 }
```

### Frontend console logs:
```
Raffle cancelled: { code: 'ABC100' }
```

### Toasts usuarios:
- **Quien cancela**: "Rifa cancelada exitosamente. Todos los compradores fueron reembolsados."
- **Otros usuarios**: "⚠️ Esta rifa ha sido cancelada. Serás reembolsado automáticamente."

---

## 🧪 TESTING MANUAL

### Pre-requisitos:
1. Usuario con rol "Tote" o tg_id "1417856820"
2. Rifa activa con al menos 1 comprador
3. Wallet con balance suficiente para reembolsos (sin límite)

### Pasos:
1. **Acceder a rifa activa**
   - URL: `/raffles/:code`
   - Verificar botón rojo (Trash2) visible

2. **Click botón cancelar**
   - Ver modal de confirmación
   - Leer advertencias
   - Confirmar

3. **Verificar proceso**
   - Toast: "Rifa cancelada exitosamente..."
   - Redirect a `/raffles` después de 2s
   - Verificar otros usuarios reciben notificación

4. **Verificar reembolsos**
   - Revisar wallets de compradores (balance += monto)
   - Revisar `wallet_transactions` (tipo 'refund')
   - Verificar pot de rifa = 0

5. **Verificar estado rifa**
   - Status = 'cancelled'
   - Números liberados (state='available', owner_id=NULL)
   - No se puede volver a cancelar

### Casos edge:
- [ ] Cancelar rifa sin ventas (0 reembolsos)
- [ ] Cancelar rifa con 1 solo comprador
- [ ] Cancelar rifa con 100+ compradores
- [ ] Intentar cancelar rifa finished (debe fallar)
- [ ] Intentar cancelar rifa ya cancelled (debe fallar)
- [ ] Usuario sin permisos intenta cancelar (botón no visible)

---

## 📝 DATABASE CHANGES

### Tablas afectadas:

#### `raffles`:
- `status` → 'cancelled'
- `pot_fires` → 0
- `pot_coins` → 0
- `updated_at` → NOW()

#### `raffle_numbers`:
- `state` → 'available'
- `owner_id` → NULL
- `reserved_at` → NULL

#### `wallets`:
- `fires_balance` o `coins_balance` → += refund amount

#### `wallet_transactions` (nuevos registros):
- `type`: 'refund'
- `currency`: 'fires' | 'coins'
- `amount`: monto reembolsado
- `description`: "Reembolso por cancelación de rifa {code}"
- `reference`: "raffle_cancel_{code}"

---

## 🚀 DEPLOY

**Railway**: Auto-deploy ✅  
**Tiempo**: ~6 minutos  
**URL**: https://mundoxyz-production.up.railway.app  
**Commit**: 9bee32d  

### Verificación post-deploy:
- [ ] Server inicia sin errores
- [ ] Endpoint DELETE `/api/raffles/v2/:code` responde
- [ ] Botón visible en frontend para usuario Tote
- [ ] Cancelación procesa correctamente
- [ ] Reembolsos acreditados
- [ ] Socket events emitidos

---

## 📦 ARCHIVOS MODIFICADOS

### Backend:
1. **`backend/modules/raffles/services/RaffleServiceV2.js`**
   - Método `cancelRaffle()` completo (+147 líneas)
   - Transacción atómica con rollback
   - Logging detallado

2. **`backend/modules/raffles/controllers/RaffleController.js`**
   - Validación de permisos actualizada (Tote + tg_id)
   - Socket event emission
   - Response mejorado

### Frontend:
3. **`frontend/src/features/raffles/pages/RaffleRoom.tsx`**
   - Import `Trash2` + `useCancelRaffle`
   - Handler `handleCancelRaffle()`
   - Socket listener `raffle:cancelled`
   - Botón UI con permisos condicionales
   - Confirmación modal nativa

---

## 💡 MEJORAS FUTURAS

### Opcionales (no implementadas ahora):
1. **Modal custom** en lugar de `window.confirm`
2. **Motivo de cancelación** (input text opcional)
3. **Email notification** a compradores reembolsados
4. **Audit log** específico para cancelaciones
5. **Estadísticas** de rifas canceladas en dashboard
6. **Límite de tiempo** para cancelar (ej: no después de 80% vendido)

---

## ✅ CHECKLIST FINAL

### Backend:
- [x] Método `cancelRaffle()` en service
- [x] Validación de permisos en controller
- [x] Transacción atómica
- [x] Reembolso automático
- [x] Logging completo
- [x] Socket event emission
- [x] Error handling robusto

### Frontend:
- [x] Botón visible para usuarios autorizados
- [x] Confirmación antes de cancelar
- [x] Handler con try/catch
- [x] Socket listener
- [x] Toasts informativos
- [x] Redirect después de cancelar
- [x] Disabled state mientras procesa

### General:
- [x] Código testeado localmente
- [x] Commit con mensaje descriptivo
- [x] Push a GitHub
- [x] Deploy automático Railway
- [x] Documentación completa

---

**Status**: ✅ IMPLEMENTACIÓN COMPLETA  
**Testing**: Manual requerido en producción  
**Usuario Objetivo**: Tote (1417856820)  
**Próximo Paso**: Verificación con Chrome DevTools  

