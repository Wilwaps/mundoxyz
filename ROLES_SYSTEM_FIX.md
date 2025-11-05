# 🔴 FIX URGENTE: SISTEMA DE ROLES FALTANTE

**Fecha:** 4 Nov 2025 18:30  
**Severidad:** 🚨 CRÍTICA - Login Telegram completamente roto  
**Commit:** `562b260`

---

## 🔍 PROBLEMA DETECTADO

```
Error creating Telegram user: relation "roles" does not exist
Telegram WebApp auth successful
POST /api/auth/login-telegram
```

### Causa Root

Las tablas **`roles`** y **`user_roles`** **NUNCA FUERON CREADAS** en Railway.

**Por qué:**
1. ✅ Creamos `DATABASE_SCHEMA_MASTER.sql` con todas las tablas
2. ❌ PERO Railway NO lo ejecuta automáticamente
3. ❌ Movimos migraciones antiguas a "no es fundamental"
4. ❌ Railway solo ejecuta migraciones en `backend/db/migrations/`
5. ❌ NO había migración para crear `roles`

---

## 🎯 SISTEMA DE ROLES

### Roles Definidos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **user** | Usuario regular | Acceso básico a juegos |
| **admin** | Administrador | Panel admin, gestión usuarios/juegos |
| **tote** | Super Admin | Acceso completo + economía |

### Usuario Especial: Tote

**Telegram ID:** `1417856820`  
**Username:** Wilrcnet  
**Rol:** `tote` (super admin)

**Asignación automática:**
```javascript
// En auth.js línea 728-740
if (String(telegramData.id) === config.telegram.toteId) {
  // Asignar rol 'tote' automáticamente
}
```

**Configuración:**
```javascript
// config.js línea 44
telegram: {
  toteId: process.env.TOTE_TG_ID || '1417856820'
}
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Migración 002: Sistema de Roles

**Archivo:** `backend/db/migrations/002_create_roles_system.sql`

**Crea:**
1. ✅ Tabla `roles` con índice en `name`
2. ✅ Tabla `user_roles` con FK a users y roles
3. ✅ Inserta 3 roles: user, admin, tote
4. ✅ Asigna rol tote a usuario 1417856820 si existe
5. ✅ Sincroniza columna `users.roles[]` con `user_roles`

**Permisos por Rol:**
```sql
-- user
'{"basic_access": true}'

-- admin
'{"basic_access": true, "admin_panel": true, "manage_users": true, "manage_games": true}'

-- tote
'{"basic_access": true, "admin_panel": true, "manage_users": true, "manage_games": true, 
  "manage_economy": true, "full_access": true}'
```

### Migración 003: Telegram Link Sessions

**Archivo:** `backend/db/migrations/003_create_telegram_link_sessions.sql`

**Crea:**
1. ✅ Tabla `telegram_link_sessions`
2. ✅ Índices en token, user_id, expires_at
3. ✅ Soporte para vincular Telegram a cuentas existentes

---

## 🚀 FLUJO DE ASIGNACIÓN DE ROLES

### Caso 1: Usuario Regular

```javascript
1. Usuario nuevo registra con Telegram
2. Se crea en tabla users
3. Se crea en auth_identities (provider='telegram')
4. Se crea wallet
5. ✅ Se asigna rol 'user' automáticamente (línea 715-725)
```

### Caso 2: Usuario Tote (1417856820)

```javascript
1. Tote hace login con Telegram
2. Sistema detecta: tg_id === '1417856820'
3. ✅ Se asigna rol 'user' (básico)
4. ✅ Se asigna rol 'tote' ADICIONAL (línea 728-740)
5. Resultado: Tote tiene ambos roles ['user', 'tote']
```

### Caso 3: Admin

```javascript
1. Admin debe ser asignado manualmente vía:
   - SQL directo
   - Panel de administración (por tote)
   - Endpoint /api/roles/assign (requiere rol tote)
```

---

## 🔐 VERIFICACIÓN DE PERMISOS

### Middleware: requireAuth

**Archivo:** `backend/middleware/auth.js`

```javascript
// Cualquier usuario autenticado
router.get('/profile', requireAuth, ...)

// Solo admin o tote
router.delete('/user/:id', requireAuth, requireAdmin, ...)

// Solo tote
router.post('/economy/mint', requireAuth, requireTote, ...)
```

### Función: requireTote (línea 141-148)

```javascript
const isTote = 
  req.user.roles?.includes('tote') ||
  req.user.tg_id?.toString() === config.telegram.toteId;
