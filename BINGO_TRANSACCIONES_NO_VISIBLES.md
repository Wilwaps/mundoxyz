# Investigación: Transacciones de Bingo No Visibles en Historial

**Fecha:** 9 Nov 2025 2:05pm  
**Problema reportado:** Las transacciones de monedas no se ven en el historial  
**Estado:** Investigación completa

---

## 🐛 PROBLEMA REPORTADO

El usuario reporta que las transacciones de Bingo (compra de cartones, reembolsos) **NO aparecen en el historial**, aunque las operaciones sí se están ejecutando correctamente.

**Evidencia:**
- En la imagen 4 del reporte, se ven transacciones de Bingo con FUEGOS (🔥):
  - "Bingo Refund" +1.00 🔥
  - "Bingo Card Purchase" +1.00 🔥
- Las transacciones con MONEDAS (🪙) NO se muestran

---

## 🔍 ANÁLISIS REALIZADO

### 1. Backend - Sistema de Transacciones

El backend **SÍ está registrando** las transacciones correctamente:

**`backend/services/bingoV2Service.js` - Método `joinRoom` (líneas 337-352):**
```javascript
// ✅ CRITICAL: Registrar transacción de compra
await dbQuery(
  `INSERT INTO wallet_transactions 
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   SELECT w.id, 'bingo_card_purchase', $1, $2, $3, $4, $5, $6
   FROM wallets w WHERE w.user_id = $7`,
  [
    currency,           // ✅ 'coins' o 'fires'
    totalCost,
    balanceBefore,
    balanceBefore - totalCost,
    `Compra de ${cardsToBuy} cartón(es) Bingo - Sala #${room.code}`,
    `bingo:${room.code}:purchase`,
    userId
  ]
);
```

**`backend/routes/bingoV2.js` - Endpoint `/update-cards` (líneas 561-577, 608-624):**
```javascript
// ✅ Registrar transacción de compra adicional
await query(
  `INSERT INTO wallet_transactions 
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   SELECT w.id, 'bingo_card_purchase', $1, $2, $3, $4, $5, $6
   FROM wallets w WHERE w.user_id = $7`,
  [
    currency,  // ✅ 'coins' o 'fires'
    costDifference,
    balanceBefore,
    balanceBefore - costDifference,
    `Compra adicional de ${cardsDifference} cartón(es) Bingo - Sala #${code}`,
    `bingo:${code}:purchase_add`,
    userId
  ]
);

