const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (!connectionString) {
    console.error('ERROR: Debes definir DATABASE_URL o DATABASE_PUBLIC_URL en las variables de entorno.');
    process.exit(1);
  }

  const identifier = process.argv[2];

  if (!identifier) {
    console.error('Uso: node debug_user_password.js <username|email|ci_full|provider_uid>');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado a PostgreSQL');

    const sql = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.ci_full,
        u.security_answer IS NOT NULL AS has_security_answer,
        ai.id AS auth_identity_id,
        ai.provider,
        ai.provider_uid,
        (ai.password_hash IS NOT NULL) AS has_password_hash,
        LENGTH(ai.password_hash) AS hash_length
      FROM users u
      LEFT JOIN auth_identities ai ON ai.user_id = u.id
      WHERE LOWER(u.username) = LOWER($1)
         OR LOWER(u.email) = LOWER($1)
         OR u.ci_full = $1
         OR ai.provider_uid = $1
      ORDER BY u.created_at DESC NULLS LAST, ai.provider NULLS LAST;
    `;

    const { rows } = await client.query(sql, [identifier]);

    if (rows.length === 0) {
      console.log('No se encontraron usuarios para el identificador:', identifier);
    } else {
      console.log(`Encontradas ${rows.length} filas:`);
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error('Error ejecutando consulta:', err);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
