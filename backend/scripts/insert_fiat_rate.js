'use strict';

const { Client } = require('pg');

function parseArgs(argv) {
  const args = {
    source: null,
    pair: 'USDVES',
    rate: null,
    spread: null,
    isDegraded: false,
    db: null
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') {
      args.source = argv[++i];
    } else if (a === '--pair') {
      args.pair = argv[++i];
    } else if (a === '--rate') {
      args.rate = parseFloat(argv[++i]);
    } else if (a === '--spread') {
      args.spread = parseFloat(argv[++i]);
    } else if (a === '--degraded') {
      args.isDegraded = true;
    } else if (a === '--db') {
      args.db = argv[++i];
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const validSources = ['bcv', 'binance', 'mundoxyz'];
  if (!args.source || !validSources.includes(args.source)) {
    console.error('Usage: node backend/scripts/insert_fiat_rate.js --source <bcv|binance|mundoxyz> --rate <number> [--pair <USDVES>] [--spread <number>] [--degraded] [--db <connectionString>]');
    process.exit(1);
  }

  if (!Number.isFinite(args.rate) || args.rate <= 0) {
    console.error('Rate must be a positive number');
    process.exit(1);
  }

  const connectionString = args.db || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_PUBLIC_URL/DATABASE_URL or --db');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query('BEGIN');

    let spread = Number.isFinite(args.spread) ? args.spread : null;

    if (spread === null && args.source !== 'bcv') {
      const bcvRes = await client.query(
        'SELECT rate FROM fiat_rates WHERE source = $1 AND pair = $2 ORDER BY captured_at DESC LIMIT 1',
        ['bcv', args.pair]
      );
      if (bcvRes.rows.length > 0) {
        const bcvRate = parseFloat(bcvRes.rows[0].rate);
        if (Number.isFinite(bcvRate)) {
          spread = args.rate - bcvRate;
        }
      }
    }

    const capturedAt = new Date();

    const insertRes = await client.query(
      `INSERT INTO fiat_rates (source, pair, rate, spread_vs_bcv, is_degraded, captured_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        args.source,
        args.pair,
        args.rate,
        spread,
        !!args.isDegraded,
        capturedAt
      ]
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({ ok: true, rate: insertRes.rows[0] }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
