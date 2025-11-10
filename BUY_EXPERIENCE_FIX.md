# FIX: Experiencia No Se Acredita Visualmente Después de Compra

**Fecha:** 9 Nov 2025 5:30pm  
**Commit:** `0c0bee9`  
**Usuario afectado:** prueba1 (y todos los usuarios)  
**Archivo:** `frontend/src/components/BuyExperienceModal.js`

---

## 🐛 PROBLEMA REPORTADO

Usuario **prueba1** compró 10 puntos de experiencia pero no se reflejaron en la UI del header.

**Síntomas:**
- ✅ Compra procesada exitosamente (backend)
- ✅ Coins y fires descontados correctamente
- ✅ Experiencia actualizada en base de datos
- ❌ **Badge de XP en header NO se actualiza**
- ❌ Usuario no ve su nueva experiencia hasta recargar página

---

## 🔍 CAUSA RAÍZ

El `BuyExperienceModal` después de una compra exitosa:

1. ✅ Invalida queries de React Query (`header-balance`, `profile`)
2. ❌ **NO actualiza el contexto del usuario** (`AuthContext`)

**Código problemático (líneas 60-62 ANTES):**
```javascript
// Invalidar queries para actualizar balances
queryClient.invalidateQueries(['header-balance']);
queryClient.invalidateQueries(['profile']);
```

**Problema:**
- `header-balance` query actualiza `coins_balance` y `fires_balance`
- **NO actualiza `experience`** porque esa query NO consulta experiencia
- El `AuthContext` mantiene el valor viejo de experiencia
- El badge de XP muestra el valor del contexto (desactualizado)

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **Cambio 1: Importar useAuth (línea 8)**
```javascript
import { useAuth } from '../contexts/AuthContext';
```

### **Cambio 2: Obtener updateUser (línea 14)**
```javascript
const { updateUser } = useAuth();
```

### **Cambio 3: Actualizar contexto en onSuccess (líneas 62-67)**
```javascript
// ANTES:
// Invalidar queries para actualizar balances
queryClient.invalidateQueries(['header-balance']);
queryClient.invalidateQueries(['profile']);

// DESPUÉS:
// Actualizar usuario en contexto con nueva experiencia y balances
updateUser({
  experience: data.newExperience,
  coins_balance: data.newCoinsBalance,
  fires_balance: data.newFiresBalance
});

// Invalidar queries para actualizar balances
queryClient.invalidateQueries(['header-balance']);
queryClient.invalidateQueries(['profile']);
```

---

## 📊 FLUJO TÉCNICO CORRECTO

### **Antes del Fix:**
```
Usuario compra 10 XP
    ↓
Backend procesa:
  - UPDATE users SET experience = experience + 10
  - Descuenta coins/fires
  - Devuelve { newExperience: 10, newCoinsBalance: 450, newFiresBalance: 9 }
    ↓
Frontend onSuccess:
  - queryClient.invalidateQueries() ✅
  - AuthContext NO se actualiza ❌
    ↓
UI muestra:
  - Coins: 450 ✅ (header-balance query)
  - Fires: 9 ✅ (header-balance query)
  - XP: 0 ❌ (AuthContext desactualizado)
```

### **Después del Fix:**
```
Usuario compra 10 XP
    ↓
Backend procesa:
  - UPDATE users SET experience = experience + 10
  - Descuenta coins/fires
  - Devuelve { newExperience: 10, newCoinsBalance: 450, newFiresBalance: 9 }
    ↓
Frontend onSuccess:
  - updateUser({ experience: 10, coins_balance: 450, fires_balance: 9 }) ✅
  - queryClient.invalidateQueries() ✅
    ↓
UI muestra:
  - Coins: 450 ✅
  - Fires: 9 ✅
  - XP: 10 ✅ (AuthContext actualizado inmediatamente)
```

---

## 🎯 DATOS ACTUALIZADOS

El backend devuelve en la respuesta exitosa:

```javascript
{
  success: true,
  xpGained: 10,
  newExperience: 10,           // ← XP total del usuario
  coinsSpent: 500,
  firesSpent: 10,
  newCoinsBalance: 450,        // ← Balance actualizado
  newFiresBalance: 9           // ← Balance actualizado
}
```

Ahora el frontend usa **todos** estos valores para actualizar el contexto inmediatamente.

---

## 🧪 TESTING

### **Test Manual (después de deploy):**

1. **Login como prueba1**
2. **Verificar balance inicial:**
   - XP: 0 (o el valor actual)
   - Coins: ≥ 500
   - Fires: ≥ 10

3. **Comprar 10 XP:**
   - Click en 🪙 → Modal de compra
   - Cantidad: 10
   - Confirmar compra

4. **Verificar actualización inmediata:**
   - ✅ Badge ⭐ debe mostrar: 10 XP (sin recargar)
   - ✅ Badge 🪙 debe mostrar: -500 coins
   - ✅ Badge 🔥 debe mostrar: -10 fires
   - ✅ Toast de éxito: "Con esta experiencia transforma tu camino..!"
   - ✅ Confetti animado

5. **Verificar persistencia:**
   - Recargar página
   - XP debe seguir en 10
   - Balances deben mantenerse

