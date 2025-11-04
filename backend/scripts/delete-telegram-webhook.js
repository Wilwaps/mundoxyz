#!/usr/bin/env node
/**
 * Script para eliminar el webhook de Telegram Bot
 * Útil para volver a modo polling en desarrollo
 * 
 * Uso:
 *   node backend/scripts/delete-telegram-webhook.js
 */

require('dotenv').config();
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN no configurado en .env');
  process.exit(1);
}

console.log('🤖 Eliminando Telegram Bot Webhook...\n');

const options = {
  method: 'POST',
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/deleteWebhook`,
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.ok) {
        console.log('✅ Webhook eliminado exitosamente!');
        console.log('💡 Ahora puedes usar modo polling en desarrollo');
      } else {
        console.error('❌ Error:', response.description);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error parseando respuesta:', error.message);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error.message);
  process.exit(1);
});

req.write(JSON.stringify({ drop_pending_updates: true }));
req.end();
