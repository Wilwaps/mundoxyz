# 🧹 INSTRUCCIONES PARA LIMPIAR CACHE Y VER FIXES

**Fecha:** 11 Nov 2025, 23:40 UTC-4  
**Problema:** El cache del browser tiene datos del sistema de refetch agresivo anterior  
**Solución:** Limpiar cache completamente  

---

## 📋 PASOS PARA LIMPIAR CACHE EN CHROME

### Opción 1: Hard Reload (Rápido)
1. Abre Chrome DevTools (F12)
2. Click derecho en el botón de recarga (⟳)
3. Selecciona "**Empty Cache and Hard Reload**"
4. Espera a que cargue completamente
5. Verifica que los datos aparezcan correctamente

### Opción 2: Limpiar Cache Completo (Recomendado)
1. Presiona `Ctrl + Shift + Delete` (o `Cmd + Shift + Delete` en Mac)
2. Selecciona:
   - ✅ **Cached images and files**
   - ✅ **Cookies and other site data**
3. Rango de tiempo: **"All time"**
4. Click "**Clear data**"
5. Recargar la página

### Opción 3: Modo Incógnito (Temporal)
1. Presiona `Ctrl + Shift + N` (o `Cmd + Shift + N` en Mac)
2. Navega a: `https://mundoxyz-production.up.railway.app`
3. Inicia sesión
4. Ve a la rifa de prueba
5. Verifica que los datos se muestren correctamente

---

## ✅ VERIFICACIÓN POST-LIMPIEZA

Después de limpiar el cache, verifica que:

### En la Página de Rifa (código 913669):
- ✅ **Total:** 10 (no 0)
- ✅ **Vendidos:** 2
- ✅ **Disponibles:** 8 (no -2)
- ✅ **Progreso:** 20% (no 0%)
- ✅ **Pote Total:** 20 🔥 (no 0)
- ✅ **Precio por número:** 10 🔥 (no 0)

### Tab "Números":
- ✅ Grid de números visible (1-10)
- ✅ Números 1 y 2 marcados como vendidos
- ✅ Números 3-10 disponibles para comprar

### Tab "Información":
- ✅ **Precio por número:** 10.00 🔥 (no 0)
- ✅ **Modo:** 🔥 Fuegos
- ✅ **Organizador:** prueba1

---

## 🔍 SI AÚN VES DATOS EN 0

Si después de limpiar el cache sigues viendo datos en 0:

1. **Verifica que el deploy completó:**
   - Ve a: https://railway.com/project/9ed64502-9a9f-4129-8cb5-00a50f074995/service/68a15835-82a9-4897-ad6f-fa55a2ec9326?environmentId=dc0d6ff4-7c00-435c-89d8-d6433b4f598d
   - Busca el último deploy (commit `d8ae02a`)
   - Verifica que diga "✅ Deploy succeeded"

2. **Abre la consola del navegador (F12):**
   - Ve a la pestaña "Console"
   - Busca errores en rojo
   - Toma captura y reporta

3. **Verifica la petición de red:**
   - Ve a la pestaña "Network"
   - Busca la request: `GET .../api/raffles/v2/913669`
   - Click en ella
   - Ve a "Response"
   - Verifica que `numbersRange: 10` aparezca
   - Si aparece en Response pero no en UI → Problema de rendering
   - Si NO aparece en Response → Problema de backend

---

## 🐛 PROBLEMA CONOCIDO: "Invalid Date"

Este bug ya está documentado y será corregido en la siguiente iteración. Es cosmético y NO afecta la funcionalidad.

---

## 📊 DATOS CORRECTOS ESPERADOS (Backend)

El backend devuelve correctamente:
```json
{
  "raffle": {
    "numbersRange": 10,
    "numbersSold": 2,
    "numbersReserved": 0,
    "entryPriceFire": "10.00",
    "potFires": 20,
    "status": "active"
  }
}
```

El frontend DEBE mostrar estos valores en la UI.

---

## ⚡ HOTFIX APLICADO

**Commit:** `d8ae02a`  
**Cambios:**
1. ✅ Desactivado refetch agresivo (false en SYNC_INTERVALS)
2. ✅ Actualización solo vía socket events
3. ✅ Version bump a 1.3.8-no-refetch (force cache bust)

**Resultado esperado:**
- ❌ YA NO debe haber parpadeo de datos
- ✅ Datos deben permanecer estables y visibles
- ✅ Actualizaciones solo cuando hay cambios reales (socket)

---

## 🆘 SOPORTE

Si después de seguir estos pasos sigues teniendo problemas:

1. Toma captura de pantalla de:
   - La UI mostrando datos en 0
   - La consola con errores (si hay)
   - La respuesta de Network del endpoint `/api/raffles/v2/913669`

2. Reporta con esta información

---

**Autor:** Cascade AI  
**Última actualización:** 11 Nov 2025, 23:40 UTC-4  
**Deploy:** Railway automático (~6 minutos desde push)
