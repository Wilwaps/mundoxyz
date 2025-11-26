const axios = require('axios');
const https = require('https');
const { query } = require('../db');
const logger = require('../utils/logger');
const fiatRateService = require('./fiatRateService');

async function scrapeBcvRate(pair = 'USDVES') {
  const url = process.env.FIAT_BCV_URL || 'https://www.bcv.org.ve';

  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = response.data || '';
    const lowerHtml = typeof html === 'string' ? html.toLowerCase() : '';
    const dolarIndex = lowerHtml.indexOf('id="dolar"');
    let snippet = null;
    if (dolarIndex !== -1) {
      const start = Math.max(0, dolarIndex - 200);
      const end = Math.min(html.length, dolarIndex + 400);
      snippet = html.slice(start, end);
    }

    const dolarRegex = new RegExp(
      '<div[^>]*id=["\']dolar["\'][^>]*>[\\s\\S]*?<div[^>]*class=["\'][^"\']*centrado[^"\']*["\'][^>]*>\\s*<strong>\\s*([0-9.,]+)\\s*<\\/strong>',
      'i'
    );
    const dolarMatch = html.match(dolarRegex);

    if (!dolarMatch) {
      logger.warn('FIAT BCV scraping: no rate match in dolar block', {
        pair,
        url,
        snippet
      });
      return null;
    }

    const raw = dolarMatch[1].replace(/\./g, '').replace(/,/g, '.');
    const rate = parseFloat(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      logger.warn('FIAT BCV scraping: invalid rate after parse', {
        pair,
        url,
        raw,
        snippet
      });
      return null;
    }

    const capturedAt = new Date();
    const insertRes = await query(
      `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      ['bcv', pair, rate, null, false, capturedAt]
    );

    const row = insertRes.rows[0] || null;
    logger.info('FIAT BCV scraping: inserted fiat_rate', {
      pair,
      url,
      raw,
      rate,
      capturedAt,
      rowId: row?.id
    });

    return row;
  } catch (error) {
    logger.error('Error scraping BCV rate:', {
      message: error?.message || String(error),
      code: error?.code,
      responseStatus: error?.response?.status,
      responseDataSnippet:
        typeof error?.response?.data === 'string'
          ? error.response.data.slice(0, 500)
          : undefined
    });
    return null;
  }
}

async function scrapeBinanceAndMxyz(pair = 'USDVES') {
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
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 15000
    });

    const data = response.data && response.data.data;
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('FIAT Binance scraping: empty data array');
      return { binance: null, mundoxyz: null };
    }

    const adv = data[1] || data[0];
    const priceStr = adv && adv.adv && adv.adv.price;
    const rate = parseFloat(priceStr);

    if (!Number.isFinite(rate) || rate <= 0) {
      logger.warn('FIAT Binance scraping: invalid price', { priceStr });
      return { binance: null, mundoxyz: null };
    }

    const capturedAt = new Date();

    let spreadVsBcv = null;
    try {
      const bcvRes = await query(
        'SELECT rate FROM fiat_rates WHERE source = $1 AND pair = $2 ORDER BY captured_at DESC LIMIT 1',
        ['bcv', pair]
      );
      if (bcvRes.rows.length > 0) {
        const bcvRate = parseFloat(bcvRes.rows[0].rate);
        if (Number.isFinite(bcvRate)) {
          spreadVsBcv = rate - bcvRate;
        }
      }
    } catch (spreadError) {
      logger.warn('FIAT Binance scraping: error computing spread vs BCV', spreadError);
    }

    const binInsert = await query(
      `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      ['binance', pair, rate, spreadVsBcv, false, capturedAt]
    );

    const binanceRow = binInsert.rows[0] || null;

    let mxyzRow = null;
    try {
      const config = await fiatRateService.getOperationalConfig();
      const margin = config?.margin_percent != null ? parseFloat(config.margin_percent) : 5.0;
      const opRate = rate * (1 - margin / 100);

      let spreadMxyz = null;
      if (spreadVsBcv != null && Number.isFinite(spreadVsBcv)) {
        spreadMxyz = opRate - (rate - spreadVsBcv);
      }

      const mxyzInsert = await query(
        `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        ['mundoxyz', pair, opRate, spreadMxyz, false, capturedAt]
      );

      mxyzRow = mxyzInsert.rows[0] || null;
    } catch (mxyzError) {
      logger.error('Error computing MundoXYZ operational rate from Binance:', mxyzError);
    }

    return { binance: binanceRow, mundoxyz: mxyzRow };
  } catch (error) {
    logger.error('Error scraping Binance P2P rate:', error);
    return { binance: null, mundoxyz: null };
  }
}

module.exports = {
  scrapeBcvRate,
  scrapeBinanceAndMxyz
};
