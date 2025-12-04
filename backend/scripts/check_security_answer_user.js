// Debug script for security answer / auth_identities consistency
// Usage:
//   node backend/scripts/check_security_answer_user.js <telegram_id_or_username>
//
// Reads DATABASE_PUBLIC_URL from env and prints:
// - user row (id, username, email, tg_id, has security_answer)
// - auth_identities rows for that user
//
// This is read-only and safe to run.

const { Client } = require('pg');

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('Usage: node check_security_answer_user.js <telegram_id_or_username>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_PUBLIC_URL or DATABASE_URL env var is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Detect if identifier looks like a number (Telegram ID) or username
    let userQuery;
    let params;
    if (/^\d+$/.test(identifier)) {
      // Telegram ID
      userQuery = 'SELECT id, username, email, tg_id, security_answer, must_change_password FROM users WHERE tg_id = $1';
      params = [Number(identifier)];
    } else {
      // Username (case-insensitive)
      userQuery = 'SELECT id, username, email, tg_id, security_answer, must_change_password FROM users WHERE LOWER(username) = LOWER($1)';
      params = [identifier];
    }

    const userRes = await client.query(userQuery, params);

    if (userRes.rows.length === 0) {
      console.log('No user found for identifier:', identifier);
      return;
    }

    const user = userRes.rows[0];
    console.log('User:');
    console.table([{
      id: user.id,
      username: user.username,
      email: user.email,
      tg_id: user.tg_id,
      has_security_answer: !!user.security_answer,
      must_change_password: !!user.must_change_password,
    }]);

    const aiRes = await client.query(
      'SELECT id, provider, provider_uid, (password_hash IS NOT NULL) AS has_password_hash, created_at FROM auth_identities WHERE user_id = $1 ORDER BY id',
      [user.id]
    );

    console.log('\nAuth identities:');
    if (aiRes.rows.length === 0) {
      console.log('  (none)');
    } else {
      console.table(aiRes.rows.map(r => ({
        id: r.id,
        provider: r.provider,
        provider_uid: r.provider_uid,
        has_password_hash: r.has_password_hash,
        created_at: r.created_at,
      })));
    }

    // Quick summary of what /update-security-answer would see
    const emailIdentity = aiRes.rows.find(r => r.provider === 'email');
    console.log('\nSummary for /api/auth/update-security-answer:');
    if (!emailIdentity) {
      console.log('- No email provider in auth_identities -> backend would respond 400 "No tienes clave configurada"');
    } else if (!emailIdentity.has_password_hash) {
      console.log('- Email provider exists but without password_hash -> backend would respond 400 "No tienes clave configurada"');
    } else {
      console.log('- Email provider with password_hash present -> password check should work');
    }
  } catch (err) {
    console.error('Error running check_security_answer_user script:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
