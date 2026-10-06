import { NextResponse } from 'next/server';
import { query, write, transaction } from '@/lib/pgdb';

export async function GET() {
  try {
    const [agenciesResult, productsResult] = await Promise.all([
      query('SELECT * FROM agencies ORDER BY name ASC'),
      query('SELECT * FROM agency_products ORDER BY agency_id, sort_order ASC'),
    ]);
    const productsByAgency = {};
    productsResult.rows.forEach((p) => {
      if (!productsByAgency[p.agency_id]) productsByAgency[p.agency_id] = [];
      productsByAgency[p.agency_id].push(p);
    });
    const agencies = agenciesResult.rows.map((a) => ({ ...a, products: productsByAgency[a.id] || [] }));
    return NextResponse.json({ ok: true, data: agencies });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type } = body;
    if (type === 'agency') {
      const { name, phone, person, day } = body;
      if (!name?.trim()) return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
      const result = await write(
        `INSERT INTO agencies (name, phone, person, day, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
        [name.trim(), phone?.trim() || null, person?.trim() || null, day || 'Not fixed']
      );
      return NextResponse.json({ ok: true, data: { ...result.rows[0], products: [] } });
    }
    if (type === 'product') {
      const { id, agency_id, name, unit, wholesale, retail, sort_order } = body;
      if (!id || !agency_id || !name?.trim()) return NextResponse.json({ ok: false, error: 'id, agency_id, name required' }, { status: 400 });
      const result = await write(
        `INSERT INTO agency_products (id, agency_id, name, unit, wholesale, retail, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, unit=EXCLUDED.unit,
           wholesale=EXCLUDED.wholesale, retail=EXCLUDED.retail, sort_order=EXCLUDED.sort_order
         RETURNING *`,
        [id, agency_id, name.trim(), unit?.trim() || null, wholesale ?? null, retail ?? null, sort_order ?? 0]
      );
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    return NextResponse.json({ ok: false, error: 'type must be agency or product' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    const body = await request.json();
    const { type } = body;
    if (type === 'agency') {
      const { name, phone, person, day } = body;
      const result = await write(
        `UPDATE agencies SET name=COALESCE($2,name), phone=$3, person=$4, day=COALESCE($5,day) WHERE id=$1 RETURNING *`,
        [id, name || null, phone?.trim() || null, person?.trim() || null, day || null]
      );
      if (result.rowCount === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    if (type === 'product') {
      const { name, unit, wholesale, retail, sort_order } = body;
      const result = await write(
        `UPDATE agency_products SET name=COALESCE($2,name), unit=COALESCE($3,unit),
         wholesale=$4, retail=$5, sort_order=COALESCE($6,sort_order) WHERE id=$1 RETURNING *`,
        [id, name || null, unit || null, wholesale ?? null, retail ?? null, sort_order ?? null]
      );
      if (result.rowCount === 0) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: result.rows[0] });
    }
    if (type === 'product_order') {
      const { products } = body;
      await transaction(async (client) => {
        for (const p of products) await client.query('UPDATE agency_products SET sort_order=$2 WHERE id=$1', [p.id, p.sort_order]);
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'unknown type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'agency';
    if (!id) return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    if (type === 'product') {
      await write('DELETE FROM agency_products WHERE id=$1', [id]);
    } else {
      await write('DELETE FROM agencies WHERE id=$1', [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
