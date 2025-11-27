/*
 * Vincula relación de referidos entre dos usuarios existentes.
 * No crea usuarios nuevos.
 *
 * Uso:
 *   node backend/scripts/link_referrer.js \
 *     --referrer <username_o_email_lider> \
 *     --referred <username_o_email_referido> \
 *     [--set-tito-owner] \
 *     [--db <connectionString>]
 *
 * Usa DATABASE_PUBLIC_URL o DATABASE_URL si no se pasa --db.
 */

const { Client } = require('pg');

function parseArgs(argv) {
  const args = {
    referrer: null,
    referred: null,
    setTitoOwner: false,
    db: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--referrer') args.referrer = argv[++i];
    else if (a === '--referred') args.referred = argv[++i];
    else if (a === '--set-tito-owner') args.setTitoOwner = true;
    else if (a === '--db') args.db = argv[++i];
  }

  return args;
}

async function main() {
  const { referrer, referred, setTitoOwner, db } = parseArgs(process.argv);

  if (!referrer || !referred) {
    console.error(
      'Uso: node backend/scripts/link_referrer.js --referrer <username/email> --referred <username/email> [--set-tito-owner] [--db <connectionString>]'
    );
    process.exit(1);
  }

  const connectionString =
    db || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

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

    const findUserSql =
      'SELECT id, username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1';

    const refRes = await client.query(findUserSql, [referrer]);
    if (refRes.rows.length === 0) {
      throw new Error(`No se encontró usuario referrer con username/email: ${referrer}`);
    }
    const refUser = refRes.rows[0];

    const childRes = await client.query(findUserSql, [referred]);
    if (childRes.rows.length === 0) {
      throw new Error(`No se encontró usuario referido con username/email: ${referred}`);
    }
    const childUser = childRes.rows[0];

    if (String(refUser.id) === String(childUser.id)) {
      throw new Error('referrer y referred no pueden ser el mismo usuario');
    }

    const updateRes = await client.query(
      `UPDATE users
       SET referrer_id = $1,
           referrals_enabled = TRUE
       WHERE id = $2
       RETURNING id, username, referrer_id, referrals_enabled`,
      [refUser.id, childUser.id]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('No se pudo actualizar el usuario referido');
    }

    let titoOwnerRow = null;
    if (setTitoOwner) {
      const titoRes = await client.query(
        `UPDATE users
         SET tito_owner_id = $1
         WHERE id = $2
         RETURNING id, username, tito_owner_id`,
        [refUser.id, childUser.id]
      );
      titoOwnerRow = titoRes.rows[0] || null;
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          referrer: {
            id: refUser.id,
            username: refUser.username,
            email: refUser.email
          },
          referred: {
            id: childUser.id,
            username: childUser.username,
            email: childUser.email,
            referrer_id: updateRes.rows[0].referrer_id,
            referrals_enabled: updateRes.rows[0].referrals_enabled
          },
          titoOwnerUpdated: !!titoOwnerRow,
          titoOwner: titoOwnerRow
        },
        null,
        2
      )
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
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
