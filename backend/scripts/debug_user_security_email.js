#!/usr/bin/env node

/**
 * Script de diagnóstico para revisar estado de seguridad y email de un usuario.
 *
 * Uso (ejemplos):
 *   node backend/scripts/debug_user_security_email.js --tg-id 5607496650
 *   node backend/scripts/debug_user_security_email.js --user-id <uuid>
 *   node backend/scripts/debug_user_security_email.js --email ejemplo@correo.com
 *
 * El script lee DATABASE_PUBLIC_URL o DATABASE_URL de las variables de entorno.
 */

const { Client } = require('pg');

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const tgId = getArgValue('--tg-id');
const userId = getArgValue('--user-id');
const email = getArgValue('--email');
const username = getArgValue('--username');

if (!tgId && !userId && !email && !username) {
  console.error('Debe indicar al menos un criterio: --tg-id, --user-id, --email o --username');
  process.exit(1);
}

const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Debe definir DATABASE_PUBLIC_URL o DATABASE_URL en las variables de entorno.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado a la base de datos');

    // Construir query de usuario
    let queryStr = `
      SELECT 
        u.id,
        u.tg_id,
        u.username,
        u.email,
        u.ci_full,
        u.security_answer,
        u.tito_owner_id,
        u.created_at,
        u.last_seen_at
      FROM users u
      WHERE 1=1`;

    const params = [];

    if (userId) {
      params.push(userId);
      queryStr += ` AND u.id = $${params.length}`;
    }

    if (tgId) {
      params.push(tgId);
      queryStr += ` AND u.tg_id = $${params.length}`;
    }

    if (email) {
      params.push(email.toLowerCase());
      queryStr += ` AND LOWER(u.email) = $${params.length}`;
    }

    if (username) {
      params.push(username.toLowerCase());
      queryStr += ` AND LOWER(u.username) = $${params.length}`;
    }

    queryStr += ' ORDER BY u.created_at DESC LIMIT 5';

    console.log('\n=== Buscando usuario(s) ===');
    console.log('Criterios:', { userId, tgId, email, username });

    const userRes = await client.query(queryStr, params);

    if (userRes.rows.length === 0) {
      console.log('No se encontraron usuarios con esos criterios.');
      return;
    }

    for (const row of userRes.rows) {
      console.log('\n============================================');
      console.log('Usuario encontrado:');
      console.log({
        id: row.id,
        tg_id: row.tg_id,
        username: row.username,
        email: row.email,
        ci_full: row.ci_full,
        tito_owner_id: row.tito_owner_id,
        created_at: row.created_at,
        last_seen_at: row.last_seen_at,
        // No imprimir la respuesta completa, solo indicar si existe y largo del hash
        has_security_answer: !!row.security_answer,
        security_answer_length: row.security_answer ? String(row.security_answer).length : 0
      });

      // Revisar identidades de autenticación
      const authRes = await client.query(
        `SELECT 
           id,
           provider,
           provider_uid,
           (password_hash IS NOT NULL) AS has_password,
           LENGTH(password_hash) AS hash_length
         FROM auth_identities
         WHERE user_id = $1
         ORDER BY provider, id`,
        [row.id]
      );

      console.log('\nIdentidades en auth_identities:');
      if (authRes.rows.length === 0) {
        console.log('  (sin filas en auth_identities para este usuario)');
      } else {
        for (const ai of authRes.rows) {
          console.log('  -', {
            id: ai.id,
            provider: ai.provider,
            provider_uid: ai.provider_uid,
            has_password: ai.has_password,
            hash_length: ai.hash_length
          });
        }
      }

      // Extra: mostrar si hay claims de welcome_events (first_login) para entender bonos de bienvenida
      const wecRes = await client.query(
        `SELECT event_id, coins_claimed, fires_claimed, claimed_at
         FROM welcome_event_claims
         WHERE user_id = $1
         ORDER BY claimed_at DESC
         LIMIT 5`,
        [row.id]
      );

      console.log('\nÚltimos welcome_event_claims:');
      if (wecRes.rows.length === 0) {
        console.log('  (sin claims de eventos de bienvenida recientes)');
      } else {
        for (const claim of wecRes.rows) {
          console.log('  -', claim);
        }
      }
    }
  } catch (err) {
    console.error('Error ejecutando diagnóstico:', err.message);
  } finally {
    await client.end();
    console.log('\nConexión cerrada');
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});
