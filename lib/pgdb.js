/**
 * lib/pgdb.js
 * ─────────────────────────────────────────────────────────────
 * Dual-write PostgreSQL connection layer.
 *
 * PRIMARY  → Neon cloud (DATABASE_URL)          — always awaited
 * BACKUP   → Local PostgreSQL (DATABASE_URL_LOCAL)
 *              • If running on laptop: direct write (fast, same process)
 *              • If running on Vercel: HTTP POST to /api/sync after write
 *                (triggers laptop's local server to pull from Neon)
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
      connectionTimeoutMillis: 2000,
      ssl: false,
    });
    localPool.on('error', (err) =>
      console.error('[pgdb:local] pool error:', err.message)
    );
  }
  return localPool;
}

// ── Direct local write (laptop only) ─────────────────────────
function writeLocalSilently(text, params) {
  const pool = getLocal();
  if (!pool) return;
  pool.query(text, params).catch((err) =>
    console.warn('[pgdb:local] backup write failed (ok if offline):', err.message)
  );
}

// ── Public API ────────────────────────────────────────────────

/**
 * READ — queries Neon only (source of truth).
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
 * WRITE — writes to Neon (awaited) then mirrors to local.
 * If DATABASE_URL_LOCAL is set (laptop): mirrors directly.
 * Always triggers full background sync via notifyLocalServer().
 */
export async function write(text, params = []) {
  const client = await getPrimary().connect();
  let result;
  try {
    result = await client.query(text, params);
  } finally {
    client.release();
  }
  // Direct mirror if local pool available (laptop dev mode)
  writeLocalSilently(text, params);
  // Always schedule a full table sync (covers Vercel → local)
  notifyLocalServer();
  return result;
}

/**
 * TRANSACTION — Neon transaction, then mirrors to local.
 */
export async function transaction(fn) {
  const client = await getPrimary().connect();
  const ops = [];

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

    // Mirror transaction to local directly if available
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

    // Always notify local server to sync
    notifyLocalServer();
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * notifyLocalServer
 * ─────────────────────────────────────────────────────────────
 * Calls the laptop's local Next.js server at localhost:3000/api/sync
 * so it pulls the latest data from Neon into local PostgreSQL.
 *
 * - Runs completely in the background (no await, never throws)
 * - Has a 3-second debounce so rapid writes don't cause repeated syncs
 * - Does nothing if running on laptop already (DATABASE_URL_LOCAL is set,
 *   meaning direct write already handled it above)
 * - Safe to call from Vercel — the fetch will simply fail silently if
 *   the laptop server is off, which is fine
 */
let _syncDebounceTimer = null;

function notifyLocalServer() {
  // If we have local pool, direct write already handled it — skip HTTP call
  if (process.env.DATABASE_URL_LOCAL) return;

  // Debounce: wait 3 seconds after last write before triggering sync
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    _syncDebounceTimer = null;
    const laptopUrl = process.env.LAPTOP_SYNC_URL;
    if (!laptopUrl) return; // not configured — skip silently

    fetch(`${laptopUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': process.env.SYNC_SECRET || '' },
      signal: AbortSignal.timeout(8000),
    }).catch(() => {
      // laptop is offline or unreachable — that's ok
    });
  }, 3000);
}

/** Health check */
export async function testConnection() {
  const neonResult = await query('SELECT NOW() as now, current_database() as db');

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
    neon:  { db: neonResult.rows[0].db, time: neonResult.rows[0].now },
    local: localStatus,
  };
}
