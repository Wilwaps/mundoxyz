# 🐛 BUG: Modal No Muestra Precios de Números

## 📋 Descripción

El modal de compra no mostraba el precio por número ni el total a pagar. Solo se veían los iconos 🔥 o 🪙 sin las cantidades numéricas.

### Impacto

- ❌ Usuario no podía ver cuánto costaría comprar números
- ❌ Usuario no sabía si tenía saldo suficiente
- ❌ Experiencia de usuario confusa
- ❌ Imposible tomar decisión de compra informada

## 🔍 Causa Raíz

El componente `PurchaseModal.tsx` usaba la propiedad **incorrecta** para obtener el precio:

### Código Incorrecto (línea 58)

```typescript
const totalCost = selectedNumbers.length * (raffle?.entryPrice || 0);
```

### Problema

La propiedad `raffle?.entryPrice` **no existe** en la estructura de datos de la rifa.

Según el backend (`RaffleServiceV2.js` línea 776-777), las propiedades correctas son:
- `entryPriceFire` - Precio en fuegos
- `entryPriceCoin` - Precio en monedas

## ✅ Solución Implementada

### 1. Calcular Precio Según Modo de Rifa

```typescript
const pricePerNumber = raffle?.mode === 'fires' 
  ? (raffle?.entryPriceFire || 0) 
  : (raffle?.entryPriceCoin || 0);
const totalCost = selectedNumbers.length * pricePerNumber;
```

### 2. Usar Variable en el Modal

```typescript
<div className="flex justify-between text-sm">
  <span className="text-text/60">Precio por número:</span>
  <span className="text-text">
    {pricePerNumber} {raffle?.mode === 'fires' ? '🔥' : '🪙'}
  </span>
</div>
```

## 📂 Archivos Modificados

1. **frontend/src/features/raffles/components/PurchaseModal.tsx**
   - Líneas 58-61: Cálculo correcto del precio por número
   - Línea 423: Uso de `pricePerNumber` en lugar de `raffle?.entryPrice`

## 🧪 Casos de Prueba

### Caso 1: Rifa Modo Fuegos
```
Rifa: { mode: 'fires', entryPriceFire: 10 }
Números seleccionados: 3

Resultado esperado:
- Precio por número: 10 🔥
- Total a pagar: 30 🔥
```

### Caso 2: Rifa Modo Monedas
```
Rifa: { mode: 'coins', entryPriceCoin: 5 }
Números seleccionados: 5

Resultado esperado:
- Precio por número: 5 🪙
- Total a pagar: 25 🪙
```

## 🎯 Resultado

✅ El modal ahora muestra correctamente:
- Precio por número con valor numérico
- Total a pagar calculado correctamente
- Balance del usuario
- Indicador visual si el balance es suficiente

---

**Autor**: Cascade AI  
**Fecha**: 2025-11-09  
**Módulo**: Sistema de Rifas V2 - Frontend  
**Prioridad**: 🔴 ALTA (bloquea UX de compra)  
**Tipo**: Bug Fix / Display Issue
