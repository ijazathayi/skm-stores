/**
 * /api/inventory
 * GET    — list all products (ordered by name)
 * POST   — create a new product
 * PUT    — update an existing product (requires product_id in body)
 * DELETE — delete a product (?id=PC001)
 */
import { NextResponse } from 'next/server';
import { query, write } from '@/lib/pgdb';

export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM products ORDER BY name ASC'
    );
    return NextResponse.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error('[/api/inventory GET]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { product_id, name, alt_name, price, unit, category } = body;

    if (!product_id || !name) {
      return NextResponse.json({ ok: false, error: 'product_id and name are required' }, { status: 400 });
    }

    const result = await write(
      `INSERT INTO products (product_id, name, alt_name, price, unit, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (product_id) DO UPDATE
         SET name       = EXCLUDED.name,
             alt_name   = EXCLUDED.alt_name,
             price      = EXCLUDED.price,
             unit       = EXCLUDED.unit,
             category   = EXCLUDED.category,
             updated_at = NOW()
       RETURNING *`,
      [product_id, name, alt_name || null, price || null, unit || 'both', category || null]
    );

    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[/api/inventory POST]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { product_id, name, alt_name, price, unit, category } = body;

    if (!product_id) {
      return NextResponse.json({ ok: false, error: 'product_id is required' }, { status: 400 });
    }

    const result = await write(
      `UPDATE products
       SET name       = COALESCE($2, name),
           alt_name   = COALESCE($3, alt_name),
           price      = $4,
           unit       = COALESCE($5, unit),
           category   = COALESCE($6, category),
           updated_at = NOW()
       WHERE product_id = $1
       RETURNING *`,
      [product_id, name || null, alt_name || null, price ?? null, unit || null, category || null]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error('[/api/inventory PUT]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id param required' }, { status: 400 });
    }

    await write('DELETE FROM products WHERE product_id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/inventory DELETE]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
