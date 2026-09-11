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
const EMPTY_STATE = { pending: [], batches: [], tripCounter: 0 };

const makeId = () => crypto.randomUUID();

function formatQty(item) {
  return `${item.qty ?? 1} ${item.unit || 'pcs'}`;
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return `₹${Number.isInteger(number) ? number : number.toFixed(2)}`;
}

function formatDate(value) {
  const date = new Date(value);
  return `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeState(value) {
  return {
    pending: Array.isArray(value?.pending) ? value.pending : [],
    batches: Array.isArray(value?.batches) ? value.batches : [],
    tripCounter: typeof value?.tripCounter === 'number' ? value.tripCounter : (value?.batches?.length || 0),
  };
}

export default function RestockPage() {
  const { user } = useAuth();
  const { inventory } = useStore();
  const [state, setState] = useState(EMPTY_STATE);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState({ name: '', qty: '1', unit: 'pcs', price: '', note: '' });
  const [inventorySearch, setInventorySearch] = useState('');
  const [shop, setShop] = useState('');
  const [toast, setToast] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(RESTOCK_REF, (snapshot) => {
      const nextState = normalizeState(snapshot.exists() ? snapshot.data() : null);
      setState(nextState);
      setSelectedIds((current) => current.filter((id) => nextState.pending.some((item) => item.id === id)));
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
        note: form.note.trim(),
        addedAt: new Date().toISOString(),
      }, ...state.pending],
    };
    updateState(nextState);
    setForm({ name: '', qty: '1', unit: 'pcs', price: '', note: '' });
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
        note: '',
        addedAt: new Date().toISOString(),
      }, ...state.pending],
    };
    updateState(nextState, `${product.name} added to restock list`);
    setInventorySearch('');
  };

  const deleteItem = (id) => {
    const nextState = { ...state, pending: state.pending.filter((item) => item.id !== id) };
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
    updateState(nextState);
  };

  const editItem = (item) => {
    const name = window.prompt('Product name', item.name);
    if (name === null || !name.trim()) return;
    const qty = window.prompt('Quantity', String(item.qty ?? 1));
    const note = window.prompt('Note', item.note || '');
    const nextState = {
      ...state,
      pending: state.pending.map((current) => current.id === item.id
        ? { ...current, name: name.trim(), qty: qty ? Number(qty) : 1, note: note?.trim() || '' }
        : current),
    };
    updateState(nextState);
  };

  const createBatch = () => {
    if (!selectedIds.length) return;
    const tripCounter = state.tripCounter + 1;
    const chosen = state.pending.filter((item) => selectedIds.includes(item.id));
    const batch = {
      id: makeId(),
      shop: shop.trim() || `Trip ${tripCounter}`,
      createdAt: new Date().toISOString(),
      items: chosen.map((item) => ({ ...item, bought: false })),
    };
    const nextState = {
      tripCounter,
      pending: state.pending.filter((item) => !selectedIds.includes(item.id)),
      batches: [batch, ...state.batches],
    };
    setSelectedIds([]);
    setShop('');
    updateState(nextState);
    setReceipt(batch);
  };

  const updateBatch = (batchId, updater) => {
    const nextState = {
      ...state,
      batches: state.batches.map((batch) => batch.id === batchId ? updater(batch) : batch),
    };
    updateState(nextState);
  };

  const cancelBatch = (batch) => {
    const returned = batch.items.map(({ bought, ...item }) => ({ ...item, addedAt: new Date().toISOString() }));
    updateState({
      ...state,
      pending: [...returned, ...state.pending],
      batches: state.batches.filter((current) => current.id !== batch.id),
    }, 'Trip cancelled');
  };

  const finishBatch = (batch) => {
    const missing = batch.items.filter((item) => !item.bought)
      .map(({ bought, ...item }) => ({ ...item, addedAt: new Date().toISOString() }));
    updateState({
      ...state,
      pending: [...missing, ...state.pending],
      batches: state.batches.filter((current) => current.id !== batch.id),
    }, missing.length ? `${missing.length} item(s) returned to the list` : 'Trip complete');
  };

  const clearAll = () => {
    if (!window.confirm('Clear all products and shopping trips? This cannot be undone.')) return;
    setSelectedIds([]);
    updateState(EMPTY_STATE, 'All restock data cleared');
  };

  const pendingTotal = state.pending.length;
  const tripTotal = state.batches.length;
  const inventoryMatches = inventory
    .filter((product) => matchesSearch(product, inventorySearch))
    .filter((product) => inventorySearch.trim())
    .slice(0, 8);

  return (
    <>
      <Header backHref="/" title="📦 Restock Manager" />
      <main className="wrap restock-page">
        <section className="restock-hero">
          <div>
            <div className="restock-kicker">Shared store workflow</div>
            <h1>Restock Manager</h1>
            <p>Track empty shelves, group urgent items by shop, and keep every signed-in team member in sync.</p>
          </div>
          <div className="restock-hero-actions">
            <button className="restock-light-btn" onClick={() => document.getElementById('restock-pending')?.scrollIntoView({ behavior: 'smooth' })}>Open list</button>
            <button className="restock-outline-btn" onClick={() => document.getElementById('restock-trips')?.scrollIntoView({ behavior: 'smooth' })}>View trips</button>
          </div>
          <div className="restock-stats">
            <div><strong>{pendingTotal}</strong><span>Pending items</span></div>
            <div><strong>{tripTotal}</strong><span>Shopping trips</span></div>
            <div><strong>Live</strong><span>Firebase sync</span></div>
          </div>
        </section>

        <div className="restock-columns">
          <section className="restock-panel" id="restock-pending">
            <h2>Add products</h2>
            <p className="restock-sub">Add products here, then select them to create a checklist for a shop.</p>
            <div className="restock-inventory-search">
              <label htmlFor="restock-inventory-search">Add from inventory</label>
              <input id="restock-inventory-search" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Search inventory products" />
              {inventorySearch.trim() && (
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
            <form className="restock-add-form" onSubmit={addItem}>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Product name" required />
              <input type="number" min="0" step="any" value={form.qty} onChange={(event) => setForm({ ...form, qty: event.target.value })} placeholder="Qty" />
              <select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
              <input type="number" min="0" step="any" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Price ₹" />
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Note (optional)" />
              <button className="restock-primary-btn" type="submit">Add</button>
            </form>

            {state.pending.length === 0 ? <div className="restock-empty">Nothing is out right now. Add a product when you spot an empty shelf.</div> : (
              <div className="restock-list">
                {state.pending.map((item) => (
                  <div className="restock-item" key={item.id}>
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                    <div className="restock-item-main"><strong>{item.name}</strong><span>{formatQty(item)} {item.price ? `· ${formatPrice(item.price)}` : ''}</span>{item.note && <small>{item.note}</small>}</div>
                    <div className="restock-item-actions"><button onClick={() => editItem(item)} title="Edit">✎</button><button onClick={() => deleteItem(item.id)} title="Delete">🗑</button></div>
                  </div>
                ))}
              </div>
            )}

            <div className="restock-batch-bar"><span>{selectedIds.length} selected for checklist</span><input value={shop} onChange={(event) => setShop(event.target.value)} placeholder="Shop name" /><button className="restock-primary-btn" disabled={!selectedIds.length} onClick={createBatch}>Create checklist</button></div>
          </section>

          <section className="restock-panel" id="restock-trips">
            <h2>Shop checklists</h2>
            <p className="restock-sub">Check an item when staff buy it. Unchecked items still need to be bought.</p>
            {state.batches.length === 0 ? <div className="restock-empty">No checklists yet. Select products and create one for a shop.</div> : (
              <div>
                {state.batches.map((batch) => {
                  const bought = batch.items.filter((item) => item.bought).length;
                  const total = batch.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                  return <article className="restock-trip" key={batch.id}>
                    <div className="restock-trip-head"><div><strong>{batch.shop}</strong><small>{formatDate(batch.createdAt)}</small></div><div><button onClick={() => setReceipt(batch)} title="Print">🖨</button><button onClick={() => cancelBatch(batch)} title="Cancel">✕</button></div></div>
                    {batch.items.map((item) => <label className={`restock-trip-item${item.bought ? ' bought' : ''}`} key={item.id}><input type="checkbox" aria-label={`${item.name}: ${item.bought ? 'Bought' : 'Still need to buy'}`} checked={Boolean(item.bought)} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, items: current.items.map((currentItem) => currentItem.id === item.id ? { ...currentItem, bought: event.target.checked } : currentItem) }))} /><span><strong>{item.name}</strong><small>{item.bought ? 'Bought' : 'Still need to buy'} · {formatQty(item)} {item.price ? `· ${formatPrice(item.price)}` : ''}</small></span></label>)}
                    <div className="restock-trip-foot"><span>{bought} of {batch.items.length} bought</span>{total > 0 && <strong>{formatPrice(total)}</strong>}<button className="restock-primary-btn" onClick={() => finishBatch(batch)}>Complete checklist</button></div>
                  </article>;
                })}
              </div>
            )}
          </section>
        </div>
        <button className="restock-clear-btn" onClick={clearAll}>Clear all data</button>
      </main>

      {receipt && <div className="restock-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setReceipt(null)}><div className="restock-receipt-modal"><div className="restock-receipt" id="restock-print-area"><strong>{receipt.shop}</strong><span>Purchase List</span><span>{formatDate(receipt.createdAt)}</span><hr />{receipt.items.map((item, index) => <div key={item.id}><p><span>{index + 1}. {item.name}</span>{item.price ? <b>{formatPrice(item.price)}</b> : null}</p><small>{formatQty(item)}{item.note ? ` · ${item.note}` : ''}</small></div>)}<hr /><span>Items: {receipt.items.length}</span></div><div className="restock-modal-actions"><button onClick={() => setReceipt(null)}>Close</button><button className="restock-primary-btn" onClick={() => window.print()}>Print</button></div></div></div>}
      {toast && <div className="restock-toast">{toast}</div>}
    </>
  );
}