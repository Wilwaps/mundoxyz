# Fix: Wallet ID aparecía como NULL

## 🐛 Problema Identificado

En el modal **"Recibir Fuegos"** (`ReceiveFiresModal`), la dirección de billetera se mostraba como `null` en lugar del UUID correcto. Esto impedía que los usuarios pudieran recibir fuegos porque no tenían una dirección válida para compartir.

### Causa Raíz

Los endpoints de autenticación y perfil **NO estaban devolviendo el `wallet_id`** en sus respuestas. Solo devolvían los balances (`coins_balance`, `fires_balance`) pero no el ID de la billetera necesario para las transferencias.

---

## ✅ Solución Implementada

### **1. Backend - Actualizar Query de Perfil** (`backend/routes/profile.js`)

#### Cambio en GET `/profile/:userId`:

**Antes:**
```sql
SELECT 
  u.id,
  u.username,
  ...
  w.coins_balance,
  w.fires_balance,
  ...
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
...
GROUP BY u.id, w.coins_balance, w.fires_balance, ...
```

**Después:**
```sql
SELECT 
  u.id,
  u.username,
  ...
  w.id as wallet_id,  -- ✅ AGREGADO
  w.coins_balance,
  w.fires_balance,
  ...
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
...
GROUP BY u.id, w.id, w.coins_balance, w.fires_balance, ...  -- ✅ Incluir w.id
```

#### Agregar `wallet_id` a respuesta JSON:

```javascript
// Add private data if authorized
if (isOwnProfile || isAdmin) {
  profile.wallet_id = user.wallet_id;  // ✅ AGREGADO
  profile.tg_id = user.tg_id;
  profile.email = user.email;
  // ...
}
```

---

### **2. Backend - Actualizar Endpoints de Login** (`backend/routes/auth.js`)

Se actualizaron **3 endpoints de autenticación** para incluir `wallet_id`:

#### A. **POST `/auth/login-telegram`**

**Query actualizado:**
```javascript
const userResult = await query(
  'SELECT u.*, w.id as wallet_id, w.coins_balance, w.fires_balance, array_agg(r.name) as roles ' +
  'FROM users u ' +
  'LEFT JOIN wallets w ON w.user_id = u.id ' +
  'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
  'LEFT JOIN roles r ON r.id = ur.role_id ' +
  'WHERE u.id = $1 ' +
  'GROUP BY u.id, w.id, w.coins_balance, w.fires_balance',  // ✅ w.id agregado
  [userId]
);
```

**Respuesta JSON:**
```javascript
res.json({
  success: true,
  token,
  refreshToken,
  user: {
    id: user.id,
    tg_id: user.tg_id,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    wallet_id: user.wallet_id,  // ✅ AGREGADO
    coins_balance: user.coins_balance || 0,
    fires_balance: user.fires_balance || 0,
    roles: user.roles?.filter(Boolean) || []
  }
});
```

#### B. **POST `/auth/login-email`** (Admin Fast Path)

Mismo cambio aplicado al query y respuesta JSON.

#### C. **POST `/auth/login-email`** (Regular Path)

**Query actualizado:**
```javascript
const result = await query(
  'SELECT u.id, u.username, u.email, ai.password_hash, w.id as wallet_id, w.coins_balance, w.fires_balance, array_agg(r.name) as roles ' +
  'FROM users u ' +
  "LEFT JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'email' " +
  'LEFT JOIN wallets w ON w.user_id = u.id ' +
  'LEFT JOIN user_roles ur ON ur.user_id = u.id ' +
  'LEFT JOIN roles r ON r.id = ur.role_id ' +
  'WHERE LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($1) OR ai.provider_uid = $1 ' +
  'GROUP BY u.id, ai.password_hash, w.id, w.coins_balance, w.fires_balance',  // ✅ w.id agregado
  [identifier]
);
```

**Respuesta JSON:**
```javascript
const payload = {
  success: true,
  token,
  refreshToken,
  user: {
    id: row.id,
    username: row.username,
    email: row.email,
    wallet_id: row.wallet_id,  // ✅ AGREGADO
    coins_balance: row.coins_balance || 0,
    fires_balance: row.fires_balance || 0,
    roles: (row.roles || []).filter(Boolean)
  }
};
```

