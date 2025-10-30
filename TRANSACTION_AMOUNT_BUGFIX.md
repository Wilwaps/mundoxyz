# 🐛 Bug Fix Crítico: Transacciones de Apuesta con Signo Incorrecto

**Fecha**: 29 de Octubre, 2025  
**Módulo**: Wallet Transactions - TicTacToe  
**Severidad**: 🔴 **CRÍTICA** (Economía del juego rota)  
**Estado**: ✅ Resuelto

---

## 🚨 Problema Identificado

### **Síntoma Reportado:**
Los usuarios reportaron que en su historial de transacciones **solo aparecen aumentos** (flechas verdes), nunca pérdidas. Esto hacía parecer que "nadie está perdiendo dinero" en el juego.

### **Evidencia:**
- Usuario prueba1: Solo transacciones positivas en historial
- Usuario prueba2: Solo transacciones positivas en historial
- Ambos jugaron múltiples partidas pero el historial no reflejaba pérdidas

---

## 🔍 Análisis de Root Cause

### **Bug Encontrado:**

En `backend/routes/tictactoe.js`, las transacciones de tipo `game_bet` (apuestas) se estaban registrando con **amount POSITIVO** cuando deberían ser **NEGATIVO**.

**Ubicaciones del bug:**

1. **Crear sala** (línea 94):
```javascript
// ❌ ANTES (INCORRECTO)
[userId, mode, betAmount, balance, balance - betAmount]
//             ↑ Positivo (Ej: 1.0)

// ✅ DESPUÉS (CORRECTO)
[userId, mode, -betAmount, balance, balance - betAmount]
//             ↑ Negativo (Ej: -1.0)
```

2. **Unirse a sala** (línea 244):
```javascript
// ❌ ANTES
[userId, room.mode, betAmount, balance, balance - betAmount, code]

// ✅ DESPUÉS
[userId, room.mode, -betAmount, balance, balance - betAmount, code]
```

3. **Revancha** (línea 728):
```javascript
// ❌ ANTES
[playerId, currency, betAmount, balance, balance - betAmount, newRematchCount, code]

// ✅ DESPUÉS
[playerId, currency, -betAmount, balance, balance - betAmount, newRematchCount, code]
```

---

## 📊 Impacto del Bug

### **Antes del Fix:**

**Flujo de transacciones para un jugador que PIERDE:**
```
1. Crear sala: game_bet → amount: +1.0 Fire ❌ (debería ser -1.0)
2. Pierde partida: (ninguna transacción adicional)
3. Historial muestra: +1.0 Fire ❌

PROBLEMA: Parece que ganó 1 Fire cuando en realidad perdió 1 Fire
```

**Flujo de transacciones para un jugador que GANA:**
```
1. Unirse a sala: game_bet → amount: +1.0 Fire ❌ (debería ser -1.0)
2. Gana partida: game_win → amount: +2.0 Fires ✅
3. Historial muestra: +1.0 + 2.0 = +3.0 Fires ❌

PROBLEMA: Parece que ganó 3 Fires cuando en realidad ganó 1 Fire neto
```

### **Después del Fix:**

**Flujo de transacciones para un jugador que PIERDE:**
```
1. Crear sala: game_bet → amount: -1.0 Fire ✅
2. Pierde partida: (ninguna transacción adicional)
3. Historial muestra: -1.0 Fire ✅

CORRECTO: Refleja la pérdida de 1 Fire
```

**Flujo de transacciones para un jugador que GANA:**
```
1. Unirse a sala: game_bet → amount: -1.0 Fire ✅
2. Gana partida: game_win → amount: +2.0 Fires ✅
3. Historial muestra: -1.0 + 2.0 = +1.0 Fire ✅

CORRECTO: Refleja la ganancia neta de 1 Fire
```

---

## 💰 Convención de Transacciones

### **Estándar adoptado:**

| Tipo de Transacción | Amount | Ejemplo | Descripción |
|---------------------|--------|---------|-------------|
| `game_bet` | **Negativo** | -1.0 | Apuesta realizada (pérdida) |
| `game_win` | **Positivo** | +2.0 | Premio recibido (ganancia) |
| `game_refund` | **Positivo** | +0.5 | Devolución en empate (recuperación) |
| `refund` | **Positivo** | +1.0 | Devolución por cancelación (recuperación) |
| `purchase` | **Negativo** | -10.0 | Compra en mercado (gasto) |
| `reward` | **Positivo** | +5.0 | Recompensa/premio (ingreso) |
| `transfer_out` | **Negativo** | -3.0 | Transferencia enviada (pérdida) |
| `transfer_in` | **Positivo** | +3.0 | Transferencia recibida (ganancia) |

**Regla General:**
- ✅ **Amount > 0**: El usuario RECIBE dinero (gana, recupera, recibe)
- ❌ **Amount < 0**: El usuario PIERDE dinero (apuesta, gasta, envía)

---

## 🔧 Cambios Implementados

### **Archivo Modificado:**
`backend/routes/tictactoe.js`

