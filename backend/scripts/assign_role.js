const { Client } = require('pg');

function parseArgs(argv) {
  const args = {
    user: null,
    role: null,
    db: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--user') args.user = argv[++i];
    else if (a === '--role') args.role = argv[++i];
    else if (a === '--db') args.db = argv[++i];
  }

  return args;
}

async function main() {
  const { user, role, db } = parseArgs(process.argv);

  if (!user || !role) {
    console.error('Uso: node backend/scripts/assign_role.js --user <username/email> --role <roleName> [--db <connectionString>]');
    process.exit(1);
  }

  const connectionString = db || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('Falta DATABASE_PUBLIC_URL / DATABASE_URL o parámetro --db');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id, username, email, tg_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR tg_id::text = $1 LIMIT 1',
      [user]
    );

    if (userRes.rows.length === 0) {
      throw new Error(`No se encontró usuario con username/email/tg_id: ${user}`);
    }

    const dbUser = userRes.rows[0];

    const roleRes = await client.query(
      'SELECT id, name FROM roles WHERE name = $1 LIMIT 1',
      [role]
    );

    if (roleRes.rows.length === 0) {
      throw new Error(`No se encontró rol con name: ${role}`);
    }

    const dbRole = roleRes.rows[0];

    const relRes = await client.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2 LIMIT 1',
      [dbUser.id, dbRole.id]
    );

    if (relRes.rows.length === 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [dbUser.id, dbRole.id]
      );
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      ok: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        tg_id: dbUser.tg_id
      },
      role: {
        id: dbRole.id,
        name: dbRole.name
      },
      alreadyHadRole: relRes.rows.length > 0
    }, null, 2));
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
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
