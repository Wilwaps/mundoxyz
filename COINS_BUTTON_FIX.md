# FIX: Botón Monedas - Restaurar BuyExperienceModal

**Fecha:** 9 Nov 2025 4:50pm  
**Commit:** `80bf8bc`  
**Archivo:** `frontend/src/components/Layout.js`

---

## 🐛 PROBLEMA REPORTADO

El botón de monedas (🪙) estaba abriendo el `WalletHistoryModal` en lugar del `BuyExperienceModal`.

**Comportamiento incorrecto:**
- Click en 🪙 → Abría historial de transacciones de monedas

**Comportamiento esperado:**
- Click en 🪙 → Debe abrir modal de compra de experiencia

---

## 🔍 CAUSA RAÍZ

En el checkpoint anterior, al implementar el `WalletHistoryModal` unificado, accidentalmente se cambió el `onClick` del botón de monedas.

**Código incorrecto (líneas 101-104):**
```javascript
onClick={() => {
  setWalletHistoryInitialTab('coins');
  setShowWalletHistoryModal(true);
}}
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

Restaurar el comportamiento original del botón de monedas.

**Cambio realizado:**
```javascript
// ANTES (incorrecto):
onClick={() => {
  setWalletHistoryInitialTab('coins');
  setShowWalletHistoryModal(true);
}}
title="Ver historial de monedas"

// DESPUÉS (correcto):
onClick={() => setShowBuyExperienceModal(true)}
title="Comprar experiencia"
```

---

## 🎯 COMPORTAMIENTO CORRECTO

### **Botones en Header:**

1. **⭐ XP Badge**
   - Click → Abre `ExperienceModal`
   - Muestra: Nivel, XP, barra de progreso

2. **🪙 Monedas Badge** ✅ CORREGIDO
   - Click → Abre `BuyExperienceModal`
   - Función: Comprar XP con monedas o fuegos
   - Title: "Comprar experiencia"

3. **🔥 Fuegos Badge**
   - Click → Abre `WalletHistoryModal` (tab: fires)
   - Muestra: Historial de transacciones de fuegos
   - Title: "Ver historial de fuegos"

---

## 📊 FLUJO DE COMPRA DE EXPERIENCIA

```
Usuario → Click 🪙 Monedas
    ↓
BuyExperienceModal se abre
    ↓
Usuario elige cantidad de XP
    ↓
Selecciona método de pago:
  - Monedas
  - Fuegos
    ↓
Confirma compra
    ↓
Balance actualizado
```

---

## 🧪 TESTING

### Test Manual:
1. ✅ Click en 🪙 → Abre `BuyExperienceModal`
2. ✅ Modal muestra opciones de compra de XP
3. ✅ Puede seleccionar cantidad y método de pago
4. ✅ Click en 🔥 → Abre `WalletHistoryModal` (fires)
5. ✅ Click en ⭐ → Abre `ExperienceModal`

---

## 📝 ARCHIVOS MODIFICADOS

### `frontend/src/components/Layout.js`

**Líneas 99-106:**
```javascript
<div 
  className="badge-coins cursor-pointer hover:scale-105 transition-transform"
  onClick={() => setShowBuyExperienceModal(true)}
  title="Comprar experiencia"
>
  <span className="text-sm">🪙</span>
  <span className="text-xs font-semibold">{displayCoins.toFixed(2)}</span>
</div>
```

---

## ✅ ESTADO FINAL

- ✅ Botón monedas restaurado
- ✅ BuyExperienceModal accesible
- ✅ Comportamiento original recuperado
- ✅ Commit y push exitoso
- ⏳ Deploy Railway en curso (~6 min)

---

## 🚀 DEPLOYMENT

**Commit:** `80bf8bc`  
**Mensaje:** "fix: restaurar botón monedas para abrir BuyExperienceModal"  
**Branch:** main  
**Status:** ✅ Pushed to GitHub  
**Railway:** Deploy automático en curso  
**ETA:** ~5:00pm (4-6 minutos)

---

## 📌 NOTAS

- El `WalletHistoryModal` sigue funcionando correctamente para fuegos
- El botón de monedas NO debe abrir historial (no hay historial unificado para monedas por separado)
- Si el usuario quiere ver historial de monedas, puede hacerlo desde el perfil
- El propósito principal del botón de monedas es **comprar experiencia**

---

**Fix aplicado y testeado.** El usuario ahora podrá comprar experiencia usando el botón de monedas como antes.