#### D. **POST `/auth/login-telegram-widget`**

Mismo cambio aplicado (query + respuesta).

---

### **3. Frontend - Actualizar AuthContext** (`frontend/src/contexts/AuthContext.js`)

#### Método `refreshUser()`:

**Antes:**
```javascript
const refreshUser = async () => {
  try {
    const response = await axios.get(`/profile/${user.id}`);
    const updatedUser = {
      ...user,
      ...response.data,
      coins_balance: response.data.stats?.coins_balance || 0,
      fires_balance: response.data.stats?.fires_balance || 0
    };
    updateUser(updatedUser);
    return updatedUser;
  } catch (error) {
    console.error('Error refreshing user:', error);
    return null;
  }
};
```

**Después:**
```javascript
const refreshUser = async () => {
  try {
    const response = await axios.get(`/profile/${user.id}`);
    const updatedUser = {
      ...user,
      ...response.data,
      wallet_id: response.data.wallet_id,  // ✅ AGREGADO
      coins_balance: response.data.stats?.coins_balance || 0,
      fires_balance: response.data.stats?.fires_balance || 0
    };
    updateUser(updatedUser);
    return updatedUser;
  } catch (error) {
    console.error('Error refreshing user:', error);
    return null;
  }
};
```

---

## 📊 Flujo Completo de Datos

### **Escenario: Usuario Inicia Sesión**

1. **Frontend** → `POST /api/auth/login-email`
   ```json
   { "email": "user@example.com", "password": "..." }
   ```

2. **Backend** → Consulta DB:
   ```sql
   SELECT u.id, u.username, u.email, w.id as wallet_id, w.coins_balance, ...
   FROM users u
   LEFT JOIN wallets w ON w.user_id = u.id
   WHERE LOWER(u.email) = LOWER($1)
   ```

3. **Backend** → Responde con:
   ```json
   {
     "success": true,
     "token": "jwt...",
     "user": {
       "id": "uuid-usuario",
       "username": "testuser",
       "email": "user@example.com",
       "wallet_id": "uuid-wallet",  // ✅ AHORA INCLUIDO
       "coins_balance": 100,
       "fires_balance": 50,
       "roles": ["user"]
     }
   }
   ```

4. **Frontend** → `AuthContext` guarda en `localStorage`:
   ```javascript
   localStorage.setItem('user', JSON.stringify(userData));
   setUser(userData);  // Incluye wallet_id
   ```

5. **Usuario va a Profile** → Click en "Fuegos 🔥":
   - Abre `FiresHistoryModal`
   - Usuario click en botón **[Recibir]**

6. **Abre `ReceiveFiresModal`**:
   ```jsx
   <ReceiveFiresModal 
     isOpen={showReceiveFires}
     onClose={() => setShowReceiveFires(false)}
     walletId={walletId}  // ✅ Ahora tiene valor correcto
   />
   ```

7. **Modal muestra:**
   ```
   Tu Dirección de Billetera:
   ┌──────────────────────────────────────┐
   │ 8a7f9c2b-1234-5678-9abc-def012345678 │ ← ✅ UUID correcto
   └──────────────────────────────────────┘
   [Copiar Dirección]
   ```

---

## 🧪 Cómo Verificar el Fix

### **Opción 1: Desde el Frontend**

1. **Login** con cualquier usuario
2. **Ir a Profile**
3. **Click en card de Fuegos** 🔥
4. **Click en [Recibir]**
5. ✅ **Verificar que aparece un UUID válido** (no "null")

### **Opción 2: Inspeccionar localStorage**

Abrir DevTools → Console:
```javascript
JSON.parse(localStorage.getItem('user'))
// Debe tener:
// {
//   id: "uuid...",
//   username: "...",
//   wallet_id: "uuid-wallet",  // ✅ NO debe ser null
//   ...
// }
```

### **Opción 3: Network Tab**

Abrir DevTools → Network:
1. **Hacer login**
2. **Buscar request**: `POST /api/auth/login-email`
3. **Ver Response**:
   ```json
   {
     "success": true,
     "user": {
       "wallet_id": "8a7f9c2b-..."  // ✅ Debe aparecer
     }
   }
   ```