### **Cambio 1: Crear Sala** (línea 94)
```javascript
// Registrar transacción (amount negativo para apuestas)
await client.query(
  `INSERT INTO wallet_transactions (...) VALUES (...)`,
  [userId, mode, -betAmount, balance, balance - betAmount]  // Agregado signo negativo
);
```

### **Cambio 2: Unirse a Sala** (línea 244)
```javascript
// Registrar transacción (amount negativo para apuestas)
await client.query(
  `INSERT INTO wallet_transactions (...) VALUES (...)`,
  [userId, room.mode, -betAmount, balance, balance - betAmount, code]  // Agregado signo negativo
);
```

### **Cambio 3: Revancha** (línea 728)
```javascript
await client.query(
  `INSERT INTO wallet_transactions (...) VALUES (...)`,
  [playerId, currency, -betAmount, balance, balance - betAmount, newRematchCount, code]  // Agregado signo negativo
);
```

---

## 🧪 Casos de Prueba

### **Test 1: Usuario Pierde Partida**
1. Usuario A crea sala con 1 Fire
2. Usuario B se une
3. Usuario B gana
4. **Verificar historial Usuario A**:
   - Transacción 1: game_bet → -1.0 Fire ✅
   - Balance final: -1.0 Fire neto ✅

### **Test 2: Usuario Gana Partida**
1. Usuario A crea sala con 1 Fire
2. Usuario B se une
3. Usuario A gana
4. **Verificar historial Usuario A**:
   - Transacción 1: game_bet → -1.0 Fire ✅
   - Transacción 2: game_win → +2.0 Fires ✅
   - Balance final: +1.0 Fire neto ✅

### **Test 3: Empate**
1. Usuario A crea sala con 1 Fire
2. Usuario B se une
3. Termina en empate
4. **Verificar historial ambos usuarios**:
   - Transacción 1: game_bet → -1.0 Fire ✅
   - Transacción 2: game_refund → +0.5 Fire ✅
   - Balance final: -0.5 Fire neto (perdieron 50% cada uno) ✅

### **Test 4: Múltiples Revanchas**
1. Jugar 5 revanchas consecutivas
2. Usuario A gana 3, Usuario B gana 2
3. **Verificar historial Usuario A**:
   - 5 × game_bet: -5.0 Fires
   - 3 × game_win: +6.0 Fires
   - Balance final: +1.0 Fire neto ✅

---

## ⚠️ Impacto en Producción

### **Datos Históricos:**

**IMPORTANTE**: Las transacciones anteriores a este fix tienen `amount` incorrecto:
- Todas las apuestas (`game_bet`) en DB tienen `amount > 0` (incorrecto)
- Para mostrar el historial correcto, se necesita:
  1. **Migración de datos** (invertir signo de game_bet históricos)
  2. **O ajuste en la UI** para interpretar el tipo de transacción

### **Opción 1: Migración SQL (Recomendada)**
```sql
-- Invertir signo de todas las transacciones game_bet existentes
UPDATE wallet_transactions
SET amount = -amount
WHERE type = 'game_bet' 
  AND amount > 0;
```

### **Opción 2: Ajuste en Frontend**
```javascript
// En el componente que muestra historial
const displayAmount = transaction.type === 'game_bet' && transaction.amount > 0
  ? -transaction.amount  // Corregir transacciones viejas
  : transaction.amount;
```

---

## 📈 Verificación Post-Deploy

**Después del despliegue, verificar:**

1. ✅ Nuevas apuestas se registran con `amount < 0`
2. ✅ Victorias se registran con `amount > 0`
3. ✅ Historial de transacciones muestra correctamente ganancias y pérdidas
4. ✅ Balance de usuarios es consistente

**SQL para verificar:**
```sql
-- Ver últimas transacciones de apuestas
SELECT 
  user_id,
  type,
  amount,
  description,
  created_at
FROM wallet_transactions
WHERE type = 'game_bet'
ORDER BY created_at DESC
LIMIT 20;

-- Debe mostrar amount negativo para todas las nuevas apuestas
```

---

## 🚀 Despliegue

**Commit**: `fix: corregir signo de transacciones game_bet a negativo`

**Testing**:
1. Deploy en Railway (6 minutos)
2. Jugar partida con Chrome DevTools
3. Verificar historial de transacciones
4. Confirmar amounts correctos

---

## 📚 Lecciones Aprendidas

1. **Convenciones Claras**: Definir desde el inicio qué significa un `amount` positivo vs negativo
2. **Testing de Economía**: Casos de prueba exhaustivos para flujos de dinero
3. **Auditoría de Transacciones**: Revisar periódicamente la consistencia de transacciones
4. **Documentación**: Mantener documentada la estructura de `wallet_transactions`

---

## 🔮 Mejoras Futuras

1. **Script de Migración**: Corregir transacciones históricas en producción
2. **Constraint de DB**: Agregar check constraint para validar signos según tipo
3. **Dashboard de Admin**: Panel para auditar transacciones inconsistentes
4. **Tests Automatizados**: Unit tests para verificar signos de transacciones

---

**Desarrollado por**: Cascade AI  
**Severidad**: 🔴 Crítica  
**Status**: ✅ Resuelto  
**Ready for Production**: ✅
