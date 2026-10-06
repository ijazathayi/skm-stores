import { NextResponse } from 'next/server';
import { query, write } from '@/lib/pgdb';

export async function GET() {
  try {
    const result = await query('SELECT * FROM veg_prices ORDER BY name ASC');
    return NextResponse.json({ ok: true, data: result.rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, alt_name, price, unit, date } = await request.json();
    if (!name || price == null) return NextResponse.json({ ok: false, error: 'name and price are required' }, { status: 400 });
    const result = await write(
      `INSERT INTO veg_prices (name, alt_name, price, unit, date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), alt_name || name.trim(), price, unit || 'kg', date || new Date().toISOString().slice(0, 10)]
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
    const { name, alt_name, price, unit, date } = await request.json();
    const result = await write(
      `UPDATE veg_prices SET name=COALESCE($2,name), alt_name=COALESCE($3,alt_name),
       price=COALESCE($4,price), unit=COALESCE($5,unit), date=COALESCE($6,date)
       WHERE id=$1 RETURNING *`,
      [id, name || null, alt_name || null, price ?? null, unit || null, date || null]
    );
    if (result.rowCount === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    await write('DELETE FROM veg_prices WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
