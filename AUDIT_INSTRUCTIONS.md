# 🔍 INSTRUCCIONES DE AUDITORÍA - EXPLOIT REEMBOLSOS

**Deploy en progreso:** ~6 minutos  
**Endpoint:** `GET /api/audit/raffle-refund-exploit`

---

## 📋 CÓMO EJECUTAR LA AUDITORÍA

### Opción 1: Desde Navegador (RECOMENDADO)

1. **Obtener Token de Admin:**
   - Login como admin en https://mundoxyz-production.up.railway.app
   - Abrir DevTools (F12)
   - Console → `localStorage.getItem('token')`
   - Copiar el token

2. **Ejecutar Auditoría:**
   - Abrir nueva pestaña
   - Pegar en la barra de direcciones:
   ```
   https://mundoxyz-production.up.railway.app/api/audit/raffle-refund-exploit
   ```
   - Agregar el token en headers (usar extensión como ModHeader o Postman)

### Opción 2: Usando cURL (Terminal)

```bash
curl -H "Authorization: Bearer <TU_TOKEN_ADMIN>" \
     https://mundoxyz-production.up.railway.app/api/audit/raffle-refund-exploit
```

### Opción 3: Usando Postman/Insomnia

```
GET https://mundoxyz-production.up.railway.app/api/audit/raffle-refund-exploit
Headers:
  Authorization: Bearer <TU_TOKEN_ADMIN>
```

---

## 📊 QUÉ ESPERAR EN EL REPORTE

### Estructura del JSON:

```json
{
  "success": true,
  "data": {
    "timestamp": "2025-11-06T...",
    "auditor": "username",
    
    "sections": {
      "cancelledRafflesWithPot": {
        "count": 0,  // ← Si es > 0: EXPLOIT CONFIRMADO
        "totalExploitFires": 0,
        "totalExploitCoins": 0,
        "raffles": [...]
      },
      
      "refundTransactions": {
        "total": 0,
        "byType": {
          "raffle_number_refund": 0,
          "raffle_refund_from_pot": 0,  // ← Si es 0: flujo viejo usado
          "raffle_refund_platform_fee": 0
        },
        "hasNewFlow": false,
        "recentTransactions": [...]
      },
      
      "benefitedHosts": {
        "count": 0,
        "hosts": [
          {
            "id": "...",
            "username": "...",
            "currentBalance": { "fires": 0, "coins": 0 },
            "totalKeptFires": 0,  // ← Cuánto no devolvió
            "totalKeptCoins": 0
          }
        ]
      }
    },
    
    "summary": {
      "exploitDetected": false,
      "totalIndebidFires": 0,
      "totalIndebidCoins": 0,
      "affectedRaffles": 0,
      "benefitedHosts": 0,
      "newFlowActive": false
    },
    
    "recommendations": [
      {
        "priority": "CRÍTICA",
        "action": "...",
        "description": "..."
      }
    ]
  }
}
```

---

## 🎯 INTERPRETACIÓN DE RESULTADOS

### ✅ ESCENARIO 1: Sistema Limpio

```json
{
  "summary": {
    "exploitDetected": false,
    "affectedRaffles": 0
  }
}
```

**Significa:**
- ✅ No hay rifas canceladas con pot_fires > 0
- ✅ No hubo uso del exploit
- ✅ Sistema está limpio

**Acción:** Ninguna

---

### ⚠️ ESCENARIO 2: Exploit Detectado (Sin Flujo Nuevo)

```json
{
  "summary": {
    "exploitDetected": true,
    "totalIndebidFires": 500,
    "affectedRaffles": 5,
    "benefitedHosts": 2,
    "newFlowActive": false
  }
}
```

**Significa:**
- 🚨 5 rifas canceladas con pot no devuelto
- 🚨 500 fuegos generados indebidamente
- 🚨 2 hosts se beneficiaron
- ⚠️ El fix aún no se ha probado (no hay transacciones nuevas)

**Acción:** ROLLBACK MANUAL REQUERIDO

---

### ✅ ESCENARIO 3: Exploit Detectado (Con Flujo Nuevo Activo)

```json
{
  "summary": {
    "exploitDetected": true,
    "totalIndebidFires": 500,
    "newFlowActive": true
  },
  "sections": {
    "refundTransactions": {
      "byType": {
        "raffle_refund_from_pot": 3  // ← FIX FUNCIONANDO
      }
    }
  }
}
```

**Significa:**
- 🚨 Hubo exploit en el pasado (500 fuegos)
- ✅ Pero el fix ya está funcionando (hay transacciones nuevas)
- ⚠️ Quedan pendientes los casos viejos

**Acción:** ROLLBACK de casos viejos + Monitorear nuevos

---

## 🔧 ACCIÓN DE ROLLBACK (Si es necesario)

### Si el reporte muestra `benefitedHosts`:

```sql
-- Para cada host identificado en el reporte:

-- 1. Descontar fuegos indebidos
UPDATE wallets 
SET fires_balance = fires_balance - <totalKeptFires>
WHERE user_id = '<hostId>';

-- 2. Registrar transacción
INSERT INTO wallet_transactions 
(wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
VALUES (
  (SELECT id FROM wallets WHERE user_id = '<hostId>'),
  'admin_correction_exploit',
  'fires',
  <totalKeptFires>,
  (SELECT fires_balance + <totalKeptFires> FROM wallets WHERE user_id = '<hostId>'),
  (SELECT fires_balance FROM wallets WHERE user_id = '<hostId>'),
  'EXPLOIT_FIX_2025_11_06',
  'Corrección: devolución pot_fires rifas canceladas (exploit económico detectado en auditoría)'
);
```

**⚠️ IMPORTANTE:** 
- Revisar CADA caso individualmente
- Verificar que el host realmente tenga balance suficiente
- Documentar cada corrección

---

## 📝 SIGUIENTE PASO DESPUÉS DE AUDITORÍA

Una vez obtengas el reporte:

1. **Copia el JSON completo**
2. **Compártelo conmigo**
3. **Analizaré los resultados**
4. **Te daré plan de acción específico**

Luego me encargaré del problema de compra de rifas.

---

## ⏰ TIMING

- **Deploy actual:** En progreso (~6 min desde push)
- **Esperar a:** ~11:25am UTC-04:00
- **Entonces ejecutar:** GET /api/audit/raffle-refund-exploit

---

**Preparado por:** Sistema de Auditoría Automática  
**Fecha:** 2025-11-06  
**Versión:** 1.0