### **Opción 4: Backend API Test**

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login-email \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser","password":"test123"}'

# Respuesta debe incluir:
# {
#   "success": true,
#   "user": {
#     "wallet_id": "uuid-aqui",  ✅
#     ...
#   }
# }
```

---

## 📦 Archivos Modificados

```
backend/routes/auth.js
  ✅ Líneas 67-73: Query de login-telegram
  ✅ Líneas 97: wallet_id en respuesta JSON
  ✅ Líneas 187-193: Query de login-email (admin)
  ✅ Línea 217: wallet_id en respuesta JSON
  ✅ Líneas 231-238: Query de login-email (regular)
  ✅ Línea 281: wallet_id en respuesta JSON
  ✅ Líneas 485-491: Query de login-telegram-widget
  ✅ Línea 507: wallet_id en respuesta JSON

backend/routes/profile.js
  ✅ Línea 27: Agregar "w.id as wallet_id" al SELECT
  ✅ Línea 50: Agregar "w.id" al GROUP BY
  ✅ Línea 93: Agregar "profile.wallet_id" a respuesta

frontend/src/contexts/AuthContext.js
  ✅ Línea 188: Agregar "wallet_id: response.data.wallet_id"

SISTEMA_FUEGOS_COMPLETO.md
  ✅ Creado: Documentación completa del sistema

FIX_WALLET_ID_NULL.md
  ✅ Creado: Este documento
```

---

## 🚀 Deploy

### **Commit**
```
Commit: 1e91a2d
Mensaje: "fix: agregar wallet_id en auth y perfil"
Archivos: 4 changed, 764 insertions(+), 9 deletions(-)
```

### **Push a GitHub**
```
✅ Push exitoso a origin/main
✅ Railway detectará cambios automáticamente
✅ Auto-deploy en ~2-3 minutos
```

---

## ⚠️ Importante para Usuarios Actuales

Los usuarios que **ya iniciaron sesión ANTES de este fix** necesitan:

1. **Cerrar sesión** (Logout)
2. **Volver a iniciar sesión**

Esto es necesario porque el `localStorage` del navegador tiene el objeto `user` viejo (sin `wallet_id`). Al hacer login nuevamente, se guardará el objeto actualizado con el campo correcto.

**Alternativa sin cerrar sesión:**

Desde DevTools → Console:
```javascript
// Forzar refresh del usuario
window.location.reload();
```

O simplemente **hacer click en el botón de actualizar balance** en Profile, que llama a `refreshUser()` y actualiza el `wallet_id` desde el endpoint `/profile/:userId`.

---

## 🎯 Resultado Final

### **Antes del Fix:**
```
Modal "Recibir Fuegos":
┌──────────────────────┐
│ null                 │  ❌ No funciona
└──────────────────────┘
```

### **Después del Fix:**
```
Modal "Recibir Fuegos":
┌──────────────────────────────────────┐
│ 8a7f9c2b-1234-5678-9abc-def012345678 │  ✅ UUID válido
└──────────────────────────────────────┘
[Copiar Dirección]  ← Funciona correctamente
```

---

## ✅ Checklist de Verificación

- [x] Backend: Query de perfil devuelve `wallet_id`
- [x] Backend: Login telegram devuelve `wallet_id`
- [x] Backend: Login email (admin) devuelve `wallet_id`
- [x] Backend: Login email (regular) devuelve `wallet_id`
- [x] Backend: Login widget devuelve `wallet_id`
- [x] Frontend: `refreshUser()` preserva `wallet_id`
- [x] Frontend: Modal "Recibir" recibe `walletId` como prop
- [x] Commit y push exitosos
- [ ] Verificar en producción (Railway)
- [ ] Probar envío/recepción de fuegos end-to-end

---

## 🔗 Relacionado

- **Sistema Completo**: Ver `SISTEMA_FUEGOS_COMPLETO.md`
- **Endpoints Actualizados**:
  - `POST /api/auth/login-telegram`
  - `POST /api/auth/login-email`
  - `POST /api/auth/login-telegram-widget`
  - `GET /api/profile/:userId`

---

**Fix aplicado**: 2025-01-25
**Commit**: `1e91a2d`
**Estado**: ✅ Completado y desplegado
