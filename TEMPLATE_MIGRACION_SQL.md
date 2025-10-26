# 📋 TEMPLATE PARA MIGRACIONES SQL EN RAILWAY

## 🎯 FORMATO PARA CREAR NUEVAS MIGRACIONES

---

## PASO 1: Crear Archivo SQL

**Nombre:** `MIGRACION_NOMBRE_FEATURE.sql`

**Estructura:**

```sql
-- ==================================================
-- MIGRACIÓN: [Nombre del Feature]
-- Descripción: [Breve descripción]
-- Fecha: [YYYY-MM-DD]
-- ==================================================

BEGIN;

-- ==================================================
-- 1. CREAR TABLAS
-- ==================================================

CREATE TABLE IF NOT EXISTS nombre_tabla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campos principales
  campo1 VARCHAR(255) NOT NULL,
  campo2 NUMERIC(10,2) DEFAULT 0,
  campo3 BOOLEAN DEFAULT FALSE,
  
  -- Referencias (Foreign Keys)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_campo CHECK (campo2 >= 0)
);

-- ==================================================
-- 2. CREAR ÍNDICES
-- ==================================================

CREATE INDEX IF NOT EXISTS idx_nombre_tabla_campo ON nombre_tabla(campo1);
CREATE INDEX IF NOT EXISTS idx_nombre_tabla_user ON nombre_tabla(user_id);
CREATE INDEX IF NOT EXISTS idx_nombre_tabla_created ON nombre_tabla(created_at DESC);

-- ==================================================
-- 3. CREAR TRIGGERS
-- ==================================================

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_nombre_tabla_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nombre_tabla_updated_at
BEFORE UPDATE ON nombre_tabla
FOR EACH ROW
EXECUTE FUNCTION update_nombre_tabla_updated_at();

-- ==================================================
-- 4. FUNCIONES AUXILIARES (OPCIONAL)
-- ==================================================

CREATE OR REPLACE FUNCTION cleanup_old_records()
RETURNS void AS $$
BEGIN
  DELETE FROM nombre_tabla
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- 5. COMENTARIOS (DOCUMENTACIÓN)
-- ==================================================

COMMENT ON TABLE nombre_tabla IS 'Descripción de la tabla';
COMMENT ON COLUMN nombre_tabla.campo1 IS 'Descripción del campo';

-- ==================================================
-- 6. DATOS INICIALES (OPCIONAL)
-- ==================================================

INSERT INTO nombre_tabla (campo1, campo2, user_id) 
VALUES ('valor1', 100.00, (SELECT id FROM users LIMIT 1))
ON CONFLICT DO NOTHING;

COMMIT;
```

---

## PASO 2: Crear Script de Migración Node.js

**Nombre:** `ejecutar_migracion_[FEATURE].js`

**Contenido:**

