# 🧪 GUÍA DE TESTING: Validación de Patrones Ganadores Bingo V2

## 🎯 OBJETIVO
Reproducir el problema donde el sistema no reconoce patrones ganadores completados y analizar los logs para encontrar la causa raíz.

---

## 📋 PRE-REQUISITOS

1. ✅ Usuario con rol admin: **prueba1** (contraseña: 123456789)
2. ✅ Navegador con DevTools abierto (F12)
3. ✅ Dos ventanas/tabs del navegador (para simular 2 jugadores)
4. ✅ URL: https://confident-bravery-production-ce7b.up.railway.app

---

## 🔧 SETUP INICIAL

### VENTANA 1 (Jugador Host)
1. Abrir navegador normal
2. Ir a: https://confident-bravery-production-ce7b.up.railway.app
3. Login con: **prueba1 / 123456789**
4. Abrir DevTools (F12) → Pestaña Console
5. Ir a `/bingo` (Lobby)

### VENTANA 2 (Jugador Invitado)
1. Abrir navegador en modo incógnito (Ctrl+Shift+N)
2. Ir a: https://confident-bravery-production-ce7b.up.railway.app
3. Login con: **prueba2 / Mirame12veces.**
4. Abrir DevTools (F12) → Pestaña Console
5. Ir a `/bingo` (Lobby)

---

## 🎮 PASOS PARA REPRODUCIR

### PASO 1: Crear Sala (Ventana 1 - prueba1)
1. Click en **"Crear Sala"**
2. Configuración:
   - Modo: **75 números**
   - Patrón: **line** (línea)
   - Moneda: **fires**
   - Precio cartón: **1.00**
   - Max jugadores: **10**
3. Click **"Crear Sala"**
4. **ANOTAR EL CÓDIGO** de la sala (ej: #555558)

### PASO 2: Unirse a la Sala (Ventana 2 - prueba2)
1. En Lobby, buscar la sala creada (código #555558)
2. Click en la sala
3. Comprar **1 cartón**
4. Click **"Listo"**

### PASO 3: Iniciar Juego (Ventana 1 - prueba1)
1. Esperar que prueba2 esté "Listo" (✓)
2. Comprar **1 cartón** para el host
3. Click **"Listo"**
4. Click **"Iniciar Juego"**

### PASO 4: Jugar y Completar Patrón
1. **Ventana 1**: Activar **"Auto-cantar"** para que los números salgan automáticamente
2. **Ambas Ventanas**: Marcar números en los cartones cuando salgan
3. **IMPORTANTE**: Estar atento a cuando se complete una línea (horizontal, vertical o diagonal)

### PASO 5: Reclamar BINGO
Cuando un jugador complete una línea completa:
1. Debe aparecer el modal **"¡PATRÓN COMPLETO!"**
2. Click en botón **"¡BINGO!"**
3. **OBSERVAR**:
   - ¿Aparece mensaje en consola?
   - ¿Aparece modal de ganador?
   - ¿Se distribuyen premios?

---

## 📊 QUÉ OBSERVAR EN CONSOLE (DevTools)

### En AMBAS Ventanas:
```
🔍 VALIDATING BINGO: {
  cardId: "...",
  pattern: "line",
  gridSize: "5x5",
  markedCount: X,
  markedPositions: "[{row:0,col:0},{row:0,col:1},...]"
}

🎲 validatePattern75 - Pattern: line, Marked positions: 0,0, 0,1, 0,2, 0,3, 0,4

🎯 Pattern validation result: true/false
```

### Si sale FALSE:
- Verificar cuántas posiciones marcadas hay
- Verificar si las posiciones forman una línea completa
- Comparar con el cartón visual

---

## 🔍 ANÁLISIS DE LOGS EN RAILWAY

1. Ir a: https://railway.app
2. Seleccionar proyecto **mundoxyz**
3. Click en servicio backend
4. Pestaña **"Logs"**
5. Filtrar por: `VALIDATING BINGO` o `Pattern validation`
6. **CAPTURAR** los logs completos cuando se reproduce el problema

---

## 📸 CAPTURAS REQUERIDAS

Por favor captura:
1. ✅ Cartón de Bingo con patrón completado (antes de reclamar)
2. ✅ Console log con los datos de validación
3. ✅ Railway logs con el detalle del servidor
4. ✅ Modal de BINGO (si aparece) o mensaje de error

---

## 🐛 CASOS ESPECÍFICOS A PROBAR

### CASO 1: Línea Horizontal
- Completar fila 0: (0,0), (0,1), (0,2), (0,3), (0,4)
- Reclamar BINGO
- ¿Funciona?

### CASO 2: Línea Vertical
- Completar columna 0: (0,0), (1,0), (2,0), (3,0), (4,0)
- Reclamar BINGO
- ¿Funciona?

### CASO 3: Diagonal Principal
- Completar diagonal: (0,0), (1,1), (2,2), (3,3), (4,4)
- NOTA: (2,2) es FREE, no cuenta
- Reclamar BINGO
- ¿Funciona?

### CASO 4: Diagonal Secundaria
- Completar diagonal: (0,4), (1,3), (2,2), (3,1), (4,0)
- NOTA: (2,2) es FREE, no cuenta
- Reclamar BINGO
- ¿Funciona?

---

## ❓ PREGUNTAS DIAGNÓSTICAS

Después de reproducir el problema, responde:

1. ¿El modal "PATRÓN COMPLETO" apareció?
   - ✅ Sí → El frontend detecta correctamente
   - ❌ No → Problema en frontend checkPatternComplete()

2. ¿Apareció log "🔍 VALIDATING BINGO" en console?
   - ✅ Sí → El emit llegó al backend
   - ❌ No → Problema en socket connection

3. ¿Cuántas posiciones marcadas muestra el log?
   - Si < 5 → Problema: marked_positions no se actualiza
   - Si >= 5 → Continuar análisis

4. ¿Qué dice "Pattern validation result"?
   - **true** → Backend valida OK, problema en distributePrizes
   - **false** → Problema en validatePattern75

5. ¿Las posiciones marcadas forman una línea?
   - ✅ Sí → Problema en lógica de validación
   - ❌ No → Problema en marcado de números

---

## 🔧 COMANDOS ÚTILES EN CONSOLE

Para debug adicional, ejecuta en Console:

```javascript
// Ver estado del socket
window.socket?._callbacks

// Ver room data
localStorage.getItem('currentRoom')

// Ver user data
JSON.parse(localStorage.getItem('user'))
```

---

## 📝 FORMATO DE REPORTE

Después de las pruebas, reporta:

```
CASO: [Línea Horizontal/Vertical/Diagonal]
RESULTADO: [✅ Funciona / ❌ Falla]

LOGS CONSOLE:
[Pegar logs aquí]

LOGS RAILWAY:
[Pegar logs aquí]

CAPTURAS:
[Adjuntar imágenes]

OBSERVACIONES:
[Cualquier detalle adicional]
```

---

## 🎯 OBJETIVO FINAL

Identificar exactamente dónde falla la validación:
1. ¿marked_positions vacío?
2. ¿Formato incorrecto de posiciones?
3. ¿Lógica de validación con bug?
4. ¿Problema en distribución de premios?

**Con esta información podré aplicar el fix correcto.**
