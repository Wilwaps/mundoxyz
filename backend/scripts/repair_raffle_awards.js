// Repair script: award payouts and inbox messages for a finished raffle
// Usage:
//   $env:DATABASE_URL = 'postgresql://...'
//   $env:PGSSLMODE   = 'require'
//   node backend/scripts/repair_raffle_awards.js <RAFFLE_CODE>

const { Pool } = require('pg');

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node backend/scripts/repair_raffle_awards.js <RAFFLE_CODE>');
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
    await client.query('BEGIN');

    const r1 = await client.query(
      `SELECT id, code, status, host_id, mode, pot_fires, pot_coins, winner_id
       FROM raffles WHERE code = $1 FOR UPDATE`,
      [code]
    );
    if (r1.rows.length === 0) throw new Error('Raffle not found');
    const raffle = r1.rows[0];
    if (raffle.status !== 'finished') {
      console.log('Raffle is not finished, skipping. status=', raffle.status);
      await client.query('ROLLBACK');
      return;
    }

    const effectiveMode = raffle.mode; // fallback only
    const firesPot = parseFloat(raffle.pot_fires || 0);
    const coinsPot = parseFloat(raffle.pot_coins || 0);

    // Distribution expected
    let winnerPrize = 0, hostReward = 0, platformCommission = 0, currency = 'fires';
    if (effectiveMode === 'fires') {
      winnerPrize = Math.floor(firesPot * 0.70);
      hostReward = Math.floor(firesPot * 0.20);
      platformCommission = firesPot - winnerPrize - hostReward;
      currency = 'fires';
    } else if (effectiveMode === 'coins') {
      winnerPrize = coinsPot;
      currency = 'coins';
    } else {
      console.log('Mode is prize, no virtual payout required.');
    }

    // Resolve wallets
    const winnerWallet = raffle.winner_id ? await client.query(`SELECT id, fires_balance, coins_balance FROM wallets WHERE user_id = $1 FOR UPDATE`, [raffle.winner_id]) : { rows: [] };
    const hostWallet   = await client.query(`SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE`, [raffle.host_id]);
    const platUserRes  = await client.query(`SELECT id FROM users WHERE tg_id = '1417856820'`);
    const platformUserId = platUserRes.rows[0]?.id || null;
    const platformWallet = platformUserId ? await client.query(`SELECT id, fires_balance FROM wallets WHERE user_id = $1 FOR UPDATE`, [platformUserId]) : { rows: [] };

    // Helper to check tx by reference
    async function txExists(walletId, ref) {
      if (!walletId) return false;
      const q = await client.query(`SELECT 1 FROM wallet_transactions WHERE wallet_id = $1 AND reference = $2 LIMIT 1`, [walletId, ref]);
      return q.rows.length > 0;
    }

    // 1) Award winner
    if (winnerPrize > 0 && winnerWallet.rows[0]?.id) {
      const winRef = `raffle_win_${raffle.code}`;
      const exists = await txExists(winnerWallet.rows[0].id, winRef);
      if (!exists) {
        const balanceBefore = currency === 'fires' ? parseFloat(winnerWallet.rows[0].fires_balance) : parseFloat(winnerWallet.rows[0].coins_balance);
        const balanceAfter  = balanceBefore + winnerPrize;
        const column        = currency === 'fires' ? 'fires_balance' : 'coins_balance';
        await client.query(`UPDATE wallets SET ${column} = ${column} + $1, updated_at = NOW() WHERE id = $2`, [winnerPrize, winnerWallet.rows[0].id]);
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'raffle_prize', $2, $3, $4, $5, $6, $7)`,
          [winnerWallet.rows[0].id, currency, winnerPrize, balanceBefore, balanceAfter, `Premio ganado en rifa ${raffle.code} (70% del pot)`, winRef]
        );
      }
    }

    // 2) Award host (fires only)
    if (hostReward > 0 && hostWallet.rows[0]?.id) {
      const hostRef = `raffle_host_${raffle.code}`;
      const exists = await txExists(hostWallet.rows[0].id, hostRef);
      if (!exists) {
        const balanceBefore = parseFloat(hostWallet.rows[0].fires_balance);
        const balanceAfter  = balanceBefore + hostReward;
        await client.query(`UPDATE wallets SET fires_balance = fires_balance + $1, updated_at = NOW() WHERE id = $2`, [hostReward, hostWallet.rows[0].id]);
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'raffle_host_reward', 'fires', $2, $3, $4, $5, $6)`,
          [hostWallet.rows[0].id, hostReward, balanceBefore, balanceAfter, `Recompensa como host de rifa ${raffle.code} (20% del pot)`, hostRef]
        );
      }
    }

    // 3) Platform commission (fires only)
    if (platformCommission > 0 && platformWallet.rows[0]?.id) {
      const platRef = `raffle_commission_${raffle.code}`;
      const exists = await txExists(platformWallet.rows[0].id, platRef);
      if (!exists) {
        const balanceBefore = parseFloat(platformWallet.rows[0].fires_balance);
        const balanceAfter  = balanceBefore + platformCommission;
        await client.query(`UPDATE wallets SET fires_balance = fires_balance + $1, updated_at = NOW() WHERE id = $2`, [platformCommission, platformWallet.rows[0].id]);
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, reference)
           VALUES ($1, 'raffle_platform_commission', 'fires', $2, $3, $4, $5, $6)`,
          [platformWallet.rows[0].id, platformCommission, balanceBefore, balanceAfter, `Comisión de rifa ${raffle.code} (10% del pot)`, platRef]
        );
      }
    }

    // 4) Inbox messages for participants
    const parts = await client.query(
      `SELECT DISTINCT rn.owner_id as user_id, u.username
       FROM raffle_numbers rn
       JOIN users u ON u.id = rn.owner_id
       WHERE rn.raffle_id = $1 AND rn.state = 'sold'`,
      [raffle.id]
    );

    const prizeTotal = effectiveMode === 'fires' ? firesPot : (effectiveMode === 'coins' ? coinsPot : 0);
    const winnerUserId = raffle.winner_id;
    for (const row of parts.rows) {
      const isWinner = row.user_id === winnerUserId;
      const title = `Resultado de rifa ${raffle.code}`;
      const content = isWinner
        ? `🎉 ¡Felicidades! Ganaste la rifa ${raffle.code}. Premio total del pote: ${prizeTotal} ${effectiveMode === 'fires' ? '🔥' : effectiveMode === 'coins' ? '🪙' : ''}`
        : `La rifa ${raffle.code} finalizó. Ganador: @${parts.rows.find(p => p.user_id === winnerUserId)?.username || 'desconocido'}`;
      const metadata = { type: 'raffle_finished', raffleCode: raffle.code, isWinner, prizeAmount: prizeTotal, currency };
      await client.query(
        `INSERT INTO bingo_v2_messages (user_id, category, title, content, metadata)
         VALUES ($1, 'system', $2, $3, $4)`,
        [row.user_id, title, content, JSON.stringify(metadata)]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Repair completed for raffle', code, '\nDistribution:', { winnerPrize, hostReward, platformCommission, currency });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Repair failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
