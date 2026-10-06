/**
 * lib/pgdb.js
 * ─────────────────────────────────────────────────────────────
 * Dual-write PostgreSQL connection layer.
 *
 * PRIMARY  → Neon cloud (DATABASE_URL)        — always awaited
 * BACKUP   → Local PostgreSQL (DATABASE_URL_LOCAL) — fire-and-forget,
 *            never blocks or errors the user if local is offline
 * ─────────────────────────────────────────────────────────────
 */
import { Pool } from 'pg';

// ── Pool singletons ──────────────────────────────────────────
let primaryPool;
let localPool;

function getPrimary() {
  if (!primaryPool) {
    primaryPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });
    primaryPool.on('error', (err) =>
      console.error('[pgdb:primary] pool error:', err.message)
    );
  }
  return primaryPool;
}

function getLocal() {
  if (!localPool && process.env.DATABASE_URL_LOCAL) {
    localPool = new Pool({
      connectionString: process.env.DATABASE_URL_LOCAL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,   // short — local may be offline
      ssl: false,
    });
    localPool.on('error', (err) =>
      console.error('[pgdb:local] pool error:', err.message)
    );
  }
  return localPool;
}

// ── Silent backup write ───────────────────────────────────────
// Runs the same query on local PostgreSQL without awaiting or
// surfacing any errors — local being offline is perfectly fine.
function writeLocalSilently(text, params) {
  const pool = getLocal();
  if (!pool) return;
  pool.query(text, params).catch((err) =>
    console.warn('[pgdb:local] backup write failed (ok if offline):', err.message)
  );
}

// ── Public API ────────────────────────────────────────────────

/**
 * READ  — queries Neon only (source of truth).
 */
export async function query(text, params = []) {
  const client = await getPrimary().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * WRITE — writes to Neon (awaited) then silently mirrors to local.
 * Use this for INSERT / UPDATE / DELETE operations.
 */
export async function write(text, params = []) {
  const client = await getPrimary().connect();
  let result;
  try {
    result = await client.query(text, params);
  } finally {
    client.release();
  }
  // Mirror to local backup — never awaited, never throws
  writeLocalSilently(text, params);
  return result;
}

/**
 * TRANSACTION — runs multiple writes inside one Neon transaction,
 * then mirrors each statement to local silently.
 */
export async function transaction(fn) {
  const client = await getPrimary().connect();
  const ops = [];   // collect [text, params] for local mirror

  // Wrap client.query so we can capture every statement for mirroring
  const wrappedClient = {
    query: async (text, params = []) => {
      const result = await client.query(text, params);
      ops.push({ text, params });
      return result;
    },
  };

  try {
    await client.query('BEGIN');
    const result = await fn(wrappedClient);
    await client.query('COMMIT');

    // Mirror entire transaction to local (best-effort)
    const local = getLocal();
    if (local) {
      (async () => {
        const lc = await local.connect().catch(() => null);
        if (!lc) return;
        try {
          await lc.query('BEGIN');
          for (const { text, params } of ops) await lc.query(text, params);
          await lc.query('COMMIT');
        } catch (err) {
          await lc.query('ROLLBACK').catch(() => {});
          console.warn('[pgdb:local] transaction mirror failed:', err.message);
        } finally {
          lc.release();
        }
      })();
    }

    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Health check — used by /api/health */
export async function testConnection() {
  const [neon] = await Promise.all([
    query('SELECT NOW() as now, current_database() as db'),
  ]);

  let localStatus = 'offline';
  const local = getLocal();
  if (local) {
    try {
      await local.query('SELECT 1');
      localStatus = 'online';
    } catch {
      localStatus = 'offline';
    }
  }

  return {
    neon: { db: neon.rows[0].db, time: neon.rows[0].now },
    local: localStatus,
  };
}
