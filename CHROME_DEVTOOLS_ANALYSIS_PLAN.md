# 🔍 PLAN DE ANÁLISIS CHROME DEVTOOLS

## OBJETIVO

Verificar implementación completa del sistema de reservas y mejoras visuales después del deploy.

---

## 🚀 INICIO CHROME DEVTOOLS

### Configuración Inicial

```powershell
# Ya iniciado en background
# Al terminar 6 minutos, ejecutar manualmente si necesario
```

### URL a Analizar
```
https://mundoxyz-production.up.railway.app
```

### Rutas Específicas
1. `/login` - Login page
2. `/raffles/lobby` - Lobby de rifas
3. `/raffles/room/{id}` - Sala de rifa específica

---

## 📋 CHECKLIST DE VERIFICACIÓN

### Parte 1: MIGRATION DATABASE (CRÍTICO)

**Verificar en Railway Dashboard:**

1. **Logs de Deploy:**
   ```
   ✅ Buscar: "📝 Running migration: 036_add_raffle_reservation_columns.sql"
   ✅ Buscar: "✅ 036_add_raffle_reservation_columns.sql completed successfully"
   ✅ Buscar: "✅ All migrations completed successfully"
   ```

2. **PostgreSQL Query:**
   ```sql
   -- Verificar migración registrada
   SELECT * FROM migrations 
   WHERE filename = '036_add_raffle_reservation_columns.sql';
   
   -- Verificar columnas creadas
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns 
   WHERE table_name = 'raffle_numbers' 
     AND column_name IN ('reserved_by', 'reserved_until');
   
   -- Esperado:
   -- reserved_by    | uuid                   | uuid
   -- reserved_until | timestamp with time zone | timestamptz
   ```

---

### Parte 2: FRONTEND - BOTONES FLOTANTES

**Página: `/raffles/room/{cualquier_id}`**

**Chrome DevTools → Elements:**

1. **Buscar elemento:**
   ```html
   <div class="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
   ```

2. **Verificar estilos computados:**
   ```css
   position: fixed;
   bottom: 2rem;
   right: 2rem;
   z-index: 50;
   ```

3. **Verificar botones:**
   - 🔵 Botón Participantes (azul)
     ```html
     <button class="...from-blue-500 to-blue-600...">
       <FaUsers size={24} />
     </button>
     ```
   - 🟢 Botón Datos Pago (verde, solo host)
     ```html
     <button class="...from-green-500 to-green-600...">
       <FaDollarSign size={24} />
     </button>
     ```

4. **Verificar visibilidad:**
   - Hacer scroll completo página
   - Botones DEBEN permanecer visibles
   - NO deben desaparecer con scroll

**Screenshots:**
- [ ] Botones visibles sin scroll
- [ ] Botones visibles con scroll completo
- [ ] Hover effect funcionando

---

### Parte 3: SISTEMA DE RESERVAS

**Página: `/raffles/room/{cualquier_id}`**

#### Test 3.1: Reserva Exitosa

**Chrome DevTools → Console:**

1. **Abrir modal de compra:**
   - Click en número disponible (ej: 5)
   
2. **Verificar logs:**
   ```javascript
   // Esperado:
   ✅ Número 5 reservado temporalmente
   ```

3. **Verificar Network:**
   ```
   POST /api/raffles/{id}/reserve-number
   Status: 200 OK
   Response: {
     success: true,
     data: {
       number_idx: 5,
       reserved_until: "2025-11-06T20:05:00Z",
       expires_at: "2025-11-06T20:05:00Z"
     },
     message: "Número reservado por 5 minutos"
   }
   ```

4. **Verificar visual:**
   - Número cambia a estado "Reservado" (naranja)
   - Otros números disponibles siguen verdes

**Screenshots:**
- [ ] Console con log de reserva
- [ ] Network request exitoso
- [ ] Número visual reservado

---

#### Test 3.2: Bloqueo de Otro Usuario

**Requisito: 2 navegadores (Chrome + Firefox o Incógnito)**

**Navegador 1 (Usuario A):**
1. Login
2. Entrar rifa
3. Click número 5
4. Modal abierto
5. **Dejar así (NO cerrar)**

**Navegador 2 (Usuario B) - Chrome DevTools activo:**
1. Login (usuario diferente)
2. Entrar MISMA rifa
3. Click número 5 (mismo)

