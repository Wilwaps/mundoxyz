const axios = require('axios');

const RAILWAY_URL = 'https://mundoxyz-production.up.railway.app';

// Credenciales del admin
const TELEGRAM_ID = '1417856820';

async function getToken() {
  try {
    console.log('🔐 Obteniendo token de autenticación...');
    const response = await axios.post(`${RAILWAY_URL}/api/auth/telegram`, {
      id: TELEGRAM_ID,
      first_name: 'Admin',
      username: 'admin'
    });
    console.log('✅ Token obtenido\n');
    return response.data.token;
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.message);
    throw error;
  }
}

async function testCreateRaffle() {
  const TOKEN = await getToken();
  try {
    console.log('🧪 PRUEBA: Crear Rifa en Modo Fuego');
    console.log('━'.repeat(80));
    
    const raffleData = {
      name: 'Test Script - Rifa Fuego',
      description: 'Rifa de prueba desde script Node.js',
      mode: 'fires',
      visibility: 'public',
      numbersRange: 100,
      entryPrice: 10,
      startsAt: null,
      endsAt: null
    };
    
    console.log('📤 Datos enviados:');
    console.log(JSON.stringify(raffleData, null, 2));
    console.log('');
    
    const response = await axios.post(
      `${RAILWAY_URL}/api/raffles/v2`,
      raffleData,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Respuesta exitosa:');
    console.log('━'.repeat(80));
    console.log('Status:', response.status);
    console.log('');
    console.log('📥 Datos recibidos:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    
    // Verificar campos clave
    console.log('🔍 Verificación de campos clave:');
    console.log('━'.repeat(80));
    console.log('✅ id:', response.data.id || '❌ FALTA');
    console.log('✅ code:', response.data.code || '❌ FALTA');
    console.log('✅ name:', response.data.name || '❌ FALTA');
    console.log('✅ mode:', response.data.mode || '❌ FALTA');
    console.log('✅ status:', response.data.status || '❌ FALTA');
    console.log('');
    
    if (!response.data.code) {
      console.log('❌ PROBLEMA DETECTADO: El backend NO está devolviendo el campo "code"');
    } else {
      console.log(`✅ Todo correcto. Se puede navegar a: /raffles/${response.data.code}`);
    }
    
  } catch (error) {
    console.error('❌ Error en la petición:');
    console.error('━'.repeat(80));
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
      console.error(error.message);
    } else {
      console.error('Error configurando la petición:', error.message);
    }
  }
}

testCreateRaffle();
