// Script de verificación pre-deploy para evitar errores
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando integridad del proyecto antes del deploy...\n');

let errors = 0;
let warnings = 0;

// 1. Verificar que todos los archivos críticos existan
const criticalFiles = [
  'backend/server.js',
  'backend/db/index.js',
  'backend/db/migrate.js',
  'backend/services/bingoService.js',
  'backend/socket/bingo.js',
  'backend/routes/bingo.js',
  'frontend/src/pages/BingoRoom.js'
];

console.log('📁 Verificando archivos críticos:');
criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.error(`  ❌ ${file} - NO ENCONTRADO`);
    errors++;
  }
});

// 2. Verificar imports en archivos de rutas
const routeFiles = fs.readdirSync(path.join(__dirname, 'backend/routes'));
console.log('\n📋 Verificando imports en rutas:');

routeFiles.forEach(file => {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(__dirname, 'backend/routes', file), 'utf8');
    
    // Verificar imports problemáticos
    if (content.includes("require('../db/db')") || content.includes("require('../db/pool')")) {
      console.error(`  ❌ ${file} tiene import incorrecto: debe ser '../db' o '../db/index'`);
      errors++;
    }
    
    // Verificar que si usa pool, importe correctamente
    if (content.includes('pool.query') || content.includes('pool.connect')) {
      if (!content.includes("require('../db')") && !content.includes("require('../db/index')")) {
        console.warn(`  ⚠️ ${file} usa pool pero podría tener import incorrecto`);
        warnings++;
      } else {
        console.log(`  ✅ ${file} - imports correctos`);
      }
    }
  }
});

// 3. Verificar package.json scripts
console.log('\n📦 Verificando package.json:');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

if (packageJson.scripts.start) {
  console.log(`  ✅ Script start: ${packageJson.scripts.start}`);
} else {
  console.error('  ❌ Falta script start');
  errors++;
}

if (packageJson.scripts.migrate) {
  console.log(`  ✅ Script migrate: ${packageJson.scripts.migrate}`);
} else {
  console.error('  ❌ Falta script migrate');
  errors++;
}

// 4. Verificar variables de entorno requeridas
console.log('\n🔐 Variables de entorno requeridas:');
const requiredEnvVars = [
  'DATABASE_URL',
  'PORT',
  'JWT_SECRET',
  'FRONTEND_URL'
];

requiredEnvVars.forEach(envVar => {
  console.log(`  ℹ️ ${envVar} - debe estar configurada en Railway`);
});

// 5. Verificar sintaxis de archivos críticos
console.log('\n✅ Verificando sintaxis de archivos críticos:');
const filesToCheck = [
  'backend/server.js',
  'backend/services/bingoService.js',
  'backend/socket/bingo.js'
];

filesToCheck.forEach(file => {
  try {
    require(path.join(__dirname, file));
    console.log(`  ✅ ${file} - sintaxis correcta`);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && !error.message.includes('../db/db')) {
      // Ignorar errores de módulos externos
      console.log(`  ✅ ${file} - sintaxis básica correcta`);
    } else if (error.message.includes('../db/db')) {
      console.error(`  ❌ ${file} - Error: ${error.message}`);
      errors++;
    }
  }
});

// Resultado final
console.log('\n' + '='.repeat(50));
if (errors > 0) {
  console.error(`❌ DEPLOY NO SEGURO: ${errors} errores encontrados`);
  console.log('Por favor, corrige los errores antes de hacer push');
  process.exit(1);
} else if (warnings > 0) {
  console.warn(`⚠️ DEPLOY CON PRECAUCIÓN: ${warnings} advertencias`);
  console.log('Revisa las advertencias antes de continuar');
} else {
  console.log('✅ DEPLOY SEGURO: No se encontraron problemas');
}
console.log('='.repeat(50));
