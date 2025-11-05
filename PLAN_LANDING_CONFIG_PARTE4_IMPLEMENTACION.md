# 📋 PARTE 4: Orden de Implementación

**Proyecto:** MundoXYZ - Sistema Multi-Ecosistema  
**Fecha:** 2025-11-05

---

## 🔢 ORDEN DE IMPLEMENTACIÓN

### **FASE 1: Base de Datos (Día 1)**

1. **Migración 025: Crear tabla ecosystems**
   - Crear `backend/db/migrations/025_create_ecosystems.sql`
   - Definir todos los campos según especificación
   - Crear índices necesarios
   - Añadir constraints y validations

2. **Modificar tablas existentes**
   - Añadir `ecosystem_id` a `users`
   - Añadir `ecosystem_id` a `wallets`
   - Añadir `ecosystem_id` a `raffles`
   - Añadir `ecosystem_id` a `bingo_rooms`
   - Crear índices correspondientes

3. **Actualizar DATABASE_SCHEMA_MASTER.sql**
   - Incluir tabla `ecosystems`
   - Actualizar definiciones de tablas modificadas

---

### **FASE 2: Backend - Servicios y Rutas (Día 2-3)**

1. **EcosystemService.js**
   ```javascript
   class EcosystemService {
     async createEcosystem(data)
     async updateEcosystem(id, data)
     async getEcosystem(slug)
     async saveDraft(id, data)
     async publishEcosystem(id)
     async validateConfig(config)
     async uploadLogo(file)
   }
   ```

2. **routes/ecosystems.js**
   - `POST /api/ecosystems/create`
   - `PUT /api/ecosystems/:id/draft`
   - `POST /api/ecosystems/:id/publish`
   - `GET /api/ecosystems/:slug`
   - `PUT /api/ecosystems/:id/config`
   - `POST /api/ecosystems/:id/upload-logo`

3. **routes/ecosystemAdmin.js**
   - `POST /api/ecosystems/admin/login`
   - `GET /api/ecosystems/admin/dashboard`

4. **middleware/verifyEcosystemAdmin.js**
   - Verificar que el usuario es admin del ecosistema
   - Middleware para proteger rutas de configuración

---

### **FASE 3: Frontend - Wizard (Día 4-5)**

1. **Contexto y Estado**
   - Crear `contexts/EcosystemContext.js`
   - Gestionar estado del wizard
   - Guardar progreso en localStorage

2. **Componentes del Wizard**
   - `pages/EcosystemSetup/index.js` (contenedor principal)
   - `Step1Identity.js` (nombre, slogan, logo)
   - `Step2Admin.js` (credenciales admin)
   - `Step3Economy.js` (monedas, supply, comisiones)
   - `Step4Games.js` (bingo, rifa, costos)
   - `Step5Review.js` (resumen y confirmación)

3. **Componentes Compartidos**
   - `ProgressBar.js`
   - `SaveDraftButton.js`
   - `NavigationButtons.js`
   - `FormField.js`
   - `PercentageInput.js`

---

### **FASE 4: Frontend - Dashboard (Día 6-7)**

1. **Layout del Dashboard**
   - `pages/EcosystemDashboard/index.js`
   - Menú lateral con secciones
   - Header con info del admin

2. **Secciones**
   - `IdentitySection.js`
   - `EconomySection.js`
   - `GamesSection.js`
   - `MarketSection.js`

3. **Componentes de Edición**
   - `ConfigCard.js` (card con botón editar)
   - `EditModal.js` (modal genérico)
   - `LockedField.js` (campos no editables como max_supply)
   - `PercentageEditor.js`

---

### **FASE 5: Validaciones y Testing (Día 8)**

1. **Validaciones Frontend**
   - Nombres únicos
   - Slugs válidos
   - Emails correctos
   - Contraseñas coinciden
   - Porcentajes suman 100%
   - Valores numéricos en rangos

2. **Validaciones Backend**
   - Duplicados en BD
   - Constraints de porcentajes
   - Max supply > 0
   - Formatos de archivo (logo)

3. **Testing Manual**
   - Crear ecosistema completo
   - Guardar borradores
   - Publicar ecosistema
   - Login como admin
   - Editar configuraciones
   - Intentar editar max_supply (debe fallar)

---

### **FASE 6: Integración y Deploy (Día 9)**

1. **Integración con Sistema Existente**
   - Modificar lógica de juegos para usar config de ecosistema
   - Actualizar cálculo de comisiones
   - Asignar ecosystem_id a nuevos usuarios

2. **Migraciones de Datos**
   - Crear ecosistema "MundoXYZ" por defecto
   - Asignar usuarios existentes a MundoXYZ
   - Asociar wallets, raffles, bingo_rooms

3. **Deploy**
   - Commit y push de todas las migraciones
   - Esperar Railway deploy
   - Verificar migraciones ejecutadas
   - Testing en producción

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### **Base de Datos**
- [ ] Migración 025 creada
- [ ] Tabla ecosystems con todos los campos
- [ ] Índices creados
- [ ] Modificaciones a users, wallets, raffles, bingo_rooms
- [ ] Schema maestro actualizado
- [ ] Migración testeada localmente

### **Backend**
- [ ] EcosystemService.js implementado
- [ ] routes/ecosystems.js completo
- [ ] routes/ecosystemAdmin.js completo
- [ ] Middleware verifyEcosystemAdmin
- [ ] Validaciones de porcentajes
- [ ] Validaciones de unicidad
- [ ] Upload de logo funcionando
- [ ] Endpoints testeados con Postman/Thunder

