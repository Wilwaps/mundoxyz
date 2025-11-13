/*
 * Verify raffle evidence in Railway Postgres
 * Usage:
 *   node backend/scripts/verify_raffle_evidence.js <RAFFLE_CODE> [--db <connectionString>]
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL (preferred)
 */

const { Client } = require('pg');

function parseArgs(argv) {
  const args = { code: null, db: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!args.code && !a.startsWith('--')) {
      args.code = a;
    } else if (a === '--db') {
      args.db = argv[++i];
    }
  }
  return args;
}

async function main() {
  const { code, db } = parseArgs(process.argv);
  if (!code) {
    console.error('Usage: node backend/scripts/verify_raffle_evidence.js <RAFFLE_CODE> [--db <connectionString>]');
    process.exit(1);
  }

  const connectionString = db || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_PUBLIC_URL/DATABASE_URL or --db');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const raffleRes = await client.query(
      `SELECT id, code, status, mode, draw_mode, numbers_range, winner_id, winner_number, created_at, finished_at
       FROM raffles WHERE code = $1`,
      [code]
    );

    if (raffleRes.rows.length === 0) {
      console.log(JSON.stringify({ ok: false, message: 'Raffle not found', code }, null, 2));
      return;
    }

    const raffle = raffleRes.rows[0];

    const numbersRes = await client.query(
      `SELECT number_idx, state, owner_id, reserved_by, reserved_until, purchased_at
       FROM raffle_numbers WHERE raffle_id = $1 ORDER BY number_idx`,
      [raffle.id]
    );

    const counts = numbersRes.rows.reduce((acc, r) => {
      acc.total++;
      acc[r.state] = (acc[r.state] || 0) + 1;
      return acc;
    }, { total: 0 });

    // Participants (unique owners for SOLD)
    const participantsRes = await client.query(
      `SELECT owner_id, COUNT(*) as numbers
       FROM raffle_numbers WHERE raffle_id = $1 AND state = 'sold' AND owner_id IS NOT NULL
       GROUP BY owner_id ORDER BY numbers DESC`,
      [raffle.id]
    );

    // Requests (if any)
    let requestsAgg = { none: true };
    try {
      const reqAgg = await client.query(
        `SELECT status, COUNT(*) as cnt FROM raffle_requests WHERE raffle_id = $1 GROUP BY status`,
        [raffle.id]
      );
      requestsAgg = reqAgg.rows.length ? Object.fromEntries(reqAgg.rows.map(r => [r.status, parseInt(r.cnt, 10)])) : { total: 0 };
    } catch (e) {
      // Table might not exist in some envs
      requestsAgg = { error: e.message };
    }

    const summary = {
      raffle: {
        code: raffle.code,
        status: raffle.status,
        mode: raffle.mode,
        drawMode: raffle.draw_mode,
        numbersRange: raffle.numbers_range,
        winnerId: raffle.winner_id,
        winnerNumber: raffle.winner_number,
        createdAt: raffle.created_at,
        finishedAt: raffle.finished_at,
      },
      numbers: {
        counts,
        sample: numbersRes.rows.slice(0, 10),
      },
      participants: participantsRes.rows,
      requests: requestsAgg,
    };

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
