'use strict';

const { Client } = require('pg');
const axios = require('axios');
const https = require('https');

function getDbConnectionString(cliDb) {
  return (
    cliDb ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING
  );
}

function parseArgs(argv) {
  const args = { db: null, pair: 'USDVES' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') {
      args.db = argv[++i];
    } else if (a === '--pair') {
      args.pair = argv[++i];
    }
  }
  return args;
}

async function fetchBcvRate(pair) {
  const url = process.env.FIAT_BCV_URL || 'https://www.bcv.org.ve';

  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const res = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = res.data || '';

    // Extraer específicamente el bloque del dólar oficial (id="dolar") y su valor en <strong>
    const dolarMatch = html.match(
      /<div[^>]*id=["']dolar["'][^>]*>[\s\S]*?<span>\s*USD\s*<\\/span>[\s\S]*?<strong>\s*([0-9.,]+)\s*<\\/strong>/i
    );

    if (!dolarMatch) {
      console.warn('[FIAT] No se pudo encontrar tasa BCV en el bloque dolar. Ajusta el parser en fetchBcvRate().');
      return null;
    }

    const raw = dolarMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const rate = parseFloat(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      console.warn('[FIAT] Tasa BCV inválida después de parsear:', raw);
      return null;
    }

    return { source: 'bcv', pair, rate };
  } catch (err) {
    console.error('[FIAT] Error obteniendo tasa BCV:', err.message || err);
    return null;
  }
}

async function fetchBinanceP2PRate(pair) {
  // Usamos la API pública de Binance P2P para buscar anuncios de compra USDT/VES
  const url =
    process.env.FIAT_BINANCE_P2P_URL ||
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  const payload = {
    page: 1,
    rows: 10,
    payTypes: [],
    asset: 'USDT',
    tradeType: 'BUY',
    fiat: 'VES',
    publisherType: null
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    const data = res.data && res.data.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[FIAT] Respuesta Binance P2P sin datos');
      return null;
    }

    // Usar el segundo anuncio si existe (más representativo del mercado), si no el primero
    const adv = data[1] || data[0];
    const priceStr = adv && adv.adv && adv.adv.price;
    const rate = parseFloat(priceStr);

    if (!Number.isFinite(rate) || rate <= 0) {
      console.warn('[FIAT] Tasa Binance P2P inválida:', priceStr);
      return null;
    }

    return { source: 'binance', pair, rate };
  } catch (err) {
    console.error('[FIAT] Error obteniendo tasa Binance P2P:', err.message || err);
    return null;
  }
}

async function getMarginPercent(client) {
  try {
    const res = await client.query(
      'SELECT margin_percent FROM fiat_operational_config ORDER BY id DESC LIMIT 1'
    );
    if (res.rows.length === 0) return 5.0;
    const v = parseFloat(res.rows[0].margin_percent);
    return Number.isFinite(v) ? v : 5.0;
  } catch (err) {
    console.warn('[FIAT] Error leyendo fiat_operational_config, usando margen 5%:', err.message || err);
    return 5.0;
  }
}

async function insertRate(client, { source, pair, rate, spread, isDegraded }) {
  const capturedAt = new Date();

  const res = await client.query(
    `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [source, pair, rate, spread, !!isDegraded, capturedAt]
  );

  return res.rows[0];
}

async function main() {
  const args = parseArgs(process.argv);
  const connectionString = getDbConnectionString(args.db);

  if (!connectionString) {
    console.error('❌ Missing DATABASE_PUBLIC_URL / DATABASE_URL / PG_CONNECTION_STRING or --db');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query('BEGIN');

    const [bcv, binance] = await Promise.all([
      fetchBcvRate(args.pair),
      fetchBinanceP2PRate(args.pair)
    ]);

    let bcvRow = null;
    let binanceRow = null;

    if (bcv) {
      bcvRow = await insertRate(client, {
        source: bcv.source,
        pair: bcv.pair,
        rate: bcv.rate,
        spread: null,
        isDegraded: false
      });
      console.log('[FIAT] Insertada tasa BCV:', bcvRow.rate);
    } else {
      console.warn('[FIAT] No se insertó tasa BCV (no disponible).');
    }

    if (binance) {
      let spread = null;
      if (bcvRow) {
        spread = binance.rate - parseFloat(bcvRow.rate);
      }

      binanceRow = await insertRate(client, {
        source: binance.source,
        pair: binance.pair,
        rate: binance.rate,
        spread,
        isDegraded: false
      });
      console.log('[FIAT] Insertada tasa Binance P2P:', binanceRow.rate);
    } else {
      console.warn('[FIAT] No se insertó tasa Binance P2P (no disponible).');
    }

    // Insertar tasa operativa MundoXYZ como registro adicional (opcional pero útil para auditoría)
    if (binanceRow) {
      const marginPercent = await getMarginPercent(client);
      const rawRate = parseFloat(binanceRow.rate);
      const opRate = rawRate * (1 - marginPercent / 100);

      let spread = null;
      if (bcvRow) {
        spread = opRate - parseFloat(bcvRow.rate);
      }

      const mxyzRow = await insertRate(client, {
        source: 'mundoxyz',
        pair: args.pair,
        rate: opRate,
        spread,
        isDegraded: false
      });
      console.log('[FIAT] Insertada tasa MundoXYZ (Binance -', marginPercent, '%):', mxyzRow.rate);
    }

    await client.query('COMMIT');
    console.log('[FIAT] fetch_fiat_rates completado.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error en fetch_fiat_rates:', err.message || err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado en fetch_fiat_rates:', err.message || err);
  process.exit(1);
});
