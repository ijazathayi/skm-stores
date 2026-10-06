import { NextResponse } from 'next/server';
import { query, write, transaction } from '@/lib/pgdb';

export async function GET() {
  try {
    const [billsResult, itemsResult] = await Promise.all([
      query('SELECT * FROM bills ORDER BY timestamp DESC'),
      query('SELECT * FROM bill_items ORDER BY bill_id, sort_order ASC'),
    ]);
    const itemsByBillId = {};
    itemsResult.rows.forEach((item) => {
      if (!itemsByBillId[item.bill_id]) itemsByBillId[item.bill_id] = [];
      itemsByBillId[item.bill_id].push(item);
    });
    const bills = billsResult.rows.map((b) => ({ ...b, items: itemsByBillId[b.id] || [] }));
    return NextResponse.json({ ok: true, data: bills });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { bill_no, date_key, timestamp, items, subtotal, round_off, total } = await request.json();
    if (!items || items.length === 0) return NextResponse.json({ ok: false, error: 'items array is required' }, { status: 400 });
    const bill = await transaction(async (client) => {
      const billResult = await client.query(
        `INSERT INTO bills (bill_no, date_key, timestamp, subtotal, round_off, total)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [bill_no, date_key || new Date().toISOString().slice(0, 10), timestamp || new Date().toISOString(),
         subtotal || 0, round_off || 0, total || 0]
      );
      const newBill = billResult.rows[0];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO bill_items (bill_id, name, alt_name, unit, qty, price, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [newBill.id, it.name, it.altName || it.alt_name || null, it.unit || 'pcs', it.qty, it.price, i]
        );
      }
      const itemsResult = await client.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY sort_order', [newBill.id]);
      return { ...newBill, items: itemsResult.rows };
    });
    return NextResponse.json({ ok: true, data: bill });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    const { items, subtotal, round_off, total } = await request.json();
    const bill = await transaction(async (client) => {
      const billResult = await client.query(
        `UPDATE bills SET subtotal=$2, round_off=$3, total=$4, updated_at=NOW() WHERE id=$1 RETURNING *`,
        [id, subtotal || 0, round_off || 0, total || 0]
      );
      if (billResult.rowCount === 0) throw new Error('Bill not found');
      await client.query('DELETE FROM bill_items WHERE bill_id = $1', [id]);
      for (let i = 0; i < (items || []).length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO bill_items (bill_id, name, alt_name, unit, qty, price, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, it.name, it.altName || it.alt_name || null, it.unit || 'pcs', it.qty, it.price, i]
        );
      }
      const itemsResult = await client.query('SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY sort_order', [id]);
      return { ...billResult.rows[0], items: itemsResult.rows };
    });
    return NextResponse.json({ ok: true, data: bill });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    await write('DELETE FROM bills WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