### **Frontend - Wizard**
- [ ] EcosystemContext creado
- [ ] Paso 1: Identidad
- [ ] Paso 2: Admin
- [ ] Paso 3: Economía
- [ ] Paso 4: Juegos
- [ ] Paso 5: Revisión
- [ ] ProgressBar funcionando
- [ ] Navegación entre pasos
- [ ] Guardar borrador
- [ ] Validaciones en tiempo real
- [ ] Upload de logo con preview
- [ ] Responsive en mobile

### **Frontend - Dashboard**
- [ ] Layout principal
- [ ] Login de admin
- [ ] IdentitySection con edición
- [ ] EconomySection con edición
- [ ] GamesSection con edición
- [ ] MarketSection con edición
- [ ] Modales de edición
- [ ] Campo max_supply bloqueado
- [ ] Validación suma porcentajes = 100%
- [ ] Responsive en tablet/mobile

### **Integración**
- [ ] Juegos usan config de ecosistema
- [ ] Comisiones desde ecosistema
- [ ] Nuevos usuarios asignados a ecosistema
- [ ] Wallets asociadas a ecosistema
- [ ] Ecosystem_id en todas las queries necesarias

### **Testing**
- [ ] Crear ecosistema de prueba
- [ ] Guardar y recuperar borrador
- [ ] Publicar ecosistema
- [ ] Login como admin
- [ ] Editar cada sección
- [ ] Intentar editar max_supply (debe fallar)
- [ ] Verificar validaciones
- [ ] Testing en diferentes navegadores
- [ ] Testing en mobile

### **Deploy**
- [ ] Commit y push a GitHub
- [ ] Railway ejecuta migraciones
- [ ] Verificar logs sin errores
- [ ] Crear ecosistema en producción
- [ ] Login admin en producción
- [ ] Editar config en producción
- [ ] Documentación actualizada

---

## 🚀 FLUJO COMPLETO

### **1. Usuario Crea Ecosistema**

```
Usuario registrado
    ↓
/setup/ecosystem
    ↓
Wizard Paso 1-5
    ↓
POST /api/ecosystems/create (status: draft)
    ↓
Guardar borrador (localStorage + BD)
    ↓
Paso 5: Revisión
    ↓
POST /api/ecosystems/:id/publish
    ↓
Ecosistema creado (status: active)
    ↓
Redirect a /ecosystem/:slug/dashboard
```

---

### **2. Admin Gestiona Ecosistema**

```
/ecosystem/mundoxyz/admin/login
    ↓
POST /api/ecosystems/admin/login
    ↓
Token JWT con permisos de admin
    ↓
/ecosystem/mundoxyz/dashboard
    ↓
GET /api/ecosystems/mundoxyz
    ↓
Ver configuraciones
    ↓
Clic en [Editar]
    ↓
Modal con campos editables
    ↓
PUT /api/ecosystems/:id/config
    ↓
Configuración actualizada
    ↓
Refrescar dashboard
```

---

### **3. Usuario Juega en Ecosistema**

```
Usuario entra al juego
    ↓
Sistema obtiene ecosystem_id del usuario
    ↓
Query a ecosystems para obtener config
    ↓
Aplicar comisiones según config
    ↓
Cálculo de premios con porcentajes del ecosistema
    ↓
Comisión plataforma va a admin del ecosistema
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **Seguridad**

1. **Slugs reservados**
   - No permitir: admin, api, static, assets, public
   - Validar en frontend y backend

2. **Permisos**
   - Solo admin del ecosistema puede editar
   - Verificar con middleware en cada ruta

3. **Max Supply**
   - Validar que NO se puede editar después de crear
   - Bloquear en UI y rechazar en API

4. **Upload de Logo**
   - Validar tipo de archivo
   - Limitar tamaño (2MB)
   - Sanitizar nombre de archivo
   - Usar storage seguro (AWS S3, Cloudinary)

---

### **Performance**

1. **Caching**
   - Cachear configuración de ecosistema
   - Invalidar al actualizar config

2. **Queries Optimizadas**
   - Índices en ecosystem_id
   - JOIN eficientes

3. **Frontend**
   - Lazy load de imágenes
   - Optimizar re-renders

---

### **UX**

1. **Wizard**
   - Guardar progreso automáticamente
   - Permitir volver a pasos anteriores
   - Validar antes de permitir avanzar

2. **Dashboard**
   - Feedback visual al guardar
   - Confirmación antes de cambios críticos
   - Loading states

3. **Errores**
   - Mensajes claros
   - Indicar qué campo tiene error
   - Sugerencias de corrección

---

## 📊 ESTIMACIÓN DE TIEMPO

| Fase | Tareas | Tiempo Estimado |
|------|--------|-----------------|
| 1 | Base de Datos | 1 día |
| 2 | Backend | 2 días |
| 3 | Frontend Wizard | 2 días |
| 4 | Frontend Dashboard | 2 días |
| 5 | Validaciones y Testing | 1 día |
| 6 | Integración y Deploy | 1 día |
| **TOTAL** | | **9 días** |

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

1. ✅ **Confirmar especificaciones** (completado)
2. ⏭️ **Crear migración 025**
3. ⏭️ **Implementar EcosystemService**
4. ⏭️ **Crear rutas de API**
5. ⏭️ **Desarrollar wizard paso a paso**
6. ⏭️ **Implementar dashboard**
7. ⏭️ **Testing completo**
8. ⏭️ **Deploy a producción**

---

**¿Procedemos con la implementación?**
