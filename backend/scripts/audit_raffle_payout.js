// Audit raffle payout distribution and notifications
// Usage:
//   $env:DATABASE_URL = 'postgresql://...'
//   $env:PGSSLMODE = 'require'
//   node backend/scripts/audit_raffle_payout.js <RAFFLE_CODE>

const { Pool } = require('pg');

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node audit_raffle_payout.js <RAFFLE_CODE>');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!connectionString) {
    console.error('Missing DATABASE_URL or DATABASE_PUBLIC_URL');
    process.exit(1);
  }
  const sslEnabled = (process.env.PGSSLMODE || '').toLowerCase() === 'require' || /shuttle\.proxy\.rlwy\.net/i.test(connectionString);
  const pool = new Pool({ connectionString, ssl: sslEnabled ? { rejectUnauthorized: false } : false });

  const client = await pool.connect();
  try {
    // Fetch raffle info
    const r = await client.query(
      `SELECT id, code, host_id, mode, pot_fires, pot_coins, winner_id
       FROM raffles WHERE code = $1`,
      [code]
    );
    if (r.rows.length === 0) {
      console.error('Raffle not found:', code);
      return;
    }
    const raffle = r.rows[0];
    const firesPot = parseFloat(raffle.pot_fires || 0);
    const coinsPot = parseFloat(raffle.pot_coins || 0);
    const isFires = raffle.mode === 'fires';

    // Resolve platform user by tg_id
    const plat = await client.query(`SELECT id FROM users WHERE tg_id = '1417856820'`);
    const platformUserId = plat.rows[0]?.id || null;

    // Winner and host wallets
    const ww = await client.query(`SELECT id, fires_balance, coins_balance FROM wallets WHERE user_id = $1`, [raffle.winner_id]);
    const hw = await client.query(`SELECT id, fires_balance, coins_balance FROM wallets WHERE user_id = $1`, [raffle.host_id]);
    const pw = platformUserId ? await client.query(`SELECT id, fires_balance FROM wallets WHERE user_id = $1`, [platformUserId]) : { rows: [] };

    const winnerWalletId = ww.rows[0]?.id;
    const hostWalletId = hw.rows[0]?.id;
    const platformWalletId = pw.rows[0]?.id;

    // Expected distribution for fires
    let expected = { winner: 0, host: 0, platform: 0, currency: isFires ? 'fires' : 'coins' };
    if (isFires) {
      expected.winner = Math.floor(firesPot * 0.70);
      expected.host = Math.floor(firesPot * 0.20);
      expected.platform = firesPot - expected.winner - expected.host; // remainder
    } else {
      expected.winner = coinsPot;
    }

    // Fetch wallet_transactions by reference patterns
    const refs = {
      prize: `raffle_win_${code}`,
      host: `raffle_host_${code}`,
      platform: `raffle_commission_${code}`
    };

    const txPrize = winnerWalletId ? await client.query(
      `SELECT id, type, currency, amount, balance_before, balance_after, description, reference, created_at
       FROM wallet_transactions WHERE wallet_id = $1 AND reference = $2
       ORDER BY created_at DESC LIMIT 1`, [winnerWalletId, refs.prize]
    ) : { rows: [] };

    const txHost = hostWalletId ? await client.query(
      `SELECT id, type, currency, amount, balance_before, balance_after, description, reference, created_at
       FROM wallet_transactions WHERE wallet_id = $1 AND reference = $2
       ORDER BY created_at DESC LIMIT 1`, [hostWalletId, refs.host]
    ) : { rows: [] };

    const txPlatform = platformWalletId ? await client.query(
      `SELECT id, type, currency, amount, balance_before, balance_after, description, reference, created_at
       FROM wallet_transactions WHERE wallet_id = $1 AND reference = $2
       ORDER BY created_at DESC LIMIT 1`, [platformWalletId, refs.platform]
    ) : { rows: [] };

    console.log('=== Raffle Payout Audit ===');
    console.log({ code: raffle.code, mode: raffle.mode, firesPot, coinsPot, winner_id: raffle.winner_id, host_id: raffle.host_id, platform_user_id: platformUserId });
    console.log('Expected:', expected);

    const prizeAmt = parseFloat(txPrize.rows[0]?.amount || 0);
    const hostAmt = parseFloat(txHost.rows[0]?.amount || 0);
    const platAmt = parseFloat(txPlatform.rows[0]?.amount || 0);

    console.log('Observed:');
    console.log('  winner:', prizeAmt, 'tx:', txPrize.rows[0] ? txPrize.rows[0].id : null);
    console.log('  host  :', hostAmt, 'tx:', txHost.rows[0] ? txHost.rows[0].id : null);
    console.log('  platf :', platAmt, 'tx:', txPlatform.rows[0] ? txPlatform.rows[0].id : null);

    // Simple pass/fail
    const okWinner = !isFires ? (prizeAmt === expected.winner) : (Math.abs(prizeAmt - expected.winner) < 0.0001);
    const okHost = !isFires ? (hostAmt === 0) : (Math.abs(hostAmt - expected.host) < 0.0001);
    const okPlat = !isFires ? (platAmt === 0) : (Math.abs(platAmt - expected.platform) < 0.0001);

    console.log('Result:', { okWinner, okHost, okPlat, allOk: okWinner && okHost && okPlat });

  } catch (err) {
    console.error('Audit failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
