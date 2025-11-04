# 🔄 INSTRUCCIONES: CIERRE MASIVO DE SALAS

**Fecha**: 2 Noviembre 2025  
**Objetivo**: Cerrar todas las salas activas y reembolsar a jugadores  
**Método**: Automatizado con opciones SQL y JavaScript

---

## 📋 SALAS A CERRAR

Según análisis con Chrome DevTools, estas salas están activas:

| Código | Estado | Jugadores | Pozo | Acción |
|--------|--------|-----------|------|--------|
| 306192 | waiting | 1 | 5.00 fires | Reembolsar |
| 139105 | waiting | 1 | 6.00 fires | Reembolsar |
| 955284 | in_progress | 1 | 6.00 fires | Reembolsar |
| 387734 | in_progress | 1 | 6.00 fires | Reembolsar |
| 451836 | in_progress | 1 | 6.00 fires | Reembolsar |
| 162908 | in_progress | 1 | 2.00 fires | Reembolsar |
| 120307 | in_progress | 1 | 3.00 fires | Reembolsar |
| 493974 | in_progress | 1 | 5.00 fires | Reembolsar |

**Total**: 8 salas  
**Total a reembolsar**: ~38 fires (estimado)

---

## 🛠️ OPCIÓN 1: Script SQL (RECOMENDADO)

### Método A: Ejecutar en Railway Dashboard

1. Ve a Railway → tu proyecto → PostgreSQL
2. Abre "Query"
3. Copia y pega el contenido de `scripts/refund-all-rooms.sql`
4. **IMPORTANTE**: Revisa los resultados de cada SELECT antes de continuar
5. Si todo se ve bien, ejecuta hasta el COMMIT
6. Si algo está mal, ejecuta ROLLBACK

### Ventajas:
- ✅ Todo en una transacción
- ✅ Se puede hacer ROLLBACK si algo falla
- ✅ Más seguro y auditable

---

## 🛠️ OPCIÓN 2: Script Node.js

### Requisitos:
```bash
npm install pg
```

### Variables de Entorno:
```bash
# En Railway, obtener la DATABASE_URL desde Variables
export DATABASE_URL="postgresql://user:pass@host:port/database"
```

### Ejecutar:
```bash
cd "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ"
node scripts/refund-all-active-rooms.js
```

### El script hace:
1. Conecta a la base de datos
2. Lista todas las salas activas
3. Espera 5 segundos para confirmación (Ctrl+C para cancelar)
4. Procesa cada sala:
   - Reembolsa a jugadores
   - Registra en bingo_v2_refunds
   - Envía mensajes al buzón
   - Actualiza estado a 'cancelled'
   - Registra en audit logs
5. Genera log en `logs/refund-mass-{timestamp}.json`

---

## 🛠️ OPCIÓN 3: Manual con Chrome DevTools (Más Lento)

Para cerrar cada sala individualmente:

```javascript
// Ejecutar en consola de Chrome DevTools
const token = localStorage.getItem('token');
const roomCode = '306192'; // Cambiar por cada sala

fetch(`https://confident-bravery-production-ce7b.up.railway.app/api/bingo/v2/admin/rooms/${roomCode}/emergency-refund`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Cierre masivo por limpieza del sistema'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

Repetir para cada código de sala.

---

## ✅ VERIFICACIÓN POST-EJECUCIÓN

Después de ejecutar cualquier método, verificar:

### 1. Salas Cerradas
```sql
SELECT code, status, finished_at 
FROM bingo_v2_rooms 
WHERE finished_at::date = CURRENT_DATE;
```

### 2. Reembolsos Registrados
```sql
SELECT COUNT(*), SUM(amount), currency_type
FROM bingo_v2_refunds
WHERE refunded_at::date = CURRENT_DATE
GROUP BY currency_type;
```

### 3. Mensajes Enviados
```sql
SELECT COUNT(*)
FROM bingo_v2_messages
WHERE created_at::date = CURRENT_DATE
  AND category = 'system'
  AND title = 'Reembolso de Bingo';
```

### 4. Wallets Actualizados
```sql
SELECT u.username, w.fires_balance, w.coins_balance
FROM users u
JOIN wallets w ON u.id = w.user_id
WHERE u.username = 'prueba1';
```

---

## 📊 LOG ESPERADO

El script generará un archivo JSON con:

```json
{
  "timestamp": "2025-11-02T18:00:00.000Z",
  "total_rooms": 8,
  "success_count": 8,
  "failed_count": 0,
  "results": {
    "success": [
      {
        "roomCode": "306192",
        "playersRefunded": 1,
        "totalRefunded": 5.00
      },
      // ...
    ],
    "failed": []
  }
}
```

---

## 🚨 EN CASO DE ERROR

Si algo falla durante la ejecución:

### Opción SQL:
```sql
ROLLBACK;
```

### Opción Node.js:
- El script tiene manejo de errores automático
- Cada sala se procesa en su propia transacción
- Si una falla, las demás continúan

### Verificar Estado:
```sql
SELECT code, status, is_stalled
FROM bingo_v2_rooms
WHERE status IN ('waiting', 'in_progress');
```

---

## 📝 NOTAS IMPORTANTES

1. **Backup**: Railway hace backups automáticos, pero es buena práctica verificar
2. **Reversión**: Los reembolsos NO son reversibles automáticamente
3. **Audit Trail**: Todo queda registrado en `bingo_v2_audit_logs`
4. **Notificaciones**: Los jugadores recibirán mensaje en su buzón
5. **Timing**: Ejecutar cuando haya menos usuarios activos

---

## 🎯 RECOMENDACIÓN

Para este caso específico (8 salas, todas del mismo host):

**USAR OPCIÓN 1 (SQL)** por:
- ✅ Más rápido (una sola transacción)
- ✅ Más seguro (ROLLBACK disponible)
- ✅ Más simple de auditar
- ✅ No requiere configurar variables de entorno
- ✅ Se ejecuta directamente en Railway

---

## 📧 SOPORTE

Si encuentras algún error:
1. Copia el mensaje de error completo
2. Verifica los logs de Railway
3. Revisa `bingo_v2_audit_logs` para ver qué se procesó
4. Si es necesario, revertir manualmente consultando los refunds registrados

---

**Autor**: Cascade AI  
**Versión**: 1.0  
**Última actualización**: 2 Nov 2025
