const axios = require('axios');

// Usar token existente de la sesión del navegador
const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMDhkNWVhYi1kNmNlLTRiNTYtOWYxOC1mMzRiZmRiMjkzODEiLCJ0aW1lc3RhbXAiOjE3NjE2MTI2NjcyMzQsImlhdCI6MTc2MTYxMjY2NywiZXhwIjoxNzYyMjE3NDY3fQ.MfOTi_KbK10u-GkFcdMS8ZJeN59F9V2UfGg1CL6pL_8';

const API_URL = 'https://confident-bravery-production-ce7b.up.railway.app/api';

let testRoomCode = '';
let testRoomData = {};

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

async function createRoom() {
    try {
        log('🏗️ Creando sala de prueba...');
        const roomConfig = {
            roomName: 'Sala Test Backend Token',
            roomType: 'public',
            currency: 'fires',
            numbersMode: 75,
            victoryMode: 'line',
            cardCost: 1,
            maxPlayers: 10,
            maxCardsPerPlayer: 5,
            password: ''
        };

        const response = await axios.post(`${API_URL}/bingo/rooms`, roomConfig, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        testRoomData = response.data.room;
        testRoomCode = testRoomData.code;
        
        log(`✅ Sala creada - Código: ${testRoomCode}`);
        log(`   Nombre: ${testRoomData.room_name}`);
        log(`   Costo: ${testRoomData.card_cost} ${testRoomData.currency}`);
        return true;
    } catch (error) {
        log(`❌ Error creando sala: ${error.response?.data?.error || error.message}`, 'ERROR');
        if (error.response?.data) {
            log(`   Detalles: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return false;
    }
}

async function buyCards() {
    try {
        log('🛒 Comprando cartones...');
        const purchaseData = {
            numberOfCards: 2,
            password: ''
        };

        const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/join`, purchaseData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        log(`✅ Cartones comprados:`);
        log(`   Cantidad: ${response.data.cards_purchased}`);
        log(`   Total cartones: ${response.data.total_cards}`);
        log(`   Costo: ${response.data.total_cost} ${response.data.currency}`);
        return true;
    } catch (error) {
        log(`❌ Error comprando cartones: ${error.response?.data?.error || error.message}`, 'ERROR');
        if (error.response?.data) {
            log(`   Detalles: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return false;
    }
}

async function getRoomDetails() {
    try {
        log(`🔍 Obteniendo detalles de sala ${testRoomCode}...`);
        const response = await axios.get(`${API_URL}/bingo/rooms/${testRoomCode}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const room = response.data.room;
        log(`✅ Detalles obtenidos:`);
        log(`   Estado: ${room.status}`);
        log(`   Jugadores: ${room.current_players}/${room.max_players}`);
        log(`   Pozo: ${room.total_pot} ${room.currency}`);
        log(`   Host: ${room.host_username}`);
        return room;
    } catch (error) {
        log(`❌ Error obteniendo detalles: ${error.response?.data?.error || error.message}`, 'ERROR');
        if (error.response?.data) {
            log(`   Detalles: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return null;
    }
}

async function testBackendFlow() {
    log('🚀 INICIANDO PRUEBA BACKEND CON TOKEN EXISTENTE', 'SUCCESS');
    log('=' .repeat(60));

    // 1. Crear sala
    if (!await createRoom()) {
        log('❌ Prueba fallida al crear sala', 'ERROR');
        return;
    }

    // 2. Obtener detalles iniciales
    const initialDetails = await getRoomDetails();
    if (!initialDetails) {
        log('❌ No se pudieron obtener detalles iniciales', 'ERROR');
        return;
    }

    // 3. Comprar cartones
    if (!await buyCards()) {
        log('❌ Prueba fallida al comprar cartones', 'ERROR');
        return;
    }

    // 4. Verificar detalles después de compra
    const finalDetails = await getRoomDetails();
    if (!finalDetails) {
        log('❌ No se pudieron obtener detalles finales', 'ERROR');
        return;
    }

    // 5. Resumen
    log('=' .repeat(60));
    log('📊 RESUMEN DE PRUEBA BACKEND', 'SUCCESS');
    log(`✅ Sala creada: ${testRoomCode}`);
    log(`✅ Estado inicial: ${initialDetails.status}`);
    log(`✅ Jugadores iniciales: ${initialDetails.current_players}`);
    log(`✅ Pozo inicial: ${initialDetails.total_pot}`);
    log(`✅ Estado final: ${finalDetails.status}`);
    log(`✅ Jugadores finales: ${finalDetails.current_players}`);
    log(`✅ Pozo final: ${finalDetails.total_pot}`);
    log('🎉 PRUEBA BACKEND COMPLETADA EXITOSAMENTE', 'SUCCESS');
}

// Ejecutar prueba
testBackendFlow().catch(error => {
    log(`💥 Error fatal: ${error.message}`, 'ERROR');
    process.exit(1);
});
