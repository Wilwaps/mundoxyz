// Check current locks and blockers.
// Usage:
//   $env:DATABASE_PUBLIC_URL='postgresql://...'
//   node backend/scripts/check_locks.js
const { Pool } = require('pg');

const conn =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  (process.env.PGUSER &&
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);

if (!conn) throw new Error('No DB URL in env');

const pool = new Pool({ connectionString: conn });

async function run() {
  const client = await pool.connect();
  try {
    const q1 = `
      SELECT pid, mode, locktype, relation::regclass AS rel,
             virtualtransaction, granted, wait_event_type, wait_event,
             query_start, query
      FROM pg_locks l
      JOIN pg_stat_activity a USING(pid)
      WHERE NOT granted;
    `;

    const q2 = `
      SELECT bl.pid AS blocked_pid,
             a.query AS blocked_query,
             kl.pid AS locking_pid,
             ka.query AS locking_query,
             bl.relation::regclass AS rel,
             bl.mode,
             bl.granted
      FROM pg_locks bl
      JOIN pg_stat_activity a ON a.pid = bl.pid
      JOIN pg_locks kl
        ON kl.locktype = bl.locktype
       AND kl.relation = bl.relation
       AND kl.pid <> bl.pid
       AND kl.granted
      JOIN pg_stat_activity ka ON ka.pid = kl.pid
      WHERE NOT bl.granted;
    `;

    for (const [label, sql] of [
      ['waiting_locks', q1],
      ['blockers', q2]
    ]) {
      const { rows } = await client.query(sql);
      console.log(`\n--- ${label} ---`);
      console.table(rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
