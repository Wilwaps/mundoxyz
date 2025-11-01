# 🔬 ENDPOINT DE DIAGNÓSTICO BINGO

**Commit:** `a12a688`  
**Push:** 9:18 AM  
**ETA Deploy:** ~9:24 AM (~6 minutos)

---

## ✅ **LO QUE HACE**

Este endpoint te dará **TODO el estado de una sala de Bingo** en formato JSON que puedes copiar y pegar aquí, incluyendo:

- ✅ Estado de la sala
- ✅ Números cantados
- ✅ Todos los cartones
- ✅ **marked_numbers de cada cartón (RAW y PARSED)**
- ✅ Tipo de datos (string o array)
- ✅ Count antes y después del parseo
- ✅ Errores de parseo si existen

---

## 🚀 **CÓMO USARLO**

### **Paso 1: Espera 6 minutos** (~9:24 AM)

Railway necesita desplegar el nuevo código.

---

### **Paso 2: Obtén el código de tu sala**

Cuando estés en la partida de Bingo, el código está visible en la URL o en pantalla.

Ejemplo: Si la URL es:
```
https://confident-bravery-production-ce7b.up.railway.app/bingo/room/309852
```

El código es: **309852**

---

### **Paso 3: Llama al endpoint**

**Opción A: En el navegador (MÁS FÁCIL)**

1. Abre una nueva pestaña
2. Pega esta URL (reemplaza `TU_CODIGO` con el código de tu sala):
   ```
   https://confident-bravery-production-ce7b.up.railway.app/api/diagnostic/bingo-status/TU_CODIGO
   ```

3. Presiona Enter

4. **Verás un JSON gigante**

5. **Presiona Ctrl+A** (seleccionar todo)

6. **Presiona Ctrl+C** (copiar)

7. **Pégalo aquí en el chat**

**Opción B: PowerShell**

```powershell
Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/diagnostic/bingo-status/TU_CODIGO" -Method Get | ConvertTo-Json -Depth 10
```

---

## 📊 **QUÉ INFORMACIÓN VERÁS**

El JSON tendrá esta estructura:

```json
{
  "timestamp": "2025-10-31T13:24:00.000Z",
  "room": {
    "id": 123,
    "code": "309852",
    "status": "playing",
    "bingo_mode": "75",
    "victory_mode": "linea",
    "drawn_numbers_count": 15,
    "drawn_numbers": [12, 45, 67, ...]
  },
  "cards": [
    {
      "cardId": "abc-123",
      "userId": 456,
      "marked_numbers_raw": "[12,22,\"FREE\",49,66]",  // ← Como viene de la DB
      "marked_numbers_type": "string",  // ← PROBLEMA SI ES STRING
      "marked_numbers_isArray": false,  // ← PROBLEMA SI ES FALSE
      "marked_numbers_count_before_parse": 17,  // ← PROBLEMA SI ES 17
      "marked_numbers_parsed": [12,22,"FREE",49,66],  // ← Como queda después de parsear
      "marked_numbers_count_after_parse": 5,  // ← DEBE SER 5
      "parse_error": null
    }
  ],
  "summary": {
    "total_cards": 2,
    "cards_with_string_marked": 2,  // ← PROBLEMA SI NO ES 0
    "cards_with_array_marked": 0,  // ← PROBLEMA SI NO ES total_cards
    "cards_with_parse_error": 0
  }
}
```

---

## 🔍 **CÓMO INTERPRETAR LOS RESULTADOS**

### **CASO 1: marked_numbers_type = "string"**

```json
"marked_numbers_type": "string",
"marked_numbers_isArray": false,
"marked_numbers_count_before_parse": 17
```

**Diagnóstico:** PostgreSQL está guardando como STRING JSON en lugar de JSONB array.  
**Problema:** El fix del parseo NO está funcionando porque debería estar parseando antes de llegar aquí.  
**Solución:** Verificar que el código desplegado sea el correcto.

---

### **CASO 2: marked_numbers_type = "object" PERO count = 17**

```json
"marked_numbers_type": "object",
"marked_numbers_isArray": true,
"marked_numbers_count_before_parse": 17,
"marked_numbers_parsed": "[[1,2,3,4,5],[6,7,8,9,10],...]"
```

**Diagnóstico:** marked_numbers es un array de arrays (estructura del cartón completo) en lugar de solo los números marcados.  
**Problema:** La lógica de markNumber está guardando mal los datos.  
**Solución:** Revisar `backend/services/bingoService.js` función `markNumber`.

---

### **CASO 3: marked_numbers_isArray = true Y count = 5**

```json
"marked_numbers_type": "object",
"marked_numbers_isArray": true,
"marked_numbers_count_after_parse": 5,
"marked_numbers_parsed": [12,22,"FREE",49,66]
```

**Diagnóstico:** ✅ **El parseo funciona correctamente**.  
**Problema:** El bug está en otro lado (validateWinningPattern, socket, o frontend).  
**Siguiente paso:** Revisar logs de "🎯 RESULTADO DE VALIDACIÓN".

---

## 🎯 **FLUJO COMPLETO DE DEBUG**

1. **Espera ~6 min** para que Railway despliegue `a12a688`

2. **Juega una partida de Bingo** hasta completar una línea

3. **ANTES de presionar BINGO**, llama al endpoint:
   ```
   https://confident-bravery-production-ce7b.up.railway.app/api/diagnostic/bingo-status/TU_CODIGO
   ```

4. **Copia TODO el JSON** y pégalo aquí

5. **Presiona el botón "¡BINGO!"**

6. **Abre DevTools (F12)** → Console

7. **Busca en Console:**
   - `🏆 [FRONTEND] Evento bingo:game_over recibido`
   - Cualquier error en rojo

8. **Copia los logs del Console** y pégalos aquí

9. **Ve a Railway logs** y busca:
   - `========================================`
   - `PARSEO DE MARKED_NUMBERS`
   - `RESULTADO DE VALIDACIÓN`

10. **Copia esos bloques** de Railway logs

---

## 📝 **CON ESTA INFORMACIÓN IDENTIFICARÉ EL BUG EN 30 SEGUNDOS**

El endpoint de diagnóstico me dirá:
- ✅ Si los datos se guardan correctamente
- ✅ Si el parseo funciona
- ✅ Si hay errores de parseo
- ✅ Cuántos números están marcados realmente

Combinado con:
- ✅ Logs del Console del navegador
- ✅ Logs de Railway

Tendré **TODO** lo necesario para identificar y solucionar el bug.

---

**Espera ~6 minutos y luego usa el endpoint. Es la forma más directa de obtener la información.** 🔬
