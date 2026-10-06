/**
 * /api/sync
 * POST — Pull everything from Neon (primary) and write to local PostgreSQL (backup).
 *        Only works when running on the laptop (DATABASE_URL_LOCAL must be set).
 *        Safe to run any time — uses UPSERT everywhere, never deletes data.
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function POST() {
  if (!process.env.DATABASE_URL_LOCAL) {
    return NextResponse.json({
      ok: false,
      error: 'DATABASE_URL_LOCAL is not set. This sync only works when running on your laptop.',
    }, { status: 400 });
  }

  const neon  = new Pool({ connectionString: process.env.DATABASE_URL,       ssl: { rejectUnauthorized: false } });
  const local = new Pool({ connectionString: process.env.DATABASE_URL_LOCAL, ssl: false, connectionTimeoutMillis: 5000 });

  const stats = {};
  const errors = [];

  try {
    // ── 1. products ──────────────────────────────────────────
    const products = await neon.query('SELECT * FROM products');
    stats.products = 0;
    for (const row of products.rows) {
      await local.query(
        `INSERT INTO products (product_id, name, alt_name, price, unit, category, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (product_id) DO UPDATE
           SET name=EXCLUDED.name, alt_name=EXCLUDED.alt_name, price=EXCLUDED.price,
               unit=EXCLUDED.unit, category=EXCLUDED.category, updated_at=EXCLUDED.updated_at`,
        [row.product_id, row.name, row.alt_name, row.price, row.unit, row.category, row.created_at, row.updated_at]
      ).catch((e) => errors.push(`products ${row.product_id}: ${e.message}`));
      stats.products++;
    }

    // ── 2. bills ─────────────────────────────────────────────
    const bills = await neon.query('SELECT * FROM bills');
    stats.bills = 0;
    for (const row of bills.rows) {
      await local.query(
        `INSERT INTO bills (id, bill_no, date_key, timestamp, subtotal, round_off, total, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE
           SET bill_no=EXCLUDED.bill_no, subtotal=EXCLUDED.subtotal,
               round_off=EXCLUDED.round_off, total=EXCLUDED.total, updated_at=EXCLUDED.updated_at`,
        [row.id, row.bill_no, row.date_key, row.timestamp, row.subtotal, row.round_off, row.total, row.updated_at]
      ).catch((e) => errors.push(`bills ${row.id}: ${e.message}`));
      stats.bills++;
    }

    // ── 3. bill_items ─────────────────────────────────────────
    const billItems = await neon.query('SELECT * FROM bill_items');
    stats.bill_items = 0;
    for (const row of billItems.rows) {
      await local.query(
        `INSERT INTO bill_items (id, bill_id, name, alt_name, unit, qty, price, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE
           SET name=EXCLUDED.name, alt_name=EXCLUDED.alt_name, unit=EXCLUDED.unit,
               qty=EXCLUDED.qty, price=EXCLUDED.price, sort_order=EXCLUDED.sort_order`,
        [row.id, row.bill_id, row.name, row.alt_name, row.unit, row.qty, row.price, row.sort_order]
      ).catch((e) => errors.push(`bill_items ${row.id}: ${e.message}`));
      stats.bill_items++;
    }

    // ── 4. veg_prices ────────────────────────────────────────
    const veg = await neon.query('SELECT * FROM veg_prices');
    stats.veg_prices = 0;
    for (const row of veg.rows) {
      await local.query(
        `INSERT INTO veg_prices (id, name, alt_name, price, unit, date)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE
           SET name=EXCLUDED.name, alt_name=EXCLUDED.alt_name,
               price=EXCLUDED.price, unit=EXCLUDED.unit, date=EXCLUDED.date`,
        [row.id, row.name, row.alt_name, row.price, row.unit, row.date]
      ).catch((e) => errors.push(`veg_prices ${row.id}: ${e.message}`));
      stats.veg_prices++;
    }

    // ── 5. config ────────────────────────────────────────────
    const config = await neon.query('SELECT * FROM config');
    stats.config = 0;
    for (const row of config.rows) {
      await local.query(
        `INSERT INTO config (key, value, updated_at) VALUES ($1,$2,$3)
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at`,
        [row.key, JSON.stringify(row.value), row.updated_at]
      ).catch((e) => errors.push(`config ${row.key}: ${e.message}`));
      stats.config++;
    }

    // ── 6. customers ─────────────────────────────────────────
    const customers = await neon.query('SELECT * FROM customers');
    stats.customers = 0;
    for (const row of customers.rows) {
      await local.query(
        `INSERT INTO customers (id, name, mobile, created_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, mobile=EXCLUDED.mobile`,
        [row.id, row.name, row.mobile, row.created_at]
      ).catch((e) => errors.push(`customers ${row.id}: ${e.message}`));
      stats.customers++;
    }

    // ── 7. ledger_entries ────────────────────────────────────
    const entries = await neon.query('SELECT * FROM ledger_entries');
    stats.ledger_entries = 0;
    for (const row of entries.rows) {
      await local.query(
        `INSERT INTO ledger_entries (id, customer_id, kind, product, qty, amount, date, note, timestamp)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE
           SET kind=EXCLUDED.kind, product=EXCLUDED.product, qty=EXCLUDED.qty,
               amount=EXCLUDED.amount, date=EXCLUDED.date, note=EXCLUDED.note`,
        [row.id, row.customer_id, row.kind, row.product, row.qty, row.amount, row.date, row.note, row.timestamp]
      ).catch((e) => errors.push(`ledger_entries ${row.id}: ${e.message}`));
      stats.ledger_entries++;
    }

    // ── 8. agencies ──────────────────────────────────────────
    const agencies = await neon.query('SELECT * FROM agencies');
    stats.agencies = 0;
    for (const row of agencies.rows) {
      await local.query(
        `INSERT INTO agencies (id, name, phone, person, day, created_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE
           SET name=EXCLUDED.name, phone=EXCLUDED.phone, person=EXCLUDED.person, day=EXCLUDED.day`,
        [row.id, row.name, row.phone, row.person, row.day, row.created_at]
      ).catch((e) => errors.push(`agencies ${row.id}: ${e.message}`));
      stats.agencies++;
    }

    // ── 9. agency_products ───────────────────────────────────
    const agencyProducts = await neon.query('SELECT * FROM agency_products');
    stats.agency_products = 0;
    for (const row of agencyProducts.rows) {
      await local.query(
        `INSERT INTO agency_products (id, agency_id, name, unit, wholesale, retail, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE
           SET name=EXCLUDED.name, unit=EXCLUDED.unit, wholesale=EXCLUDED.wholesale,
               retail=EXCLUDED.retail, sort_order=EXCLUDED.sort_order`,
        [row.id, row.agency_id, row.name, row.unit, row.wholesale, row.retail, row.sort_order]
      ).catch((e) => errors.push(`agency_products ${row.id}: ${e.message}`));
      stats.agency_products++;
    }

    // ── 10. restock_items ────────────────────────────────────
    const restock = await neon.query('SELECT * FROM restock_items');
    stats.restock_items = 0;
    for (const row of restock.rows) {
      await local.query(
        `INSERT INTO restock_items (id, name, product_id, inventory_id, qty, unit, price, date, note, bought, added_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE
           SET name=EXCLUDED.name, qty=EXCLUDED.qty, unit=EXCLUDED.unit,
               price=EXCLUDED.price, note=EXCLUDED.note, bought=EXCLUDED.bought`,
        [row.id, row.name, row.product_id, row.inventory_id, row.qty, row.unit,
         row.price, row.date, row.note, row.bought, row.added_at]
      ).catch((e) => errors.push(`restock_items ${row.id}: ${e.message}`));
      stats.restock_items++;
    }

    return NextResponse.json({
      ok: true,
      message: '✅ Neon → Local sync complete',
      synced: stats,
      errors: errors.length > 0 ? errors : undefined,
      syncedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[/api/sync]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    await neon.end().catch(() => {});
    await local.end().catch(() => {});
  }
}
