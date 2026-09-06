'use client';
import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import CartDrawer from '@/components/CartDrawer';
import { useStore } from '@/lib/store';
import { STORE_CATEGORIES, getProductCategory, matchesSearch, money, normalizeSearchText } from '@/lib/helpers';

export default function BillPage() {
  const { inventory, vegPrices, cart, addToCart, bills } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const [sortMode, setSortMode] = useState('popular');

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
      if (sortMode === 'az') return (a.name || '').localeCompare(b.name || '');
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
    if (typeof window !== 'undefined') printReceipt(bill);
  };

  const printReceipt = (bill) => {
    const area = document.getElementById('printArea');
    if (!area) return;
    area.innerHTML = `
      <div class="pr-center"><img src="/skm-logo.png" class="pr-logo" alt="SKM" /></div>
      <div class="pr-center pr-title" style="margin-bottom:2px;">SKM STORES</div>
      <div class="pr-center" style="font-size:10px;font-weight:700;margin-bottom:4px;">RETAIL INVOICE</div>
      <div class="pr-meta" style="margin-bottom:2px;">
        <div><span style="font-weight:700;">BILL NO - ${bill.billNo}</span></div>
        <div><span style="font-weight:700;">DATE - ${new Date(bill.timestamp).toLocaleDateString('en-GB')}</span></div>
        <div><span style="font-weight:700;">TIME - ${new Date(bill.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>
      </div>
      <div class="pr-line"></div>
      <div class="pr-row pr-table-head" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;">
        <span>#</span><span>ITEM</span><span style="text-align:center">Q</span>
        <span style="text-align:right">RATE</span><span style="text-align:right">TOTAL</span>
      </div>
      <div class="pr-line"></div>
      ${bill.items.map((it, idx) => `
        <div class="pr-row pr-item" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;margin-top:2px;">
          <span>${idx+1}</span><span>${it.name}</span>
          <span style="text-align:center">${it.qty}</span>
          <span style="text-align:right">₹${Number(it.price).toFixed(2)}</span>
          <span style="text-align:right">₹${(it.qty*it.price).toFixed(2)}</span>
        </div>`).join('')}
      <div class="pr-line"></div>
      <div class="pr-row pr-total" style="grid-template-columns:1fr auto;margin-top:2px;">
        <span>GRAND TOTAL</span><span>₹${bill.total.toFixed(2)}</span>
      </div>
      <div class="pr-line"></div>
      <div class="pr-center pr-thanks" style="margin-top:6px;">THANK YOU VISIT AGAIN</div>
    `;
    setTimeout(() => window.print(), 80);
  };

  const cat = STORE_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <>
      <Header backHref="/" title="🧾 New Bill" />
      <main className="wrap">
        {/* search */}
        <div className="search-wrap">
          <div className="search-row">
            <span style={{ fontSize: 17 }}>🔍</span>
            <input placeholder="Search products…" value={search}
              onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--ink3)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            )}
          </div>
          {q && (suggestions.length > 0 || vegSuggestions.length > 0) && (
            <div className="suggest-list">
              {[...suggestions, ...vegSuggestions].map((m) => {
                const isVeg = !m.productId && m.date !== undefined;
                return (
                  <button key={m.id} className="suggest-item"
                    onClick={() => { addToCart(isVeg ? null : m.id, m.name, isVeg ? m.id : null); setSearch(''); }}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    {m.price && <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--ink3)' }}>₹{Number(m.price).toFixed(2)}</span>}
                    {isVeg && <span style={{ marginLeft: 6, fontSize: 10.5, color: '#5a9a5a', fontWeight: 700 }}>Today's price</span>}
                  </button>
                );
              })}
            </div>
          )}
          {q && suggestions.length === 0 && vegSuggestions.length === 0 && (
            <div className="suggest-list"><div className="no-match">No matching item</div></div>
          )}
        </div>

        {/* category view */}
        {!q && selectedCategory === 'all' && (
          <div className="cat-grid">
            {STORE_CATEGORIES.map((c) => (
              <button key={c.id} className="cat-card" onClick={() => setSelectedCategory(c.id)}>
                <span className="cat-icon">{c.icon}</span>
                <span className="cat-name">{c.label}</span>
                <span className="cat-count">{catCounts[c.id] || 0} items</span>
              </button>
            ))}
          </div>
        )}

        {/* products in selected category */}
        {!q && selectedCategory !== 'all' && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => setSelectedCategory('all')} className="tab-back-btn">
                ← {cat?.icon} {cat?.label}
              </button>
              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--card)', overflow: 'hidden' }}>
                {[['popular','🔥'],['az','A–Z'],['price','₹']].map(([m,l]) => (
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
                return (
                  <button key={m.id}
                    className={`product-tile${inCart ? ' in-cart' : ''}`}
                    onClick={() => addToCart(isVeg ? null : m.id, m.name, isVeg ? m.id : null)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{m.name}</div>
                        {isVeg && <div style={{ fontSize: 10, color: '#5a9a5a', fontWeight: 600 }}>Today's price</div>}
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
                <div className="empty-box" style={{ gridColumn: '1 / -1' }}>No products in this category.</div>
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

      {/* Print area */}
      <div id="printArea" />
    </>
  );
}
