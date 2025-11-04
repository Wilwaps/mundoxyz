#!/usr/bin/env node
/**
 * Script para configurar el webhook de Telegram Bot
 * 
 * Uso:
 *   node backend/scripts/setup-telegram-webhook.js
 * 
 * Variables requeridas en .env:
 *   TELEGRAM_BOT_TOKEN
 *   PUBLIC_WEBAPP_URL
 */

require('dotenv').config();
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_WEBAPP_URL;

if (!BOT_TOKEN) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN no configurado en .env');
  process.exit(1);
}

if (!PUBLIC_URL) {
  console.error('❌ ERROR: PUBLIC_WEBAPP_URL no configurado en .env');
  process.exit(1);
}

// Construir webhook URL
// El token se pasa en la URL para seguridad
const webhookPath = BOT_TOKEN.split(':')[1];
const WEBHOOK_URL = `${PUBLIC_URL}/api/telegram/webhook/${webhookPath}`;

console.log('🤖 Configurando Telegram Bot Webhook...\n');
console.log(`📍 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`🌐 Webhook URL: ${WEBHOOK_URL}\n`);

// Set webhook
const options = {
  method: 'POST',
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/setWebhook`,
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
        console.log('✅ Webhook configurado exitosamente!\n');
        console.log('📋 Detalles:');
        console.log(`   - URL: ${response.result.url}`);
        console.log(`   - Pending updates: ${response.result.pending_update_count || 0}`);
        console.log(`   - Max connections: ${response.result.max_connections || 40}`);
        
        if (response.result.allowed_updates) {
          console.log(`   - Allowed updates: ${response.result.allowed_updates.join(', ')}`);
        }
        
        console.log('\n✨ El bot está listo para recibir mensajes!');
        console.log('💡 Prueba enviando /start a @' + process.env.TELEGRAM_BOT_USERNAME);
      } else {
        console.error('❌ Error al configurar webhook:', response.description);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error parseando respuesta:', error.message);
      console.error('Respuesta raw:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la petición:', error.message);
  process.exit(1);
});

const payload = JSON.stringify({
  url: WEBHOOK_URL,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false
});

req.write(payload);
req.end();
