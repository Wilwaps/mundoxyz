const axios = require('axios');

const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMDhkNWVhYi1kNmNlLTRiNTYtOWYxOC1mMzRiZmRiMjkzODEiLCJ0aW1lc3RhbXAiOjE3NjE2MTI2NjcyMzQsImlhdCI6MTc2MTYxMjY2NywiZXhwIjoxNzYyMjE3NDY3fQ.MfOTi_KbK10u-GkFcdMS8ZJeN59F9V2UfGg1CL6pL_8';
const API_URL = 'https://confident-bravery-production-ce7b.up.railway.app/api';

let testRoomCode = '';

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

async function createFreeRoom() {
    try {
        log('🏗️ Creando sala GRATIS de prueba...');
        const roomConfig = {
            roomName: 'Sala Test Backend GRATIS',
            roomType: 'public',
            currency: 'fires',
            numbersMode: 75,
            victoryMode: 'line',
            cardCost: 0, // SALA GRATIS
            maxPlayers: 10,
            maxCardsPerPlayer: 5,
            password: ''
        };

        const response = await axios.post(`${API_URL}/bingo/rooms`, roomConfig, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        testRoomCode = response.data.room.code;
        
        log(`✅ Sala GRATIS creada - Código: ${testRoomCode}`);
        log(`   Nombre: ${response.data.room.room_name}`);
        log(`   Costo: ${response.data.room.card_cost} ${response.data.room.currency}`);
        return true;
    } catch (error) {
        log(`❌ Error creando sala: ${error.response?.data?.error || error.message}`, 'ERROR');
        if (error.response?.data) {
            log(`   Detalles: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return false;
    }
}

async function buyFreeCards() {
    try {
        log('🛒 Comprando cartones GRATIS...');
        const purchaseData = {
            numberOfCards: 3,
            password: ''
        };

        const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/join`, purchaseData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        log(`✅ Cartones comprados:`);
        log(`   Cantidad: ${response.data.cards_purchased}`);
        log(`   Total cartones: ${response.data.total_cards}`);
        log(`   Costo: ${response.data.total_cost} ${response.data.currency}`);
        log(`   IDs de cartones: ${response.data.card_ids?.join(', ') || 'N/A'}`);
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
        log(`   Cartones del usuario: ${room.user_cards?.length || 0}`);
        
        if (room.user_cards && room.user_cards.length > 0) {
            log(`   Primer cartón (primeros 10 números): ${JSON.stringify(room.user_cards[0].numbers.slice(0, 10))}`);
        }
        
        return room;
    } catch (error) {
        log(`❌ Error obteniendo detalles: ${error.response?.data?.error || error.message}`, 'ERROR');
        if (error.response?.data) {
            log(`   Detalles: ${JSON.stringify(error.response.data, null, 2)}`, 'ERROR');
        }
        return null;
    }
}

async function markReady() {
    try {
        log('✅ Marcando jugador como listo...');
        const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/ready`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        log(`✅ Jugador marcado como listo`);
        return true;
    } catch (error) {
        log(`❌ Error marcando listo: ${error.response?.data?.error || error.message}`, 'ERROR');
        return false;
    }
}

async function startGame() {
    try {
        log('🎮 Iniciando juego...');
        const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/start`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        log(`✅ Juego iniciado - Estado: ${response.data.room.status}`);
        return true;
    } catch (error) {
        log(`❌ Error iniciando juego: ${error.response?.data?.error || error.message}`, 'ERROR');
        return false;
    }
}

async function drawNumbers(count = 3) {
    try {
        log(`🎲 Cantando ${count} números...`);
        
        for (let i = 0; i < count; i++) {
            const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/draw`, {}, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            
            const number = response.data.number;
            const called = response.data.called_count;
            log(`   Número ${i + 1}: ${number} (${called}/${response.data.total_numbers} cantados)`);
            
            await delay(500);
        }
        
        return true;
    } catch (error) {
        log(`❌ Error cantando números: ${error.response?.data?.error || error.message}`, 'ERROR');
        return false;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCompleteFlow() {
    log('🚀 INICIANDO PRUEBA COMPLETA BACKEND GRATIS', 'SUCCESS');
    log('=' .repeat(60));

    // 1. Crear sala gratis
    if (!await createFreeRoom()) {
        log('❌ Prueba fallida al crear sala', 'ERROR');
        return;
    }

    // 2. Obtener detalles iniciales
    const initialDetails = await getRoomDetails();
    if (!initialDetails) {
        log('❌ No se pudieron obtener detalles iniciales', 'ERROR');
        return;
    }

    // 3. Comprar cartones gratis
    if (!await buyFreeCards()) {
        log('❌ Prueba fallida al comprar cartones', 'ERROR');
        return;
    }

    // 4. Verificar detalles después de compra
    const afterPurchase = await getRoomDetails();
    if (!afterPurchase) {
        log('❌ No se pudieron obtener detalles post-compra', 'ERROR');
        return;
    }

    // 5. Marcar listo
    if (!await markReady()) {
        log('❌ Prueba fallida al marcar listo', 'ERROR');
        return;
    }

    // 6. Iniciar juego
    if (!await startGame()) {
        log('❌ Prueba fallida al iniciar juego', 'ERROR');
        return;
    }

    // 7. Cantar números
    if (!await drawNumbers(3)) {
        log('❌ Prueba fallida al cantar números', 'ERROR');
        return;
    }

    // 8. Estado final
    const finalDetails = await getRoomDetails();

    // 9. Resumen
    log('=' .repeat(60));
    log('📊 RESUMEN PRUEBA BACKEND COMPLETA', 'SUCCESS');
    log(`✅ Sala creada: ${testRoomCode}`);
    log(`✅ Flujo completo: Crear → Comprar → Listo → Iniciar → Cantar`);
    log(`✅ Cartones generados: ${afterPurchase.user_cards?.length || 0}`);
    log(`✅ Juego funcional: ${finalDetails?.status}`);
    log('🎉 TODOS LOS ENDPOINTS BACKEND FUNCIONAN PERFECTAMENTE', 'SUCCESS');
}

// Ejecutar prueba
testCompleteFlow().catch(error => {
    log(`💥 Error fatal: ${error.message}`, 'ERROR');
    process.exit(1);
});
