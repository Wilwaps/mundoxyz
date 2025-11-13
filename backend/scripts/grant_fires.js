/*
 * Grant fires to a user and record a wallet transaction (credit)
 * Usage:
 *   node backend/scripts/grant_fires.js --user <username> --amount <number> [--reason <text>] [--db <connectionString>]
 * Env:
 *   DATABASE_PUBLIC_URL or DATABASE_URL (preferred)
 */

const { Client } = require('pg');

function parseArgs(argv) {
  const args = { user: null, amount: null, reason: 'QA topup', db: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user') args.user = argv[++i];
    else if (a === '--amount') args.amount = parseFloat(argv[++i]);
    else if (a === '--reason') args.reason = argv[++i];
    else if (a === '--db') args.db = argv[++i];
  }
  return args;
}

async function main() {
  const { user, amount, reason, db } = parseArgs(process.argv);
  if (!user || !Number.isFinite(amount)) {
    console.error('Usage: node backend/scripts/grant_fires.js --user <username> --amount <number> [--reason <text>] [--db <connectionString>]');
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
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)', [user]);
    if (userRes.rows.length === 0) {
      throw new Error(`User not found: ${user}`);
    }
    const userId = userRes.rows[0].id;

    const walletRes = await client.query('SELECT id, fires_balance, total_fires_earned FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
    if (walletRes.rows.length === 0) {
      // Create wallet if missing (edge-case)
      const created = await client.query(
        'INSERT INTO wallets (user_id, coins_balance, fires_balance, total_fires_earned, total_fires_spent, total_coins_earned, total_coins_spent) VALUES ($1, 0, 0, 0, 0, 0, 0) RETURNING id, fires_balance, total_fires_earned',
        [userId]
      );
      walletRes.rows.push(created.rows[0]);
    }
    const wallet = walletRes.rows[0];

    const before = parseFloat(wallet.fires_balance || 0);
    const after = before + amount;

    await client.query(
      'UPDATE wallets SET fires_balance = $1, total_fires_earned = COALESCE(total_fires_earned, 0) + $2, updated_at = NOW() WHERE id = $3',
      [after, Math.max(0, amount), wallet.id]
    );

    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference, metadata, created_at)
       VALUES ($1, 'credit', 'fires', $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
      [wallet.id, amount, before, after, `Topup: ${reason}`, 'grant_fires_script', JSON.stringify({ by: 'script', reason })]
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({ ok: true, user, walletId: wallet.id, before, after, credited: amount }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