**Verificar en Console:**
```javascript
// Esperado:
Error reservando número: 
Request failed with status code 400
Este número está siendo procesado por otro usuario
```

**Verificar en Network:**
```
POST /api/raffles/{id}/reserve-number
Status: 400 Bad Request
Response: {
  success: false,
  error: "Este número está siendo procesado por otro usuario"
}
```

**Verificar visual:**
- Número aparece como "Reservado" (naranja)
- Modal muestra error
- Usuario B NO puede continuar

**Screenshots:**
- [ ] Console error usuario B
- [ ] Network 400 error
- [ ] Número visual bloqueado

---

#### Test 3.3: Liberación al Cerrar

**Continuando Test 3.2...**

**Navegador 1 (Usuario A):**
1. Cerrar modal (ESC o X)

**Verificar Console Navegador 1:**
```javascript
// Esperado:
✅ Número 5 liberado
```

**Verificar Network Navegador 1:**
```
POST /api/raffles/{id}/release-number
Status: 200 OK
Response: {
  success: true,
  message: "Reserva liberada"
}
```

**Navegador 2 (Usuario B) - AHORA:**
1. Click número 5 nuevamente

**Verificar:**
- Modal abre normalmente
- Console: "✅ Número 5 reservado temporalmente"
- Usuario B puede continuar

**Screenshots:**
- [ ] Console liberación usuario A
- [ ] Network release exitoso
- [ ] Usuario B ahora puede reservar

---

#### Test 3.4: WebSocket Real-Time

**Con 2 navegadores abiertos simultáneamente:**

**Navegador 1:**
1. Click número 5
2. Modal abre

**Navegador 2 - Verificar INMEDIATAMENTE:**

**Chrome DevTools → Console:**
```javascript
// Esperado (sin refresh):
WebSocket message received: {
  type: "number:reserved",
  data: {
    number_idx: 5,
    user_id: "uuid-del-usuario-A",
    expires_at: "2025-11-06T20:05:00Z"
  }
}
```

**Visual en Navegador 2:**
- Número 5 cambia a naranja (reservado)
- **SIN NECESIDAD DE REFRESH**

**Screenshots:**
- [ ] WebSocket message en console
- [ ] Visual cambio tiempo real

---

### Parte 4: PERFORMANCE & ERRORS

**Chrome DevTools → Console:**

**Verificar NO hay errores:**
```javascript
// NO debe aparecer:
❌ TypeError
❌ ReferenceError  
❌ Network Error
❌ 404 Not Found
❌ 500 Internal Server Error
```

**Chrome DevTools → Network:**

1. **Filtrar por XHR:**
   - Todas las llamadas API deben ser 200 OK
   - reserve-number: 200 OK
   - release-number: 200 OK
   - payment-details: 200 OK

2. **Verificar tiempos:**
   - reserve-number: < 500ms
   - release-number: < 500ms
   - WebSocket connection: Stable

**Chrome DevTools → Performance:**

1. **Grabar interacción:**
   - Start recording
   - Click número
   - Modal abre
   - Stop recording

2. **Verificar:**
   - No memory leaks
   - No layout shifts
   - Smooth animations

**Screenshots:**
- [ ] Console sin errores
- [ ] Network all 200 OK
- [ ] Performance sin issues

---

### Parte 5: MOBILE RESPONSIVENESS

**Chrome DevTools → Device Toolbar (Ctrl+Shift+M):**

**Dispositivos a probar:**
1. iPhone 12 Pro (390x844)
2. Samsung Galaxy S20 (360x800)
3. iPad Air (820x1180)

**Verificar:**
- [ ] Botones flotantes visibles
- [ ] Botones accesibles (no obstruidos)
- [ ] Modal reserva funciona
- [ ] Touch events operan
- [ ] Layout correcto

**Screenshots:**
- [ ] Mobile iPhone
- [ ] Mobile Android
- [ ] Tablet

---

## 📊 ANÁLISIS DE LOGS RAILWAY

**Railway Dashboard → Deployments → Latest → Logs:**

### Sección 1: Build

```
✅ Buscar: "npm install"
✅ Buscar: "npm run build"
✅ Buscar: "Build completed"
```

### Sección 2: Migrations

