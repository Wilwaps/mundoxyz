# 📋 INSTRUCCIONES COMPLETAS DE DEPLOYMENT - MUNDOXYZ

## 🚀 PASO A PASO PARA LEVANTAR EL PROYECTO

### 1️⃣ DESARROLLO LOCAL (Tu PC)

#### A. Preparación inicial
```powershell
# Navega al directorio del proyecto
cd "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ"

# Instalar dependencias del backend
npm install

# Instalar dependencias del frontend
cd frontend
npm install
cd ..
```

#### B. Configurar Base de Datos con Docker
```powershell
# Levantar los contenedores de PostgreSQL y Redis
docker-compose up -d

# Verificar que estén corriendo
docker ps

# Esperar 10 segundos para que PostgreSQL esté listo
Start-Sleep -Seconds 10

# Ejecutar las migraciones
node backend/db/migrate.js
```

#### C. Iniciar el servidor de desarrollo
```powershell
# Opción 1: Iniciar backend y frontend juntos
npm run dev

# Opción 2: Iniciar por separado (en diferentes terminales)
# Terminal 1 - Backend:
npm run server:dev

# Terminal 2 - Frontend:
cd frontend
npm start
```

**El proyecto estará disponible en:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Adminer (DB): http://localhost:8080

---

### 2️⃣ DEPLOYMENT EN RAILWAY

#### A. Preparar el repositorio GitHub

```powershell
# Asegúrate de estar en el directorio del proyecto
cd "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ"

# Inicializar git (si no está iniciado)
git init

# Agregar todos los archivos
git add -A

# Crear commit
git commit -m "Initial deployment: MUNDOXYZ Telegram MiniApp"

# Agregar el repositorio remoto
git remote add origin https://github.com/alejodriguez/mundoxyz.git

# Subir al repositorio
git push -u origin main
```

#### B. Configurar en Railway

1. **Entra a Railway.app** y conecta tu GitHub

2. **Crea un nuevo proyecto** desde el repositorio `mundoxyz`

3. **Agrega los servicios necesarios:**
   - Click en "New" → "Database" → **PostgreSQL**
   - Click en "New" → "Database" → **Redis**

4. **Configura las variables de entorno** en Railway:

```env
# === PRODUCCIÓN - Variables para Railway ===
NODE_ENV=production
PORT=3000

# Telegram (YA CONFIGURADO)
TELEGRAM_BOT_TOKEN=8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU
TELEGRAM_BOT_USERNAME=mundoxyz_bot
TOTE_TG_ID=1417856820

# URLs (Railway las genera automáticamente)
FRONTEND_URL=${{RAILWAY_STATIC_URL}}
PUBLIC_WEBAPP_URL=${{RAILWAY_STATIC_URL}}

# Base de datos (Railway las configura automáticamente)
DATABASE_URL=${{DATABASE_URL}}
REDIS_URL=${{REDIS_URL}}

# Seguridad
JWT_SECRET=mundoxyz-production-secret-2024-secure-key
SESSION_SECRET=mundoxyz-session-production-2024
COOKIE_SECURE=true
COOKIE_DOMAIN=${{RAILWAY_STATIC_URL}}

# Admin
ADMIN_USERNAME=Tote
ADMIN_CODE=mundoxyz2024

# Roles
ROLE_TOTE_USER_IDS=tg:1417856820
ROLE_ADMIN_USER_IDS=tg:1417856820
TOTE_ID=1417856820

# Features
TTT_V2=true
TTT_DB_WALLET=true
WELCOME_AUTOSTART=true
ECONOMY_DEV_AUTO_SEED=false
```

5. **Deploy automático:**
   - Railway detectará automáticamente el `package.json` y `railway.json`
   - Se ejecutará el build del frontend
   - Se ejecutarán las migraciones automáticamente
   - El servidor se iniciará

---

### 3️⃣ CONFIGURAR TELEGRAM BOT

1. **Abre BotFather** en Telegram: @BotFather

2. **Configura el WebApp:**
```
/setmenubutton
Selecciona tu bot: @mundoxyz_bot
Envía el texto del botón: 🎮 Abrir MUNDOXYZ
Envía la URL: https://tu-app.railway.app
```

3. **Configura la descripción:**
```
/setdescription
Selecciona tu bot: @mundoxyz_bot
Envía: MiniApp de juegos con economía dual 🔥🪙
```

4. **Configura los comandos:**
```
/setcommands
Selecciona tu bot: @mundoxyz_bot
start - Iniciar MiniApp
help - Ayuda
stats - Ver estadísticas
```

---

### 4️⃣ VERIFICACIÓN POST-DEPLOYMENT

#### A. Verificar servicios:
```bash
# Health check del backend
curl https://tu-app.railway.app/health

# Health check de la base de datos
curl https://tu-app.railway.app/api/health/db
```

#### B. Probar en Telegram:
1. Abre @mundoxyz_bot en Telegram
2. Presiona el botón del menú para abrir la MiniApp
3. Inicia sesión con tu cuenta de Telegram
4. Verifica que puedas ver los juegos

---

### 5️⃣ COMANDOS ÚTILES

#### Para desarrollo:
```powershell
# Ver logs de Docker
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Limpiar y reconstruir
docker-compose down -v
docker-compose up -d

# Ver logs del servidor
npm run server:dev
```

#### Para Git:
```powershell
# Hacer commit de cambios
git add -A
$message = "feat: descripción del cambio"
Set-Content -Path .git\COMMIT_MSG.txt -Value $message
git commit -F .git\COMMIT_MSG.txt
git push -u origin main
```

#### Para Railway:
```bash
# Ver logs en Railway CLI
railway logs

# Ejecutar comandos en Railway
railway run npm run migrate
```

---

### 6️⃣ SOLUCIÓN DE PROBLEMAS

**Error: "Cannot connect to database"**
- Verifica que Docker esté corriendo
- Verifica las credenciales en `.env`
- Ejecuta: `docker-compose restart postgres`

**Error: "Telegram auth failed"**
- Verifica el TELEGRAM_BOT_TOKEN
- Asegúrate de estar usando HTTPS en producción

**Error: "Port already in use"**
- Cambia el puerto en `.env`
- O detén el proceso: `taskkill /F /IM node.exe`

**Frontend no se conecta al backend:**
- Verifica CORS en `backend/server.js`
- Verifica que el proxy en `frontend/package.json` apunte al backend

---

### 7️⃣ MONITOREO

- **Logs**: Railway Dashboard → Deployments → View Logs
- **Base de datos**: Usa Adminer en local o Railway DB Dashboard
- **Métricas**: Railway Dashboard → Metrics
- **Errores**: Revisa `/logs/error.log` en el servidor

---

## ✅ CHECKLIST FINAL

- [ ] Docker Desktop está corriendo
- [ ] PostgreSQL y Redis están activos
- [ ] Migraciones ejecutadas exitosamente
- [ ] Backend responde en `/health`
- [ ] Frontend se carga correctamente
- [ ] Telegram Bot configurado con WebApp
- [ ] Variables de entorno en Railway configuradas
- [ ] Deploy en Railway exitoso
- [ ] MiniApp funciona en Telegram

---

## 🎉 ¡LISTO!

Tu aplicación MUNDOXYZ debería estar funcionando en:
- **Local**: http://localhost:3000
- **Producción**: https://tu-app.railway.app
- **Telegram**: @mundoxyz_bot

Para soporte o dudas, revisa los logs o contacta al Tote.
