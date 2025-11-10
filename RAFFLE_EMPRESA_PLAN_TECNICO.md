# PLAN TÉCNICO: MODO EMPRESA + LANDING PÚBLICA + OPTIMIZACIONES

## FASE 1: DATABASE (Migración)

### Migración 036: Segundo color empresa
```sql
ALTER TABLE raffle_companies 
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#06B6D4';
  
COMMENT ON COLUMN raffle_companies.brand_color IS 'Color primario de marca (HEX)';
COMMENT ON COLUMN raffle_companies.secondary_color IS 'Color secundario de marca (HEX)';
```

## FASE 2: BACKEND

### 2.1 Constante de Bancos
**Archivo**: `backend/constants/banks.js` (NUEVO)
- Lista completa de 25 bancos venezolanos
- Formato: `{ code, name, fullName }`

### 2.2 Service: Batch creation números
**Archivo**: `backend/modules/raffles/services/RaffleServiceV2.js`
- Método `createNumbersBatch()` con chunks de 1000
- Para >5000 números: proceso async con job queue
- Response inmediato con `status: 'creating'`

### 2.3 Endpoint Landing Pública
**Archivo**: `backend/modules/raffles/routes/index.js`
- GET `/public/:code` - Sin auth
- Response: raffle + company + números (solo lectura)

## FASE 3: FRONTEND

### 3.1 Constante Bancos
**Archivo**: `frontend/src/constants/banks.ts` (NUEVO)

### 3.2 CreateRaffleModal Refactor
**Archivo**: `frontend/src/components/raffles/CreateRaffleModal.js`

**PASO 1 (Información Básica)**:
- Nombre rifa
- Descripción
- Cantidad números
- **NUEVO**: Toggle "Empresa" ✅
  - Si activo: campos empresa (nombre, RIF, logo upload, 2 color pickers)
  - Todos opcionales

**PASO 2 (Modo y Premio)**:
- Si "Empresa" ON → Forzar modo PRIZE
- Si "Empresa" OFF → Selector normal (fires/coins/prize)

**PASO 3 (Datos Pago - GLOBAL)**:
- Titular (input text)
- Banco (dropdown con código+nombre)
- Cédula (input)
- Teléfono (input)

### 3.3 Landing Pública
**Archivo**: `frontend/src/pages/RafflePublicLanding.tsx` (NUEVO)
- Route: `/raffles/:code/public`
- UI: Logo empresa, colores custom, estado rifa
- Solo lectura, sin login

### 3.4 Upload de Logo
- Integrar Cloudinary/S3
- Preview antes de subir
- Validar tamaño/formato

## FASE 4: TESTING

1. Rifa estándar (100 números)
2. Rifa empresa (1000 números)
3. Rifa empresa (10000 números - async)
4. Landing pública
5. Formulario pagos con bancos

## ESTIMACIÓN

- **Fase 1**: 5 min
- **Fase 2**: 45 min
- **Fase 3**: 90 min
- **Fase 4**: 30 min
- **TOTAL**: ~3 horas
