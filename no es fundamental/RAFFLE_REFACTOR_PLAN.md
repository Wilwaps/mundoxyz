# Plan de Refactorización Sistema de Rifas

## 📋 Mapeo de Columnas (Antiguas → Nuevas)

### Tabla `raffle_numbers`

| COLUMNA ANTIGUA | COLUMNA NUEVA | TIPO | DESCRIPCIÓN |
|-----------------|---------------|------|-------------|
| `number` | `number_idx` | INTEGER | Índice numérico (0-99, 0-999, etc.) |
| `status` | `state` | VARCHAR(20) | Estado: 'available', 'reserved', 'sold' |
| `purchased_by` | `owner_id` | UUID | ID del usuario propietario |
| N/A | `owner_ext` | VARCHAR(128) | Identificador externo del propietario |
| `reserved_by` | `reserved_by_ext` | VARCHAR(128) | Identificador externo de quien reservó |
| `reserved_at` | `reserved_until` | TIMESTAMPTZ | Fecha hasta cuando está reservado |
| `purchased_at` | `sold_at` | TIMESTAMPTZ | Fecha de venta |
| N/A | `reference` | VARCHAR(255) | Referencia de pago/transacción |
| N/A | `transaction_id` | UUID | ID de transacción wallet |

### Estados

| ESTADO ANTIGUO | ESTADO NUEVO | SIGNIFICADO |
|----------------|--------------|-------------|
| `available` | `available` | Disponible para compra |
| `pending_approval` | `reserved` | Reservado, esperando aprobación (modo prize) |
| `purchased` | `sold` | Vendido/comprado |

---

## 🔧 Métodos a Refactorizar

### 1. **generateRaffleNumbers** (línea 388-408)
- ❌ `INSERT INTO raffle_numbers (raffle_id, number)`
- ✅ `INSERT INTO raffle_numbers (raffle_id, number_idx, state)`
- ❌ `ON CONFLICT (raffle_id, number)`
- ✅ `ON CONFLICT (raffle_id, number_idx)`
- Guardar `number_idx` como INTEGER
- Inicializar `state = 'available'`

### 2. **purchaseNumber** (línea 436-508)
- ❌ `WHERE raffle_id = $1 AND number = $2`
- ✅ `WHERE raffle_id = $1 AND number_idx = $2`
- ❌ `numberData.status !== 'available'`
- ✅ `numberData.state !== 'available'`
- Actualizar validaciones y comparaciones

### 3. **processFirePurchase** (línea 513-549)
- ❌ `SET status = 'purchased', purchased_by = $1, purchased_at = CURRENT_TIMESTAMP`
- ✅ `SET state = 'sold', owner_id = $1, sold_at = CURRENT_TIMESTAMP`
- ❌ `WHERE raffle_id = $2 AND number = $3`
- ✅ `WHERE raffle_id = $2 AND number_idx = $3`
- Actualizar INSERT en `raffle_purchases` para usar `number_idx`

### 4. **processPrizePurchase** (línea 554-569)
- ❌ `SET status = 'pending_approval', reserved_by = $1`
- ✅ `SET state = 'reserved', owner_id = $1, reserved_until = CURRENT_TIMESTAMP + INTERVAL '24 hours'`
- ❌ `WHERE raffle_id = $2 AND number = $3`
- ✅ `WHERE raffle_id = $2 AND number_idx = $3`
- Actualizar INSERT en `raffle_requests`

### 5. **approvePurchase** (línea 574-637)
- ❌ `SET status = 'purchased', purchased_by = $1, purchased_at = CURRENT_TIMESTAMP`
- ✅ `SET state = 'sold', owner_id = $1, sold_at = CURRENT_TIMESTAMP`
- Actualizar referencias a `number`

### 6. **checkRaffleCompletion** (línea 658-681)
- ❌ `WHERE raffle_id = $1 AND status = 'purchased'`
- ✅ `WHERE raffle_id = $1 AND state = 'sold'`

### 7. **closeRaffleAndSelectWinner** (línea 686-728)
- ❌ `SELECT number FROM raffle_numbers WHERE ... AND status = 'purchased'`
- ✅ `SELECT number_idx FROM raffle_numbers WHERE ... AND state = 'sold'`
- ❌ `SELECT purchased_by FROM raffle_numbers`
- ✅ `SELECT owner_id FROM raffle_numbers`
- Actualizar referencias en UPDATES y INSERTS

