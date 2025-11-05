# 📋 PARTE 1: Estructura de Datos y Migración

**Proyecto:** MundoXYZ - Sistema Multi-Ecosistema  
**Fecha:** 2025-11-05

---

## 📊 ESTRUCTURA DE BASE DE DATOS

### **Nueva Tabla: `ecosystems`**

```sql
CREATE TABLE IF NOT EXISTS ecosystems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identidad
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  slogan VARCHAR(200),
  logo_url TEXT,
  
  -- Admin del ecosistema
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Configuración monetaria
  fire_name VARCHAR(50) DEFAULT 'Fire',
  fire_symbol VARCHAR(10) DEFAULT '🔥',
  coin_name VARCHAR(50) DEFAULT 'Coin',
  coin_symbol VARCHAR(10) DEFAULT '🪙',
  max_supply DECIMAL(20,2) NOT NULL,
  
  -- Comisiones de transferencias (porcentaje)
  transfer_commission_percentage DECIMAL(5,2) DEFAULT 5.00,
  withdrawal_commission_percentage DECIMAL(5,2) DEFAULT 5.00,
  
  -- Comisiones Bingo (porcentaje)
  bingo_winner_percentage DECIMAL(5,2) DEFAULT 70.00,
  bingo_host_percentage DECIMAL(5,2) DEFAULT 20.00,
  bingo_platform_percentage DECIMAL(5,2) DEFAULT 10.00,
  
  -- Comisiones Rifa (porcentaje)
  raffle_winner_percentage DECIMAL(5,2) DEFAULT 70.00,
  raffle_host_percentage DECIMAL(5,2) DEFAULT 20.00,
  raffle_platform_percentage DECIMAL(5,2) DEFAULT 10.00,
  
  -- Costos de creación de rifas (monto fijo)
  raffle_cost_prize_mode DECIMAL(10,2) DEFAULT 300.00,
  raffle_cost_normal_mode DECIMAL(10,2) DEFAULT 3000.00,
  
  -- Límites para hosts
  host_custom_commission_min DECIMAL(5,2) DEFAULT 1.00,
  host_custom_commission_max DECIMAL(5,2) DEFAULT 20.00,
  
  -- Marketplace
  market_min_withdrawal DECIMAL(10,2) DEFAULT 100.00,
  market_withdrawal_commission_percentage DECIMAL(5,2) DEFAULT 5.00,
  
  -- Estado
  status VARCHAR(20) DEFAULT 'active',
  is_public BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ecosystems_slug ON ecosystems(slug);
CREATE INDEX idx_ecosystems_admin ON ecosystems(admin_user_id);
CREATE INDEX idx_ecosystems_status ON ecosystems(status);
```

---

### **Modificaciones a Tablas Existentes**

```sql
-- Tabla users
ALTER TABLE users 
ADD COLUMN ecosystem_id UUID REFERENCES ecosystems(id) ON DELETE CASCADE;

CREATE INDEX idx_users_ecosystem ON users(ecosystem_id);

-- Tabla wallets
ALTER TABLE wallets 
ADD COLUMN ecosystem_id UUID REFERENCES ecosystems(id) ON DELETE CASCADE;

CREATE INDEX idx_wallets_ecosystem ON wallets(ecosystem_id);

-- Tabla raffles
ALTER TABLE raffles 
ADD COLUMN ecosystem_id UUID REFERENCES ecosystems(id) ON DELETE CASCADE;

CREATE INDEX idx_raffles_ecosystem ON raffles(ecosystem_id);

-- Tabla bingo_rooms
ALTER TABLE bingo_rooms 
ADD COLUMN ecosystem_id UUID REFERENCES ecosystems(id) ON DELETE CASCADE;

CREATE INDEX idx_bingo_rooms_ecosystem ON bingo_rooms(ecosystem_id);
```

---

## 📁 ARCHIVOS A CREAR

### Backend
- `backend/db/migrations/025_create_ecosystems.sql`
- `backend/routes/ecosystems.js`
- `backend/routes/ecosystemAdmin.js`
- `backend/middleware/verifyEcosystemAdmin.js`
- `backend/services/EcosystemService.js`

### Frontend
- `frontend/src/pages/EcosystemSetup/` (carpeta completa)
- `frontend/src/pages/EcosystemDashboard/` (carpeta completa)
- `frontend/src/contexts/EcosystemContext.js`
