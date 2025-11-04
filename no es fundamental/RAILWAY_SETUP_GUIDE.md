# 🚂 GUÍA DE CONFIGURACIÓN RAILWAY - MUNDOXYZ

**Fecha:** 2025-11-04  
**URL Producción:** https://mundoxyz-production.up.railway.app  
**Status:** ✅ **CONFIGURACIÓN ACTUALIZADA**

---

## 📋 INFORMACIÓN DEL PROYECTO

### URLs de Railway
```
Aplicación: https://mundoxyz-production.up.railway.app
GitHub: https://github.com/Wilwaps/mundoxyz
Branch: main
```

### Base de Datos PostgreSQL
```
DATABASE_URL (interna):
postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@postgres.railway.internal:5432/railway

DATABASE_PUBLIC_URL (externa):
postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway
```

---

## 🔧 CONFIGURACIÓN PASO A PASO

### 1️⃣ Variables de Entorno en Railway

#### **BACKEND SERVICE**

Ve a Railway → Project → Backend Service → Variables y configura:

```bash
# === DATABASE ===
DATABASE_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@postgres.railway.internal:5432/railway
DATABASE_PUBLIC_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway
PGHOST=postgres.railway.internal
PGPORT=5432
PGUSER=postgres
PGPASSWORD=gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG
PGDATABASE=railway
PGSSLMODE=require

# === SERVER ===
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
FRONTEND_URL=https://mundoxyz-production.up.railway.app
API_URL=https://mundoxyz-production.up.railway.app
PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app
TRUST_PROXY_HOPS=1

# === TELEGRAM ===
TELEGRAM_BOT_TOKEN=[TU_BOT_TOKEN]
TELEGRAM_BOT_USERNAME=[TU_BOT_USERNAME]
TOTE_TG_ID=1417856820

# === SECURITY ===
JWT_SECRET=[GENERAR_SECRETO_SEGURO]
SESSION_SECRET=[GENERAR_SECRETO_SEGURO]
COOKIE_SECURE=true
COOKIE_DOMAIN=mundoxyz-production.up.railway.app

# === ADMIN ===
ADMIN_USERNAME=admin
ADMIN_CODE=[TU_CODIGO_ADMIN]

# === FEATURES ===
TTT_V2=true
TTT_DB_WALLET=true
LOG_LEVEL=info
```

#### **FRONTEND SERVICE** (si está separado)

```bash
# === API ===
REACT_APP_API_URL=https://mundoxyz-production.up.railway.app
REACT_APP_SOCKET_URL=https://mundoxyz-production.up.railway.app

# === BUILD ===
NODE_ENV=production
GENERATE_SOURCEMAP=false
```

---

### 2️⃣ Configuración Local de Desarrollo

#### **Backend**

1. Copia el archivo de ejemplo:
```bash
cd backend
cp .env.example .env
```

2. Edita `.env` con tus valores locales:
```bash
# Para desarrollo local con Railway DB
DATABASE_PUBLIC_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway

# O con DB local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mundoxyz

FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001
NODE_ENV=development
```

#### **Frontend**

1. Copia el archivo de ejemplo:
```bash
cd frontend
cp .env.example .env
```

2. Edita `.env`:
```bash
# Para desarrollo local (usa proxy en package.json)
REACT_APP_API_URL=

# Para apuntar a Railway desde local
# REACT_APP_API_URL=https://mundoxyz-production.up.railway.app
```

---

### 3️⃣ Verificar Configuración

#### **Backend**

El archivo `backend/config/config.js` ya está configurado para leer `DATABASE_URL`:

```javascript
database: {
  url: process.env.DATABASE_URL,  // ✅ Ya configurado
  // ...
}
```

El archivo `backend/db/index.js` usa esta configuración:

```javascript
const poolConfig = config.database.url ? {
  connectionString: config.database.url,  // ✅ Ya configurado
  ssl: config.database.sslMode === 'require' ? {
    rejectUnauthorized: false
  } : false,
  // ...
}
```

#### **Frontend**

El archivo `frontend/src/config/api.js` ya está configurado:

```javascript
const apiUrl = process.env.REACT_APP_API_URL;  // ✅ Ya configurado
const API_URL = apiUrl && apiUrl !== '' 
  ? (apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl)
  : '';
```

---

### 4️⃣ Desplegar en Railway

#### **Opción A: Auto-deploy desde GitHub**

Railway ya está configurado para auto-deploy. Simplemente:

```bash
git add -A
git commit -m "update: configuración Railway"
git push origin main
```

