import { NextResponse } from 'next/server';
import { query, write } from '@/lib/pgdb';

// Serialize PostgreSQL DATE objects to YYYY-MM-DD strings
function serializeRow(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) {
      // DATE columns → YYYY-MM-DD, TIMESTAMPTZ → ISO string
      out[k] = v.toISOString().slice(0, 10);
    }
  }
  return out;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'customers';
    const customerId = searchParams.get('customerId');
    if (type === 'entries') {
      const result = customerId
        ? await query('SELECT * FROM ledger_entries WHERE customer_id=$1 ORDER BY date ASC, timestamp ASC', [customerId])
        : await query('SELECT * FROM ledger_entries ORDER BY date ASC, timestamp ASC');
      return NextResponse.json({ ok: true, data: result.rows.map(serializeRow) });
    }
    const result = await query('SELECT * FROM customers ORDER BY name ASC');
    return NextResponse.json({ ok: true, data: result.rows.map(serializeRow) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type } = body;
    if (type === 'customer') {
      const { name, mobile } = body;
      if (!name?.trim()) return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
      const result = await write(
        `INSERT INTO customers (name, mobile, created_at) VALUES ($1,$2,NOW()) RETURNING *`,
        [name.trim(), mobile?.trim() || null]
      );
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    if (type === 'entry') {
      const { customer_id, kind, product, qty, amount, date, note, timestamp } = body;
      if (!customer_id || !kind || !amount) return NextResponse.json({ ok: false, error: 'customer_id, kind, amount required' }, { status: 400 });
      const result = await write(
        `INSERT INTO ledger_entries (customer_id, kind, product, qty, amount, date, note, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [customer_id, kind, product?.trim() || null, qty?.trim() || null, amount,
         date || new Date().toISOString().slice(0, 10), note?.trim() || null, timestamp || new Date().toISOString()]
      );
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    return NextResponse.json({ ok: false, error: 'type must be customer or entry' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    const { type, name, mobile } = await request.json();
    if (type === 'customer') {
      if (!name?.trim()) return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
      const result = await write(
        `UPDATE customers SET name=$2, mobile=$3 WHERE id=$1 RETURNING *`,
        [id, name.trim(), mobile?.trim() || null]
      );
      if (result.rowCount === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    return NextResponse.json({ ok: false, error: 'type must be customer' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'customer';
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    if (type === 'entry') {
      await write('DELETE FROM ledger_entries WHERE id=$1', [id]);
    } else {
      await write('DELETE FROM customers WHERE id=$1', [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
