'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { matchesSearch } from '@/lib/helpers';

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'packet', 'dozen', 'box', 'bunch', 'set'];

const makeId = () => crypto.randomUUID();

function formatQty(item) {
  return `${item.qty ?? 1} ${item.unit || 'pcs'}`;
}
function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return `₹${Number.isInteger(number) ? number : number.toFixed(2)}`;
}
function formatDate(value = new Date().toISOString()) {
  const date = new Date(value);
  return `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
function formatItemDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

async function apiGet()           { const r = await fetch('/api/restock');               const j = await r.json(); return j.data || []; }
async function apiPost(body)      { const r = await fetch('/api/restock', { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
async function apiPut(id, body)   { const r = await fetch(`/api/restock?id=${id}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); }
async function apiDel(id)         { const r = await fetch(`/api/restock?id=${id}`, { method: 'DELETE' }); return r.json(); }
async function apiClearBought()   { const r = await fetch('/api/restock?clearBought=true', { method: 'DELETE' }); return r.json(); }

export default function RestockPage() {
  const { inventory } = useStore();
  const [items,      setItems]     = useState([]);
  const [form,       setForm]      = useState({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [toast,      setToast]     = useState('');
  const [receipt,    setReceipt]   = useState(null);
  const [activeTab,  setActiveTab] = useState('pending');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const load = useCallback(async () => {
    try { setItems(await apiGet()); } catch { showToast('Could not load restock data'); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  // ── Add item manually ──
  const addItem = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    await apiPost({
      id:    makeId(),
      name,
      qty:   form.qty ? Number(form.qty) : 1,
      unit:  form.unit,
      price: form.price ? Number(form.price) : null,
      date:  form.date,
      note:  form.note.trim(),
    });
    setForm({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
    await load();
  };

  // ── Add from inventory ──
  const addInventoryItem = async (product) => {
    if (items.some((i) => i.inventory_id === product.id || (product.productId && i.product_id === product.productId))) {
      showToast('This product is already on the restock list');
      return;
    }
    await apiPost({
      id:           makeId(),
      name:         product.name,
      product_id:   product.productId || product.product_id || null,
      inventory_id: product.id,
      qty:          1,
      unit:         product.unit === 'kg' ? 'kg' : 'pcs',
      price:        product.price ? Number(product.price) : null,
      date:         new Date().toISOString().slice(0, 10),
      note:         '',
    });
    showToast(`${product.name} added to restock list`);
    setForm({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
    await load();
  };

  const deleteItem = async (id) => { await apiDel(id); await load(); };

  const editItem = async (item) => {
    const name = window.prompt('Product name', item.name);
    if (name === null || !name.trim()) return;
    const qty  = window.prompt('Quantity', String(item.qty ?? 1));
    const date = window.prompt('Date (YYYY-MM-DD)', item.date || item.added_at?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    const note = window.prompt('Note', item.note || '');
    await apiPut(item.id, { name: name.trim(), qty: qty ? Number(qty) : 1, date: date || item.date, note: note?.trim() || '' });
    await load();
  };

  const toggleItem = async (id, bought) => { await apiPut(id, { bought }); await load(); };

  const clearAll = async () => {
    if (!window.confirm('Clear the entire checklist? This cannot be undone.')) return;
    // delete all items
    await Promise.all(items.map((i) => apiDel(i.id)));
    showToast('All restock data cleared');
    await load();
  };

  const pendingTotal  = items.filter((i) => !i.bought).length;
  const boughtTotal   = items.filter((i) =>  i.bought).length;
  const visibleItems  = items.filter((i) => activeTab === 'purchased' ? i.bought : !i.bought);
  const inventoryMatches = inventory
    .filter((p) => matchesSearch(p, form.name))
    .filter(() => form.name.trim())
    .slice(0, 8);

  return (
    <>
      <Header backHref="/" title="📦 Restock Manager" />
      <main className="wrap restock-page">
        <section className="restock-hero">
          <div>
            <div className="restock-kicker">Shared store workflow</div>
            <h1>Restock Manager</h1>
            <p>Keep one shared checklist of products to buy and mark each item when it is bought.</p>
          </div>
          <div className="restock-hero-actions">
            <button className="restock-light-btn" onClick={() => document.getElementById('restock-checklist')?.scrollIntoView({ behavior: 'smooth' })}>Open checklist</button>
            <button className="restock-outline-btn" onClick={() => setReceipt({ shop: 'Restock Checklist', createdAt: new Date().toISOString(), items })}>Print checklist</button>
          </div>
          <div className="restock-stats">
            <div><strong>{pendingTotal}</strong><span>Still need to buy</span></div>
            <div><strong>{boughtTotal}</strong><span>Bought</span></div>
            <div><strong>Live</strong><span>PostgreSQL sync</span></div>
          </div>
        </section>

        <div className="restock-columns">
          <section className="restock-panel" id="restock-checklist">
            <h2>Checklist</h2>
            <p className="restock-sub">Search by product name and add it directly to the shared checklist.</p>
            <form className="restock-add-form" onSubmit={addItem}>
              <div className="restock-product-name-field">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Search product name" required />
                {form.name.trim() && (
                  <div className="restock-inventory-results">
                    {inventoryMatches.length === 0
                      ? <span className="restock-search-empty">No inventory products found.</span>
                      : inventoryMatches.map((p) => (
                        <div className="restock-inventory-result" key={p.id}>
                          <span><strong>{p.name}</strong><small>{p.altName && p.altName !== p.name ? `${p.altName} · ` : ''}{p.price ? formatPrice(p.price) : 'No price'}</small></span>
                          <button className="restock-primary-btn" type="button" onClick={() => addInventoryItem(p)}>Add</button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <label className="form-field"><span>Quantity</span><input type="number" min="0" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="1" /></label>
              <label className="form-field"><span>Unit</span><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="form-field"><span>Needed by</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="form-field"><span>Expected price</span><input type="number" min="0" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Optional" /></label>
              <label className="form-field"><span>Note <em>(optional)</em></span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Add a note" /></label>
              <button className="restock-primary-btn" type="submit">Add</button>
            </form>

            <div className="restock-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={activeTab === 'pending'}    className={activeTab === 'pending'    ? 'active' : ''} onClick={() => setActiveTab('pending')}>To buy ({pendingTotal})</button>
              <button type="button" role="tab" aria-selected={activeTab === 'purchased'} className={activeTab === 'purchased' ? 'active' : ''} onClick={() => setActiveTab('purchased')}>Purchased ({boughtTotal})</button>
            </div>

            {visibleItems.length === 0
              ? <div className="restock-empty">{activeTab === 'purchased' ? 'No purchased products yet.' : 'Nothing is waiting to be bought.'}</div>
              : (
                <div className="restock-list">
                  {visibleItems.map((item) => (
                    <div className="restock-item" key={item.id}>
                      <input type="checkbox" aria-label={`${item.name}: ${item.bought ? 'Bought' : 'Still need to buy'}`} checked={Boolean(item.bought)} onChange={(e) => toggleItem(item.id, e.target.checked)} />
                      <div className="restock-item-main">
                        <strong>{item.name}</strong>
                        <span>{formatItemDate(item.date || item.added_at)} · {formatQty(item)} {item.price ? `· ${formatPrice(item.price)}` : ''}</span>
                        {item.note && <small>{item.note}</small>}
                      </div>
                      <div className="restock-item-actions">
                        <button onClick={() => editItem(item)} title="Edit">✎</button>
                        <button onClick={() => deleteItem(item.id)} title="Delete">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            <div className="restock-batch-bar">
              <span>{pendingTotal} still need to buy · {boughtTotal} bought</span>
              <button className="restock-primary-btn" type="button" onClick={() => setReceipt({ shop: 'Restock Checklist', createdAt: new Date().toISOString(), items })}>Print checklist</button>
            </div>
          </section>
        </div>
        <button className="restock-clear-btn" onClick={clearAll}>Clear all data</button>
      </main>

      {receipt && (
        <div className="restock-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReceipt(null)}>
          <div className="restock-receipt-modal">
            <div className="restock-receipt" id="restock-print-area">
              <strong>{receipt.shop}</strong>
              <span>Purchase List</span>
              <span>{formatDate(receipt.createdAt)}</span>
              <hr />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 64px', gap: 6, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                <span>Item</span><span>Date</span><span style={{ textAlign: 'right' }}>Price</span>
              </div>
              {receipt.items.map((item, idx) => (
                <div key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 64px', gap: 6, alignItems: 'baseline' }}>
                    <span>{idx + 1}. {item.name}</span>
                    <span>{formatItemDate(item.date || item.added_at)}</span>
                    <b style={{ textAlign: 'right' }}>{item.price ? formatPrice(item.price) : '—'}</b>
                  </div>
                  <small>{formatQty(item)}{item.note ? ` · ${item.note}` : ''}</small>
                </div>
              ))}
              <hr />
              <span>Items: {receipt.items.length}</span>
            </div>
            <div className="restock-modal-actions">
              <button onClick={() => setReceipt(null)}>Close</button>
              <button className="restock-primary-btn" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="restock-toast">{toast}</div>}
    </>
  );
}
