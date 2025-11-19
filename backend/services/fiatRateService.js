'use strict';

const { query } = require('../db');
const logger = require('../utils/logger');

const DEFAULT_MARGIN_PERCENT = 5.0;
const DEFAULT_MAX_RATE_AGE_MINUTES = 30;
const DEFAULT_FIRES_PER_USDT = 300;
const DEFAULT_USDT_NETWORK = 'TRON';

function getClientQuery(client) {
  if (client && typeof client.query === 'function') {
    return client.query.bind(client);
  }
  return query;
}

function diffMinutes(a, b) {
  if (!a || !b) return null;
  const t1 = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const t2 = b instanceof Date ? b.getTime() : new Date(b).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return Math.abs(t1 - t2) / 60000;
}

async function getOperationalConfig(client) {
  const q = getClientQuery(client);
  try {
    const res = await q('SELECT * FROM fiat_operational_config ORDER BY id DESC LIMIT 1');
    if (res.rows.length === 0) {
      return {
        margin_percent: DEFAULT_MARGIN_PERCENT,
        max_rate_age_minutes: DEFAULT_MAX_RATE_AGE_MINUTES,
        is_enabled: false,
        shadow_mode_enabled: true,
        fires_per_usdt: DEFAULT_FIRES_PER_USDT,
        usdt_official_wallet: null,
        usdt_network: DEFAULT_USDT_NETWORK
      };
    }
    const row = res.rows[0];
    return {
      margin_percent: parseFloat(row.margin_percent) || DEFAULT_MARGIN_PERCENT,
      max_rate_age_minutes: row.max_rate_age_minutes || DEFAULT_MAX_RATE_AGE_MINUTES,
      is_enabled: row.is_enabled,
      shadow_mode_enabled: row.shadow_mode_enabled,
      fires_per_usdt: parseFloat(row.fires_per_usdt) || DEFAULT_FIRES_PER_USDT,
      usdt_official_wallet: row.usdt_official_wallet || null,
      usdt_network: row.usdt_network || DEFAULT_USDT_NETWORK,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  } catch (error) {
    logger.error('Error fetching fiat_operational_config:', error);
    return {
      margin_percent: DEFAULT_MARGIN_PERCENT,
      max_rate_age_minutes: DEFAULT_MAX_RATE_AGE_MINUTES,
      is_enabled: false,
      shadow_mode_enabled: true,
      fires_per_usdt: DEFAULT_FIRES_PER_USDT,
      usdt_official_wallet: null,
      usdt_network: DEFAULT_USDT_NETWORK
    };
  }
}

async function getLatestRate(source, client) {
  const q = getClientQuery(client);
  try {
    const res = await q(
      'SELECT * FROM fiat_rates WHERE source = $1 ORDER BY captured_at DESC LIMIT 1',
      [source]
    );
    return res.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching latest fiat_rate for source:', { source, error });
    return null;
  }
}

async function getOperationalContext(client) {
  const q = getClientQuery(client);
  const config = await getOperationalConfig(client);

  const [bcvRate, binanceRate] = await Promise.all([
    getLatestRate('bcv', client),
    getLatestRate('binance', client)
  ]);

  const now = new Date();
  let baseRate = binanceRate || bcvRate || null;
  let isDegraded = false;
  let usedFallback = false;

  if (!baseRate) {
    // No hay tasas disponibles
    return {
      config,
      bcvRate,
      binanceRate,
      operationalRate: null,
      isDegraded: true,
      usedFallback: false
    };
  }

  const ageMinutes = diffMinutes(now, baseRate.captured_at);
  if (ageMinutes !== null && ageMinutes > config.max_rate_age_minutes) {
    isDegraded = true;
  }

  const rawRate = parseFloat(baseRate.rate);
  let operationalRate = null;

  if (Number.isFinite(rawRate) && rawRate > 0) {
    let margin = config.margin_percent || DEFAULT_MARGIN_PERCENT;
    let opRate = rawRate;
    let baseSource = baseRate.source;

    if (baseRate.source === 'binance') {
      // Aplicar markup: la tasa MundoXYZ es mayor que Binance
      opRate = rawRate * (1 + margin / 100);
    } else {
      // Fallback: si solo hay BCV, usamos BCV como referencia sin margen
      margin = 0;
      usedFallback = true;
    }

    operationalRate = {
      source: 'mundoxyz',
      rate: opRate,
      baseSource,
      marginPercent: margin,
      capturedAt: baseRate.captured_at,
      ageMinutes
    };
  }

  return {
    config,
    bcvRate,
    binanceRate,
    operationalRate,
    isDegraded,
    usedFallback
  };
}

module.exports = {
  getOperationalConfig,
  getLatestRate,
  getOperationalContext
};
