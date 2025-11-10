# ANÁLISIS: Error 500 al Obtener Detalles de Rifa

## 📊 Situación Actual

### ✅ Éxitos Logrados
1. **Bug #1** (Validación prizeMeta) - RESUELTO
2. **Bug #2** (JSON.parse JSONB) - RESUELTO  
3. **Bug #3** (Código undefined) - RESUELTO ✅

### ❌ Nuevo Problema Detectado
- **Rifa creada exitosamente**: POST /api/raffles/v2 → 201 ✅
- **Código capturado correctamente**: `334710` ✅
- **Navegación correcta**: `/raffles/334710` ✅
- **Error al obtener detalles**: GET /api/raffles/v2/334710 → 500 ❌

## 🔍 Investigación

### Peticiones de Red (Chrome DevTools)
```
reqid=461 POST /api/raffles/v2 → 201 ✅ (creación exitosa)
reqid=462 GET /api/raffles/v2/334710 → 500 ❌ (error al obtener detalles)
reqid=463 GET /api/raffles/v2/334710/numbers → 500 ❌
reqid=464 GET /api/raffles/v2/334710/my-numbers → 200 ✅
```

### Respuesta del Error 500
```json
{
  "success": false,
  "message": "Error obteniendo rifa"
}
```

### Query SQL Probada (Script Local)
La query del backend funciona perfectamente cuando se ejecuta directamente:

```sql
SELECT 
  r.*,
  u.username as host_username,
  COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as numbers_sold,
  COUNT(CASE WHEN rn.state = 'reserved' THEN 1 END) as numbers_reserved,
  rc.company_name,
  rc.rif_number,
  rc.brand_color as primary_color,
  rc.logo_url,
  rc.website_url
FROM raffles r
JOIN users u ON r.host_id = u.id
LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
LEFT JOIN raffle_companies rc ON rc.raffle_id = r.id
WHERE r.code = '334710'
GROUP BY r.id, u.username, rc.company_name, rc.rif_number, 
         rc.brand_color, rc.logo_url, rc.website_url
```

**Resultado:** ✅ Rifa encontrada con todos los datos correctos

## 🤔 Hipótesis

### Posibles Causas

1. **Timeout en Railway**
   - La query puede estar tardando demasiado en producción
   - Railway tiene timeouts más estrictos

2. **Error en el Controller**
   - El error puede no ser en la query, sino en el controller que maneja la respuesta
   - Posible problema al procesar la respuesta

3. **Problema con getRaffleNumbers**
   - El endpoint `/numbers` también falla con 500
   - Puede ser el mismo problema raíz

4. **Error no capturado**
   - El mensaje genérico "Error obteniendo rifa" oculta el error real
   - Necesitamos logs de Railway para ver el error exacto

## 🔧 Siguiente Paso

Necesito revisar el **controller** que maneja el endpoint GET /api/raffles/v2/:code para ver:
1. Cómo maneja los errores
2. Si hay algún procesamiento adicional que pueda fallar
3. Si hay validaciones que fallen silenciosamente

## 📂 Archivos a Revisar

1. `backend/modules/raffles/controllers/RaffleController.js` - Controller principal
2. `backend/modules/raffles/services/RaffleServiceV2.js` - Service (líneas 254-289)
3. Logs de Railway (necesitamos acceso directo)

## 🎯 Datos de la Rifa Creada

```json
{
  "id": 17,
  "code": "334710",
  "name": "POST-DEPLOY Test - Rifa Fuego",
  "mode": "fires",
  "status": "active",
  "visibility": "public",
  "entry_price_fire": "10.00",
  "numbers_range": 100,
  "host_username": "prueba1",
  "numbers_sold": "0"
}
```

---

**Creado:** 2025-11-09 19:20 UTC-4  
**Status:** En investigación
