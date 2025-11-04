# 🔧 CONFIGURAR VARIABLES EN RAILWAY - INSTRUCCIONES EXACTAS

**Commit:** `bc8250d`  
**Status:** ✅ **CÓDIGO ACTUALIZADO - CONFIGURAR VARIABLES AHORA**

---

## ⚡ ACCIÓN INMEDIATA REQUERIDA

El código ya está actualizado en GitHub. Ahora debes **configurar las variables de entorno en Railway**.

---

## 🎯 PASO 1: ABRIR RAILWAY DASHBOARD

1. Ve a: https://railway.app
2. Login con tu cuenta
3. Selecciona el proyecto **mundoxyz**
4. Click en el servicio **Backend** (o el servicio principal)

---

## 🔑 PASO 2: CONFIGURAR VARIABLES

Click en la pestaña **"Variables"** y agrega las siguientes:

### ✅ VARIABLES OBLIGATORIAS (COPIAR Y PEGAR)

```bash
DATABASE_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@postgres.railway.internal:5432/railway

DATABASE_PUBLIC_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway

PGHOST=postgres.railway.internal
PGPORT=5432
PGUSER=postgres
PGPASSWORD=gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG
PGDATABASE=railway
PGSSLMODE=require

PORT=3000
HOST=0.0.0.0
NODE_ENV=production

FRONTEND_URL=https://mundoxyz-production.up.railway.app
API_URL=https://mundoxyz-production.up.railway.app
PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app

TRUST_PROXY_HOPS=1
COOKIE_SECURE=true
COOKIE_DOMAIN=mundoxyz-production.up.railway.app

TTT_V2=true
TTT_DB_WALLET=true
LOG_LEVEL=info
```

### 🔐 VARIABLES QUE NECESITAS COMPLETAR

Estas variables requieren tus valores privados:

```bash
TELEGRAM_BOT_TOKEN=[PEGA_TU_TOKEN_AQUÍ]
TELEGRAM_BOT_USERNAME=[PEGA_TU_USERNAME_AQUÍ]
TOTE_TG_ID=1417856820

JWT_SECRET=[GENERA_UN_SECRETO_SEGURO]
SESSION_SECRET=[GENERA_OTRO_SECRETO_SEGURO]

ADMIN_USERNAME=admin
ADMIN_CODE=[TU_CODIGO_ADMIN]
```

### 🔑 GENERAR SECRETOS SEGUROS

En tu terminal local (PowerShell), ejecuta:

```powershell
# Para JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Para SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia los resultados y pégalos en Railway.

---

## 🎨 PASO 3: SI TIENES SERVICIO FRONTEND SEPARADO

Si el frontend está en un servicio separado en Railway:

1. Click en el servicio **Frontend**
2. Ve a **Variables**
3. Agrega:

```bash
REACT_APP_API_URL=https://mundoxyz-production.up.railway.app
REACT_APP_SOCKET_URL=https://mundoxyz-production.up.railway.app
NODE_ENV=production
GENERATE_SOURCEMAP=false
```

---

## 🚀 PASO 4: REDEPLOY

Una vez configuradas todas las variables:

1. Click en el servicio **Backend**
2. Click en **"Deploy"** → **"Redeploy"**
3. Espera ~2-3 minutos

Railway detectará las nuevas variables y re-desplegará automáticamente.

---

## ✅ PASO 5: VERIFICAR QUE TODO FUNCIONA

### Test 1: Health Check

Abre en tu navegador:
```
https://mundoxyz-production.up.railway.app/health
```

Debe retornar:
```json
{
  "status": "ok",
  "database": "connected"
}
```

### Test 2: Ver Logs

1. En Railway → Backend → **Logs**
2. Busca la línea: `Database connected at`
3. Debe aparecer sin errores

### Test 3: Abrir la App

```
https://mundoxyz-production.up.railway.app
```

Debe cargar la interfaz correctamente.

---

## ❌ SI HAY ERRORES

### Error: "Database not initialized"

**Causa:** `DATABASE_URL` no está configurada o tiene error de sintaxis.

**Solución:**
1. Verifica que copiaste exactamente: `postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@postgres.railway.internal:5432/railway`
2. No debe tener espacios al inicio o final
3. Restart el servicio

### Error: "Connection refused"

**Causa:** Variables de PostgreSQL incorrectas.

**Solución:**
- Verifica `PGHOST=postgres.railway.internal`
- Verifica `PGSSLMODE=require`
- Restart el servicio

### Frontend no carga

**Causa:** `REACT_APP_API_URL` incorrecta o faltante.

**Solución:**
1. Si frontend está en el mismo servicio: no hace falta la variable
2. Si frontend está separado: agrega `REACT_APP_API_URL=https://mundoxyz-production.up.railway.app`
3. Redeploy frontend

---

## 📋 CHECKLIST FINAL

Marca cuando completes cada paso:

**Configuración:**
- [ ] Variables de DATABASE_URL configuradas
- [ ] Variables de servidor (PORT, HOST, etc.) configuradas
- [ ] TELEGRAM_BOT_TOKEN agregado
- [ ] JWT_SECRET generado y agregado
- [ ] SESSION_SECRET generado y agregado
- [ ] ADMIN_CODE configurado

**Deploy:**
- [ ] Backend re-desplegado
- [ ] Logs muestran "Database connected"
- [ ] Health check responde OK
- [ ] App carga correctamente

**Opcional (si aplica):**
- [ ] Frontend service configurado
- [ ] REACT_APP_API_URL agregada
- [ ] Frontend re-desplegado

---

## 🎉 CUANDO TODO ESTÉ LISTO

El sistema estará completamente funcional con:
- ✅ Base de datos Railway conectada
- ✅ URLs correctas configuradas
- ✅ Seguridad configurada (SSL, secrets)
- ✅ Auto-deploy desde GitHub funcionando

---

## 📞 RESUMEN DE URLs

```
App Principal:    https://mundoxyz-production.up.railway.app
GitHub Repo:      https://github.com/Wilwaps/mundoxyz
Database Interna: postgres.railway.internal:5432
Database Externa: shuttle.proxy.rlwy.net:10199
```

---

## 📚 DOCUMENTACIÓN ADICIONAL

Para más detalles, revisa:
- `RAILWAY_SETUP_GUIDE.md` - Guía completa
- `backend/.env.example` - Todas las variables disponibles
- `frontend/.env.example` - Variables del frontend

---

*Configuración lista - Solo falta agregar variables en Railway* ✅
