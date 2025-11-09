# FEATURE: Modal de Historial de Wallet Unificado

**Fecha:** 9 Nov 2025 3:10pm  
**Tipo:** Mejora UX - Unificación de funcionalidades  
**Problema resuelto:** Transacciones de monedas no eran visibles

---

## 🎯 PROBLEMA ANTERIOR

### Síntomas:

- ❌ **Solo existía `FiresHistoryModal`** que mostraba transacciones de fuegos
- ❌ **NO había forma de ver transacciones de monedas**
- ❌ **Transacciones de Bingo con monedas eran invisibles** para el usuario
- ❌ **Botón de monedas (🪙) abría `BuyExperienceModal`**, no historial

### Consecuencias:

El usuario reportó: *"no se están registrando las transacciones de monedas en el historial"*

**Realidad:** Las transacciones **SÍ se registraban**, pero no había dónde verlas:
- ✅ Transacciones de Bingo con fuegos → Visibles en FiresHistoryModal
- ❌ Transacciones de Bingo con monedas → No había modal para verlas

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Nuevo Componente: `WalletHistoryModal`

Modal unificado con **tabs para Monedas y Fuegos**, reemplazando al antiguo `FiresHistoryModal`.

#### Características:

**1. Tabs Dinámicos:**
```javascript
const [activeTab, setActiveTab] = useState(initialTab); // 'coins' | 'fires'

// Query dinámica según tab activo
const response = await axios.get(`/api/profile/${user.id}/transactions`, {
  params: {
    currency: activeTab, // ✅ 'coins' o 'fires' según tab
    limit: pageSize,
    offset: page * pageSize
  }
});
```

**2. Prop `initialTab`:**
```javascript
<WalletHistoryModal 
  isOpen={showWalletHistoryModal}
  onClose={() => setShowWalletHistoryModal(false)}
  initialTab={walletHistoryInitialTab}  // ✅ Abre en tab específico
/>
```

**3. Labels para Transacciones de Bingo:**
```javascript
const getTransactionLabel = (type) => {
  const labels = {
    // ... otros tipos ...
    bingo_card_purchase: 'Compra Cartón Bingo',    // ✅ NUEVO
    bingo_card_refund: 'Reembolso Bingo',          // ✅ NUEVO
    experience_purchase: 'Compra de Experiencia'   // ✅ NUEVO
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
```

**4. Tipos de Transacción Debit Actualizados:**
```javascript
const isDebitTransaction = (type) => {
  const debitTypes = [
    'transfer_out',
    'game_bet',
    'tictactoe_bet',
    'commission',
    'raffle_cost',
    'raffle_number_purchase',
    'market_redeem',
    'fire_burn',
    'bingo_card_purchase',       // ✅ NUEVO
    'experience_purchase'         // ✅ NUEVO
  ];
  // ...
};
```

---

## 🔄 CAMBIOS EN LAYOUT.JS

### Antes:

**Botón de Monedas:**
```javascript
<div 
  className="badge-coins"
  onClick={() => setShowBuyExperienceModal(true)}  // ❌ Abría compra de XP
  title="Comprar experiencia"
>
```

**Botón de Fuegos:**
```javascript
<div 
  className="badge-fire"
  onClick={() => setShowFiresHistoryModal(true)}  // ❌ Solo fuegos
  title="Ver historial de fuegos"
>
```

---

### Después:

**Botón de Monedas:**
```javascript
<div 
  className="badge-coins cursor-pointer hover:scale-105 transition-transform"
  onClick={() => {
    setWalletHistoryInitialTab('coins');  // ✅ Abre tab de monedas
    setShowWalletHistoryModal(true);
  }}
  title="Ver historial de monedas"        // ✅ Nuevo tooltip
>
```

**Botón de Fuegos:**
```javascript
<div 
  className="badge-fire cursor-pointer hover:scale-105 transition-transform"
  onClick={() => {
    setWalletHistoryInitialTab('fires');  // ✅ Abre tab de fuegos
    setShowWalletHistoryModal(true);
  }}
  title="Ver historial de fuegos"
>
```

**Estado:**
```javascript
// ANTES:
const [showFiresHistoryModal, setShowFiresHistoryModal] = useState(false);

// DESPUÉS:
const [showWalletHistoryModal, setShowWalletHistoryModal] = useState(false);
const [walletHistoryInitialTab, setWalletHistoryInitialTab] = useState('fires');
```

**Imports:**
```javascript
// ANTES:
import FiresHistoryModal from './FiresHistoryModal';

// DESPUÉS:
import WalletHistoryModal from './WalletHistoryModal';
```

---

## 🎨 INTERFAZ DE USUARIO

