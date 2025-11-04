# 🤖 TELEGRAM BOT - GUÍA DE CONFIGURACIÓN

## 📋 ÍNDICE
1. [Problema Detectado](#problema-detectado)
2. [Solución Implementada](#solución-implementada)
3. [Configuración Local (Desarrollo)](#configuración-local-desarrollo)
4. [Configuración Railway (Producción)](#configuración-railway-producción)
5. [Verificación](#verificación)
6. [Troubleshooting](#troubleshooting)

---

## 🔍 PROBLEMA DETECTADO

### ❌ Error 1: PUBLIC_WEBAPP_URL mal configurado
```env
# ❌ INCORRECTO (múltiples URLs)
PUBLIC_WEBAPP_URL=http://localhost:3001;https://confident-bravery-production-ce7b.up.railway.app/;https://mundoxyz-production.up.railway.app/

# ✅ CORRECTO (una sola URL)
PUBLIC_WEBAPP_URL=http://localhost:3001  # En desarrollo
PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app  # En producción
```

### ❌ Error 2: Polling no funciona en Railway
**Polling** requiere conexión persistente → Railway lo mata después de inactividad

**Solución:** Usar **webhooks** en producción

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Bot Adaptativo (Polling/Webhook)
- **Desarrollo** → Polling (más fácil de debuggear)
- **Producción** → Webhook (compatible con Railway)

### 2. Nueva Ruta Webhook
```
POST /api/telegram/webhook/:token
GET /api/telegram/health
```

### 3. Scripts de Configuración
- `setup-telegram-webhook.js` → Configura webhook en Telegram
- `delete-telegram-webhook.js` → Elimina webhook (para desarrollo)

---

## 🏠 CONFIGURACIÓN LOCAL (DESARROLLO)

### 1. Variables de Entorno (.env)
```env
# Telegram
TELEGRAM_BOT_TOKEN=8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU
TELEGRAM_BOT_USERNAME=mundoxyz_bot
TOTE_TG_ID=1417856820
PUBLIC_WEBAPP_URL=http://localhost:3001

# Servidor
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001
```

### 2. Eliminar Webhook (si existe)
```bash
node backend/scripts/delete-telegram-webhook.js
```

### 3. Iniciar Servidor
```bash
npm run dev
```

**Resultado esperado:**
```
✅ Database connected
✅ Telegram bot started
📱 Telegram Bot: @mundoxyz_bot
🚀 Server running on port 3000
```

### 4. Probar Bot
1. Abrir Telegram
2. Buscar `@mundoxyz_bot`
3. Enviar `/start`
4. Debe responder con mensaje de bienvenida

---

## 🚀 CONFIGURACIÓN RAILWAY (PRODUCCIÓN)

### 1. Variables en Railway Dashboard

Ve a: **Railway Dashboard → mundoxyz → Variables**

Agregar/Actualizar:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU
TELEGRAM_BOT_USERNAME=mundoxyz_bot
TOTE_TG_ID=1417856820
PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app

# Importante
NODE_ENV=production
```

**⚠️ CRÍTICO:** `PUBLIC_WEBAPP_URL` debe ser la URL exacta de Railway **SIN trailing slash**

### 2. Desplegar Cambios
```bash
git add .
git commit -m "fix: Telegram bot con webhook para Railway"
git push
```

### 3. Esperar Deploy (5-6 min)

### 4. Configurar Webhook

**Opción A: Desde Local**
```bash
# En tu .env temporal agregar:
PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app

# Ejecutar:
node backend/scripts/setup-telegram-webhook.js
```

**Opción B: Manualmente con curl**
```bash
curl -X POST https://api.telegram.org/bot8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url":"https://mundoxyz-production.up.railway.app/api/telegram/webhook/AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU"}'
```

**Resultado esperado:**
```json
{
  "ok": true,
  "result": {
    "url": "https://mundoxyz-production.up.railway.app/api/telegram/webhook/...",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

---

## ✅ VERIFICACIÓN

### 1. Verificar Webhook Activo
```bash
curl https://api.telegram.org/bot8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU/getWebhookInfo
```

Debe mostrar:
```json
{
  "ok": true,
  "result": {
    "url": "https://mundoxyz-production.up.railway.app/api/telegram/webhook/...",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0,
    "max_connections": 40
  }
}
```

### 2. Health Check del Bot
```bash
curl https://mundoxyz-production.up.railway.app/api/telegram/health
```

Debe responder:
```json
{
  "status": "active",
  "mode": "webhook"
}
```

### 3. Probar Bot en Producción
1. Telegram → `@mundoxyz_bot`
2. `/start`
3. Debe responder inmediatamente

### 4. Logs de Railway
Buscar en logs:
```
✅ Telegram bot started
Telegram bot initialized in WEBHOOK mode
```

---

## 🔧 TROUBLESHOOTING

### Problema: Bot no responde en Railway

**Verificar webhook:**
```bash
curl https://api.telegram.org/bot[TU_TOKEN]/getWebhookInfo
```

**Si `url` está vacío:**
```bash
node backend/scripts/setup-telegram-webhook.js
```

### Problema: Error 403 Forbidden

**Causa:** Token de webhook incorrecto

**Solución:** El token en la URL debe coincidir con la segunda parte del `TELEGRAM_BOT_TOKEN`

Ejemplo:
- Token completo: `8381840118:AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU`
- Token para URL: `AAGJZcWcBRIQn0JkU98hqsH3Z7NsWstGRNU`

### Problema: Bot responde en local pero no en Railway

1. **Verificar NODE_ENV:**
   ```bash
   # En Railway debe ser:
   NODE_ENV=production
   ```

2. **Verificar PUBLIC_WEBAPP_URL:**
   ```bash
   # Debe ser la URL de Railway exacta
   PUBLIC_WEBAPP_URL=https://mundoxyz-production.up.railway.app
   ```

3. **Re-configurar webhook:**
   ```bash
   node backend/scripts/setup-telegram-webhook.js
   ```

### Problema: Polling error en local

**Si ves:** `Error: 409 Conflict: terminated by other getUpdates request`

**Causa:** Webhook activo

**Solución:**
```bash
node backend/scripts/delete-telegram-webhook.js
```

---

## 📊 RESUMEN

| Entorno | Modo | Configuración |
|---------|------|---------------|
| **Local** | Polling | `NODE_ENV=development` |
| **Railway** | Webhook | `NODE_ENV=production` + Script setup |

### Comandos Rápidos

```bash
# Desarrollo (local)
node backend/scripts/delete-telegram-webhook.js
npm run dev

# Producción (Railway)
git add .
git commit -m "fix: Telegram bot webhook"
git push
# Esperar 6 min
node backend/scripts/setup-telegram-webhook.js
```

---

## 🎯 RESULTADO FINAL

✅ Bot funciona en **local** con polling  
✅ Bot funciona en **Railway** con webhook  
✅ Sin errores de conectividad  
✅ Respuesta inmediata en ambos entornos

---

## 📞 SOPORTE

Si persisten problemas:
1. Verificar logs de Railway
2. Verificar `getWebhookInfo`
3. Verificar variables de entorno
4. Re-ejecutar script de setup

**Telegram Admin:** @tote (ID: 1417856820)
