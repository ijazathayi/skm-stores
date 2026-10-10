import { NextResponse } from 'next/server';
import { query, write } from '@/lib/pgdb';

function serializeRow(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
  }
  return out;
}

export async function GET() {
  try {
    const result = await query('SELECT * FROM restock_items ORDER BY bought ASC, added_at DESC');
    return NextResponse.json({ ok: true, data: result.rows.map(serializeRow) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { id, name, product_id, inventory_id, qty, unit, price, date, note } = await request.json();
    if (!name?.trim()) return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
    const result = await write(
      `INSERT INTO restock_items (id, name, product_id, inventory_id, qty, unit, price, date, note, bought, added_at)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, FALSE, NOW()) RETURNING *`,
      [id || null, name.trim(), product_id || null, inventory_id || null, qty ?? null,
       unit || 'pcs', price ?? null, date || new Date().toISOString().slice(0, 10), note?.trim() || null]
    );
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    const { name, qty, unit, price, date, note, bought } = await request.json();
    const result = await write(
      `UPDATE restock_items
       SET name   = COALESCE($2, name), qty  = COALESCE($3, qty),  unit = COALESCE($4, unit),
           price  = $5,                 date = COALESCE($6, date), note = COALESCE($7, note),
           bought = COALESCE($8, bought)
       WHERE id = $1 RETURNING *`,
      [id, name || null, qty ?? null, unit || null, price ?? null, date || null, note ?? null, bought ?? null]
    );
    if (result.rowCount === 0) return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearBought = searchParams.get('clearBought') === 'true';
    if (clearBought) { await write('DELETE FROM restock_items WHERE bought = TRUE'); return NextResponse.json({ ok: true }); }
    if (!id) return NextResponse.json({ ok: false, error: 'id or clearBought param required' }, { status: 400 });
    await write('DELETE FROM restock_items WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