### 8. **getRaffleDetails** (línea 778-828)
- ❌ `COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END)`
- ✅ `COUNT(CASE WHEN rn.state = 'sold' THEN 1 END)`
- ❌ `ORDER BY rn.number`
- ✅ `ORDER BY rn.number_idx`
- Agregar formateo de `number_idx` para display

### 9. **listPublicRaffles** (línea 833-910)
- ✅ Ya usa `state` correctamente (línea 852)
- Verificar otras referencias

### 10. **getUserParticipatedRaffles** (línea 941-967)
- ❌ `rn.number as user_number`
- ✅ `rn.number_idx as user_number`

### 11. **getRaffleByCode** (línea 972-1022)
- ❌ `COUNT(CASE WHEN rn.status = 'purchased' THEN 1 END)`
- ✅ `COUNT(CASE WHEN rn.state = 'sold' THEN 1 END)`
- ❌ `ORDER BY rn.number`
- ✅ `ORDER BY rn.number_idx`

### 12. **rejectPurchase** (línea 1027-1075)
- ❌ `SET status = 'available', reserved_by = NULL, reserved_at = NULL, expires_at = NULL`
- ✅ `SET state = 'available', owner_id = NULL, reserved_by_ext = NULL, reserved_until = NULL`

### 13. **getRaffleNumbers** (línea 1080-1107)
- ❌ `LEFT JOIN users u ON rn.purchased_by = u.id`
- ✅ `LEFT JOIN users u ON rn.owner_id = u.id`
- ❌ `ORDER BY rn.number`
- ✅ `ORDER BY rn.number_idx`
- Agregar alias para display: `purchased_username` → `owner_username`

### 14. **validateTicket** (línea 1155-1187)
- Revisar referencias a `number_id` en `raffle_tickets`

---

## 🎯 Cambios Adicionales Necesarios

### Helper para formateo de números
```javascript
/**
 * Formatear number_idx para display visual
 */
formatNumberForDisplay(numberIdx, numbersRange) {
    const format = this.getNumberRangeConfig(numbersRange).format;
    return numberIdx.toString().padStart(format.length, '0');
}
```

### Actualizar responses para compatibilidad frontend
Cuando retornemos números, incluir ambos:
- `number_idx`: para uso interno
- `number_display`: string formateado para UI

---

## ✅ Checklist de Verificación

- [ ] generateRaffleNumbers usa number_idx + state
- [ ] purchaseNumber busca por number_idx y verifica state
- [ ] processFirePurchase actualiza state='sold', owner_id, sold_at
- [ ] processPrizePurchase actualiza state='reserved', owner_id, reserved_until
- [ ] approvePurchase actualiza state='sold'
- [ ] checkRaffleCompletion cuenta state='sold'
- [ ] closeRaffleAndSelectWinner selecciona de state='sold'
- [ ] getRaffleDetails cuenta correctamente
- [ ] getRaffleNumbers ordena por number_idx
- [ ] rejectPurchase limpia state='available'
- [ ] Todos los SELECT usan columnas correctas
- [ ] Todos los UPDATE usan columnas correctas
- [ ] Todos los COUNT/GROUP BY usan columnas correctas
- [ ] Routes no necesitan cambios (usan el servicio)

---

## 🚀 Orden de Ejecución

1. Actualizar `generateRaffleNumbers`
2. Actualizar `purchaseNumber` y helpers de validación
3. Actualizar `processFirePurchase` y `processPrizePurchase`
4. Actualizar `approvePurchase` y `rejectPurchase`
5. Actualizar `checkRaffleCompletion` y `closeRaffleAndSelectWinner`
6. Actualizar todas las consultas (getRaffleDetails, getRaffleByCode, etc.)
7. Agregar helper formatNumberForDisplay
8. Verificar compatibilidad con frontend
9. Commit + Push
10. Deploy + Validación

---

**Estado:** LISTO PARA EJECUTAR
**Garantía:** 100% - Todos los cambios alineados con esquema real de BD
