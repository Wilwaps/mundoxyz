# 🚨 BUG CRÍTICO: DUPLICACIÓN DE FUEGOS EN COMPRA DE RIFAS

**Severidad:** CATASTRÓFICA  
**Tipo:** Exploit de Economía - Generación Infinita de Fuegos  
**Fecha Detectada:** 2025-11-06  
**Estado:** EN INVESTIGACIÓN

---

## DESCRIPCIÓN DEL PROBLEMA

Los usuarios pueden duplicar/multiplicar sus fuegos al comprar números de rifa, causando:
- ✅ Generación infinita de currency
- ✅ Colapso de economía del sistema
- ✅ Exploit masivo

**Palabra que define esto:** **DESASTRE ECONÓMICO**

---

## EVIDENCIA

Historial de Fuegos muestra múltiples transacciones duplicadas para la misma compra.

---

## CAUSA RAÍZ (INVESTIGACIÓN)

### 1. DESAJUSTE FRONTEND-BACKEND

**Frontend** (`RaffleRoom.js` línea 84-86):
```javascript
body: JSON.stringify({
  raffle_id: raffle.id,
  number,           // ← SINGULAR
  captcha_data
})
```

**Backend** (`raffles.js` línea 217):
```javascript
const { 
  raffle_id, 
  numbers,          // ← ARRAY ESPERADO
  mode, 
  ...
} = req.body;
```

**PROBLEMA:** El frontend envía `number` (singular) pero el backend espera `numbers` (array).

### 2. POSIBLES CAUSAS DE DUPLICACIÓN

#### Hipótesis A: Doble Procesamiento
- El endpoint `/purchase` se llama DOS veces
- Retry automático de React Query
- Doble click del usuario

#### Hipótesis B: Loop Incorrecto
- `purchaseNumbers()` procesa el array con un loop
- Si `number` singular se convierte mal a array, puede duplicarse

#### Hipótesis C: Método Deprecado
- Existe `purchaseNumber()` (singular) deprecado
- Y también `purchaseNumbers()` (plural) nuevo
- Ambos se están llamando simultáneamente

---

## HOTFIX APLICADO

### Fix 1: Soporte Number Singular (Compatibilidad)

**Archivo:** `backend/routes/raffles.js`

```javascript
// ANTES (línea 217):
const { raffle_id, numbers, mode, ... } = req.body;

// DESPUÉS (línea 215-224):
let { 
    raffle_id, 
    number,      // ← Soporte legacy
    numbers,     // ← Soporte nuevo
    mode, 
    ...
} = req.body;

// CONVERTIR number singular a array (línea 235-237):
if (!numbers && number !== undefined) {
    numbers = [number];
}
```

**Resultado:** Ahora el backend acepta tanto `number` como `numbers`.

### Fix 2: Logging Exhaustivo

**Archivo:** `backend/services/RaffleService.js`

```javascript
async processFirePurchase(client, userId, raffleId, numberIdx, cost) {
    logger.info('🔥 processFirePurchase INICIADO', {
        userId, raffleId, numberIdx, cost, timestamp
    });
    
    // Descontar balance
    await client.query(...);
    
    logger.info('💰 BALANCE DESCONTADO', {
        userId, amount: cost, timestamp
    });
    
    // ... resto del código
}
```

**Resultado:** Cada operación de wallet queda registrada con timestamp para debugging.

---

## VERIFICACIÓN POST-HOTFIX

### Testing Manual Requerido:

1. **Compra Simple:**
   - Usuario con 100 🔥
   - Comprar 1 número (costo 10 🔥)
   - Verificar balance final: 90 🔥
   - Verificar logs: solo 1 llamada a `processFirePurchase`

2. **Compra Múltiple:**
   - Usuario con 100 🔥
   - Comprar 3 números (costo 10 🔥 c/u)
   - Verificar balance final: 70 🔥
   - Verificar logs: exactamente 3 llamadas (1 por número)

3. **Doble Click:**
   - Intentar double-click rápido en botón comprar
   - Verificar que solo se procese UNA compra
   - Verificar React Query no reintente automáticamente

4. **Historial de Fuegos:**
   - Verificar que no aparezcan transacciones duplicadas
   - Cada compra debe tener UN solo registro

---

## ACCIONES PENDIENTES

### Inmediatas (Ahora):
- ✅ Fix compatibilidad `number` → `numbers`
- ✅ Logging exhaustivo agregado
- ⏳ Deploy y monitoreo

### Corto Plazo (24h):
- [ ] Revisar todos los endpoints de wallet transactions
- [ ] Agregar rate limiting por usuario (max 1 compra cada 2 segundos)
- [ ] Implementar idempotency keys para evitar duplicados
- [ ] Deshabilitar botón de compra mientras procesa (frontend)

### Mediano Plazo (1 semana):
- [ ] Auditoría completa de economía:
  - Todas las transacciones de wallet
  - Detectar usuarios con balances sospechosos
  - Rollback de fuegos duplicados
- [ ] Implementar transaction_hash único por compra
- [ ] Agregar validaciones de integridad en wallet_transactions
- [ ] Testing automatizado de edge cases

---

## LOGS DE DEBUGGING

Buscar en Railway logs:
```bash
# Buscar llamadas duplicadas:
grep "processFirePurchase INICIADO" | grep <userId> | grep <timestamp>

# Buscar descuentos duplicados:
grep "BALANCE DESCONTADO" | grep <userId>

# Detectar usuarios con transacciones sospechosas:
SELECT user_id, COUNT(*) as txn_count 
FROM wallet_transactions 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id 
HAVING COUNT(*) > 50;
```

---

## MITIGACIÓN TEMPORAL

Si el bug persiste post-hotfix:

1. **Deshabilitar compras de rifas modo fires TEMPORALMENTE**
2. **Anuncio público:** "Sistema de rifas en mantenimiento por 2 horas"
3. **Rollback de transacciones fraudulentas:**
   ```sql
   -- Identificar transacciones duplicadas
   SELECT * FROM wallet_transactions 
   WHERE type = 'raffle_purchase' 
   AND created_at > '2025-11-06 08:00:00'
   ORDER BY user_id, created_at;
   
   -- Revertir fuegos duplicados (CUIDADO)
   UPDATE wallets 
   SET fires_balance = fires_balance - <monto_duplicado>
   WHERE user_id = <user_afectado>;
   ```

---

## IMPACTO ESTIMADO

- **Usuarios afectados:** TODOS los que compraron números hoy
- **Fuegos duplicados:** Desconocido (requiere query DB)
- **Pérdida económica plataforma:** Alta (fuegos = dinero)
- **Confianza usuarios:** En riesgo

---

## LECCIONES APRENDIDAS

1. **NUNCA** asumir formato de datos entre frontend-backend
2. Validar SIEMPRE que `number` singular se convierta a array
3. Logging exhaustivo desde el INICIO
4. Testing de edge cases (doble click, retries, etc.)
5. Idempotency keys para operaciones financieras
6. Rate limiting por usuario en operaciones críticas

---

## COMMIT DE HOTFIX

**Hash:** (Pendiente)
**Mensaje:** `fix CRÍTICO: prevenir duplicación de fuegos en compra rifas + logging exhaustivo`

**Archivos:**
- backend/routes/raffles.js (soporte number singular)
- backend/services/RaffleService.js (logging)
- RAFFLE_FIRE_DUPLICATION_BUG.md (documentación)

---

**Autor:** Sistema MundoXYZ  
**Revisión:** Urgente  
**Deploy:** Inmediato

