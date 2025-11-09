# FIX: Actualización Visual del Balance al Comprar Cartones de Bingo

**Fecha:** 9 Nov 2025 12:58pm  
**Sala de prueba:** 637147  
**Usuario afectado:** prueba2  
**Problema reportado:** Balance no se actualiza visualmente al comprar cartones

---

## 🐛 PROBLEMA IDENTIFICADO

### Síntomas:

**Caso de Ejemplo:**
- Usuario: `prueba2`
- Sala: `637147`
- Cartones comprados: `3`
- Costo por cartón: `100 monedas`
- Costo total: `300 monedas`

**Comportamiento incorrecto:**
1. ✅ Backend deduce las 300 monedas de la wallet
2. ✅ Backend registra la transacción en `wallet_transactions`
3. ✅ Cartones se generan correctamente
4. ❌ **Frontend NO muestra el balance actualizado**
5. ❌ **Usuario ve su balance sin cambios hasta recargar la página**

---

## 🔍 ANÁLISIS DE CAUSA RAÍZ

### Backend (Correcto pero Incompleto):

**`backend/services/bingoV2Service.js` - método `joinRoom`:**
```javascript
// ✅ Deduce correctamente
await dbQuery(
  `UPDATE wallets SET ${columnName} = ${columnName} - $1 WHERE user_id = $2`,
  [totalCost, userId]
);

// ✅ Registra transacción
await dbQuery(
  `INSERT INTO wallet_transactions (...)
   VALUES (...)`,
  [...]
);

// ❌ PROBLEMA: No devuelve el balance actualizado
return { room, player, cardsGenerated: cardsToBuy };
```

**`backend/routes/bingoV2.js` - endpoint `/rooms/:code/join`:**
```javascript
const result = await BingoV2Service.joinRoom(...);

// ❌ PROBLEMA: Solo propaga lo que devuelve el servicio
res.json({
  success: true,
  ...result  // No incluye updatedBalance
});
```

### Frontend (No Recibe Información):

**`frontend/src/components/bingo/JoinRoomModal.js`:**
```javascript
const response = await axios.post(`/api/bingo/v2/rooms/${room.code}/join`, {
  cards_count: cardsCount
});

if (response.data.success) {
  // ❌ PROBLEMA: No actualiza el balance del usuario
  toast.success(`¡Te has unido a la sala!`);
  onSuccess(room.code);
  onClose();
}
```

**Resultado:** Usuario ve su balance sin cambios hasta que recarga la página completa o hace otra acción que refresque el perfil.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Backend: Devolver Balance Actualizado

#### Cambio en `backend/services/bingoV2Service.js`:

**ANTES:**
```javascript
return { room, player, cardsGenerated: cardsToBuy };
```

**DESPUÉS:**
```javascript
// ✅ CRITICAL: Obtener balance actualizado para devolverlo al frontend
const updatedWalletResult = await dbQuery(
  `SELECT coins_balance, fires_balance FROM wallets WHERE user_id = $1`,
  [userId]
);

const updatedBalance = {
  coins: parseFloat(updatedWalletResult.rows[0].coins_balance),
  fires: parseFloat(updatedWalletResult.rows[0].fires_balance)
};

return { 
  room, 
  player, 
  cardsGenerated: cardsToBuy,
  updatedBalance  // ✅ Incluir balance actualizado
};
```

#### Cambio en `backend/routes/bingoV2.js` - endpoint `/update-cards`:

**Agregado al final de la respuesta:**
```javascript
// ✅ CRITICAL: Obtener balance actualizado para devolverlo al frontend
const updatedWalletResult = await query(
  `SELECT coins_balance, fires_balance FROM wallets WHERE user_id = $1`,
  [userId]
);

const updatedBalance = {
  coins: parseFloat(updatedWalletResult.rows[0].coins_balance),
  fires: parseFloat(updatedWalletResult.rows[0].fires_balance)
};

res.json({
  success: true,
  message: `Cards updated to ${cards_count}`,
  cards: newCards,
  cards_count: cards_count,
  cost: cards_count * room.card_cost,
  currency: room.currency_type,
  is_ready: readyStatus,
  updatedBalance  // ✅ Incluir balance actualizado
});
```

---

### 2. Frontend: Actualizar Balance del Usuario

#### Cambio en `frontend/src/components/bingo/JoinRoomModal.js`:

**ANTES:**
```javascript
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const JoinRoomModal = ({ show, room, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [cardsCount, setCardsCount] = useState(1);
  
  const handleJoin = async () => {
    // ...
    if (response.data.success) {
      toast.success(`¡Te has unido a la sala!`);
      onSuccess(room.code);
      onClose();
    }
  };
```

