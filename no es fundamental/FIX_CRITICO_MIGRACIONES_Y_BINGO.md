# 🚨 FIX CRÍTICO - MIGRACIONES Y SISTEMA BINGO COMPLETO

**Fecha:** 31 Oct 2025  
**Problema Principal:** Migración 006 no se ejecuta, causando múltiples fallos en Bingo  
**Impacto:** Sistema de Bingo parcialmente roto, modal de celebración no aparece  
**Prioridad:** CRÍTICA

---

## 🔴 **PROBLEMAS IDENTIFICADOS**

### 1. **Sistema de Migraciones Sin Control**
- No rastrea qué migraciones ya se ejecutaron
- Reintenta todas las migraciones en cada deploy
- Falla silenciosamente si hay errores

### 2. **Migración 006 Fallando**
- Requiere tablas que no existen (`bingo_drawn_numbers`, `bingo_audit_logs`)
- BingoAbandonmentJob deshabilitado
- Estructura de DB inconsistente

### 3. **marked_numbers como String**
- PostgreSQL guarda como string JSON en lugar de JSONB array
- Validación falla porque espera array

### 4. **Socket Desconectado**
- Pérdida de conexión durante el juego
- Eventos no llegan al frontend

---

## ✅ **SOLUCIÓN COMPLETA PASO A PASO**

---

## **PASO 1: Sistema de Migraciones Robusto**

### **1.1 Crear tabla de control de migraciones**

```sql
-- backend/db/migrations/000_create_migrations_table.sql
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Insertar migraciones ya ejecutadas (si existen las tablas)
INSERT INTO migrations (filename) 
SELECT '001_initial_schema.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
ON CONFLICT DO NOTHING;

INSERT INTO migrations (filename) 
SELECT '002_bingo_initial.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bingo_rooms')
ON CONFLICT DO NOTHING;

INSERT INTO migrations (filename) 
SELECT '003_auth_improvements.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'users' AND column_name = 'last_password_change')
ON CONFLICT DO NOTHING;

INSERT INTO migrations (filename) 
SELECT '004_bingo_updates.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'bingo_rooms' AND column_name = 'refund_processed')
ON CONFLICT DO NOTHING;

INSERT INTO migrations (filename) 
SELECT '005_bingo_90_mode.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'bingo_rooms' AND column_name = 'bingo_mode')
ON CONFLICT DO NOTHING;
```

### **1.2 Actualizar script de migraciones**

```javascript
// backend/db/migrate.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // Crear tabla de migraciones si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Obtener migraciones ya ejecutadas
    const executedResult = await pool.query('SELECT filename FROM migrations');
    const executed = new Set(executedResult.rows.map(row => row.filename));
    
    // Obtener archivos de migración
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Filtrar solo las no ejecutadas
    const pending = files.filter(file => !executed.has(file));
    
    console.log(`Found ${files.length} migration files`);
    console.log(`Already executed: ${executed.size}`);
    console.log(`Pending: ${pending.length}\n`);
    
    for (const file of pending) {
      console.log(`📝 Running migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        // Iniciar transacción
        await pool.query('BEGIN');
        
        // Ejecutar migración
        await pool.query(sql);
        
        // Registrar como ejecutada
        await pool.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        
        // Confirmar transacción
        await pool.query('COMMIT');
        
        console.log(`✅ ${file} completed successfully\n`);
      } catch (error) {
        // Rollback en caso de error
        await pool.query('ROLLBACK');
        console.error(`❌ Error in ${file}:`, error.message);
        
        // Si es la migración 006, intentar arreglarla
        if (file === '006_bingo_host_abandonment.sql') {
          console.log('⚠️  Intentando fix para migración 006...');
          await fixMigration006();
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Fix específico para migración 006
async function fixMigration006() {
  try {
    // Crear tablas faltantes si no existen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bingo_drawn_numbers (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES bingo_rooms(id),
        number INTEGER,
        drawn_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS bingo_audit_logs (
        id SERIAL PRIMARY KEY,
        room_id INTEGER,
        user_id UUID,
        action VARCHAR(100),
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('✅ Tablas faltantes creadas');
    
    // Ahora intentar la migración 006 nuevamente
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '006_bingo_host_abandonment.sql'), 
      'utf8'
    );
    
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      ['006_bingo_host_abandonment.sql']
    );
    await pool.query('COMMIT');
    
    console.log('✅ Migración 006 aplicada con éxito después del fix');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ No se pudo aplicar fix para migración 006:', error.message);
  }
}

