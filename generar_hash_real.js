const bcrypt = require('bcryptjs');

async function generarHashes() {
  console.log('🔐 Generando hashes reales con bcryptjs...\n');
  
  // Hash para "123456"
  const hash123456 = await bcrypt.hash('123456', 10);
  console.log('Password: "123456"');
  console.log('Hash:', hash123456);
  console.log('Longitud:', hash123456.length);
  
  // Verificar que funciona
  const isValid = await bcrypt.compare('123456', hash123456);
  console.log('Verificación:', isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO');
  
  console.log('\n---\n');
  
  // Hash para "copito"
  const hashCopito = await bcrypt.hash('copito', 10);
  console.log('Security Answer: "copito"');
  console.log('Hash:', hashCopito);
  console.log('Longitud:', hashCopito.length);
  
  // Verificar que funciona
  const isValidCopito = await bcrypt.compare('copito', hashCopito);
  console.log('Verificación:', isValidCopito ? '✅ VÁLIDO' : '❌ INVÁLIDO');
  
  console.log('\n---\n');
  console.log('📋 SQL para actualizar usuario prueba1:\n');
  console.log(`-- 1. Actualizar password`);
  console.log(`UPDATE auth_identities ai`);
  console.log(`SET password_hash = '${hash123456}'`);
  console.log(`FROM users u`);
  console.log(`WHERE ai.user_id = u.id AND u.username = 'prueba1' AND ai.provider = 'email';`);
  
  console.log(`\n-- 2. Actualizar security_answer`);
  console.log(`UPDATE users`);
  console.log(`SET security_answer = '${hashCopito}'`);
  console.log(`WHERE username = 'prueba1';`);
}

generarHashes().catch(console.error);
