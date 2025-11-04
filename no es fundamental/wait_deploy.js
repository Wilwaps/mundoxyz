console.log(`
==================================================
⏳ ESPERANDO DEPLOY EN RAILWAY
==================================================

Tiempo de espera: 800 segundos (13 minutos 20 segundos)
Inicio: ${new Date().toLocaleTimeString()}

`);

const totalSeconds = 800;
const updateInterval = 30; // Actualizar cada 30 segundos
let elapsed = 0;

const timer = setInterval(() => {
    elapsed += updateInterval;
    const remaining = totalSeconds - elapsed;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const percentage = ((elapsed / totalSeconds) * 100).toFixed(1);
    
    console.log(`⏱️  [${new Date().toLocaleTimeString()}] Progreso: ${percentage}% - Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // Mensajes de estado cada 2 minutos
    if (elapsed % 120 === 0) {
        const stages = {
            120: '🔄 Railway detectando cambios en GitHub...',
            240: '📦 Construyendo aplicación frontend...',
            360: '🔧 Instalando dependencias...',
            480: '🚀 Preparando deploy...',
            600: '✅ Finalizando configuración...',
            720: '🎯 Casi listo, últimos ajustes...'
        };
        
        if (stages[elapsed]) {
            console.log(`\n${stages[elapsed]}\n`);
        }
    }
    
    if (elapsed >= totalSeconds) {
        clearInterval(timer);
        console.log(`
==================================================
✅ DEPLOY COMPLETADO
==================================================

Hora de finalización: ${new Date().toLocaleTimeString()}

El deploy debería estar listo en Railway.
Ahora puedes proceder con las pruebas en Chrome DevTools.

CAMBIOS APLICADOS:
1. Códigos de sala ahora son numéricos (6 dígitos)
2. Frontend corregido para procesar room data
3. BingoWaitingRoom debería mostrarse correctamente

==================================================
`);
        process.exit(0);
    }
}, updateInterval * 1000);
