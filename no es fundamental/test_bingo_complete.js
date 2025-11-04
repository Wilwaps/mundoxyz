const axios = require('axios');

// Configuración
const API_URL = 'https://confident-bravery-production-ce7b.up.railway.app/api';
const TEST_USER = {
    username: 'prueba1',
    password: '123456'
};

let authToken = '';
let testRoomCode = '';
let testRoomData = {};

// Funciones helper
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
}

async function login() {
    try {
        log('🔐 Iniciando sesión de prueba...');
        const response = await axios.post(`${API_URL}/auth/login-email`, TEST_USER);
        authToken = response.data.token;
        log(`✅ Login exitoso - Token: ${authToken.substring(0, 20)}...`);
        return true;
    } catch (error) {
        log(`❌ Error en login: ${error.response?.data?.error || error.message}`, 'ERROR');
        return false;
    }
}

async function createRoom() {
    try {
        log('🏗️ Creando sala de prueba...');
        const roomConfig = {
            roomName: 'Sala Test Backend Completo',
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
        return room;
    } catch (error) {
        log(`❌ Error obteniendo detalles: ${error.response?.data?.error || error.message}`, 'ERROR');
        return null;
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
        return false;
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

async function drawNumbers(count = 5) {
    try {
        log(`🎲 Cantando ${count} números...`);
        
        for (let i = 0; i < count; i++) {
            const response = await axios.post(`${API_URL}/bingo/rooms/${testRoomCode}/draw`, {}, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            
            const number = response.data.number;
            const called = response.data.called_count;
            log(`   Número ${i + 1}: ${number} (${called}/${response.data.total_numbers} cantados)`);
            
            await delay(1000); // Esperar 1 segundo entre números
        }
        
        return true;
    } catch (error) {
        log(`❌ Error cantando números: ${error.response?.data?.error || error.message}`, 'ERROR');
        return false;
    }
}

async function getBalance() {
    try {
        log('💰 Obteniendo balance actual...');
        const response = await axios.get(`${API_URL}/economy/balance`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const balance = response.data;
        log(`✅ Balance actual:`);
        log(`   Coins: ${balance.coins_balance}`);
        log(`   Fires: ${balance.fires_balance}`);
        return balance;
    } catch (error) {
        log(`❌ Error obteniendo balance: ${error.response?.data?.error || error.message}`, 'ERROR');
        return null;
    }
}

async function listPublicRooms() {
    try {
        log('📋 Listando salas públicas...');
        const response = await axios.get(`${API_URL}/bingo/rooms/public`);
        
        log(`✅ Salas públicas encontradas: ${response.data.rooms.length}`);
        response.data.rooms.forEach((room, index) => {
            log(`   ${index + 1}. ${room.room_name || room.code} - ${room.current_players}/${room.max_players} jugadores`);
        });
        return response.data.rooms;
    } catch (error) {
        log(`❌ Error listando salas: ${error.response?.data?.error || error.message}`, 'ERROR');
        return [];
    }
}

// Test principal
async function runCompleteTest() {
    log('🚀 INICIANDO PRUEBA COMPLETA DE BACKEND BINGO', 'SUCCESS');
    log('=' .repeat(60));

    // 1. Login
    if (!await login()) {
        log('❌ Prueba fallida en login', 'ERROR');
        return;
    }

    // 2. Obtener balance inicial
    const initialBalance = await getBalance();
    if (!initialBalance) {
        log('❌ No se pudo obtener balance inicial', 'ERROR');
        return;
    }

    // 3. Listar salas públicas
    await listPublicRooms();

    // 4. Crear sala
    if (!await createRoom()) {
        log('❌ Prueba fallida al crear sala', 'ERROR');
        return;
    }

    // 5. Obtener detalles de sala
    const roomDetails = await getRoomDetails();
    if (!roomDetails) {
        log('❌ No se pudieron obtener detalles de sala', 'ERROR');
        return;
    }

    // 6. Comprar cartones
    if (!await buyCards()) {
        log('❌ Prueba fallida al comprar cartones', 'ERROR');
        return;
    }

    // 7. Verificar detalles después de compra
    await getRoomDetails();

    // 8. Marcar listo
    if (!await markReady()) {
        log('❌ Prueba fallida al marcar listo', 'ERROR');
        return;
    }

    // 9. Iniciar juego
    if (!await startGame()) {
        log('❌ Prueba fallida al iniciar juego', 'ERROR');
        return;
    }

    // 10. Cantar números
    if (!await drawNumbers(5)) {
        log('❌ Prueba fallida al cantar números', 'ERROR');
        return;
    }

    // 11. Obtener balance final
    const finalBalance = await getBalance();
    if (!finalBalance) {
        log('❌ No se pudo obtener balance final', 'ERROR');
        return;
    }

    // 12. Resumen final
    log('=' .repeat(60));
    log('📊 RESUMEN DE PRUEBA COMPLETA', 'SUCCESS');
    log(`✅ Sala creada: ${testRoomCode}`);
    log(`✅ Balance inicial: ${initialBalance.fires_balance} fuegos`);
    log(`✅ Balance final: ${finalBalance.fires_balance} fuegos`);
    log(`✅ Diferencia: ${(parseFloat(finalBalance.fires_balance) - parseFloat(initialBalance.fires_balance)).toFixed(2)} fuegos`);
    log(`✅ Estado final sala: ${roomDetails.status}`);
    log('🎉 PRUEBA COMPLETA FINALIZADA EXITOSAMENTE', 'SUCCESS');
}

// Ejecutar prueba
if (require.main === module) {
    runCompleteTest().catch(error => {
        log(`💥 Error fatal en prueba: ${error.message}`, 'ERROR');
        process.exit(1);
    });
}

module.exports = {
    runCompleteTest,
    login,
    createRoom,
    buyCards,
    startGame,
    drawNumbers
};
