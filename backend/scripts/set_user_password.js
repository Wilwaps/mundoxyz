const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (!connectionString) {
    console.error('ERROR: Debes definir DATABASE_URL o DATABASE_PUBLIC_URL en las variables de entorno.');
    process.exit(1);
  }

  const identifier = process.argv[2];
  const newPassword = process.argv[3];

  if (!identifier || !newPassword) {
    console.error('Uso: node scripts/set_user_password.js <username|email|ci_full> <nueva_clave>');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Conectado a PostgreSQL');

    // 1) Buscar usuario por username/email/ci_full
    const findUserSql = `
      SELECT id, username, email, ci_full
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($1)
         OR ci_full = $1
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1;
    `;

    const userRes = await client.query(findUserSql, [identifier]);
    if (userRes.rows.length === 0) {
      console.error('No se encontró usuario para el identificador:', identifier);
      process.exit(1);
    }

    const user = userRes.rows[0];
    console.log('Usuario encontrado:', user);

    // 2) Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3) Ver si ya existe auth_identity provider='email'
    const aiRes = await client.query(
      "SELECT id, provider_uid FROM auth_identities WHERE user_id = $1 AND provider = 'email'",
      [user.id]
    );

    if (aiRes.rows.length > 0) {
      // Actualizar hash existente
      await client.query(
        "UPDATE auth_identities SET password_hash = $1 WHERE user_id = $2 AND provider = 'email'",
        [passwordHash, user.id]
      );
      console.log('Password_hash actualizado en auth_identities (provider=email).');
    } else {
      // Crear entrada nueva
      const providerUid = user.email || user.username || String(user.id);
      await client.query(
        "INSERT INTO auth_identities (user_id, provider, provider_uid, password_hash, created_at) VALUES ($1, 'email', $2, $3, NOW())",
        [user.id, providerUid, passwordHash]
      );
      console.log('Fila nueva creada en auth_identities (provider=email).');
    }

    // 4) Marcar que ya no requiere cambio forzado de contraseña
    await client.query(
      'UPDATE users SET must_change_password = FALSE WHERE id = $1',
      [user.id]
    );

    console.log('✅ Contraseña actualizada correctamente para el usuario:', user.username || user.email || user.id);
    console.log('Ahora deberías poder iniciar sesión con esa clave desde el login dev.');
  } catch (err) {
    console.error('Error ejecutando script:', err);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
