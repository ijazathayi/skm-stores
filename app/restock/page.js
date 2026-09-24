'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/lib/store';
import { matchesSearch } from '@/lib/helpers';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const RESTOCK_REF = doc(db, 'restock', 'shared');
const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'packet', 'dozen', 'box', 'bunch', 'set'];
const EMPTY_STATE = { pending: [] };

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

function normalizeState(value) {
  const pending = Array.isArray(value?.pending) ? value.pending : [];
  const legacyItems = Array.isArray(value?.batches)
    ? value.batches.flatMap((batch) => (Array.isArray(batch.items) ? batch.items : []))
    : [];
  const items = [...pending, ...legacyItems];
  const uniqueItems = items.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  return {
    pending: uniqueItems,
  };
}

export default function RestockPage() {
  const { user } = useAuth();
  const { inventory } = useStore();
  const [state, setState] = useState(EMPTY_STATE);
  const [form, setForm] = useState({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [toast, setToast] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    const unsubscribe = onSnapshot(RESTOCK_REF, (snapshot) => {
      const nextState = normalizeState(snapshot.exists() ? snapshot.data() : null);
      setState(nextState);
    }, () => setToast('Could not load shared restock data'));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveState = async (nextState, successMessage = '') => {
    try {
      await setDoc(RESTOCK_REF, {
        ...nextState,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });
      if (successMessage) setToast(successMessage);
    } catch (error) {
      console.error(error);
      setToast('Could not save to Firebase');
    }
  };

  const updateState = (nextState, successMessage = '') => {
    setState(nextState);
    saveState(nextState, successMessage);
  };

  const addItem = (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const nextState = {
      ...state,
      pending: [{
        id: makeId(),
        name,
        qty: form.qty ? Number(form.qty) : 1,
        unit: form.unit,
        price: form.price ? Number(form.price) : null,
        date: form.date,
        note: form.note.trim(),
        bought: false,
        addedAt: new Date().toISOString(),
      }, ...state.pending],
    };
    updateState(nextState);
    setForm({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
  };

  const addInventoryItem = (product) => {
    if (state.pending.some((item) => item.inventoryId === product.id || (product.productId && item.productId === product.productId))) {
      setToast('This product is already on the restock list');
      return;
    }
    const nextState = {
      ...state,
      pending: [{
        id: makeId(),
        productId: product.productId || null,
        inventoryId: product.id,
        name: product.name,
        qty: 1,
        unit: product.unit === 'kg' ? 'kg' : 'pcs',
        price: product.price ? Number(product.price) : null,
        date: new Date().toISOString().slice(0, 10),
        note: '',
        bought: false,
        addedAt: new Date().toISOString(),
      }, ...state.pending],
    };
    updateState(nextState, `${product.name} added to restock list`);
    setForm({ name: '', qty: '1', unit: 'pcs', price: '', date: new Date().toISOString().slice(0, 10), note: '' });
  };

  const deleteItem = (id) => {
    const nextState = { ...state, pending: state.pending.filter((item) => item.id !== id) };
    updateState(nextState);
  };

  const editItem = (item) => {
    const name = window.prompt('Product name', item.name);
    if (name === null || !name.trim()) return;
    const qty = window.prompt('Quantity', String(item.qty ?? 1));
    const date = window.prompt('Date (YYYY-MM-DD)', item.date || item.addedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    const note = window.prompt('Note', item.note || '');
    const nextState = {
      ...state,
      pending: state.pending.map((current) => current.id === item.id
        ? { ...current, name: name.trim(), qty: qty ? Number(qty) : 1, date: date || current.date, note: note?.trim() || '' }
        : current),
    };
    updateState(nextState);
  };

  const toggleItem = (id, bought) => {
    updateState({
      ...state,
      pending: state.pending.map((item) => item.id === id ? { ...item, bought } : item),
    });
  };

  const clearAll = () => {
    if (!window.confirm('Clear the entire checklist? This cannot be undone.')) return;
    updateState(EMPTY_STATE, 'All restock data cleared');
  };

  const pendingTotal = state.pending.filter((item) => !item.bought).length;
  const boughtTotal = state.pending.filter((item) => item.bought).length;
  const visibleItems = state.pending.filter((item) => activeTab === 'purchased' ? item.bought : !item.bought);
  const inventoryMatches = inventory
    .filter((product) => matchesSearch(product, form.name))
    .filter((product) => form.name.trim())
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
            <button className="restock-outline-btn" onClick={() => setReceipt({ shop: 'Restock Checklist', createdAt: new Date().toISOString(), items: state.pending })}>Print checklist</button>
          </div>
          <div className="restock-stats">
            <div><strong>{pendingTotal}</strong><span>Still need to buy</span></div>
            <div><strong>{boughtTotal}</strong><span>Bought</span></div>
            <div><strong>Live</strong><span>Firebase sync</span></div>
          </div>
        </section>

        <div className="restock-columns">
          <section className="restock-panel" id="restock-checklist">
            <h2>Checklist</h2>
            <p className="restock-sub">Search by product name and add it directly to the shared checklist.</p>
            <form className="restock-add-form" onSubmit={addItem}>
              <div className="restock-product-name-field">
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Search product name" required />
                {form.name.trim() && (
                <div className="restock-inventory-results">
                  {inventoryMatches.length === 0 ? <span className="restock-search-empty">No inventory products found.</span> : inventoryMatches.map((product) => (
                    <div className="restock-inventory-result" key={product.id}>
                      <span><strong>{product.name}</strong><small>{product.altName && product.altName !== product.name ? `${product.altName} · ` : ''}{product.price ? formatPrice(product.price) : 'No price'}</small></span>
                      <button className="restock-primary-btn" type="button" onClick={() => addInventoryItem(product)}>Add</button>
                    </div>
                  ))}
                </div>
                )}
              </div>
              <label className="form-field"><span>Quantity</span><input type="number" min="0" step="any" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} placeholder="1" /></label>
              <label className="form-field"><span>Unit</span><select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
              <label className="form-field"><span>Needed by</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} aria-label="Date" /></label>
              <label className="form-field"><span>Expected price</span><input type="number" min="0" step="any" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Optional" /></label>
              <label className="form-field"><span>Note <em>(optional)</em></span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Add a note" /></label>
              <button className="restock-primary-btn" type="submit">Add</button>
            </form>

            <div className="restock-tabs" role="tablist" aria-label="Checklist status">
              <button type="button" role="tab" aria-selected={activeTab === 'pending'} className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>To buy ({pendingTotal})</button>
              <button type="button" role="tab" aria-selected={activeTab === 'purchased'} className={activeTab === 'purchased' ? 'active' : ''} onClick={() => setActiveTab('purchased')}>Purchased ({boughtTotal})</button>
            </div>

            {visibleItems.length === 0 ? <div className="restock-empty">{activeTab === 'purchased' ? 'No purchased products yet.' : 'Nothing is waiting to be bought. Add a product when you spot an empty shelf.'}</div> : (
              <div className="restock-list">
                {visibleItems.map((item) => (
                  <div className="restock-item" key={item.id}>
                    <input type="checkbox" aria-label={`${item.name}: ${item.bought ? 'Bought' : 'Still need to buy'}`} checked={Boolean(item.bought)} onChange={(event) => toggleItem(item.id, event.target.checked)} />
                    <div className="restock-item-main"><strong>{item.name}</strong><span>{formatItemDate(item.date || item.addedAt)} · {formatQty(item)} {item.price ? `· ${formatPrice(item.price)}` : ''}</span>{item.note && <small>{item.note}</small>}</div>
                    <div className="restock-item-actions"><button onClick={() => editItem(item)} title="Edit">✎</button><button onClick={() => deleteItem(item.id)} title="Delete">🗑</button></div>
                  </div>
                ))}
              </div>
            )}

            <div className="restock-batch-bar"><span>{pendingTotal} still need to buy · {boughtTotal} bought</span><button className="restock-primary-btn" type="button" onClick={() => setReceipt({ shop: 'Restock Checklist', createdAt: new Date().toISOString(), items: state.pending })}>Print checklist</button></div>
          </section>
        </div>
        <button className="restock-clear-btn" onClick={clearAll}>Clear all data</button>
      </main>

      {receipt && <div className="restock-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setReceipt(null)}><div className="restock-receipt-modal"><div className="restock-receipt" id="restock-print-area"><strong>{receipt.shop}</strong><span>Purchase List</span><span>{formatDate(receipt.createdAt)}</span><hr /><div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 64px', gap: 6, fontWeight: 700, fontSize: 12, marginBottom: 6 }}><span>Item</span><span>Date</span><span style={{ textAlign: 'right' }}>Price</span></div>{receipt.items.map((item, index) => <div key={item.id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 64px', gap: 6, alignItems: 'baseline' }}><span>{index + 1}. {item.name}</span><span>{formatItemDate(item.date || item.addedAt)}</span><b style={{ textAlign: 'right' }}>{item.price ? formatPrice(item.price) : '—'}</b></div><small>{formatQty(item)}{item.note ? ` · ${item.note}` : ''}</small></div>)}<hr /><span>Items: {receipt.items.length}</span></div><div className="restock-modal-actions"><button onClick={() => setReceipt(null)}>Close</button><button className="restock-primary-btn" onClick={() => window.print()}>Print</button></div></div></div>}
      {toast && <div className="restock-toast">{toast}</div>}
    </>
  );
}