**DESPUÉS:**
```javascript
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';  // ✅ Nuevo import

const JoinRoomModal = ({ show, room, onClose, onSuccess }) => {
  const { user, updateUser } = useAuth();  // ✅ Obtener función updateUser
  const [loading, setLoading] = useState(false);
  const [cardsCount, setCardsCount] = useState(1);
  
  const handleJoin = async () => {
    // ...
    if (response.data.success) {
      // ✅ CRITICAL: Actualizar balance del usuario si viene en la respuesta
      if (response.data.updatedBalance) {
        updateUser({
          ...user,
          coins_balance: response.data.updatedBalance.coins,
          fires_balance: response.data.updatedBalance.fires
        });
      }
      
      toast.success(`¡Te has unido a la sala!`);
      onSuccess(room.code);
      onClose();
    }
  };
```

#### Cambio en `frontend/src/pages/BingoV2WaitingRoom.js`:

**ANTES:**
```javascript
const { user } = useAuth();

const handleUpdateCards = async () => {
  // ...
  if (data.success) {
    setCurrentCards(pendingCards);
    toast.success(`✅ ${pendingCards} cartones comprados`, {
      icon: '🎟️',
      duration: 3000
    });
    loadRoomDetails();
  }
};
```

**DESPUÉS:**
```javascript
const { user, updateUser } = useAuth();  // ✅ Obtener función updateUser

const handleUpdateCards = async () => {
  // ...
  if (data.success) {
    setCurrentCards(pendingCards);
    
    // ✅ CRITICAL: Actualizar balance del usuario si viene en la respuesta
    if (data.updatedBalance) {
      updateUser({
        ...user,
        coins_balance: data.updatedBalance.coins,
        fires_balance: data.updatedBalance.fires
      });
    }
    
    toast.success(`✅ ${pendingCards} cartones comprados`, {
      icon: '🎟️',
      duration: 3000
    });
    loadRoomDetails();
  }
};
```

---

## 📊 FLUJO COMPLETO DESPUÉS DEL FIX

### Compra Inicial (JoinRoomModal):

```
1. Usuario hace clic en "Unirse" con 3 cartones
   ↓
2. Frontend envía POST /api/bingo/v2/rooms/637147/join
   Body: { cards_count: 3 }
   ↓
3. Backend:
   a. Deduce 300 monedas de wallet
   b. Registra transacción en wallet_transactions
   c. Crea jugador en bingo_v2_room_players
   d. Genera 3 cartones
   e. ✅ Consulta balance actualizado
   f. ✅ Devuelve: { success, room, player, cardsGenerated, updatedBalance }
   ↓
4. Frontend recibe respuesta:
   {
     success: true,
     room: {...},
     player: {...},
     cardsGenerated: 3,
     updatedBalance: {  // ✅ NUEVO
       coins: 700,      // Antes: 1000, ahora: 700
       fires: 500
     }
   }
   ↓
5. ✅ Frontend actualiza contexto de usuario:
   updateUser({
     ...user,
     coins_balance: 700,
     fires_balance: 500
   })
   ↓
6. ✅ UI refleja cambio inmediatamente:
   - Header muestra: 700 monedas
   - Todas las páginas ven el balance actualizado
```

### Ajuste de Cartones (WaitingRoom):

```
1. Usuario cambia de 3 a 5 cartones (aumenta 2)
   ↓
2. Frontend envía POST /api/bingo/v2/rooms/637147/update-cards
   Body: { cards_count: 5, auto_ready: true }
   ↓
3. Backend:
   a. Calcula diferencia: 5 - 3 = 2 cartones adicionales
   b. Costo adicional: 2 * 100 = 200 monedas
   c. Deduce 200 monedas (700 → 500)
   d. Registra transacción de compra adicional
   e. Elimina cartones viejos
   f. Genera 5 cartones nuevos
   g. ✅ Consulta balance actualizado
   h. ✅ Devuelve: { success, cards, cards_count, updatedBalance }
   ↓
4. Frontend recibe respuesta:
   {
     success: true,
     cards: [{...}, {...}, {...}, {...}, {...}],
     cards_count: 5,
     updatedBalance: {  // ✅ NUEVO
       coins: 500,      // Antes: 700, ahora: 500
       fires: 500
     }
   }
   ↓
5. ✅ Frontend actualiza contexto de usuario:
   updateUser({
     ...user,
     coins_balance: 500,
     fires_balance: 500
   })
   ↓
6. ✅ UI refleja cambio inmediatamente
```

---

## 🎯 ENDPOINTS AFECTADOS

### 1. POST `/api/bingo/v2/rooms/:code/join`

**Respuesta ANTES:**
```json
{
  "success": true,
  "room": {...},
  "player": {...},
  "cardsGenerated": 3
}
```

**Respuesta DESPUÉS:**
```json
{
  "success": true,
  "room": {...},
  "player": {...},
  "cardsGenerated": 3,
  "updatedBalance": {
    "coins": 700.00,
    "fires": 500.00
  }
}
```

### 2. POST `/api/bingo/v2/rooms/:code/update-cards`

**Respuesta ANTES:**
```json
{
  "success": true,
  "message": "Cards updated to 5",
  "cards": [...],
  "cards_count": 5,
  "cost": 500,
  "currency": "coins",
  "is_ready": true
}
```

