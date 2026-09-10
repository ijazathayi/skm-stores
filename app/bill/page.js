'use client';
import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import CartDrawer from '@/components/CartDrawer';
import { useStore } from '@/lib/store';
import { printReceipt } from '@/lib/printReceipt';
import { STORE_CATEGORIES, getProductCategory, matchesSearch, money, normalizeSearchText } from '@/lib/helpers';
import { getProductName, t } from '@/lib/translations';

export default function BillPage() {
  const { inventory, vegPrices, cart, editingBill, addToCart, bills, storeProfile, lang } = useStore();
  const isTa = lang === 'ta';
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const [sortMode, setSortMode] = useState('popular');

  useEffect(() => {
    if (editingBill) setDrawerOpen(true);
  }, [editingBill]);

  // ── sale count per product ──
  const saleCount = useCallback((name) => {
    let count = 0;
    bills.forEach((b) => {
      if ((b.items || []).some((it) => normalizeSearchText(it.name) === normalizeSearchText(name))) count++;
    });
    return count;
  }, [bills]);

  // ── category counts ──
  const catCounts = {};
  STORE_CATEGORIES.forEach((c) => { catCounts[c.id] = 0; });
  inventory.forEach((p) => { const id = getProductCategory(p); catCounts[id] = (catCounts[id] || 0) + 1; });
  catCounts['VG'] = (catCounts['VG'] || 0) + vegPrices.length;

  // ── sorted inventory for current category ──
  const sortedInv = [...inventory]
    .filter((p) => getProductCategory(p) === selectedCategory || selectedCategory === 'all')
    .sort((a, b) => {
      if (sortMode === 'az') return (getProductName(a, lang) || '').localeCompare(getProductName(b, lang) || '');
      if (sortMode === 'price') return (Number(b.price) || 0) - (Number(a.price) || 0);
      return saleCount(b.name) - saleCount(a.name);
    });

  const vegForCat = selectedCategory === 'VG' || selectedCategory === 'all' ? vegPrices : [];

  // ── search suggestions ──
  const q = normalizeSearchText(search);
  const suggestions = q
    ? inventory.filter((p) => matchesSearch(p, search) && !cart.some((c) => c._invId === p.id))
    : [];
  const vegSuggestions = q
    ? vegPrices.filter((v) => matchesSearch(v, search) && !cart.some((c) => c._vegId === v.id))
    : [];

  const handleComplete = (bill) => {
    setLastBill(bill);
    setDrawerOpen(false);
    if (typeof window !== 'undefined') {
      printReceipt(bill, storeProfile, { lang });
    }
  };

  const cat = STORE_CATEGORIES.find((c) => c.id === selectedCategory);
  const catLabel = cat ? (isTa && cat.labelTa ? cat.labelTa : cat.label) : '';

  return (
    <>
      <Header backHref="/" title={editingBill ? (isTa ? `📝 ரசீது #${editingBill.billNo} திருத்தம்` : `📝 Edit Bill #${editingBill.billNo}`) : (isTa ? '🧾 புதிய ரசீது' : '🧾 New Bill')} />
      <main className="wrap">
        {/* search */}
        <div className="search-wrap">
          <div className="search-row">
            <span style={{ fontSize: 17 }}>🔍</span>
            <input
              placeholder={isTa ? 'பொருட்களைத் தேடுங்கள்…' : 'Search products…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            )}
          </div>
          {q && (suggestions.length > 0 || vegSuggestions.length > 0) && (
            <div className="suggest-list">
              {[...suggestions, ...vegSuggestions].map((m) => {
                const isVeg = !m.productId && m.date !== undefined;
                const displayName = getProductName(m, lang);
                return (
                  <button key={m.id} className="suggest-item"
                    onClick={() => { addToCart(isVeg ? null : m.id, m.name, isVeg ? m.id : null); setSearch(''); }}>
                    <span style={{ fontWeight: 600 }}>{displayName}</span>
                    {m.price && <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--ink3)' }}>₹{Number(m.price).toFixed(2)}</span>}
                    {isVeg && <span style={{ marginLeft: 6, fontSize: 10.5, color: '#5a9a5a', fontWeight: 700 }}>{isTa ? 'இன்றைய விலை' : "Today's price"}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {q && suggestions.length === 0 && vegSuggestions.length === 0 && (
            <div className="suggest-list"><div className="no-match">{isTa ? 'பொருட்கள் எதுவும் கிடைக்கவில்லை' : 'No matching item'}</div></div>
          )}
        </div>

        {/* category view */}
        {!q && selectedCategory === 'all' && (
          <div className="cat-grid">
            {STORE_CATEGORIES.map((c) => (
              <button key={c.id} className="cat-card" onClick={() => setSelectedCategory(c.id)}>
                <span className="cat-icon">{c.icon}</span>
                <span className="cat-name">{isTa && c.labelTa ? c.labelTa : c.label}</span>
                <span className="cat-count">{catCounts[c.id] || 0} {isTa ? 'பொருட்கள்' : 'items'}</span>
              </button>
            ))}
          </div>
        )}

        {/* products in selected category */}
        {!q && selectedCategory !== 'all' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => setSelectedCategory('all')} className="tab-back-btn">
                ← {cat?.icon} {catLabel}
              </button>
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--card)', overflow: 'hidden' }}>
                {[
                  ['popular', isTa ? '🔥 அதிகம்' : '🔥 Popular'],
                  ['az', isTa ? 'அ–ஔ' : 'A–Z'],
                  ['price', '₹']
                ].map(([m, l]) => (
                  <button key={m} onClick={() => setSortMode(m)} style={{
                    border: 'none', padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: sortMode === m ? 'var(--primary)' : 'transparent',
                    color: sortMode === m ? '#fff' : 'var(--ink3)'
                  }}>{l}</button>
                ))}
              </div>
            </div>

            <div className="product-grid">
              {[...sortedInv, ...vegForCat].map((m) => {
                const isVeg = !m.productId;
                const inCart = isVeg
                  ? cart.some((c) => c._vegId === m.id)
                  : cart.some((c) => c._invId === m.id);
                const displayName = getProductName(m, lang);
                return (
                  <button key={m.id}
                    className={`product-tile${inCart ? ' in-cart' : ''}`}
                    onClick={() => addToCart(isVeg ? null : m.id, m.name, isVeg ? m.id : null)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{displayName}</div>
                        {isVeg && <div style={{ fontSize: 10, color: '#5a9a5a', fontWeight: 600 }}>{isTa ? 'இன்றைய விலை' : "Today's price"}</div>}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {inCart ? <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>✓</span>
                          : <span style={{ fontSize: 14, color: 'var(--ink3)', fontWeight: 600 }}>+</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 4, width: '100%' }}>
                      {m.price
                        ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary-dark)', background: inCart ? '#D6E8D3' : '#F1F0E4', padding: '2px 7px', borderRadius: 5 }}>₹{Number(m.price).toFixed(0)}</span>
                        : <span style={{ fontSize: 11, color: 'var(--ink3)' }}>—</span>}
                    </div>
                  </button>
                );
              })}
              {sortedInv.length === 0 && vegForCat.length === 0 && (
                <div className="empty-box" style={{ gridColumn: '1 / -1' }}>{isTa ? 'இப்பிரிவில் பொருட்கள் இல்லை.' : 'No products in this category.'}</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      <button className="cart-fab" onClick={() => setDrawerOpen(true)} aria-label="Open cart">
        🛒
        {cart.length > 0 && <span className="cart-fab-badge">{cart.length}</span>}
      </button>

      {/* Cart Drawer */}
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onComplete={handleComplete} />
    </>
  );
}
