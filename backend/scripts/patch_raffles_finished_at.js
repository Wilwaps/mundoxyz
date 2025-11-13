// Patch script: Add raffles.finished_at column (idempotent)
// Usage:
//   PowerShell:
//     $env:DATABASE_URL = "postgresql://<user>:<pass>@shuttle.proxy.rlwy.net:<port>/railway"
//     $env:PGSSLMODE = "require"
//     node backend/scripts/patch_raffles_finished_at.js

const { Pool } = require('pg');
require('dotenv').config();

function buildPool() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (!connectionString) {
    console.error('[patch_raffles_finished_at] Missing DATABASE_URL or DATABASE_PUBLIC_URL');
    process.exit(1);
  }
  const sslEnabled = (process.env.PGSSLMODE || '').toLowerCase() === 'require' || /shuttle\.proxy\.rlwy\.net/i.test(connectionString);
  return new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false
  });
}

async function ensureFinishedAt(pool) {
  console.log('🛠  Applying patch: raffles.finished_at');
  await pool.query('BEGIN');
  try {
    await pool.query(`
      ALTER TABLE raffles
      ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP;
    `);

    await pool.query(`
      COMMENT ON COLUMN raffles.finished_at IS 'Fecha/hora en que la rifa quedó finalizada';
    `);

    // Backfill from ended_at if present
    await pool.query(`
      UPDATE raffles
      SET finished_at = ended_at
      WHERE finished_at IS NULL AND ended_at IS NOT NULL;
    `);

    await pool.query('COMMIT');
    console.log('✅ Patch applied successfully');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

async function verify(pool) {
  const res = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'raffles' AND column_name = 'finished_at'
  `);
  if (res.rows.length === 1) {
    console.log('🔎 Verification: raffles.finished_at exists');
  } else {
    console.warn('⚠️  Verification failed: raffles.finished_at not found');
  }
}

(async () => {
  const pool = buildPool();
  try {
    await ensureFinishedAt(pool);
    await verify(pool);
  } catch (err) {
    console.error('❌ Patch failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