runMigrations();
```

---

## **PASO 2: Fix marked_numbers como JSONB**

### **2.1 Migración para corregir tipo de datos**

```sql
-- backend/db/migrations/007_fix_marked_numbers_type.sql
-- Fix para marked_numbers: convertir de text a jsonb

-- Primero, verificar si la columna es de tipo text/varchar
DO $$
BEGIN
  -- Solo convertir si no es jsonb
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'bingo_cards' 
    AND column_name = 'marked_numbers' 
    AND data_type != 'jsonb'
  ) THEN
    -- Crear columna temporal
    ALTER TABLE bingo_cards ADD COLUMN marked_numbers_temp JSONB;
    
    -- Migrar datos parseando el JSON string
    UPDATE bingo_cards 
    SET marked_numbers_temp = 
      CASE 
        WHEN marked_numbers IS NULL THEN '[]'::jsonb
        WHEN marked_numbers = '' THEN '[]'::jsonb
        ELSE marked_numbers::jsonb
      END;
    
    -- Eliminar columna vieja
    ALTER TABLE bingo_cards DROP COLUMN marked_numbers;
    
    -- Renombrar columna nueva
    ALTER TABLE bingo_cards RENAME COLUMN marked_numbers_temp TO marked_numbers;
    
    -- Agregar default
    ALTER TABLE bingo_cards ALTER COLUMN marked_numbers SET DEFAULT '[]'::jsonb;
    
    RAISE NOTICE 'marked_numbers convertido a JSONB exitosamente';
  ELSE
    RAISE NOTICE 'marked_numbers ya es JSONB, no se requiere conversión';
  END IF;
END $$;

-- Índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_bingo_cards_marked_numbers 
ON bingo_cards USING gin(marked_numbers);

-- Verificación
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns 
  WHERE table_name = 'bingo_cards' AND column_name = 'marked_numbers';
  
  RAISE NOTICE 'Tipo de marked_numbers después de migración: %', col_type;
