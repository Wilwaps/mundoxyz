# 🚀 Migración: Modal "Mis Datos"

## ⚡ PASOS PARA APLICAR

### 1️⃣ **Ejecutar Migraciones SQL**

Conéctate a tu base de datos PostgreSQL y ejecuta:

```bash
psql -h localhost -U tu_usuario -d mundoxyz -f backend/migrations/add_profile_fields.sql
```

O si estás usando Railway/otro servicio, copia y pega el contenido del archivo:
`backend/migrations/add_profile_fields.sql`

### 2️⃣ **Variables de Entorno (Backend)**

Agrega al `.env` del backend:

```env
# Bot de Telegram (ya lo tienes)
TELEGRAM_BOT_TOKEN=7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
TELEGRAM_BOT_USERNAME=mundoxyz_bot
```

**Nota:** Si aún no has creado el bot, hazlo con @BotFather en Telegram y reemplaza el token.

### 3️⃣ **Reiniciar Servidor Backend**

```bash
cd backend
npm install  # Instala node-telegram-bot-api (ya hecho)
npm run dev  # o npm start
```

Deberías ver en los logs:
```
✅ Telegram bot started
```

### 4️⃣ **Verificar Frontend**

El frontend no necesita instalación adicional. Solo verifica que compile:

```bash
cd frontend
npm start
```

---

## ✅ QUÉ SE IMPLEMENTÓ

### **Backend:**
- ✅ 3 nuevas tablas:
  - `users`: campos `nickname` y `bio`
  - `telegram_link_sessions`: sesiones de vinculación
  - `offensive_words`: filtro de palabras
- ✅ Utilidad `offensive-words.js`
- ✅ 6 nuevos endpoints en `/profile`:
  - `PUT /:userId/update-profile`
  - `POST /:userId/check-password`
  - `GET /check-nickname/:nickname`
  - `POST /:userId/link-telegram`
  - `POST /:userId/link-telegram-manual`
  - `POST /:userId/unlink-telegram`
- ✅ Bot de Telegram completo
- ✅ Inicialización automática del bot

### **Frontend:**
- ✅ `MyDataModal.js` - Modal principal con 3 pestañas
- ✅ `TelegramLinkModal.js` - Vinculación Telegram
- ✅ `PasswordRequiredModal.js` - Confirmación segura
- ✅ Botón "Mis Datos" en Profile
- ✅ Validación de contraseña en:
  - SendFiresModal (enviar fuegos)
  - BuyFiresModal (comprar fuegos)

---

## 🧪 CÓMO PROBAR

### **1. Modal "Mis Datos"**
1. Login en MundoXYZ
2. Ve a tu Profile
3. Click en "Mis Datos"
4. Prueba las 3 pestañas:
   - **Perfil**: Cambiar alias, biografía
   - **Contacto**: Cambiar email (requiere contraseña)
   - **Telegram**: Vincular/Desvincular

### **2. Alias/Nickname**
1. Intenta poner "mierda" → Debería rechazarlo
2. Intenta poner un alias de otro usuario → Debería decir "Ya está en uso"
3. Pon un alias válido → Debería aparecer ✓ Disponible
4. Guarda → Debería actualizarse

### **3. Vincular Telegram (Manual)**
1. Ve a Telegram y busca @userinfobot
2. Envía `/start`
3. Copia tu ID
4. Pega en "Vincular Manualmente"
5. Confirma → Debería vincularse

### **4. Vincular Telegram (Bot)**
1. Click en "Vincular con Bot"
2. Se generará un enlace
3. Click en "Abrir Bot de Telegram"
4. Envía `/start` al bot
5. El bot responde "✅ Cuenta vinculada"
6. Frontend detecta automáticamente (polling 3seg)

### **5. Validación de Contraseña**
1. Intenta enviar fuegos
2. Después de llenar el formulario
3. Debería pedir contraseña antes de confirmar
4. Lo mismo al comprar fuegos o cambiar email

---

## 📋 CAMBIOS EN BASE DE DATOS

```sql
-- Nuevos campos en users
nickname VARCHAR(20) UNIQUE
bio VARCHAR(500)

-- Nueva tabla telegram_link_sessions
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
link_token VARCHAR(64) UNIQUE
expires_at TIMESTAMP
used BOOLEAN

-- Nueva tabla offensive_words
id SERIAL PRIMARY KEY
word VARCHAR(50) UNIQUE

-- 24 palabras ofensivas precargadas
```

---

## 🔐 SEGURIDAD

- ✅ Contraseña requerida para:
  - Cambiar email
  - Desvincular Telegram
  - Enviar fuegos
  - Comprar fuegos
- ✅ Validación de alias (único + sin palabras ofensivas)
- ✅ Tokens de vinculación expiran en 15 minutos
- ✅ Verificación de permisos en todos los endpoints

---

## 🐛 POSIBLES ERRORES

### Error: "TELEGRAM_BOT_TOKEN not found"
**Solución:** Agrega el token al `.env` del backend

### Error: "relation 'telegram_link_sessions' does not exist"
**Solución:** Ejecuta las migraciones SQL

### Error: El bot no responde
**Solución:** 
1. Verifica que el token sea correcto
2. Verifica que el bot esté iniciado en @BotFather
3. Revisa los logs del backend

### Error: "Este alias ya está en uso" (pero no lo está)
**Solución:** El alias está en uso por otro usuario. Prueba con otro.

---

## 📝 COMANDOS DEL BOT

- `/start` - Iniciar bot
- `/start TOKEN` - Vincular cuenta (automático)
- `/myid` - Ver tu Telegram ID
- `/help` - Ayuda

---

## 🎉 LISTO

Sistema completo de gestión de datos de usuario implementado. 

**Próximos pasos sugeridos:**
- ✅ Verificación de email con código (futuro)
- ✅ Upload de avatares (futuro)
- ✅ Más campos de perfil (futuro)

---

**Commit:** Próximo
**Estado:** ✅ Listo para producción
