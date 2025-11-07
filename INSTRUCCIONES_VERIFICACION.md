# 🔍 INSTRUCCIONES DE VERIFICACIÓN - POST DEPLOY

## ⏰ TIMING

**Deploy iniciado:** Ahora  
**Tiempo estimado:** 6-8 minutos  
**Timer:** Activo en background  

---

## 📋 CHECKLIST DE VERIFICACIÓN

### PASO 1: Esperar a que Railway termine

1. Ir a https://railway.app/dashboard
2. Ver que el deploy está completo (verde)
3. O esperar 8 minutos (timer activo)

---

### PASO 2: Abrir la aplicación

1. Ir a: https://mundoxyz-production.up.railway.app
2. **IMPORTANTE:** Hacer **hard refresh** para borrar cache:
   - Windows: `Ctrl + Shift + R` o `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

---

### PASO 3: Abrir DevTools Console

1. Presionar `F12` (o click derecho → Inspeccionar)
2. Ir a tab **Console**
3. Buscar estos logs:

```javascript
🌍 API_URL configurado: https://mundoxyz-production.up.railway.app
🏠 Hostname: mundoxyz-production.up.railway.app
🔧 isProduction: true
🔧 axios baseURL configurado: https://mundoxyz-production.up.railway.app
🏭 isProduction: true
🔌 Socket conectando a producción: https://mundoxyz-production.up.railway.app
```

**Si ves estos logs:**
✅ La detección de hostname funciona
✅ URLs configuradas correctamente
✅ Axios y Socket están listos

**Si NO ves estos logs:**
❌ Algo salió mal
→ Tomar screenshot de la consola
→ Buscar errores en rojo

---

### PASO 4: Verificar Network Tab

1. Ir a tab **Network** en DevTools
2. Hacer una acción (ej: abrir una rifa)
3. Ver las llamadas API

**Deberías ver:**
```
GET https://mundoxyz-production.up.railway.app/api/raffles/...
GET https://mundoxyz-production.up.railway.app/api/users/...
```

**NO deberías ver:**
```
GET /api/raffles/...  ← Ruta relativa SIN dominio
GET https://undefined/api/...  ← URL undefined
```

---

### PASO 5: Verificar Botones Flotantes

1. Ir a cualquier rifa activa
2. Scroll hasta abajo
3. Ver botones en esquina inferior derecha:

**Como usuario normal:**
- 🔵 **Botón azul** (Participantes) ← Debe estar visible

**Como host de la rifa:**
- 🔵 **Botón azul** (Participantes)
- 🟡 **Botón amarillo** (Ver Solicitudes) con badge
- 🟢 **Botón verde** (Datos de Pago)

**Si NO ves los botones:**
❌ Problema de renderizado
→ Ver errores en Console
→ Ver si el componente RaffleRoom cargó

---

### PASO 6: Verificar Métodos de Pago

1. En una rifa modo premio, click en un número disponible
2. Modal debe abrirse
3. Debe mostrar **3 opciones de pago:**

```
⚪ Efectivo
⚪ Pago móvil / Banco
⚪ Pago en fuegos (🔥 X)
```

4. Click en cada opción
5. Debe mostrar info correspondiente:
   - **Efectivo:** Mensaje de coordinación
   - **Banco:** Datos bancarios (si configurado)
   - **Fuegos:** Cantidad a descontar

**Si NO ves las 3 opciones:**
❌ API no responde
→ Ver Network tab
→ Ver llamada a `/api/raffles/:id/payment-details`
→ Ver response

---

### PASO 7: Verificar WebSocket

1. En Console, buscar:
```
🔌 Socket conectando a producción: https://mundoxyz-production.up.railway.app
Socket connected: [socket-id]
```

2. Abrir una rifa en 2 navegadores diferentes
3. En navegador 1: click en un número
4. En navegador 2: el número debe bloquearse automáticamente

**Si el WebSocket falla:**
- Verás error: `WebSocket connection failed`
- Número NO se bloquea en tiempo real
→ Ver error exacto en Console

---

## 🎯 CRITERIOS DE ÉXITO

### ✅ TODO FUNCIONA SI:

1. **Console logs correctos**
   - Muestra URLs hardcoded
   - isProduction = true
   - No hay errores

2. **Network tab correcto**
   - Todas las llamadas van a railway.app
   - Status 200 (éxito)
   - Responses con datos

3. **Botones flotantes visibles**
   - Azul siempre presente
   - Amarillo/verde para host
   - Siempre visibles (fixed position)

4. **Modal métodos de pago completo**
   - 3 opciones visibles
   - Click cambia selección
   - Info de pago aparece

5. **WebSocket funcional**
   - Conecta sin errores
   - Reservas en tiempo real
   - Liberaciones automáticas

---

## 🔧 TROUBLESHOOTING

### Problema: Logs NO aparecen

**Solución:**
1. Hard refresh: `Ctrl + Shift + R`
2. Borrar cache: DevTools → Application → Clear storage
3. Cerrar y reabrir navegador
4. Verificar que Railway terminó el deploy

---

### Problema: URLs siguen vacías

**Revisar:**
1. Hostname en console: `console.log(window.location.hostname)`
2. ¿Es `mundoxyz-production.up.railway.app`?
3. Si es diferente → actualizar código

**Si el hostname es correcto pero API_URL vacío:**
→ Bug en código de detección
→ Ver SOLUCION_DEFINITIVA_EXPLICADA.md

---

### Problema: Botones NO aparecen

**Posibles causas:**
1. CSS z-index bajo → otros elementos tapan
2. Componente no renderiza → error en Console
3. Datos no cargan → Network tab

**Debug:**
```javascript
// En Console:
document.querySelector('.fixed.bottom-8.right-8')
// Si es null → botones no existen en DOM
// Si existe → problema de CSS
```

---

### Problema: Modal NO muestra opciones

**Revisar:**
1. Network → `/api/raffles/:id/payment-details`
2. Response status (debe ser 200)
3. Response body (debe tener `success: true`)
4. Console → Logs de BuyNumberModal

**Esperado:**
```javascript
📥 Cargando payment details para rifa: xxx
✅ Response payment-details: {success: true, data: {...}}
💳 Payment details recibidos: {...}
🏁 loadPaymentDetails finalizado
🎨 Renderizando modal con paymentDetails: {...}
```

---

## 📸 SCREENSHOTS ÚTILES

Si hay problemas, tomar screenshots de:

1. **Console completa** (todos los logs)
2. **Network tab** (llamadas API)
3. **Application tab** → Local Storage (token presente?)
4. **Página completa** (botones visibles?)
5. **Modal** (opciones de pago?)

---

## 🎉 SI TODO FUNCIONA

**¡FELICIDADES!** 🎊

Marca como completado:
- ✅ Botones flotantes funcionan
- ✅ Métodos de pago se muestran
- ✅ WebSocket en tiempo real
- ✅ Sistema completo funcional

**Próximos pasos:**
1. Probar flujo completo de compra
2. Probar flujo completo de host aprobando
3. Verificar reembolsos
4. Celebrar 🎉

---

## ⚠️ SI AÚN NO FUNCIONA

**No te preocupes, vamos a resolverlo:**

1. **Recopila información:**
   - Screenshots de Console
   - Screenshots de Network
   - URL exacta que estás visitando
   - Pasos que seguiste

2. **Envía la info** para análisis

3. **Siguiente acción:** Investigar más profundo
   - Ver código compilado directamente
   - SSH a Railway para ver logs del servidor
   - Verificar configuración de Railway

---

**¡Estamos MUY cerca!** El código está correcto, solo falta que Railway termine el deploy. 🚀