```javascript
// Script para ejecutar migración SQL en Railway PostgreSQL
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// CONFIGURACIÓN - Obtener de Railway → Postgres → Variables
const connectionString = 'postgresql://postgres:PASSWORD@HOST:PORT/railway';

// Archivo SQL a ejecutar
const sqlFile = path.join(__dirname, 'MIGRACION_NOMBRE_FEATURE.sql');

console.log('==================================================');
console.log('🚀 EJECUTANDO MIGRACIÓN: [NOMBRE FEATURE]');
console.log('==================================================\n');

if (!fs.existsSync(sqlFile)) {
  console.error('❌ ERROR: No se encuentra el archivo SQL');
  process.exit(1);
}

console.log('✓ Archivo SQL encontrado');

const sqlContent = fs.readFileSync(sqlFile, 'utf8');

console.log('✓ Contenido SQL cargado');
console.log('✓ Conectando a Railway PostgreSQL...\n');

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Conectado exitosamente\n');
    
    console.log('📊 Ejecutando migración...\n');
    
    await client.query(sqlContent);
    
    console.log('✅ Migración ejecutada exitosamente!\n');
    
    // PERSONALIZAR: Verificar tablas específicas de tu migración
    console.log('🔍 Verificando tablas creadas...\n');
    const verification = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'nombre_tabla%'
      ORDER BY table_name;
    `);
    
    console.log('✅ Tablas creadas:');
    verification.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n==================================================');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('==================================================');
    
  } catch (error) {
    console.error('\n❌ ERROR al ejecutar migración:');
    console.error(error.message);
    
    if (error.detail) {
      console.error('\nDetalle:', error.detail);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
```

---

## PASO 3: Script PowerShell (Reutilizable)

**Usar el mismo `ejecutar_migracion.ps1` existente**

**Pero cambiar la línea:**
```powershell
node ejecutar_migracion.js
```

**Por:**
```powershell
node ejecutar_migracion_[FEATURE].js
```

O mejor, hacer el script genérico:

```powershell
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "EJECUTANDO MIGRACION SQL EN RAILWAY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Parámetro: nombre del archivo JS
param(
    [Parameter(Mandatory=$true)]
    [string]$ScriptName
)

$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js no esta instalado" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green

if (-not (Test-Path "node_modules\pg")) {
    Write-Host "Instalando driver pg..." -ForegroundColor Yellow
    npm install pg --no-save
}

Write-Host ""
Write-Host "Ejecutando migracion..." -ForegroundColor Cyan
Write-Host ""

node $ScriptName

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "MIGRACION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Error al ejecutar la migracion" -ForegroundColor Red
    exit 1
}
```

**Uso:**
```powershell
.\ejecutar_migracion.ps1 -ScriptName "ejecutar_migracion_bingo.js"
```

---

## 📝 CHECKLIST ANTES DE EJECUTAR

- [ ] Archivo SQL creado con BEGIN/COMMIT
- [ ] Script Node.js configurado con connection string correcto
- [ ] Verificación de tablas personalizada en el script
- [ ] Probado localmente si es posible
- [ ] Backup de datos importantes (si modifica tablas existentes)

---

## 🔍 VERIFICACIÓN POST-MIGRACIÓN

```sql
-- Ver todas las tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Ver columnas de una tabla específica
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'nombre_tabla'
ORDER BY ordinal_position;

-- Ver índices
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'nombre_tabla';

-- Ver constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'nombre_tabla'::regclass;
```

---

## 🚨 TROUBLESHOOTING

### Error: "relation already exists"
```sql
-- Usar IF NOT EXISTS en todas las CREATE statements
CREATE TABLE IF NOT EXISTS...
CREATE INDEX IF NOT EXISTS...
```

### Error: "column does not exist"
```sql
-- Agregar columnas si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='nombre_tabla' AND column_name='nueva_columna'
  ) THEN
    ALTER TABLE nombre_tabla ADD COLUMN nueva_columna VARCHAR(255);
  END IF;
END $$;
```

### Error: "permission denied"
```sql
-- Verificar que el usuario tiene permisos
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

---

## 📂 ORGANIZACIÓN DE ARCHIVOS

```
proyecto/
├── migraciones/
│   ├── 001_inicial.sql
│   ├── 002_la_vieja.sql
│   ├── 003_bingo.sql
│   └── ...
├── scripts/
│   ├── ejecutar_migracion.ps1 (genérico)
│   ├── ejecutar_migracion_la_vieja.js
│   ├── ejecutar_migracion_bingo.js
│   └── ...
└── TEMPLATE_MIGRACION_SQL.md (este archivo)
```

---

## ✅ EJEMPLO COMPLETO: MIGRACIÓN BINGO

### 1. MIGRACION_BINGO.sql
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS bingo_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('coins', 'fires')),
  bet_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bingo_code ON bingo_rooms(code);

COMMIT;
```

### 2. ejecutar_migracion_bingo.js
```javascript
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:PASSWORD@HOST:PORT/railway';
const sqlFile = path.join(__dirname, 'MIGRACION_BINGO.sql');

// ... (mismo código que el template)

// Personalizar verificación:
const verification = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name LIKE 'bingo%'
`);
```

### 3. Ejecutar
```powershell
.\ejecutar_migracion.ps1 -ScriptName "ejecutar_migracion_bingo.js"
```

---

## 🎯 BUENAS PRÁCTICAS

1. **Siempre usar transacciones** (BEGIN/COMMIT)
2. **IF NOT EXISTS** para evitar errores en re-ejecución
3. **Índices en foreign keys** para performance
4. **Triggers para updated_at** automático
5. **Comentarios SQL** para documentación
6. **Verificación post-migración** en el script
7. **Nombres descriptivos** para tablas y campos
8. **Check constraints** para validaciones
9. **ON DELETE CASCADE/SET NULL** según lógica de negocio
10. **Backup antes de migraciones** en producción

---

## 📚 RECURSOS

- PostgreSQL Docs: https://www.postgresql.org/docs/
- Node.js pg: https://node-postgres.com/
- Railway Docs: https://docs.railway.app/

---

**Última actualización:** Oct 2025
**Proyecto:** MundoXYZ
**Método probado en:** La Vieja (TicTacToe)
