# 🔧 FIX: Pantalla Negra en Frontend

## 🔴 PROBLEMA REPORTADO

El frontend carga inicialmente pero luego se oscurece completamente, quedando en pantalla negra.

---

## 🔍 DIAGNÓSTICO

### **En Chrome DevTools MCP:**
La página **SÍ renderiza correctamente**:
- Header visible con balance
- Lobby de La Vieja visible
- Sala AD2OWZ mostrada
- Sin errores en console

### **En navegador del usuario:**
- Pantalla negra después de cargar
- Posiblemente errores de JavaScript bloqueando la UI

---

## 🚨 POSIBLES CAUSAS

### 1️⃣ **Cache del Navegador**
El navegador está usando archivos JS/CSS antiguos que tienen errores.

### 2️⃣ **Railway No Redeployado**
El último commit con los fixes no está deployado en producción.

### 3️⃣ **Archivos JS Corruptos**
El build en Railway podría estar corrupto o incompleto.

---

## ✅ SOLUCIONES

### **Solución 1: Limpiar Cache del Navegador (INMEDIATA)**

En el navegador del usuario:

1. **Abrir DevTools** (F12)
2. **Click derecho en el botón de recarga**
3. **Seleccionar "Empty Cache and Hard Reload"**

O alternativamente:

```
Presionar: Ctrl + Shift + Delete
Seleccionar: "Cached images and files"
Click: "Clear data"
Recargar página: Ctrl + Shift + R
```

---

### **Solución 2: Verificar Deploy en Railway**

1. **Railway Dashboard → Frontend Service → Deployments**
2. **Verificar que el último commit está deployado:**
   - Debe mostrar commit reciente (últimos minutos)
   - Status debe ser "Active" ✅
3. **Si no está el último commit:**
   - Click en "⋮" (tres puntos)
   - Click en "Redeploy"

---

### **Solución 3: Force Redeploy (Si persiste)**

Desde PowerShell:

```powershell
# Commit vacío para forzar redeploy
git commit --allow-empty -m "fix: force rebuild frontend"
git push
```

Esperar 3-5 minutos para que Railway complete el build.

---

## 🔍 VERIFICACIÓN

### **En el navegador del usuario:**

1. **Abrir DevTools (F12)**
2. **Ir a Console tab**
3. **Buscar errores en rojo**
4. **Verificar que aparece:**
   ```
   Setting axios baseURL to: https://confident-bravery-production-ce7b.up.railway.app
   ```

### **Network Tab:**
5. **Verificar que cargan:**
   ```
   ✅ main.[hash].js → 200 OK
   ✅ main.[hash].css → 200 OK
   ```

---

## 📝 SI EL PROBLEMA PERSISTE

### **Capturar información de debugging:**

En Console del navegador ejecutar:

```javascript
// 1. Verificar que React está cargado
console.log('React version:', window.React);

// 2. Verificar errores
console.log('Errors:', window.onerror);

// 3. Verificar localStorage
console.log('User:', localStorage.getItem('user'));
console.log('Token:', localStorage.getItem('token'));

// 4. Verificar axios
console.log('Axios defaults:', window.axios?.defaults);
```

---

## 🎯 ACCIÓN INMEDIATA

1. **Hard Reload en el navegador** (Ctrl + Shift + R)
2. **Limpiar cache completamente**
3. **Verificar Console en DevTools** para errores específicos
4. **Intentar en ventana incógnito** para descartar extensiones del navegador

---

## 🔧 SI ES ERROR DE JAVASCRIPT

Si en Console aparece un error específico (ej: "Cannot read property X of undefined"), eso indica:

1. Un componente React está fallando
2. Posiblemente falta alguna validación de datos
3. El build podría estar incompleto

En ese caso:
- Capturar el error exacto de Console
- Proporcionar el stack trace completo
- Verificar en qué componente está fallando

---

## ✅ RESULTADO ESPERADO

Después del Hard Reload:
- ✅ Header visible con MUNDOXYZ
- ✅ Balance visible (🪙 0.00 🔥 4.75)
- ✅ Lobby de La Vieja visible
- ✅ Botón "Crear Sala" visible
- ✅ Navegación inferior visible

---

## 🆘 SI NADA FUNCIONA

**Último recurso - Rebuild completo:**

```powershell
# Cambiar algo en el código para forzar nuevo build
# Por ejemplo, agregar un espacio en cualquier archivo

git add .
git commit -m "fix: rebuild frontend para resolver pantalla negra"
git push
```

Esto forzará un build completamente nuevo en Railway.
