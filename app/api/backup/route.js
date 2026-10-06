/**
 * /api/backup
 *
 * GET  — export all Neon data as a JSON file (download or return raw)
 * POST — export + push the JSON file to GitHub skm-backup repo
 *
 * Called by:
 *   - Admin panel "Download Backup" button  (GET)
 *   - Admin panel "Push to GitHub" button   (POST)
 *   - GitHub Actions daily cron             (POST with x-cron-secret header)
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/pgdb';

// ── Fetch all tables from Neon ────────────────────────────────
async function exportAllData() {
  const [
    products,
    bills,
    billItems,
    veg,
    config,
    customers,
    entries,
    agencies,
    agencyProducts,
    restock,
  ] = await Promise.all([
    query('SELECT * FROM products       ORDER BY product_id'),
    query('SELECT * FROM bills          ORDER BY timestamp DESC'),
    query('SELECT * FROM bill_items     ORDER BY bill_id, sort_order'),
    query('SELECT * FROM veg_prices     ORDER BY name'),
    query('SELECT * FROM config         ORDER BY key'),
    query('SELECT * FROM customers      ORDER BY name'),
    query('SELECT * FROM ledger_entries ORDER BY date, timestamp'),
    query('SELECT * FROM agencies       ORDER BY name'),
    query('SELECT * FROM agency_products ORDER BY agency_id, sort_order'),
    query('SELECT * FROM restock_items  ORDER BY added_at DESC'),
  ]);

  return {
    exportedAt:     new Date().toISOString(),
    version:        '1.0',
    source:         'SKM Stores — Neon PostgreSQL',
    tables: {
      products:        products.rows,
      bills:           bills.rows,
      bill_items:      billItems.rows,
      veg_prices:      veg.rows,
      config:          config.rows,
      customers:       customers.rows,
      ledger_entries:  entries.rows,
      agencies:        agencies.rows,
      agency_products: agencyProducts.rows,
      restock_items:   restock.rows,
    },
    counts: {
      products:        products.rowCount,
      bills:           bills.rowCount,
      bill_items:      billItems.rowCount,
      veg_prices:      veg.rowCount,
      config:          config.rowCount,
      customers:       customers.rowCount,
      ledger_entries:  entries.rowCount,
      agencies:        agencies.rowCount,
      agency_products: agencyProducts.rowCount,
      restock_items:   restock.rowCount,
    },
  };
}

// ── Push JSON to GitHub ───────────────────────────────────────
async function pushToGitHub(data) {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const owner = process.env.GITHUB_BACKUP_OWNER || 'ijazathayi';
  const repo  = process.env.GITHUB_BACKUP_REPO  || 'skm-backup';

  if (!token) throw new Error('GITHUB_BACKUP_TOKEN is not set in environment variables');

  const date     = new Date().toISOString().slice(0, 10);          // 2026-10-06
  const filename = `backups/SKM_Backup_${date}.json`;
  const content  = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const message  = `backup: SKM Stores daily backup ${date}`;

  // Check if file already exists (to get its SHA for update)
  const checkRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
    { headers: { Authorization: `token ${token}`, 'User-Agent': 'SKM-Backup' } }
  );
  const existing = checkRes.ok ? await checkRes.json() : null;

  // Create or update the file
  const body = { message, content };
  if (existing?.sha) body.sha = existing.sha; // required for update

  const pushRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
    {
      method:  'PUT',
      headers: {
        Authorization:  `token ${token}`,
        'Content-Type': 'application/json',
        'User-Agent':   'SKM-Backup',
      },
      body: JSON.stringify(body),
    }
  );

  if (!pushRes.ok) {
    const err = await pushRes.json();
    throw new Error(`GitHub API error: ${err.message}`);
  }

  const result = await pushRes.json();
  return {
    file:    filename,
    url:     result.content?.html_url,
    sha:     result.content?.sha,
    updated: !!existing?.sha,
  };
}

// ── GET — download as JSON file ───────────────────────────────
export async function GET() {
  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="SKM_Backup_${date}.json"`,
      },
    });
  } catch (err) {
    console.error('[/api/backup GET]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── POST — export + push to GitHub ───────────────────────────
export async function POST(request) {
  // Verify cron secret when called from GitHub Actions
  const cronSecret = request.headers.get('x-cron-secret') || '';
  const expected   = process.env.CRON_SECRET || '';
  if (expected && cronSecret && cronSecret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data   = await exportAllData();
    const github = await pushToGitHub(data);

    return NextResponse.json({
      ok:         true,
      message:    `✅ Backup pushed to GitHub`,
      file:       github.file,
      url:        github.url,
      counts:     data.counts,
      exportedAt: data.exportedAt,
      action:     github.updated ? 'updated' : 'created',
    });
  } catch (err) {
    console.error('[/api/backup POST]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