### Tabs:

```
┌─────────────────────────────────────────┐
│  🕐 Historial de Wallet            ✕   │
├─────────────────────────────────────────┤
│  ┌─────────────┬─────────────┐         │
│  │ 🪙 Monedas  │ 🔥 Fuegos   │         │  ← Tabs
│  └─────────────┴─────────────┘         │
├─────────────────────────────────────────┤
│  (Botones de acción - solo en Fuegos)  │
├─────────────────────────────────────────┤
│  📋 Lista de transacciones              │
│                                          │
│  • Compra Cartón Bingo     -300 🪙      │
│  • Reembolso Bingo         +100 🪙      │
│  • Bono de Bienvenida     +1000 🪙      │
└─────────────────────────────────────────┘
```

### Tab de Monedas (coins):
- ✅ Muestra transacciones con `currency='coins'`
- ✅ Icono 🪙 en los montos
- ✅ Incluye: Bingo, experiencia, bonos, etc.
- ❌ **NO muestra** botones de acción (Enviar/Comprar/Recibir)

### Tab de Fuegos (fires):
- ✅ Muestra transacciones con `currency='fires'`
- ✅ Icono 🔥 en los montos
- ✅ Incluye: Bingo, TicTacToe, transferencias, etc.
- ✅ **SÍ muestra** botones de acción (Enviar/Comprar/Recibir)

---

## 📊 FLUJO COMPLETO

### Caso 1: Ver transacciones de Monedas

```
Usuario hace clic en 🪙 en header
   ↓
Layout detecta clic
   ↓
setWalletHistoryInitialTab('coins')
setShowWalletHistoryModal(true)
   ↓
WalletHistoryModal se abre
   ↓
activeTab = 'coins'
   ↓
Query: /api/profile/${user.id}/transactions?currency=coins
   ↓
Muestra transacciones:
  • Compra Cartón Bingo -300 🪙
  • Reembolso Bingo +200 🪙
  • Bono de Bienvenida +1000 🪙
  • Compra de Experiencia -50 🪙
```

### Caso 2: Ver transacciones de Fuegos

```
Usuario hace clic en 🔥 en header
   ↓
Layout detecta clic
   ↓
setWalletHistoryInitialTab('fires')
setShowWalletHistoryModal(true)
   ↓
WalletHistoryModal se abre
   ↓
activeTab = 'fires'
   ↓
Query: /api/profile/${user.id}/transactions?currency=fires
   ↓
Muestra transacciones:
  • Compra Cartón Bingo -100 🔥
  • Victoria TicTacToe +200 🔥
  • Transferencia enviada -50 🔥
  • Compra de Fuegos +1000 🔥
```

### Caso 3: Cambiar entre Tabs

```
Usuario en tab de Fuegos
   ↓
Hace clic en tab "Monedas"
   ↓
handleTabChange('coins')
   ↓
setActiveTab('coins')
setPage(0)  // Reset paginación
   ↓
React Query detecta cambio en queryKey
   ↓
Realiza nueva query con currency='coins'
   ↓
Muestra transacciones de monedas
```

---

## 🔍 TIPOS DE TRANSACCIÓN POR CURRENCY

### Monedas (🪙 coins):

| Tipo | Label | Debit/Credit |
|------|-------|--------------|
| `bingo_card_purchase` | Compra Cartón Bingo | Debit (-) |
| `bingo_card_refund` | Reembolso Bingo | Credit (+) |
| `welcome_bonus` | Bono de Bienvenida | Credit (+) |
| `game_reward` | Premio de Juego | Credit (+) |
| `experience_purchase` | Compra de Experiencia | Debit (-) |

### Fuegos (🔥 fires):

| Tipo | Label | Debit/Credit |
|------|-------|--------------|
| `bingo_card_purchase` | Compra Cartón Bingo | Debit (-) |
| `bingo_card_refund` | Reembolso Bingo | Credit (+) |
| `tictactoe_bet` | Apuesta TicTacToe | Debit (-) |
| `tictactoe_win` | Victoria TicTacToe | Credit (+) |
| `tictactoe_draw` | Empate TicTacToe | Credit (+) |
| `tictactoe_refund` | Devolución TicTacToe | Credit (+) |
| `transfer_out` | Enviado | Debit (-) |
| `transfer_in` | Recibido | Credit (+) |
| `fire_purchase` | Compra de Fuegos | Credit (+) |
| `commission` | Comisión | Debit (-) |

---

## 📝 ARCHIVOS MODIFICADOS

### 1. `frontend/src/components/WalletHistoryModal.js` ✨ NUEVO
**Cambios:**
- Creado nuevo componente unificado
- Tabs para coins y fires
- Query dinámica según activeTab
- Labels para transacciones de Bingo
- Botones de acción solo en tab de fuegos
- Reset de paginación al cambiar tab