---

## 📝 ARCHIVOS MODIFICADOS

### `frontend/src/components/BuyExperienceModal.js`

**Línea 8 (import):**
```javascript
import { useAuth } from '../contexts/AuthContext';
```

**Línea 14 (hook):**
```javascript
const { updateUser } = useAuth();
```

**Líneas 62-67 (onSuccess):**
```javascript
// Actualizar usuario en contexto con nueva experiencia y balances
updateUser({
  experience: data.newExperience,
  coins_balance: data.newCoinsBalance,
  fires_balance: data.newFiresBalance
});
```

---

## 🚀 DEPLOYMENT

**Commit:** `0c0bee9`  
**Mensaje:** "fix: actualizar contexto usuario con experiencia después de compra exitosa"  
**Branch:** main  
**Status:** ✅ Pushed to GitHub  
**Railway:** Deploy automático en curso  
**ETA:** ~5:36pm (6 minutos)

---

## 🔗 CONTEXTO TÉCNICO

### **AuthContext.updateUser():**

Función que actualiza el estado global del usuario:

```javascript
const updateUser = (updates) => {
  setUser((prevUser) => ({
    ...prevUser,
    ...updates
  }));
};
```

**Características:**
- ✅ Merge de propiedades (no sobrescribe todo el objeto)
- ✅ React re-renderiza componentes que usan `useAuth()`
- ✅ Cambios visibles inmediatamente
- ✅ Persiste hasta refresh o logout

### **Por qué invalidateQueries NO es suficiente:**

- `queryClient.invalidateQueries()` marca queries como "stale"
- React Query las refetchea **en el próximo render** o cuando el componente que las usa se monta
- **El badge de XP en Layout NO usa React Query**, usa directamente `user.experience` del contexto
- Por eso necesitamos actualizar el contexto directamente

---

## ✅ IMPACTO DEL FIX

### **Para el Usuario:**
- ✅ Experiencia se actualiza **inmediatamente** después de compra
- ✅ No necesita recargar página
- ✅ Feedback visual instantáneo
- ✅ Mejor UX

### **Para el Sistema:**
- ✅ Consistencia entre backend y frontend
- ✅ AuthContext sincronizado con base de datos
- ✅ Queries de React Query también se actualizan
- ✅ Sin efectos secundarios negativos

---

## 📌 CASO DEL USUARIO PRUEBA1

### **Situación Actual:**

Usuario prueba1 realizó compra de 10 XP:
- ✅ Backend procesó la transacción
- ✅ Experiencia = 10 en base de datos
- ❌ Frontend mostraba 0 XP (contexto desactualizado)

### **Después del Deploy:**

Al hacer **nueva compra** (ej: 5 XP más):
- ✅ Experiencia se actualizará a 15 XP inmediatamente
- ✅ El fix aplica para todas las compras futuras

**IMPORTANTE:** La compra anterior (10 XP) **SÍ se procesó** en la base de datos. El usuario solo necesita recargar la página para verla, o hacer una nueva compra después del deploy.

---

## 🔍 VERIFICACIÓN POST-DEPLOY

Con Chrome DevTools:

1. **Abrir DevTools en producción**
2. **Login como prueba1**
3. **Verificar experiencia actual:**
   ```javascript
   // En Console:
   JSON.parse(localStorage.getItem('user')).experience
   ```
4. **Comprar 5 XP adicionales**
5. **Verificar actualización inmediata:**
   - Badge ⭐ debe cambiar sin recargar
   - Console debe mostrar request exitoso
6. **Verificar en DB (opcional):**
   - Query: `SELECT experience FROM users WHERE username = 'prueba1'`

---

## 📚 LECCIONES APRENDIDAS

### **Problema General:**

Cuando un modal hace una mutación que afecta el estado global del usuario:

1. ❌ **NO es suficiente** con invalidar queries
2. ✅ **DEBE** actualizar el contexto directamente
3. ✅ Usar `updateUser()` del `AuthContext`

### **Patrón Correcto:**

```javascript
const { updateUser } = useAuth();

const mutation = useMutation({
  onSuccess: (data) => {
    // 1. Actualizar contexto primero
    updateUser({
      campo1: data.nuevoValor1,
      campo2: data.nuevoValor2
    });
    
    // 2. Invalidar queries (para otros componentes)
    queryClient.invalidateQueries(['key']);
    
    // 3. Feedback al usuario
    toast.success('Operación exitosa');
  }
});
```

### **Aplicable a:**

- ✅ Compra de experiencia
- ✅ Compra de items en Market
- ✅ Transferencias de monedas/fuegos
- ✅ Actualización de perfil
- ✅ Cualquier operación que modifique `users` table

---

## ✅ ESTADO FINAL

- ✅ Fix implementado y testeado localmente
- ✅ Commit y push exitoso
- ✅ Deploy Railway en curso
- ✅ Documentación completa generada
- ⏳ Pendiente: Testing en producción con prueba1

---

**El problema de la experiencia no acreditada está resuelto. Después del deploy, todas las compras futuras actualizarán la UI inmediatamente.** 🎉
