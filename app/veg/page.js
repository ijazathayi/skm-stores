'use client';
import { useState } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { matchesSearch } from '@/lib/helpers';

export default function VegPage() {
  const { vegPrices, addVegPrice, updateVegPrice, deleteVegPrice } = useStore();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', altName: '', price: '', unit: 'kg' });
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  const filtered = vegPrices.filter((v) => matchesSearch(v, search));

  const handleAdd = async () => {
    try {
      await addVegPrice(form.name, form.altName, form.price, form.unit);
      setForm({ name: '', altName: '', price: '', unit: 'kg' });
    } catch (e) { alert(e.message); }
  };

  const openEdit = (v) => {
    setEditItem(v);
    setEditForm({ name: v.name, altName: v.altName || '', price: String(v.price), unit: v.unit || 'kg' });
  };

  const handleSave = async () => {
    try {
      await updateVegPrice(editItem.id, editForm.name, editForm.altName, editForm.price, editForm.unit);
      setEditItem(null);
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <Header backHref="/" title="🥕 Veg Prices" />
      <main className="wrap">
        <p style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 14 }}>
          Add products and prices here. Edit a price anytime — it updates automatically.
        </p>

        {/* search */}
        <div className="search-wrap">
          <div className="search-row" style={{ minHeight: 48 }}>
            <span style={{ fontSize: 17 }}>🔍</span>
            <input placeholder="Search veg prices…" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>}
          </div>
        </div>

        {/* add form */}
        <div className="veg-add-row">
          <input placeholder="Name (e.g. Tomato)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
          <input placeholder="தமிழ் பெயர் (optional)" value={form.altName} onChange={(e) => setForm({ ...form, altName: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder="Price ₹" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="kg">kg</option><option value="pcs">pcs</option><option value="both">both</option>
          </select>
        </div>
        <div className="add-row">
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleAdd}>+ Add Price</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>

        {filtered.length === 0 ? <div className="empty-box">{search ? 'No matching items.' : 'No veg prices added yet.'}</div> : (
          <div className="veg-list">
            {filtered.map((v) => (
              <div key={v.id} className="veg-row">
                <div style={{ flex: 1 }}>
                  <div className="veg-row-name">
                    {v.name}
                    {v.altName && v.altName !== v.name && <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 400, marginLeft: 6 }}>({v.altName})</span>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{v.unit || 'kg'}</span>
                </div>
                <span className="veg-row-price">₹{Number(v.price).toFixed(2)}</span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                  <button className="icon-btn" onClick={() => openEdit(v)}>✎</button>
                  <button className="icon-btn" onClick={() => { if (confirm('Remove this veg price?')) deleteVegPrice(v.id); }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
          <div className="modal-box">
            <div className="modal-head">
              <h3 style={{ margin: 0, fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700 }}>✎ Edit Price</h3>
              <button className="drawer-close" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[['name','Product Name'],['altName','Tamil Name'],['price','Price ₹']].map(([k,l]) => (
                <div key={k} className="modal-field">
                  <label>{l}</label>
                  <input type="text" inputMode={k==='price'?'decimal':'text'} value={editForm[k] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })} />
                </div>
              ))}
              <div className="modal-field">
                <label>Unit</label>
                <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                  <option value="kg">kg</option><option value="pcs">pcs</option><option value="both">both</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