### 2. `frontend/src/components/Layout.js`
**Cambios:**
- **Import:** `FiresHistoryModal` → `WalletHistoryModal`
- **Estado:** Agregado `showWalletHistoryModal` y `walletHistoryInitialTab`
- **Botón monedas:** onClick abre modal con tab='coins'
- **Botón fuegos:** onClick abre modal con tab='fires'
- **Render:** Usa `WalletHistoryModal` con prop `initialTab`

---

## ✅ BENEFICIOS

### UX:

- ✅ **Visibilidad Total:** Usuario puede ver TODAS sus transacciones
- ✅ **Organización Clara:** Separación coins/fires con tabs
- ✅ **Contexto Preservado:** Sabe qué está viendo en cada momento
- ✅ **Navegación Intuitiva:** Clic en badge → Abre en tab correcto
- ✅ **Consistencia:** Mismo diseño para ambas currencies
- ✅ **Información Completa:** Muestra balance después de cada transacción

### Técnico:

- ✅ **Código Unificado:** Un solo modal en lugar de dos
- ✅ **Reutilización:** Misma lógica para ambas currencies
- ✅ **Escalable:** Fácil agregar nuevos tipos de transacción
- ✅ **Mantenible:** Cambios en un solo lugar
- ✅ **React Query:** Cache automático y refetch periódico

### Económico:

- ✅ **Transparencia:** Usuario ve exactamente qué ocurre con su dinero
- ✅ **Confianza:** Puede verificar todas las operaciones
- ✅ **Auditoría:** Historial completo siempre disponible

---

## 🧪 TESTING POST-DEPLOY

### Test 1: Historial de Monedas

**Pasos:**
1. [ ] Hacer clic en badge 🪙 en header
2. [ ] Verificar que modal se abre en tab "Monedas"
3. [ ] Verificar que muestra transacciones de monedas:
   - [ ] Compra Cartón Bingo (salas de monedas)
   - [ ] Reembolso Bingo
   - [ ] Bono de Bienvenida
   - [ ] Compra de Experiencia
4. [ ] Verificar que NO muestra botones de acción
5. [ ] Verificar iconos 🪙 en los montos
6. [ ] Verificar balance_after correcto

### Test 2: Historial de Fuegos

**Pasos:**
1. [ ] Hacer clic en badge 🔥 en header
2. [ ] Verificar que modal se abre en tab "Fuegos"
3. [ ] Verificar que muestra transacciones de fuegos:
   - [ ] Compra Cartón Bingo (salas de fuegos)
   - [ ] Reembolso Bingo
   - [ ] Victoria TicTacToe
   - [ ] Transferencias
   - [ ] Compra de Fuegos
4. [ ] Verificar que SÍ muestra botones de acción
5. [ ] Verificar iconos 🔥 en los montos
6. [ ] Verificar balance_after correcto

### Test 3: Cambio de Tabs

**Pasos:**
1. [ ] Abrir modal desde badge de fuegos (tab fires)
2. [ ] Hacer clic en tab "Monedas"
3. [ ] Verificar que cambia a transacciones de monedas
4. [ ] Verificar que paginación se resetea
5. [ ] Hacer clic en tab "Fuegos"
6. [ ] Verificar que vuelve a transacciones de fuegos

### Test 4: Paginación

**Pasos:**
1. [ ] Abrir modal (cualquier tab)
2. [ ] Si hay más de 25 transacciones, verificar paginación
3. [ ] Navegar a página 2
4. [ ] Cambiar de tab
5. [ ] Verificar que vuelve a página 1

### Test 5: Refetch Automático

**Pasos:**
1. [ ] Abrir modal de monedas
2. [ ] Realizar una transacción de monedas (comprar XP)
3. [ ] Esperar 5 segundos (refetch automático)
4. [ ] Verificar que nueva transacción aparece
5. [ ] Repetir con fuegos (enviar/recibir)

---

## 🎯 CONCLUSIÓN

**Problema:** Transacciones de monedas no eran visibles porque solo existía modal de fuegos.

**Solución:** Modal unificado `WalletHistoryModal` con tabs para coins y fires.

**Resultado:** Usuario ahora puede ver TODAS sus transacciones organizadas y con contexto claro.

**Impacto:**
- ✅ Mejora significativa en transparencia económica
- ✅ Mejor UX y confianza del usuario
- ✅ Código más limpio y mantenible

---

**Status:** ✅ Implementado - Listo para commit y deploy  
**Testing:** Pendiente verificación en producción  