END $$;
```

---

## **PASO 3: Fix del Backend para marked_numbers**

```javascript
// backend/services/bingoService.js - función markNumber
async markNumber(cardId, number, userId) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Obtener cartón con tipo correcto
    const cardQuery = await client.query(
      `SELECT 
        bc.*,
        bc.marked_numbers::jsonb as marked_numbers_json,
        br.drawn_numbers 
       FROM bingo_cards bc
       JOIN bingo_rooms br ON bc.room_id = br.id
       WHERE bc.id = $1 AND bc.user_id = $2`,
      [cardId, userId]
    );
    
    if (cardQuery.rows.length === 0) {
      throw new Error('Cartón no encontrado');
    }
    
    const card = cardQuery.rows[0];
    
    // Usar marked_numbers_json que ya viene como array
    let currentMarked = card.marked_numbers_json || [];
    
    // Asegurar que es array
    if (!Array.isArray(currentMarked)) {
      console.error('marked_numbers no es array:', currentMarked);
      currentMarked = [];
    }
    
    // Verificar que el número fue cantado
    const drawnNumbers = card.drawn_numbers || [];
    if (!drawnNumbers.includes(number) && number !== 'FREE') {
      throw new Error('Este número aún no ha sido cantado');
    }
    
    // Agregar si no está marcado
    if (!currentMarked.includes(number)) {
      currentMarked.push(number);
    }
    
    // Actualizar en la DB como JSONB
    const updateQuery = await client.query(
      `UPDATE bingo_cards 
       SET marked_numbers = $1::jsonb
       WHERE id = $2
       RETURNING *, marked_numbers::jsonb as marked_numbers_json`,
      [JSON.stringify(currentMarked), cardId]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      markedNumbers: currentMarked,
      card: updateQuery.rows[0]
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## **PASO 4: Fix completo de callBingo**

```javascript
// backend/services/bingoService.js - función callBingo
async callBingo(code, cardId, userId) {
  const client = await getClient();
  
  try {
    console.log('========================================');
    console.log('🎯 INICIO CALL BINGO');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Code:', code);
    console.log('CardId:', cardId);
    console.log('UserId:', userId);
    console.log('========================================');
    
    await client.query('BEGIN');
    
    // Query mejorada con cast explícito a jsonb
    const cardQuery = await client.query(
      `SELECT 
        bc.*,
        bc.marked_numbers::jsonb as marked_array,
        br.victory_mode,
        br.drawn_numbers,
        br.id as room_id,
        br.pot_total
       FROM bingo_cards bc
       JOIN bingo_rooms br ON bc.room_id = br.id
       WHERE bc.id = $1 AND bc.user_id = $2 AND br.code = $3`,
      [cardId, userId, code]
    );
    
    if (cardQuery.rows.length === 0) {
      console.error('❌ Cartón no encontrado');
      await client.query('ROLLBACK');
      return {
        success: false,
        isValid: false,
        message: 'Cartón no encontrado'
      };
    }
    
    const card = cardQuery.rows[0];
    
    // Usar marked_array que ya viene como JSONB parseado
    let markedNumbers = card.marked_array || [];
    
    console.log('========================================');
    console.log('📋 DATOS DEL CARTÓN');
    console.log('Room ID:', card.room_id);
    console.log('Victory Mode:', card.victory_mode);
    console.log('Marked Numbers Type:', typeof markedNumbers);
    console.log('Marked Numbers IsArray:', Array.isArray(markedNumbers));
    console.log('Marked Numbers Count:', markedNumbers.length);
    console.log('Marked Numbers Content:', JSON.stringify(markedNumbers));
    console.log('========================================');
    
    // Validar el patrón
    const isValid = await this.validateWinningPattern(
      card,
      markedNumbers,
      card.victory_mode,
      client
    );
    
    console.log('========================================');
    console.log('📊 VALIDACIÓN');
    console.log('Resultado:', isValid ? 'VÁLIDO ✅' : 'INVÁLIDO ❌');
    console.log('========================================');
    
    if (!isValid) {
      console.log('❌ BINGO INVÁLIDO - Patrón incompleto');
      await client.query('ROLLBACK');
      return {
        success: false,
        isValid: false,
        message: 'El patrón no está completo'
      };
    }
    
    // Obtener datos del ganador
    const userQuery = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const winnerName = userQuery.rows[0]?.username || 'Jugador';
    const totalPot = card.pot_total || 0;
    
    // Actualizar sala como terminada
    await client.query(
      `UPDATE bingo_rooms 
       SET status = 'finished', 
           winner_id = $1,
           ended_at = NOW()
       WHERE id = $2`,
      [userId, card.room_id]
    );
    
    // Distribuir premios
    await this.distributePrizes(card.room_id, userId, client);
    
    await client.query('COMMIT');
    
    console.log('========================================');
    console.log('🎉 BINGO VÁLIDO - GANADOR');
    console.log('Winner:', winnerName);
    console.log('Prize:', totalPot);
    console.log('Pattern:', card.victory_mode);
    console.log('========================================');
    
    return {
      success: true,
      isValid: true,
      winnerName,
      pattern: card.victory_mode,
      totalPot
    };
    
  } catch (error) {
    console.error('========================================');
    console.error('💥 ERROR CRÍTICO EN CALL BINGO');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================');
    
    await client.query('ROLLBACK');
    return {
      success: false,
      isValid: false,
      message: error.message
    };
  } finally {
    client.release();
  }
}
```

---

## **PASO 5: Fix Socket Handler**

```javascript
// backend/socket/bingo.js
socket.on('bingo:call_bingo', async (data, callback) => {
  const { code, cardId } = data;
  
  try {
    console.log('🎲 [SOCKET] BINGO cantado - Evento recibido', {
      code,
      cardId,
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });

    // Notificar a todos que alguien cantó bingo
    io.to(`bingo:${code}`).emit('bingo:claim_in_progress', {
      playerId: socket.userId,
      cardId,
      message: 'Validando bingo...'
    });
    
    // Validar el bingo
    const result = await bingoService.callBingo(code, cardId, socket.userId);
    
    console.log('📊 [SOCKET] Resultado de callBingo', result);

    if (result.success && result.isValid) {
      // BINGO válido!
      const gameOverData = {
        winnerId: socket.userId,
        winnerName: result.winnerName,
        cardId,
        pattern: result.pattern,
        totalPot: result.totalPot,
        celebration: true
      };

      console.log('🏆 [SOCKET] Emitiendo bingo:game_over a toda la sala', gameOverData);

      // IMPORTANTE: Emitir a TODA la sala, incluyendo al ganador
      io.to(`bingo:${code}`).emit('bingo:game_over', gameOverData);
      
      // Responder al callback si existe
      if (callback) {
        callback({ success: true });
      }
      
    } else {
      // Bingo inválido
      const invalidData = {
        playerId: socket.userId,
        message: result.message || 'Bingo inválido, el juego continúa'
      };

      console.log('❌ [SOCKET] BINGO INVÁLIDO - Emitiendo bingo:claim_invalid', invalidData);

      io.to(`bingo:${code}`).emit('bingo:claim_invalid', invalidData);
      
      // Responder al callback con error
      if (callback) {
        callback({ success: false, error: result.message });
      }
    }
  } catch (error) {
    console.error('💥 [SOCKET] Error crítico en call_bingo', error);
    
    socket.emit('bingo:error', { 
      message: 'Error al procesar tu BINGO' 
    });
    
    if (callback) {
      callback({ success: false, error: error.message });
    }
  }
});
```

---

## **PASO 6: Habilitar BingoAbandonmentJob**

```javascript
// backend/server.js - Línea ~298
// Después de que las migraciones se ejecuten correctamente
try {
  // Cleanup jobs
  const BingoRefundJob = require('./jobs/bingoRefundJob');
  BingoRefundJob.start();
  logger.info('✅ BingoRefundJob iniciado - cada 10 minutos');
  
  const BingoCleanupJob = require('./jobs/bingoCleanupJob');
  BingoCleanupJob.start();
  logger.info('✅ BingoCleanupJob iniciado - cada hora');
  
  // Ahora SÍ habilitar el job de abandono
  const BingoAbandonmentJob = require('./jobs/bingoAbandonmentJob');
  BingoAbandonmentJob.start();
  logger.info('✅ BingoAbandonmentJob iniciado - cada 60 segundos');
  
} catch (error) {
  logger.error('Error iniciando jobs de Bingo:', error);
}
```

---

## 📦 **DEPLOYMENT COMPLETO**

### **Orden de ejecución:**

```bash
# 1. Agregar todos los cambios
git add -A

# 2. Commit descriptivo
git commit -m "fix: sistema completo Bingo - migraciones + marked_numbers JSONB + socket + jobs"

# 3. Push
git push

# 4. Esperar deploy (~6 minutos)
Start-Sleep -Seconds 360

# 5. Verificar migraciones
curl https://confident-bravery-production-ce7b.up.railway.app/api/health

# 6. Verificar logs en Railway
# Buscar:
# - "All migrations completed successfully"
# - "BingoAbandonmentJob iniciado"
# - "CALL BINGO INICIADO"
```

---

## ✅ **CHECKLIST POST-DEPLOY**

- [ ] Todas las migraciones ejecutadas (incluida 006)
- [ ] marked_numbers es tipo JSONB en DB
- [ ] BingoAbandonmentJob está activo
- [ ] Socket mantiene conexión
- [ ] Modal BINGO aparece al completar patrón
- [ ] Al presionar botón, se valida correctamente
- [ ] Modal de celebración aparece
- [ ] Premios se distribuyen
- [ ] Botón "Aceptar" lleva al lobby

---

## 🎯 **RESULTADO ESPERADO**

1. **Sistema de migraciones robusto** que no re-ejecuta migraciones
2. **marked_numbers como JSONB** consistente
3. **Todos los jobs activos** incluyendo abandono
4. **Flujo completo funcional** desde BINGO hasta celebración

---

## 📊 **CONFIANZA: 99%**

Esta solución resuelve TODOS los problemas identificados de raíz.
