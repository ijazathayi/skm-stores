'use client';
import { useState, useRef } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { STORE_CATEGORIES, getProductCategory, matchesSearch, generateProductId } from '@/lib/helpers';
import { exportInventory, parseImportFile } from '@/lib/inventoryExcel';
import { getProductName } from '@/lib/translations';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function InventoryPage() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, lang } = useStore();
  const isTa = lang === 'ta';
  const [search,   setSearch]   = useState('');
  const [sortMode, setSortMode] = useState('id');
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState({ name: '', altName: '', price: '', unit: 'both', category: 'auto' });

  const CAT_OPTIONS = [
    { value: 'auto', label: isTa ? 'தானியங்கி (Auto Detect)' : 'Auto Detect' },
    ...STORE_CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${isTa && c.labelTa ? c.labelTa : c.label}` }))
  ];

  // ── import state ──
  const fileInputRef            = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importPreview, setImportPreview] = useState(null); // { toUpdate, toAdd, skipped }

  const filtered = inventory
    .filter((p) => matchesSearch(p, search))
    .sort((a, b) => {
      if (sortMode === 'az')         return (getProductName(a, lang) || '').localeCompare(getProductName(b, lang) || '');
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
    if (!form.name.trim()) { alert(isTa ? 'பெயர் கட்டாயம்' : 'Name required'); return; }

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
    if (inventory.length === 0) { alert(isTa ? 'ஏற்றுமதி செய்ய பொருட்கள் இல்லை.' : 'No products to export.'); return; }
    exportInventory(inventory);
  };

  // ── file picked → parse & show preview ──
  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-picked

    try {
      setImporting(true);
      setImportMsg(isTa ? 'கோப்பு படிக்கப்படுகிறது…' : 'Parsing file…');
      const preview = await parseImportFile(file, inventory);
      setImportPreview(preview);
      setImportMsg('');
    } catch (err) {
      setImportMsg(isTa ? `❌ இறக்குமதி பிழை: ${err.message}` : `❌ Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // ── user confirmed import preview → apply updates ──
  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setImportMsg(isTa ? 'பொருட்கள் சேமிக்கப்படுகிறது…' : 'Saving products…');

    try {
      const operations = [
        ...importPreview.toUpdate.map((item) => ({
          type: 'update', ref: doc(db, 'inventory', item.firestoreId), data: item.updates,
        })),
        ...importPreview.toAdd.map((item) => ({
          type: 'set', ref: doc(db, 'inventory', item.productId), data: item,
        })),
      ];
      const batchSize = 500;
      const batchCount = Math.ceil(operations.length / batchSize);

      for (let start = 0; start < operations.length; start += batchSize) {
        const batch = writeBatch(db);
        const chunk = operations.slice(start, start + batchSize);
        chunk.forEach((operation) => {
          if (operation.type === 'update') batch.update(operation.ref, operation.data);
          else batch.set(operation.ref, operation.data);
        });
        const currentBatch = start / batchSize + 1;
        setImportMsg(isTa
          ? `பொருட்கள் சேமிக்கப்படுகிறது… (${currentBatch}/${batchCount})`
          : `Saving products… (${currentBatch}/${batchCount})`);
        await batch.commit();
      }

      setImportMsg(isTa ? `✓ ${operations.length} பொருட்கள் வெற்றிகரமாக இறக்குமதி செய்யப்பட்டன!` : `✓ Successfully imported ${operations.length} products!`);
      setImportPreview(null);
      setTimeout(() => setImportMsg(''), 4000);
    } catch (err) {
      setImportMsg(isTa ? `❌ சேமிப்பதில் பிழை: ${err.message}` : `❌ Failed to save: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => {
    setImportPreview(null);
    setImportMsg('');
  };

  return (
    <>
      <Header backHref="/" title={isTa ? '📦 சரக்கு இருப்பு' : '📦 Inventory'} />
      <main className="wrap">
        {/* ── Top action buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            onClick={handleExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--ink)', cursor: 'pointer',
            }}>
            📥 {isTa ? 'எக்செல் பதிவிறக்கம்' : 'Export Excel'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--ink)', cursor: importing ? 'not-allowed' : 'pointer',
            }}>
            📤 {importing ? (isTa ? 'இறக்குமதி ஆகிறது…' : 'Importing…') : (isTa ? 'எக்செல் இறக்குமதி' : 'Import Excel')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFilePicked}
          />
        </div>

        {/* ── Import message / preview ── */}
        {importMsg && (
          <div style={{
            background: importMsg.startsWith('❌') ? '#fdecea' : '#E8F0E6',
            color: importMsg.startsWith('❌') ? 'var(--danger)' : 'var(--primary-dark)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 600,
          }}>
            {importMsg}
          </div>
        )}

        {importPreview && (
          <section style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            background: '#F1F0E4', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
              <strong style={{ color: 'var(--ink)' }}>{isTa ? 'இறக்குமதிக்கு தயாராக உள்ளது' : 'Ready to import'}</strong>
              <span>{isTa
                ? `: ${importPreview.toAdd.length} புதியவை, ${importPreview.toUpdate.length} புதுப்பிப்புகள், ${importPreview.skipped} தவிர்க்கப்பட்டவை`
                : `: ${importPreview.toAdd.length} new, ${importPreview.toUpdate.length} updates, ${importPreview.skipped} skipped`}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-cancel" onClick={cancelImport}>{isTa ? 'ரத்து' : 'Cancel'}</button>
              <button className="btn-save" onClick={confirmImport}>{isTa ? 'சேமித்து இறக்குமதி செய்' : 'Save and import'}</button>
            </div>
          </section>
        )}

        {/* ── Search ── */}
        <div className="search-wrap">
          <div className="search-row" style={{ minHeight: 48 }}>
            <span style={{ fontSize: 17 }}>🔍</span>
            <input
              placeholder={isTa ? 'சரக்கு பொருட்களைத் தேடுங்கள்…' : 'Search products…'}
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
          <input placeholder={isTa ? "பெயர் (English, e.g. Tomato)" : "English name (e.g. Tomato)"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder={isTa ? "தமிழ் பெயர் (எ.கா. தக்காளி)" : "தமிழ் பெயர் (optional)"} value={form.altName} onChange={(e) => setForm({ ...form, altName: e.target.value })} />
          <input type="text" inputMode="decimal" placeholder={isTa ? "விலை ₹" : "Price ₹"} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option value="pcs">{isTa ? 'எண்ணிக்கை (PCS)' : 'PCS'}</option>
            <option value="kg">{isTa ? 'கிலோ (KG)' : 'KG'}</option>
            <option value="both">{isTa ? 'இரண்டும் (BOTH)' : 'BOTH'}</option>
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ gridColumn: '1 / -1' }}>
            {CAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="add-row">
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleAdd}>
            {isTa ? '+ பொருள் சேர்க்க' : '+ Add Product'}
          </button>
        </div>

        {/* ── Sort bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
            {filtered.length}{search ? ` / ${inventory.length}` : ''} {isTa ? 'பொருட்கள்' : 'items'} · {isTa ? 'வரிசைப்படுத்து:' : 'Sort:'}
          </span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--card)', overflow: 'hidden' }}>
            {[
              ['id', '#ID'],
              ['az', isTa ? 'அ–ஔ' : 'A–Z'],
              ['price-asc', '₹↑'],
              ['price-desc', '₹↓']
            ].map(([m, l]) => (
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
          <div className="empty-box">{isTa ? 'பொருட்கள் எதுவும் கிடைக்கவில்லை.' : 'No products found.'}</div>
        ) : (
          <div className="inv-list">
            {filtered.map((p) => {
              const cat = STORE_CATEGORIES.find((c) => c.id === getProductCategory(p));
              const displayName = getProductName(p, lang);
              return (
                <div key={p.id} className="inv-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {p.productId && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px' }}>
                          #{p.productId}
                        </span>
                      )}
                      <span style={{ fontWeight: 600 }}>{displayName}</span>
                      {displayName !== p.name && (
                        <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 400 }}>({p.name})</span>
                      )}
                      {p.price
                        ? <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>₹{Number(p.price).toFixed(2)}</span>
                        : <span style={{ color: 'var(--ink3)', fontSize: 11 }}>{isTa ? 'விலை இல்லை' : 'No price'}</span>
                      }
                      <span style={{ background: '#E8F0E6', color: 'var(--primary-dark)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {isTa ? (p.unit === 'kg' ? 'கிலோ' : (p.unit === 'pcs' ? 'எண்ணிக்கை' : 'இரண்டும்')) : (p.unit || 'both')}
                      </span>
                      {cat && (
                        <span style={{ background: '#F1F0E4', color: 'var(--ink2)', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {cat.icon} {isTa && cat.labelTa ? cat.labelTa : cat.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="icon-btn" onClick={() => openEdit(p)}>✎</button>
                    <button className="icon-btn" onClick={() => { if (confirm(isTa ? 'இந்த பொருளை நீக்கவா?' : 'Delete this product?')) deleteInventoryItem(p.id); }}>🗑</button>
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
              <h3 style={{ margin: 0, fontFamily: 'Georgia,serif', fontSize: 16, fontWeight: 700 }}>
                {isTa ? '✎ பொருளைத் திருத்துக' : '✎ Edit Product'}
              </h3>
              <button className="drawer-close" onClick={() => setEditItem(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                ['productId', isTa ? 'பொருள் எண் (ID)' : 'Product ID', 'e.g. PC001'],
                ['name',      isTa ? 'பெயர் (English)' : 'Name (English)', 'e.g. Tomato'],
                ['altName',   isTa ? 'தமிழ் பெயர்' : 'Tamil name', 'e.g. தக்காளி'],
                ['price',     isTa ? 'விலை ₹' : 'Price ₹', 'e.g. 50'],
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
                <label>{isTa ? 'அளவு முறை' : 'Unit'}</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  <option value="pcs">{isTa ? 'எண்ணிக்கை (PCS)' : 'PCS'}</option>
                  <option value="kg">{isTa ? 'கிலோ (KG)' : 'KG'}</option>
                  <option value="both">{isTa ? 'இரண்டும் (BOTH)' : 'BOTH'}</option>
                </select>
              </div>
              <div className="modal-field">
                <label>{isTa ? 'பிரிவு' : 'Category'}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {STORE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {isTa && c.labelTa ? c.labelTa : c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setEditItem(null)}>{isTa ? 'ரத்து' : 'Cancel'}</button>
              <button className="btn-save"   onClick={handleSave}>
                {isTa ? 'சேமி' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
