# 🚀 DEPLOY STATUS - Sistema de Reservas

## Commit: `cc354d0` - UUID Fix + Docs

---

## 🔍 PROBLEMA IDENTIFICADO Y RESUELTO

### ❌ Error Original:
```
foreign key constraint "raffle_numbers_reserved_by_fkey" cannot be implemented
Key columns "reserved_by" and "id" are of incompatible types: integer and uuid
```

### ✅ Causa Raíz:
- `users.id` = **UUID**
- `reserved_by` = **INTEGER** ❌
- Foreign key incompatible

### ✅ Solución Aplicada:
```sql
-- ANTES (ROTO)
ALTER TABLE raffle_numbers 
ADD COLUMN reserved_by INTEGER REFERENCES users(id);

-- DESPUÉS (CORRECTO)
ALTER TABLE raffle_numbers 
ADD COLUMN reserved_by UUID REFERENCES users(id);
```

---

## 📊 ESTADO DEL DEPLOY

### Push realizado: ✅
- Commit: `cc354d0`
- Branch: `main`
- Remote: `origin/main`

### Tiempo estimado: **6 minutos**
- Inicio: ~15:56 (hora local)
- Esperado: ~16:02 (hora local)

### Archivos modificados:
1. ✅ `backend/db/migrations/036_add_raffle_reservation_columns.sql` (UUID fix)
2. ✅ `FORCE_REBUILD_RAILWAY.md` (guía troubleshooting)

---

## ✅ CHECKLIST VERIFICACIÓN POST-DEPLOY

### 1. Logs Railway (PRIMERO)

Ir a: https://railway.app/dashboard

**Buscar en logs:**
```
✅ 036_add_raffle_reservation_columns.sql completed successfully
✅ All migrations completed successfully!
✅ Database connected
✅ Raffle Reservation Cleanup Job started
🚀 Server running on port XXXX
```

**NO debe aparecer:**
```
❌ Error in 036_add_raffle_reservation_columns.sql
❌ foreign key constraint cannot be implemented
```

---

### 2. Verificar Migración en DB

**Railway Dashboard → PostgreSQL → Query:**

```sql
-- Ver migración ejecutada
SELECT * FROM migrations 
WHERE filename = '036_add_raffle_reservation_columns.sql';
```

**Esperado:** 1 fila con timestamp de ejecución

---

### 3. Verificar Columnas Creadas

```sql
-- Ver tipo de columnas
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'raffle_numbers' 
  AND column_name IN ('reserved_by', 'reserved_until');
```

**Esperado:**
```
reserved_by    | uuid                   | uuid
reserved_until | timestamp with time zone | timestamptz
```

---

### 4. Verificar Foreign Key

```sql
-- Ver constraint creado
SELECT 
  constraint_name,
  table_name,
  column_name
FROM information_schema.key_column_usage
WHERE constraint_name = 'raffle_numbers_reserved_by_fkey';
```

**Esperado:** 1 fila con constraint activo

---

## 🧪 TESTING EN PRODUCCIÓN

### Test 1: Botones Flotantes Visibles

1. **Abrir:** https://mundoxyz-production.up.railway.app
2. **Login** con cualquier usuario
3. **Ir a cualquier rifa**
4. **Verificar:**
   - ✅ Botón azul (Participantes) visible abajo-derecha
   - ✅ Botón verde (Datos pago) si eres host
   - ✅ Botones SIEMPRE visibles al hacer scroll
   - ✅ Animación hover funciona

**Si NO aparecen:**
- F12 → Console → Buscar errores
- Verificar que RaffleRoom.js se haya desplegado

---

### Test 2: Reserva de Números (CRÍTICO)

**Requisitos:**
- 2 navegadores diferentes (Chrome + Firefox)
- Misma rifa abierta en ambos
- Usuario diferente en cada navegador

**Pasos:**

**Navegador 1 (Usuario A):**
1. Click en número 5
2. **Esperado:** Modal abre
3. **F12 Console debe mostrar:**
   ```
   ✅ Número 5 reservado temporalmente
   ```
4. **Dejar modal abierto**

**Navegador 2 (Usuario B) - INMEDIATAMENTE:**
1. Click en número 5 (mismo que Usuario A)
2. **Esperado:** Modal intenta abrir
3. **Esperado:** Error aparece
4. **Console debe mostrar:**
   ```
   Error reservando número: Este número está siendo procesado por otro usuario
   ```
5. **Esperado:** Usuario B NO puede continuar
6. **Verificar:** Número 5 se ve como "Reservado" (naranja)

**Navegador 1 (Usuario A):**
7. Cerrar modal (ESC o click X)
8. **Console debe mostrar:**
   ```
   ✅ Número 5 liberado
   ```

**Navegador 2 (Usuario B) - AHORA:**
9. Click en número 5 nuevamente
10. **Esperado:** Modal abre normalmente
11. **Esperado:** Usuario B puede completar compra
12. **Console debe mostrar:**
    ```
    ✅ Número 5 reservado temporalmente
    ```