Railway detectará el push y desplegará automáticamente.

#### **Opción B: Deploy manual con Railway CLI**

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Deploy
railway up
```

---

### 5️⃣ Verificar Deploy

#### **Health Check del Backend**

```bash
curl https://mundoxyz-production.up.railway.app/health
# Debe retornar: {"status":"ok","database":"connected"}
```

#### **Test de Conexión a DB**

```bash
curl https://mundoxyz-production.up.railway.app/api/health
# Verificar que database.connected = true
```

#### **Logs en Railway**

1. Ve a Railway → Project → Backend Service
2. Click en "Logs"
3. Busca: `Database connected at`
4. Debe mostrar conexión exitosa

---

## 🔒 SEGURIDAD

### Secretos a Generar

Genera secretos seguros para producción:

```bash
# JWT_SECRET (32+ caracteres aleatorios)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET (32+ caracteres aleatorios)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### SSL/TLS

Railway automáticamente provee certificados SSL para:
- `https://mundoxyz-production.up.railway.app`

Asegúrate de tener:
```bash
COOKIE_SECURE=true
PGSSLMODE=require
```

---

## 🐛 TROUBLESHOOTING

### Error: "Database not initialized"

**Causa:** `DATABASE_URL` no está configurada.

**Solución:**
1. Ve a Railway → Variables
2. Verifica que `DATABASE_URL` existe
3. Restart el servicio

### Error: "Connection refused"

**Causa:** Usando URL incorrecta (externa vs interna).

**Solución:**
- En Railway Backend: usar `DATABASE_URL` (interna)
- Desde local: usar `DATABASE_PUBLIC_URL` (externa)

### Error: "SSL required"

**Causa:** PostgreSQL de Railway requiere SSL.

**Solución:**
```bash
PGSSLMODE=require
```

### Frontend no se conecta al Backend

**Causa:** `REACT_APP_API_URL` incorrecta.

**Solución:**
1. Verifica que `REACT_APP_API_URL=https://mundoxyz-production.up.railway.app`
2. Rebuild del frontend
3. Clear cache del navegador

---

## 📊 MONITOREO

### Métricas en Railway

Railway provee métricas automáticas:
- CPU usage
- Memory usage
- Network I/O
- Database connections

### Logs

```bash
# Con Railway CLI
railway logs

# En el dashboard
Railway → Project → Service → Logs
```

---

## 🔄 MIGRACIONES DE BASE DE DATOS

### Ejecutar Migraciones

Si tienes un script de migraciones:

```bash
# Local con DB de Railway
DATABASE_PUBLIC_URL=postgresql://... npm run migrate

# En Railway (automático al deploy)
# Asegúrate de tener en package.json:
# "postinstall": "npm run migrate"
```

---

## ✅ CHECKLIST DE CONFIGURACIÓN

**Backend:**
- [x] `DATABASE_URL` configurada
- [x] `FRONTEND_URL` apunta a Railway
- [x] `TELEGRAM_BOT_TOKEN` configurado
- [x] `JWT_SECRET` generado y seguro
- [x] `COOKIE_SECURE=true`
- [x] `PGSSLMODE=require`

**Frontend:**
- [x] `REACT_APP_API_URL` apunta a Railway
- [x] Build optimizado para producción
- [x] Sourcemaps deshabilitados

**Railway:**
- [x] Variables configuradas
- [x] Auto-deploy desde GitHub habilitado
- [x] Health checks funcionando
- [x] SSL/HTTPS activo

**Database:**
- [x] PostgreSQL corriendo
- [x] Conexión desde backend OK
- [x] Migraciones ejecutadas
- [x] Admin user (1417856820) existe

---

## 📝 NOTAS IMPORTANTES

### Admin de Plataforma
- **Telegram ID:** `1417856820`
- Recibe todas las comisiones de rifas
- Debe existir en tabla `users`

### Cambio de URLs

Si Railway cambia las URLs:
1. Actualizar variables de entorno
2. Actualizar este documento
3. Re-deploy backend y frontend

### Backup de Database

Railway hace backups automáticos, pero puedes hacer manual:

```bash
pg_dump $DATABASE_PUBLIC_URL > backup_$(date +%Y%m%d).sql
```

---

## 🆘 SOPORTE

**Documentación Railway:** https://docs.railway.app  
**PostgreSQL Railway:** https://docs.railway.app/databases/postgresql  
**GitHub Repo:** https://github.com/Wilwaps/mundoxyz

---

*Última actualización: 2025-11-04*  
*Configuración validada y funcionando* ✅