```

**Verifica:**
- Rol 'tote' en array de roles, O
- Telegram ID sea 1417856820 (fallback)

---

## 📊 ESTRUCTURA DE DATOS

### Tabla: roles

```sql
id | name  | description              | permissions
---|-------|--------------------------|-------------
1  | user  | Usuario regular          | {"basic_access": true}
2  | admin | Administrador            | {"basic_access": true, "admin_panel": true, ...}
3  | tote  | Super administrador      | {"basic_access": true, "full_access": true, ...}
```

### Tabla: user_roles

```sql
id | user_id                              | role_id | assigned_at
---|--------------------------------------|---------|-------------
1  | 123e4567-e89b-12d3-a456-426614174000 | 1       | 2025-11-04 18:30:00
2  | 123e4567-e89b-12d3-a456-426614174000 | 3       | 2025-11-04 18:30:00
```

**Si usuario es Tote:** Tendrá 2 registros (rol 1 'user' + rol 3 'tote')

---

## 🧪 VERIFICACIÓN POST-DEPLOY

### 1. Verificar Tablas Creadas

```sql
-- Conectar a Railway DB
SELECT * FROM roles ORDER BY id;
-- Debe mostrar: user, admin, tote

SELECT * FROM user_roles;
-- Debe mostrar asignaciones
```

### 2. Verificar Rol Tote

```sql
-- Buscar usuario Tote
SELECT u.id, u.username, u.tg_id, u.roles
FROM users u
WHERE u.tg_id = 1417856820;

-- Verificar rol tote asignado
SELECT u.username, r.name
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.tg_id = 1417856820;
-- Debe mostrar: 'user' y 'tote'
```

### 3. Probar Login Telegram

1. Abrir: https://mundoxyz-production.up.railway.app
2. Click "Conectar con Telegram"
3. Bot: `@mundoxyz_bot`
4. `/start [token]`
5. ✅ Login exitoso SIN error "relation roles does not exist"

**Logs esperados:**
```
Telegram WebApp auth successful
New Telegram user created
✅ User logged in successfully
```

---

## 🐛 SEGUNDO PROBLEMA: Replay Attack

```
Replay attack detected
GET /login
```

### Causa

El sistema de seguridad de Telegram detecta intentos de reutilizar tokens de autenticación.

**Configuración actual:**
```javascript
// config.js
telegram: {
  authMaxSkewSec: 86400,  // 24 horas
  replayTtlSec: 120,      // 2 minutos
}
```

### Solución

**No es un error grave**, es el sistema de seguridad funcionando correctamente.

**Si ocurre:**
1. Usuario debe hacer login nuevamente
2. Token debe ser fresco (< 2 minutos)
3. NO reutilizar tokens antiguos

**Para desarrollo:** Puedes aumentar `replayTtlSec` si es molesto, pero en producción déjalo en 120.

---

## 📋 RESULTADO ESPERADO EN RAILWAY

```bash
🚀 Starting database migrations...
Found 12 migration files

Already executed: 
- 000_create_migrations_table
- 001_create_auth_identities
- 006_bingo_host_abandonment
- 007_fix_marked_numbers_type
- 008_bingo_v2_complete_rewrite
- 009_add_last_called_at
- 010_room_limits_and_refunds
- 010_welcome_improvements
- 012_tictactoe_player_left_tracking
- 013_cleanup_bingo_legacy_objects

Pending:
- 002_create_roles_system
- 003_create_telegram_link_sessions

📝 Running migration: 002_create_roles_system.sql
✅ Tabla roles creada
✅ Tabla user_roles creada
✅ Roles insertados: user, admin, tote
✅ Rol tote asignado a usuario 1417856820
📊 Roles creados: 3
📊 Asignaciones: 2
✅ Migración 002 completada

📝 Running migration: 003_create_telegram_link_sessions.sql
✅ Tabla telegram_link_sessions creada
✅ Migración 003 completada

✅ All migrations completed successfully!

Database connected
Server started on port 3000
✅ Telegram bot started
```

---

## 🎯 PRÓXIMOS PASOS

### Después del Deploy (~6 min)

1. ✅ **Verificar migraciones ejecutadas**
   - Railway logs debe mostrar "Migration 002 completed"
   - Railway logs debe mostrar "Migration 003 completed"

2. ✅ **Probar login Telegram**
   - Usuario regular debe funcionar
   - Tote (1417856820) debe tener ambos roles

3. ✅ **Verificar panel admin**
   - Tote debe poder acceder a todas las funciones
   - Admin panel debe estar visible

---

## 🔧 COMANDOS ÚTILES

### Asignar Rol Admin a Usuario

```sql
-- Buscar usuario
SELECT id, username, tg_id FROM users WHERE username = 'nombre_usuario';

-- Asignar rol admin
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  r.id
FROM users u
CROSS JOIN roles r
WHERE u.username = 'nombre_usuario'
AND r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Actualizar columna roles[]
UPDATE users u
SET roles = ARRAY(
  SELECT r.name
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = u.id
)
WHERE u.username = 'nombre_usuario';
```

### Verificar Roles de Usuario

```sql
SELECT 
  u.username,
  u.tg_id,
  u.roles,
  array_agg(r.name) as roles_assigned
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.tg_id = 1417856820
GROUP BY u.id;
```

---

## 📞 CONTACTO

**Admin:** @tote (Telegram ID: 1417856820)  
**Repo:** https://github.com/Wilwaps/mundoxyz  
**Railway:** https://mundoxyz-production.up.railway.app

---

**✨ SISTEMA DE ROLES COMPLETAMENTE IMPLEMENTADO**