```
✅ "🚀 Starting database migrations..."
✅ "Found 36 migration files"
✅ "Already executed: 35"
✅ "Pending: 1"
✅ "📝 Running migration: 036_add_raffle_reservation_columns.sql"
✅ "✅ 036_add_raffle_reservation_columns.sql completed successfully"
✅ "✅ All migrations completed successfully!"
```

### Sección 3: Server Start

```
✅ "✅ Database connected"
✅ "✅ Bingo V2 Failure Detection Job started"
✅ "✅ Gift Expiration Job started"
✅ "✅ Raffle Reservation Cleanup Job started - runs every minute"
✅ "🚀 Server running on port XXXX"
```

### Sección 4: Cron Job (después 1 minuto)

```
✅ "X reservas expiradas limpiadas" 
   (puede ser 0 si no hay reservas expiradas)
```

---

## 🎯 CRITERIOS DE ÉXITO

### ✅ ÉXITO TOTAL (esperado)

- [x] Migración 036 ejecutada sin errores
- [x] Columnas reserved_by (UUID) y reserved_until creadas
- [x] Botones flotantes visibles y funcionales
- [x] Reserva de número funciona
- [x] Error al intentar número reservado
- [x] Liberación al cerrar modal
- [x] WebSocket real-time operando
- [x] Sin errores en console
- [x] Performance óptimo

### ⚠️ ÉXITO PARCIAL

Si alguno falla:
1. Documentar cuál específicamente
2. Screenshot del error
3. Copy logs completos
4. Ejecutar SQL manual si necesario

### ❌ FALLO

Si nada funciona:
1. Ver FORCE_REBUILD_RAILWAY.md
2. Ejecutar troubleshooting completo
3. Considerar rollback

---

## 📸 EVIDENCIA REQUERIDA

### Screenshots obligatorios:

1. **Railway logs** (migración exitosa)
2. **PostgreSQL query** (columnas creadas)
3. **Botones flotantes** (visibles)
4. **Console reserva** (log exitoso)
5. **Network reserva** (200 OK)
6. **Error usuario B** (400 bloqueado)
7. **Liberación** (release exitoso)
8. **WebSocket** (mensaje real-time)
9. **Performance** (sin issues)
10. **Mobile** (responsive OK)

### Video recomendado:

Grabar test completo 2 navegadores:
- Usuario A reserva
- Usuario B intenta (error)
- Usuario A libera
- Usuario B ahora puede
- Duración: ~2 minutos

---

## 🔧 HERRAMIENTAS NECESARIAS

- [x] Chrome con DevTools
- [x] Firefox o Chrome Incógnito (2do navegador)
- [x] Acceso Railway Dashboard
- [x] Usuario login para test
- [ ] Herramienta screen recording (opcional)

---

## ⏰ TIEMPO ESTIMADO

- Railway logs review: 5 min
- PostgreSQL verification: 5 min
- Frontend visual tests: 10 min
- Sistema reservas test: 15 min
- Performance analysis: 10 min
- Mobile responsive: 5 min
- Documentation: 10 min

**Total: ~60 minutos** para análisis completo

---

## 📝 TEMPLATE REPORTE

```markdown
# Análisis Chrome DevTools - Sistema Reservas

## Deploy Info
- Commit: cc354d0
- Time: [hora]
- Duration: [minutos]

## Database Migration
- Status: ✅/❌
- Columnas: ✅/❌
- Foreign key: ✅/❌
- [Screenshot]

## Frontend
- Botones flotantes: ✅/❌
- Responsive: ✅/❌
- [Screenshots]

## Sistema Reservas
- Reserva exitosa: ✅/❌
- Bloqueo usuario B: ✅/❌
- Liberación: ✅/❌
- WebSocket: ✅/❌
- [Screenshots]

## Performance
- Console errors: 0
- Network: all 200
- Load time: Xms
- [Screenshot]

## Resultado Final
✅ Sistema 100% operacional
o
⚠️ Issues encontrados: [lista]
o
❌ Sistema NO funciona: [detalles]
```

---

## 🚀 SIGUIENTE ACCIÓN

**Cuando timer termine (6 minutos):**

1. Verificar logs Railway PRIMERO
2. Si migración OK → Proceder tests frontend
3. Si migración FAIL → Ver FORCE_REBUILD_RAILWAY.md
4. Documentar TODOS los hallazgos
5. Reportar resultado final

---

**¡Análisis exhaustivo garantizado!** 🔍