// ✅ Registrar transacción de reembolso parcial
await query(
  `INSERT INTO wallet_transactions 
   (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
   SELECT w.id, 'bingo_card_refund', $1, $2, $3, $4, $5, $6
   FROM wallets w WHERE w.user_id = $7`,
  [
    currency,  // ✅ 'coins' o 'fires'
    costDifference,
    balanceBefore,
    balanceBefore + costDifference,
    `Reembolso parcial ${Math.abs(cardsDifference)} cartón(es) Bingo - Sala #${code}`,
    `bingo:${code}:refund_partial`,
    userId
  ]
);
```

**Conclusión:** El backend está registrando correctamente las transacciones con:
- `type`: `'bingo_card_purchase'` o `'bingo_card_refund'`
- `currency`: `'coins'` o `'fires'` según el tipo de sala

---

### 2. Endpoint de Transacciones

**`backend/routes/profile.js` - `/api/profile/:userId/transactions` (líneas 319-377):**
```javascript
router.get('/:userId/transactions', verifyToken, async (req, res) => {
  // ...
  const { currency, limit = 25, offset = 0 } = req.query;
  
  let queryStr = `
    SELECT 
      wt.id,
      wt.type,
      wt.currency,
      wt.amount,
      wt.balance_after,
      wt.description,
      wt.created_at,
      u2.username as related_username
    FROM wallet_transactions wt
    LEFT JOIN users u2 ON u2.id = wt.related_user_id
    WHERE wt.wallet_id = $1
  `;
  
  // ✅ Filtro opcional por currency
  if (currency) {
    queryStr += ` AND wt.currency = $${paramCount}`;
    queryParams.push(currency);
    paramCount++;
  }
  
  queryStr += ` ORDER BY wt.created_at DESC LIMIT ... OFFSET ...`;
  // ...
});
```

**Conclusión:** El endpoint permite filtrar por `currency`, pero **NO es obligatorio**. Si no se pasa `currency`, devuelve todas las transacciones.

---

### 3. Frontend - FiresHistoryModal

**`frontend/src/components/FiresHistoryModal.js` (líneas 19-27):**
```javascript
const { data, isLoading: loading, refetch } = useQuery({
  queryKey: ['wallet-transactions', user?.id, page],
  queryFn: async () => {
    if (!user?.id) return { transactions: [], total: 0 };
    const response = await axios.get(`/api/profile/${user.id}/transactions`, {
      params: {
        currency: 'fires',  // ❌ PROBLEMA: Solo consulta transacciones de FUEGOS
        limit: pageSize,
        offset: page * pageSize
      }
    });
    return response.data;
  },
  enabled: isOpen && !!user?.id,
  refetchInterval: 5000,
  refetchIntervalInBackground: false
});
```

**❌ PROBLEMA IDENTIFICADO:**

El modal `FiresHistoryModal` está **forzando el filtro `currency: 'fires'`**, por lo que:
- ✅ **SÍ muestra** transacciones de Bingo con **fuegos**
- ❌ **NO muestra** transacciones de Bingo con **monedas**

**Tipos de transacción de Bingo:**
```javascript
// En FiresHistoryModal.js (líneas 36-74)
const getTransactionLabel = (type) => {
  const labels = {
    transfer_in: 'Fuegos Recibidos',
    transfer_out: 'Fuegos Enviados',
    fire_purchase: 'Compra de Fuegos',
    welcome_bonus: 'Bono de Bienvenida',
    game_reward: 'Premio de Juego',
    commission: 'Comisión',
    admin_grant: 'Regalo Admin',
    game_bet: 'Apuesta de Juego',
    tictactoe_bet: 'Apuesta TicTacToe',
    tictactoe_win: 'Victoria TicTacToe',
    tictactoe_draw: 'Empate TicTacToe',
    tictactoe_refund: 'Devolución TicTacToe'
  };
  // ❌ NO incluye: 'bingo_card_purchase', 'bingo_card_refund'
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
```

---

## ✅ CONCLUSIÓN

### Problema Real:

**NO** es que las transacciones de Bingo no se estén registrando.  
**SÍ** se están registrando correctamente en `wallet_transactions`.

El problema es que:

1. **`FiresHistoryModal` solo muestra transacciones de FUEGOS (`currency: 'fires'`)**
2. **Las transacciones de Bingo con MONEDAS tienen `currency: 'coins'`, por lo que NO aparecen en ese modal**
3. **No existe un "CoinsHistoryModal" o un modal unificado para ver transacciones de monedas**

### Evidencia en la Imagen 4:

En el historial de fuegos se ven:
- ✅ "Bingo Refund" con fuegos (sala con currency_type='fires')
- ✅ "Bingo Card Purchase" con fuegos (sala con currency_type='fires')

Pero **NO se ven** las transacciones de salas con `currency_type='coins'` porque el modal está filtrando por `currency: 'fires'`.

---

## 🎯 POSIBLES SOLUCIONES

### Opción 1: Crear Modal de Monedas (CoinsHistoryModal)

Crear un modal similar a `FiresHistoryModal` pero que muestre transacciones de monedas:

```javascript
// frontend/src/components/CoinsHistoryModal.js
const response = await axios.get(`/api/profile/${user.id}/transactions`, {
  params: {
    currency: 'coins',  // ✅ Filtrar por monedas
    limit: pageSize,
    offset: page * pageSize
  }
});
```

**Ventaja:** Separación clara entre fuegos y monedas  
**Desventaja:** Duplicación de código

### Opción 2: Modal Unificado con Tabs

Crear un modal que muestre ambas currencies con pestañas:

```javascript
// frontend/src/components/WalletHistoryModal.js
const [activeTab, setActiveTab] = useState('fires'); // 'fires' | 'coins'

const response = await axios.get(`/api/profile/${user.id}/transactions`, {
  params: {
    currency: activeTab,  // ✅ Dinámico según pestaña activa
    limit: pageSize,
    offset: page * pageSize
  }
});
```

**Ventaja:** Interfaz unificada, mejor UX  
**Desventaja:** Requiere refactorización de FiresHistoryModal

### Opción 3: Modal Sin Filtro + Mostrar Icono de Currency

Remover el filtro y mostrar todas las transacciones con icono que indique la currency:

```javascript
const response = await axios.get(`/api/profile/${user.id}/transactions`, {
  params: {
    // ✅ Sin filtro de currency - muestra todas
    limit: pageSize,
    offset: page * pageSize
  }
});
```

**Ventaja:** Historial completo en un solo lugar  
**Desventaja:** Mezcla fuegos y monedas, puede ser confuso

---

## 🔧 RECOMENDACIÓN

**Implementar Opción 2: Modal Unificado con Tabs**

Beneficios:
- ✅ Usuario ve todas sus transacciones organizadas
- ✅ Separación clara entre monedas y fuegos
- ✅ Evita confusión al mezclar currencies
- ✅ Mantiene contexto claro (sabe qué está viendo)
- ✅ Reutiliza lógica existente con mínimos cambios

Cambios necesarios:
1. Renombrar `FiresHistoryModal` a `WalletHistoryModal`
2. Agregar tabs para 'coins' y 'fires'
3. Hacer queryKey dinámico según tab activo
4. Agregar labels para transacciones de Bingo:
   - `bingo_card_purchase`: "Compra Cartón Bingo"
   - `bingo_card_refund`: "Reembolso Bingo"

---

## 📊 TIPOS DE TRANSACCIÓN POR CURRENCY

### Fuegos (`currency: 'fires'`):
- `transfer_in` / `transfer_out`
- `fire_purchase`
- `tictactoe_bet` / `tictactoe_win` / `tictactoe_draw` / `tictactoe_refund`
- `bingo_card_purchase` / `bingo_card_refund` (salas de fuegos)
- `commission`
- `admin_grant`

### Monedas (`currency: 'coins'`):
- `welcome_bonus`
- `game_reward`
- `bingo_card_purchase` / `bingo_card_refund` (salas de monedas)
- `market_redeem`
- `experience_purchase`

---

**Status:** ✅ Problema identificado - Solución pendiente de implementación  
**Impacto:** Medio - Usuario puede ver transacciones pero debe saber buscar en el lugar correcto  
**Prioridad:** Media - Mejora UX significativa pero no es bloqueante  
