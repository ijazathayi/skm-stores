import { NextResponse } from 'next/server';
import { query, write } from '@/lib/pgdb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (key) {
      const result = await query('SELECT * FROM config WHERE key = $1', [key]);
      return NextResponse.json({ ok: true, data: result.rows[0] || null });
    }
    const result = await query('SELECT * FROM config ORDER BY key');
    const map = {};
    result.rows.forEach((row) => { map[row.key] = row.value; });
    return NextResponse.json({ ok: true, data: map });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { key, value } = await request.json();
    if (!key || value === undefined) return NextResponse.json({ ok: false, error: 'key and value are required' }, { status: 400 });
    const result = await write(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW() RETURNING *`,
      [key, JSON.stringify(value)]
    );
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
