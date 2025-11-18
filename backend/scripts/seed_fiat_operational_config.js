'use strict';

const { Client } = require('pg');

function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseNumber(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function main() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING;

  if (!connectionString) {
    console.error(
      '❌ No se encontró cadena de conexión. Configura DATABASE_PUBLIC_URL o DATABASE_URL o PG_CONNECTION_STRING.'
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });

  const marginPercent = parseNumber(process.env.FIAT_MARGIN_PERCENT, 5.0);
  const maxRateAgeMinutes = parseNumber(process.env.FIAT_MAX_RATE_AGE_MINUTES, 30);
  const isEnabled = parseBool(process.env.FIAT_ENABLED, false);
  const shadowModeEnabled = parseBool(process.env.FIAT_SHADOW_MODE_ENABLED, true);

  console.log('⏳ Conectando a la base de datos...');

  try {
    await client.connect();
    console.log('✅ Conectado. Verificando tabla fiat_operational_config...');

    let tableExists = false;
    try {
      const regRes = await client.query(
        "SELECT to_regclass('public.fiat_operational_config') AS reg"
      );
      tableExists = !!(regRes.rows[0] && regRes.rows[0].reg);
    } catch (err) {
      console.error('⚠️ Error comprobando existencia de tabla fiat_operational_config:', err.message || err);
    }

    if (!tableExists) {
      console.error(
        '❌ La tabla fiat_operational_config no existe. Ejecuta antes la migración 051_create_fiat_tables.sql.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('⚙️ Valores a aplicar en fiat_operational_config:');
    console.log('  margin_percent       =', marginPercent);
    console.log('  max_rate_age_minutes =', maxRateAgeMinutes);
    console.log('  is_enabled           =', isEnabled);
    console.log('  shadow_mode_enabled  =', shadowModeEnabled);

    await client.query('BEGIN');

    const existingRes = await client.query(
      'SELECT * FROM fiat_operational_config ORDER BY id DESC LIMIT 1'
    );

    let result;

    if (existingRes.rows.length === 0) {
      console.log('ℹ️ No hay configuración existente. Insertando una nueva fila...');
      result = await client.query(
        `INSERT INTO fiat_operational_config
          (margin_percent, max_rate_age_minutes, is_enabled, shadow_mode_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [marginPercent, maxRateAgeMinutes, isEnabled, shadowModeEnabled]
      );
      console.log('✅ Configuración FIAT insertada correctamente.');
    } else {
      const current = existingRes.rows[0];
      console.log('ℹ️ Configuración existente encontrada con id =', current.id, '. Actualizando...');
      result = await client.query(
        `UPDATE fiat_operational_config
           SET margin_percent = $1,
               max_rate_age_minutes = $2,
               is_enabled = $3,
               shadow_mode_enabled = $4,
               updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [marginPercent, maxRateAgeMinutes, isEnabled, shadowModeEnabled, current.id]
      );
      console.log('✅ Configuración FIAT actualizada correctamente.');
    }

    await client.query('COMMIT');

    const row = result.rows[0];
    console.log('📌 Configuración FIAT final:');
    console.log(JSON.stringify(row, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignorar error de rollback
    }
    console.error('❌ Error al aplicar configuración FIAT:', error.message || error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    console.log('🔌 Conexión cerrada.');
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado ejecutando seed_fiat_operational_config:', err);
  process.exit(1);
});