**Respuesta DESPUÉS:**
```json
{
  "success": true,
  "message": "Cards updated to 5",
  "cards": [...],
  "cards_count": 5,
  "cost": 500,
  "currency": "coins",
  "is_ready": true,
  "updatedBalance": {
    "coins": 500.00,
    "fires": 500.00
  }
}
```

---

## 📝 ARCHIVOS MODIFICADOS

### Backend:

1. **`backend/services/bingoV2Service.js`**
   - Método: `joinRoom` (líneas 379-395)
   - Agregado: Query para obtener balance actualizado
   - Cambio en return: Incluir `updatedBalance`

2. **`backend/routes/bingoV2.js`**
   - Endpoint: `POST /rooms/:code/update-cards` (líneas 690-710)
   - Agregado: Query para obtener balance actualizado antes de responder
   - Cambio en respuesta: Incluir `updatedBalance`

### Frontend:

3. **`frontend/src/components/bingo/JoinRoomModal.js`**
   - Import: `useAuth` hook
   - Líneas 4, 7, 24-31
   - Agregado: Actualización de usuario con balance recibido

4. **`frontend/src/pages/BingoV2WaitingRoom.js`**
   - Hook: `updateUser` en destructuring de `useAuth`
   - Líneas 13, 226-233
   - Agregado: Actualización de usuario con balance recibido

---

## ✅ BENEFICIOS

### UX Mejorado:
- ✅ **Feedback inmediato:** Usuario ve su balance actualizado al instante
- ✅ **Sin confusión:** No necesita recargar página para ver cambios
- ✅ **Transparencia:** Balance siempre refleja el estado real
- ✅ **Confianza:** Usuario sabe que la compra se procesó correctamente

### Técnico:
- ✅ **Consistencia:** UI sincronizada con DB en todo momento
- ✅ **Sin race conditions:** Balance actualizado antes de mostrar UI
- ✅ **Reutilizable:** Patrón aplicable a otros endpoints de economía
- ✅ **Backward compatible:** Clientes antiguos no se rompen si ignoran `updatedBalance`

---

## 🧪 TESTING

### Casos de Prueba:

**1. Compra inicial de cartones:**
- [ ] Unirse a sala con 1 cartón (costo 100)
- [ ] Verificar que balance disminuye en 100 visualmente
- [ ] Verificar que transacción se registra en DB

**2. Compra con múltiples cartones:**
- [ ] Unirse a sala con 5 cartones (costo 500)
- [ ] Verificar que balance disminuye en 500 visualmente
- [ ] Verificar que transacción se registra en DB

**3. Aumentar cartones en sala de espera:**
- [ ] Cambiar de 3 a 5 cartones (+2)
- [ ] Verificar que balance disminuye en 200 (2*100) visualmente
- [ ] Verificar que transacción "purchase_add" se registra

**4. Disminuir cartones en sala de espera:**
- [ ] Cambiar de 5 a 3 cartones (-2)
- [ ] Verificar que balance aumenta en 200 (reembolso) visualmente
- [ ] Verificar que transacción "refund_partial" se registra

**5. Fondos insuficientes:**
- [ ] Intentar comprar más cartones de los que se puede costear
- [ ] Verificar error apropiado
- [ ] Verificar que balance NO cambia

**6. Monedas vs Fuegos:**
- [ ] Probar con sala de monedas (currency_type = 'coins')
- [ ] Probar con sala de fuegos (currency_type = 'fires')
- [ ] Verificar que ambos actualizan correctamente

---

## 📋 CHECKLIST POST-DEPLOY

- [ ] Crear sala de Bingo con monedas
- [ ] Usuario A se une con 3 cartones
- [ ] Verificar balance de A disminuye visualmente
- [ ] Usuario A aumenta a 5 cartones
- [ ] Verificar balance de A disminuye nuevamente
- [ ] Usuario A disminuye a 2 cartones
- [ ] Verificar balance de A aumenta (reembolso)
- [ ] Crear sala de Bingo con fuegos
- [ ] Usuario B se une con 2 cartones
- [ ] Verificar balance de fuegos disminuye visualmente
- [ ] Verificar logs de Railway muestran balances correctos
- [ ] Verificar tabla wallet_transactions tiene registros correctos

---

## 🎯 CONCLUSIÓN

**Problema:** Balance no se actualizaba visualmente al comprar cartones de Bingo, causando confusión y sensación de que la compra no se procesó.

**Causa:** Backend deducía correctamente pero no devolvía el balance actualizado. Frontend no tenía forma de actualizar la UI sin recargar.

**Solución:** Backend ahora devuelve `updatedBalance` en respuestas de compra/ajuste de cartones. Frontend actualiza el contexto de usuario inmediatamente al recibirlo.

**Resultado:** Balance se actualiza visualmente al instante, mejorando significativamente la experiencia de usuario y eliminando la confusión.

---

**Status:** ✅ Implementado - Listo para commit y deploy  
**Testing:** Pendiente verificación en producción  