---

### Test 3: WebSocket Real-Time

**Con 2 navegadores abiertos:**

1. Usuario A: Reserva número 5
2. **Esperado en Navegador B:**
   - Número 5 cambia a naranja (reservado)
   - INMEDIATAMENTE, sin refresh
3. Usuario A: Cierra modal
4. **Esperado en Navegador B:**
   - Número 5 vuelve a verde (disponible)
   - INMEDIATAMENTE, sin refresh

---

### Test 4: Expiración Automática

1. Usuario A: Abre modal número 5
2. **Esperar 5 minutos** (sin cerrar modal)
3. Cron job ejecuta cada minuto
4. **Minuto 6:** Reserva expira
5. Usuario B: Click número 5
6. **Esperado:** Funciona normalmente
7. **Esperado:** Usuario A puede ver error si intenta completar

---

## 🔍 DEBUGGING SI FALLA

### Caso 1: Migración NO ejecutada

**Síntoma:** Logs muestran error de migración

**Solución manual:**
```sql
-- Ejecutar directo en Railway PostgreSQL Query
ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_by UUID REFERENCES users(id);

ALTER TABLE raffle_numbers 
ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_reserved 
ON raffle_numbers(reserved_until) 
WHERE reserved_until IS NOT NULL;

-- Marcar como ejecutada
INSERT INTO migrations (filename) 
VALUES ('036_add_raffle_reservation_columns.sql')
ON CONFLICT (filename) DO NOTHING;
```

Luego: **Restart** del servicio en Railway

---

### Caso 2: Botones NO aparecen

**Verificar en Console (F12):**
```javascript
// Ver si RaffleRoom está cargado
console.log(document.querySelector('.fixed.bottom-8.right-8'));
```

**Si es null:**
- Frontend NO se desplegó
- Verificar build en Railway
- Puede necesitar clear cache

---

### Caso 3: Reserva NO funciona

**Verificar en Console (F12):**
```javascript
// Ver error específico
// Al abrir modal, debe mostrar:
// POST https://mundoxyz-production.up.railway.app/api/raffles/{id}/reserve-number
// Status: 200 OK
```

**Si 500 error:**
- Columnas no existen en DB
- Ejecutar SQL manual (Caso 1)

**Si 404 error:**
- Endpoint no existe
- Backend NO se desplegó
- Verificar routes/raffles.js

---

### Caso 4: Foreign Key Error persiste

**Verificar tipo de users.id:**
```sql
SELECT data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'id';
```

**Si retorna algo diferente a `uuid`:**
- Problema mayor en schema
- Contactar soporte

---

## 📞 INFORMACIÓN REQUERIDA SI FALLA

1. **Screenshot logs Railway** (completos desde inicio)
2. **Screenshot Console navegador** (con errores)
3. **Resultado query:**
   ```sql
   SELECT * FROM migrations WHERE filename LIKE '%036%';
   ```
4. **Resultado query:**
   ```sql
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'raffle_numbers' 
     AND column_name IN ('reserved_by', 'reserved_until');
   ```
5. **Screenshot interfaz** (botones flotantes ausentes o presentes)

---

## ⏰ TIMER

**Inicio:** Push exitoso a GitHub
**Duración:** 6 minutos (~360 segundos)
**Railway detecta push:** Automático
**Build + Deploy:** ~4-5 minutos
**Warm-up:** ~1 minuto

**Total estimado:** 6-8 minutos

---

## 🎯 RESULTADO ESPERADO FINAL

✅ Migración 036 ejecutada
✅ Columnas reserved_by (UUID) y reserved_until creadas
✅ Foreign key a users(id) funcional
✅ Índice idx_raffle_numbers_reserved creado
✅ Cron job limpieza activo (cada minuto)
✅ Botones flotantes visibles
✅ Reserva de números funcional
✅ WebSocket real-time operando
✅ Sistema completo y robusto

---

## 📝 NOTAS TÉCNICAS

- **UUID vs INTEGER:** users.id es UUID en este proyecto
- **Migration system:** Archivos .sql en backend/db/migrations/
- **Railway command:** `npm run migrate && npm start`
- **Cron job:** 60000ms (1 minuto) para limpiar reservas
- **Reserva duration:** 5 minutos (300000ms)
- **WebSocket room:** `raffle-{raffleId}`
- **WebSocket events:** `number:reserved`, `number:released`

---

## ✅ CONFIRMACIÓN FINAL

Después de verificar todos los tests:

- [ ] Migración ejecutada en Railway
- [ ] Columnas creadas con tipo correcto
- [ ] Foreign key funcional
- [ ] Botones flotantes visibles
- [ ] Reserva funciona (test 2 navegadores)
- [ ] Error al número reservado
- [ ] Liberación al cerrar modal
- [ ] WebSocket real-time
- [ ] Expiración automática

**Si TODOS ✅ → Sistema 100% funcional**

**Si alguno ❌ → Ver sección Debugging**
