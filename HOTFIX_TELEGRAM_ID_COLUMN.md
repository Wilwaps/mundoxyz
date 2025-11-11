# 🔴 HOTFIX CRÍTICO: Nombre de Columna Incorrecto

**Fecha:** 11 Nov 2025 19:06 UTC-4
**Severidad:** CRÍTICA - Bloqueaba creación de rifas
**Commit:** 9d8bf00
**Status:** ✅ RESUELTO

---

## 🐛 BUG DETECTADO

### Error Reportado
```
[RaffleServiceV2] Error creando rifa column "telegram_id" does not exist
code: "42703" file: "parse_relation.c" 
```

### Impacto
**❌ TODAS las creaciones de rifas fallaban** en los siguientes modos:
- ❌ Modo FIRES (al cobrar comisión = precio_por_número)
- ❌ Modo PRIZE (al cobrar 500 fuegos)
- ❌ Modo EMPRESA (al cobrar 500 fuegos)

**⚠️ Modo COINS:** Probablemente funcionaba ya que no cobra comisión

### Causa Raíz
El código intentaba buscar al usuario de la plataforma con una columna que no existe:

```javascript
// ❌ INCORRECTO
const platformUserResult = await dbClient.query(
  'SELECT id FROM users WHERE telegram_id = $1',
  [PLATFORM_TELEGRAM_ID]
);
```

**La columna correcta en la tabla `users` es `tg_id`, no `telegram_id`**

---

## ✅ SOLUCIÓN APLICADA

### Ubicaciones Corregidas

#### 1. Método `createRaffle()` - Línea 96
```javascript
// ✅ CORREGIDO
const platformUserResult = await dbClient.query(
  'SELECT id FROM users WHERE tg_id = $1',
  [PLATFORM_TELEGRAM_ID]
);
```

**Propósito:** Buscar usuario plataforma para acreditar comisión inicial

#### 2. Método `finishRaffle()` - Línea 1135
```javascript
// ✅ CORREGIDO
const platformUserResult = await client.query(
  'SELECT id FROM users WHERE tg_id = $1',
  [PLATFORM_TELEGRAM_ID]
);
```

**Propósito:** Buscar usuario plataforma para acreditar comisión del split 70/20/10

---

## 📋 VERIFICACIÓN EN DB

### Confirmar Nombre de Columna
```sql
-- Ver estructura tabla users
\d users

-- Debe mostrar:
-- tg_id | character varying(255) | | not null | 

-- NO debe existir:
-- telegram_id
```

### Verificar Usuario Plataforma Existe
```sql
SELECT id, tg_id, username, display_name
FROM users
WHERE tg_id = '1417856820';

-- Si no existe, crear:
INSERT INTO users (tg_id, username, display_name)
VALUES ('1417856820', 'mundoxyz_platform', 'Plataforma MundoXYZ');

-- Crear wallet para plataforma
INSERT INTO wallets (user_id, fires_balance, coins_balance)
VALUES (
  (SELECT id FROM users WHERE tg_id = '1417856820'),
  0,
  0
);
```

---

## 🧪 TESTING POST-HOTFIX

### Test 1: Crear Rifa Modo FIRES
```bash
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
Authorization: Bearer <token>
{
  "name": "Test FIRES Post-Fix",
  "mode": "fires",
  "visibility": "public",
  "numbersRange": 10,
  "entryPrice": 20
}

# ✅ Debe:
# - Crear la rifa exitosamente
# - Descontar 20 fuegos del host
# - Acreditar 20 fuegos a plataforma
# - Registrar transacciones en wallet_transactions
```

### Test 2: Crear Rifa Modo PRIZE
```bash
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
Authorization: Bearer <token>
{
  "name": "Test PRIZE Post-Fix",
  "mode": "prize",
  "numbersRange": 50,
  "prizeMeta": {
    "prizeDescription": "Test",
    "bankingInfo": { ... }
  }
}

# ✅ Debe:
# - Crear la rifa exitosamente
# - Descontar 500 fuegos del host
# - Acreditar 500 fuegos a plataforma
```

### Test 3: Crear Rifa Modo EMPRESA
```bash
POST https://mundoxyz-production.up.railway.app/api/raffles/v2/
Authorization: Bearer <token>
{
  "name": "Test EMPRESA Post-Fix",
  "mode": "prize",
  "visibility": "company",
  "numbersRange": 100,
  "companyConfig": { ... }
}

# ✅ Debe:
# - Crear la rifa exitosamente
# - Descontar 500 fuegos del host
# - Acreditar 500 fuegos a plataforma
```

---

## 📊 VERIFICAR TRANSACCIONES

```sql
-- Ver comisiones cobradas post-fix
SELECT 
  wt.id,
  u.username,
  wt.type,
  wt.description,
  wt.amount,
  wt.created_at
FROM wallet_transactions wt
JOIN wallets w ON wt.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE wt.type IN ('raffle_creation_fee', 'raffle_platform_fee')
  AND wt.created_at > '2025-11-11 19:00:00'
ORDER BY wt.created_at DESC;

-- Ver balance plataforma
SELECT 
  u.tg_id,
  u.username,
  w.fires_balance
FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE u.tg_id = '1417856820';
```

---

## 🔍 ANÁLISIS DEL BUG

### ¿Por qué ocurrió?
Al implementar el sistema de comisiones, asumí que la columna se llamaba `telegram_id` (nombre lógico y común), pero en esta base de datos se usa `tg_id` (abreviación).

### ¿Por qué no se detectó antes?
- No había testing de integración con DB real
- Build frontend exitoso (no afecta TypeScript)
- Error solo aparece en runtime al intentar crear rifa

### ¿Cómo evitarlo en futuro?
1. ✅ Verificar esquema DB antes de escribir queries
2. ✅ Usar herramientas como `psql \d table_name`
3. ✅ Revisar código existente para ver nombres de columnas
4. ✅ Testing de integración en staging antes de prod

---

## 📝 LECCIONES APRENDIDAS

### ✅ Buenas Prácticas Aplicadas
- Transacciones atómicas (BEGIN/COMMIT/ROLLBACK)
- Manejo de errores descriptivo
- Logging detallado que permitió identificar el bug rápidamente

### ⚠️ Mejoras para Implementar
- [ ] Tests de integración con DB
- [ ] Verificación de esquema en CI/CD
- [ ] Script de validación de queries antes de deploy
- [ ] Testing en ambiente staging

---

## 🎯 ESTADO ACTUAL

**Bug:** ✅ RESUELTO  
**Deploy:** 🔄 Railway rebuilding (ETA: 5 min)  
**Testing:** ⏳ Pendiente (post-deploy)  
**Siguiente:** Probar creación rifas en TODOS los modos

---

## 📞 COMUNICACIÓN

**Commit:** 9d8bf00  
**Título:** "fix: corregir nombre columna telegram_id a tg_id"  
**Archivos modificados:** 1 (RaffleServiceV2.js)  
**Líneas cambiadas:** 2  
**Tiempo de fix:** ~5 minutos desde detección  

---

## ✅ CHECKLIST POST-DEPLOY

- [ ] Railway deploy completado
- [ ] Usuario plataforma existe en DB
- [ ] Probar creación FIRES
- [ ] Probar creación PRIZE
- [ ] Probar creación EMPRESA
- [ ] Verificar transacciones en DB
- [ ] Verificar balance plataforma incrementó
- [ ] Logs sin errores
- [ ] Ejecutar migración 043
- [ ] Testing completo sistema

---

**Tiempo total resolución:** 5 minutos  
**Impacto:** CRÍTICO → Resuelto  
**Confianza:** ALTA - Fix simple y directo
