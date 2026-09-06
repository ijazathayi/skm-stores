'use client';
import { useState } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { STORE_CATEGORIES, getProductCategory, matchesSearch, generateProductId } from '@/lib/helpers';

const CAT_OPTIONS = [{ value: 'auto', label: 'Auto Detect' }, ...STORE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))];

export default function InventoryPage() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useStore();
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('id');
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', altName: '', price: '', unit: 'both', category: 'auto' });

  const filtered = inventory
    .filter((p) => matchesSearch(p, search))
    .sort((a, b) => {
      if (sortMode === 'az') return (a.name || '').localeCompare(b.name || '');
      if (sortMode === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortMode === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      const aId = a.productId ? a.productId.replace(/\D/g,'') : 9999;
      const bId = b.productId ? b.productId.replace(/\D/g,'') : 9999;
      return Number(aId) - Number(bId);
    });

  const handleAdd = async () => {
    try {
      await addInventoryItem(form.name, form.altName, form.price, form.unit, form.category);
      setForm({ name: '', altName: '', price: '', unit: 'both', category: 'auto' });
    } catch (e) { alert(e.message); }
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({ name: p.name || '', altName: p.altName || '', price: p.price ? String(p.price) : '', unit: p.unit || 'both', category: p.category || 'auto', productId: p.productId || '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Name required'); return; }
    const updates = { name: form.name.trim(), altName: (form.altName || form.name).trim(), unit: form.unit };
    if (form.category && form.category !== 'auto') updates.category = form.category;
    if (form.price && !isNaN(form.price) && Number(form.price) > 0) updates.price = Number(form.price);
    if (form.productId) updates.productId = form.productId.trim().toUpperCase();
    await updateInventoryItem(editItem.id, updates);
    setEditItem(null);
  };

  return (
    <>
      <Header backHref="/" title="📦 Inventory" />
      <main className="wrap">
        {/* search */}
        <div className="search-wrap">
          <div className="search-row" style={{ minHeight: 48 }}>
            <span style={{ fontSize: 17 }}>🔍</span>
            <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>}
          </div>
        </div>

        {/* add form */}
        <div className="inv-add-grid">
          <input placeholder="English name (e.g. Tomato)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="தமிழ் பெயர் (optional)" value={form.altName} onChange={(e) => setForm({ ...form, altName: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="pcs">PCS</option><option value="kg">KG</option><option value="both">BOTH</option>
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ gridColumn: '1 / -1' }}>
            {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="add-row">
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleAdd}>+ Add Product</button>
        </div>

        {/* sort bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{filtered.length}{search ? ` of ${inventory.length}` : ''} items · Sort:</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--card)', overflow: 'hidden' }}>
            {[['id','#ID'],['az','A–Z'],['price-asc','₹↑'],['price-desc','₹↓']].map(([m,l]) => (
              <button key={m} onClick={() => setSortMode(m)} style={{
                border: 'none', padding: '6px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: sortMode === m ? 'var(--primary)' : 'transparent',
                color: sortMode === m ? '#fff' : 'var(--ink3)'
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* list */}
        {filtered.length === 0 ? <div className="empty-box">No products found.</div> : (
          <div className="inv-list">
            {filtered.map((p) => {
              const cat = STORE_CATEGORIES.find((c) => c.id === getProductCategory(p));
              return (
                <div key={p.id} className="inv-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {p.productId && <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px' }}>#{p.productId}</span>}
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.price ? <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>₹{Number(p.price).toFixed(2)}</span>
                        : <span style={{ color: 'var(--ink3)', fontSize: 11 }}>No price</span>}
                      <span style={{ background: '#E8F0E6', color: 'var(--primary-dark)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.unit || 'both'}</span>
                      {cat && <span style={{ background: '#F1F0E4', color: 'var(--ink2)', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{cat.icon} {cat.label}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="icon-btn" onClick={() => openEdit(p)}>✎</button>
                    <button className="icon-btn" onClick={() => { if (confirm('Delete this product?')) deleteInventoryItem(p.id); }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
          <div className="modal-box">
            <div className="modal-head">
              <h3 style={{ margin: 0, fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700 }}>✎ Edit Product</h3>
              <button className="drawer-close" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[['productId','Product ID','e.g. PC001'],['name','Name (English)','e.g. Tomato'],['altName','Tamil name','e.g. தக்காளி'],['price','Price ₹','e.g. 50']].map(([k,l,ph]) => (
                <div key={k} className="modal-field">
                  <label>{l}</label>
                  <input type="text" inputMode={k==='price'?'decimal':'text'} placeholder={ph}
                    value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
              <div className="modal-field">
                <label>Unit</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="pcs">PCS</option><option value="kg">KG</option><option value="both">BOTH</option>
                </select>
              </div>
              <div className="modal-field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
