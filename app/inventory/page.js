'use client';
import { useState, useRef } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { STORE_CATEGORIES, getProductCategory, matchesSearch, generateProductId } from '@/lib/helpers';
import { exportInventory, parseImportFile } from '@/lib/inventoryExcel';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CAT_OPTIONS = [{ value: 'auto', label: 'Auto Detect' }, ...STORE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))];

export default function InventoryPage() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useStore();
  const [search,   setSearch]   = useState('');
  const [sortMode, setSortMode] = useState('id');
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState({ name: '', altName: '', price: '', unit: 'both', category: 'auto' });

  // ── import state ──
  const fileInputRef            = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importPreview, setImportPreview] = useState(null); // { toUpdate, toAdd, skipped }

  const filtered = inventory
    .filter((p) => matchesSearch(p, search))
    .sort((a, b) => {
      if (sortMode === 'az')         return (a.name || '').localeCompare(b.name || '');
      if (sortMode === 'price-asc')  return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortMode === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      const aId = a.productId ? a.productId.replace(/\D/g, '') : 9999;
      const bId = b.productId ? b.productId.replace(/\D/g, '') : 9999;
      return Number(aId) - Number(bId);
    });

  // ── add product ──
  const handleAdd = async () => {
    try {
      await addInventoryItem(form.name, form.altName, form.price, form.unit, form.category);
      setForm({ name: '', altName: '', price: '', unit: 'both', category: 'auto' });
    } catch (e) { alert(e.message); }
  };

  // ── edit product ──
  const openEdit = (p) => {
    setEditItem(p);
    // Resolve the actual current category — never show 'auto' in the dropdown
    const resolvedCat = getProductCategory(p); // always returns a real category id
    setForm({
      name:      p.name     || '',
      altName:   p.altName  || '',
      price:     p.price    ? String(p.price) : '',
      unit:      p.unit     || 'both',
      category:  resolvedCat,
      productId: p.productId || '',
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Name required'); return; }

    const oldCatId = getProductCategory(editItem);
    const newCatId = form.category && form.category !== 'auto' ? form.category : oldCatId;
    const categoryChanged = newCatId !== oldCatId;

    if (categoryChanged) {
      // ── Category changed → delete old doc, create new one with new productId ──
      // Generate next available ID in the new category
      const allIds = inventory
        .filter((p) => p.id !== editItem.id) // exclude the current item
        .map((p) => p.productId)
        .filter(Boolean);
      const newProductId = generateProductId(newCatId, allIds);

      const newData = {
        productId:  newProductId,
        name:       form.name.trim(),
        altName:    (form.altName || form.name).trim(),
        unit:       form.unit,
        category:   newCatId,
      };
      if (form.price && !isNaN(form.price) && Number(form.price) > 0) {
        newData.price = Number(form.price);
      }

      // Create new doc first, then delete old
      await setDoc(doc(db, 'inventory', newProductId), newData);
      await deleteInventoryItem(editItem.id);
    } else {
      // ── Same category → just update the existing doc ──
      const updates = {
        name:     form.name.trim(),
        altName:  (form.altName || form.name).trim(),
        unit:     form.unit,
        category: newCatId,
      };
      if (form.price && !isNaN(form.price) && Number(form.price) > 0) {
        updates.price = Number(form.price);
      }
      // Allow manual productId override only when category hasn't changed
      if (form.productId && form.productId.trim().toUpperCase() !== editItem.productId) {
        updates.productId = form.productId.trim().toUpperCase();
      }
      await updateInventoryItem(editItem.id, updates);
    }

    setEditItem(null);
  };

  // ── export ──
  const handleExport = () => {
    if (inventory.length === 0) { alert('No products to export.'); return; }
    exportInventory(inventory);
  };

  // ── file picked → parse & show preview ──
  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-picked
    setImportMsg('');
    setImporting(true);
    try {
      const result = await parseImportFile(file, inventory);
      setImportPreview(result);
    } catch (err) {
      setImportMsg('❌ ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── confirm import ──
  const confirmImport = async () => {
    if (!importPreview) return;
    const { toUpdate, toAdd } = importPreview;
    setImporting(true);
    setImportMsg('');
    try {
      // Updates
      for (const { firestoreId, updates } of toUpdate) {
        await updateInventoryItem(firestoreId, updates);
      }
      // Adds — use productId from file as the Firestore doc ID so it stays unique
      for (const item of toAdd) {
        const { productId, ...rest } = item;
        await setDoc(doc(db, 'inventory', productId), { productId, ...rest });
      }
      setImportMsg(`✅ Done! ${toUpdate.length} updated · ${toAdd.length} added`);
      setImportPreview(null);
    } catch (err) {
      setImportMsg('❌ Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => { setImportPreview(null); setImportMsg(''); };

  return (
    <>
      <Header backHref="/" title="📦 Inventory" />
      <main className="wrap">

        {/* ── Export / Import toolbar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Export */}
          <button
            onClick={handleExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#2F5233', color: '#fff', border: 'none',
              borderRadius: 9, padding: '10px 18px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer', minHeight: 44,
            }}>
            ⬇️ Export Excel
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0056b3', color: '#fff', border: 'none',
              borderRadius: 9, padding: '10px 18px', fontSize: 13,
              fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer',
              minHeight: 44, opacity: importing ? 0.6 : 1,
            }}>
            {importing ? '⏳ Reading…' : '⬆️ Import Excel'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFilePicked}
          />

          {importMsg && (
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: importMsg.startsWith('✅') ? 'var(--primary-dark)' : 'var(--danger)',
            }}>
              {importMsg}
            </span>
          )}
        </div>

        {/* ── Import preview / confirm ── */}
        {importPreview && (
          <div style={{
            background: 'var(--card)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: '16px 18px', marginBottom: 18,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              📋 Import Preview
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>
                🔄 <b>{importPreview.toUpdate.length}</b> products will be <b>updated</b>
              </span>
              <span style={{ fontSize: 13 }}>
                ➕ <b>{importPreview.toAdd.length}</b> products will be <b>added</b>
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink3)' }}>
                ⏭ {importPreview.skipped} rows skipped (blank / headers)
              </span>
            </div>

            {/* show first 8 rows of each bucket as a sample */}
            {importPreview.toUpdate.length > 0 && (
              <details style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--ink3)' }}>
                  Show updates ({importPreview.toUpdate.length})
                </summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {importPreview.toUpdate.slice(0, 8).map(({ productId, updates }) => (
                    <div key={productId} style={{
                      fontSize: 12, background: 'var(--paper)',
                      borderRadius: 6, padding: '4px 10px',
                      display: 'flex', gap: 10, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{productId}</span>
                      <span>{updates.name}</span>
                      {updates.price != null && <span>₹{Number(updates.price).toFixed(2)}</span>}
                      <span style={{ color: 'var(--ink3)' }}>{updates.unit}</span>
                    </div>
                  ))}
                  {importPreview.toUpdate.length > 8 && (
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                      … and {importPreview.toUpdate.length - 8} more
                    </div>
                  )}
                </div>
              </details>
            )}

            {importPreview.toAdd.length > 0 && (
              <details style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--ink3)' }}>
                  Show new products ({importPreview.toAdd.length})
                </summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {importPreview.toAdd.slice(0, 8).map((item) => (
                    <div key={item.productId} style={{
                      fontSize: 12, background: '#E8F0E6',
                      borderRadius: 6, padding: '4px 10px',
                      display: 'flex', gap: 10, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{item.productId}</span>
                      <span>{item.name}</span>
                      {item.price != null && <span>₹{Number(item.price).toFixed(2)}</span>}
                      <span style={{ color: 'var(--ink3)' }}>{item.unit}</span>
                    </div>
                  ))}
                  {importPreview.toAdd.length > 8 && (
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                      … and {importPreview.toAdd.length - 8} more
                    </div>
                  )}
                </div>
              </details>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={confirmImport}
                disabled={importing}
                style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 22px', fontSize: 13,
                  fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer',
                  opacity: importing ? 0.6 : 1,
                }}>
                {importing ? '⏳ Saving…' : '✅ Confirm Import'}
              </button>
              <button
                onClick={cancelImport}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '9px 18px', fontSize: 13,
                  fontWeight: 600, color: 'var(--ink3)', cursor: 'pointer',
                }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        <div className="search-wrap">
          <div className="search-row" style={{ minHeight: 48 }}>
            <span style={{ fontSize: 17 }}>🔍</span>
            <input
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            )}
          </div>
        </div>

        {/* ── Add form ── */}
        <div className="inv-add-grid">
          <input placeholder="English name (e.g. Tomato)"     value={form.name}    onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="தமிழ் பெயர் (optional)"         value={form.altName} onChange={(e) => setForm({ ...form, altName: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="pcs">PCS</option>
            <option value="kg">KG</option>
            <option value="both">BOTH</option>
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ gridColumn: '1 / -1' }}>
            {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="add-row">
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleAdd}>+ Add Product</button>
        </div>

        {/* ── Sort bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
            {filtered.length}{search ? ` of ${inventory.length}` : ''} items · Sort:
          </span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--card)', overflow: 'hidden' }}>
            {[['id', '#ID'], ['az', 'A–Z'], ['price-asc', '₹↑'], ['price-desc', '₹↓']].map(([m, l]) => (
              <button key={m} onClick={() => setSortMode(m)} style={{
                border: 'none', padding: '6px 13px', fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                background: sortMode === m ? 'var(--primary)' : 'transparent',
                color: sortMode === m ? '#fff' : 'var(--ink3)',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── Product list ── */}
        {filtered.length === 0 ? (
          <div className="empty-box">No products found.</div>
        ) : (
          <div className="inv-list">
            {filtered.map((p) => {
              const cat = STORE_CATEGORIES.find((c) => c.id === getProductCategory(p));
              return (
                <div key={p.id} className="inv-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {p.productId && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px' }}>
                          #{p.productId}
                        </span>
                      )}
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.price
                        ? <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>₹{Number(p.price).toFixed(2)}</span>
                        : <span style={{ color: 'var(--ink3)', fontSize: 11 }}>No price</span>
                      }
                      <span style={{ background: '#E8F0E6', color: 'var(--primary-dark)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{p.unit || 'both'}</span>
                      {cat && (
                        <span style={{ background: '#F1F0E4', color: 'var(--ink2)', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {cat.icon} {cat.label}
                        </span>
                      )}
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

      {/* ── Edit Modal ── */}
      {editItem && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}>
          <div className="modal-box">
            <div className="modal-head">
              <h3 style={{ margin: 0, fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700 }}>✎ Edit Product</h3>
              <button className="drawer-close" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                ['productId', 'Product ID',      'e.g. PC001'],
                ['name',      'Name (English)',   'e.g. Tomato'],
                ['altName',   'Tamil name',       'e.g. தக்காளி'],
                ['price',     'Price ₹',          'e.g. 50'],
              ].map(([k, l, ph]) => (
                <div key={k} className="modal-field">
                  <label>{l}</label>
                  <input
                    type="text"
                    inputMode={k === 'price' ? 'decimal' : 'text'}
                    placeholder={ph}
                    value={form[k] || ''}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
              <div className="modal-field">
                <label>Unit</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="pcs">PCS</option>
                  <option value="kg">KG</option>
                  <option value="both">BOTH</option>
                </select>
              </div>
              <div className="modal-field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {STORE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
                {/* Show current product ID + preview of new ID if category changes */}
                {(() => {
                  const oldCat = getProductCategory(editItem);
                  const newCat = form.category && form.category !== 'auto' ? form.category : oldCat;
                  const changing = newCat !== oldCat;
                  const allIds = inventory
                    .filter((p) => p.id !== editItem?.id)
                    .map((p) => p.productId).filter(Boolean);
                  const previewId = changing ? generateProductId(newCat, allIds) : null;
                  return (
                    <div style={{ marginTop: 6, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ color: 'var(--ink3)' }}>
                        Current ID: <b style={{ fontFamily: 'monospace' }}>#{editItem?.productId || '—'}</b>
                      </span>
                      {changing && previewId && (
                        <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                          → New ID: <span style={{ fontFamily: 'monospace' }}>#{previewId}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-save"   onClick={handleSave}>
                {editItem && getProductCategory(editItem) !== (form.category && form.category !== 'auto' ? form.category : getProductCategory(editItem))
                  ? '🔄 Change Category & Save'
                  : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
