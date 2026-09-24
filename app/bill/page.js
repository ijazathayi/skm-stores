'use client';
import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import CartDrawer from '@/components/CartDrawer';
import { useStore } from '@/lib/store';
import { printReceiptBluetooth, supportsBluetoothPrinting } from '@/lib/bluetoothPrinter';
import { getProductCategory, matchesSearch, money, normalizeSearchText } from '@/lib/helpers';
import { getProductName, t } from '@/lib/translations';

export default function BillPage() {
  const { inventory, categories, vegPrices, cart, editingBill, addToCart, bills, storeProfile, lang, editBill, cartTotal } = useStore();
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
  categories.forEach((c) => { catCounts[c.id] = 0; });
  inventory.forEach((p) => { const id = getProductCategory(p, categories); catCounts[id] = (catCounts[id] || 0) + 1; });
  catCounts['VG'] = (catCounts['VG'] || 0) + vegPrices.length;

  // ── sorted inventory for current category ──
  const sortedInv = [...inventory]
    .filter((p) => getProductCategory(p, categories) === selectedCategory || selectedCategory === 'all')
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

  const handleComplete = async (bill) => {
    setLastBill(bill);
    setDrawerOpen(false);
  };

  const handleEditLastBill = () => {
    editBill(lastBill);
    setLastBill(null);
    setDrawerOpen(true);
  };

  const handleBluetoothPrint = async () => {
    if (!supportsBluetoothPrinting()) {
      alert(isTa ? 'இந்த உலாவியில் Bluetooth அச்சிடுதல் இல்லை.' : 'Bluetooth printing is not supported in this browser.');
      return;
    }
    try {
      await printReceiptBluetooth(lastBill, storeProfile, { lang });
    } catch (error) {
      if (error.name !== 'NotFoundError' && error.name !== 'NotAllowedError') {
        alert(isTa ? `Bluetooth அச்சிடுதல் தோல்வி: ${error.message}` : `Bluetooth printing failed: ${error.message}`);
      }
    }
  };

  const cat = categories.find((c) => c.id === selectedCategory);
  const catLabel = cat ? (isTa && cat.labelTa ? cat.labelTa : cat.label) : '';

  return (
    <>
      <Header
        backHref={selectedCategory === 'all' ? '/' : undefined}
        onBack={selectedCategory !== 'all' ? () => setSelectedCategory('all') : undefined}
        title={editingBill ? (isTa ? `📝 ரசீது #${editingBill.billNo} திருத்தம்` : `📝 Edit Bill #${editingBill.billNo}`) : (isTa ? '🧾 புதிய ரசீது' : '🧾 New Bill')}
      />
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
                    {isVeg && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--success)', fontWeight: 700 }}>{isTa ? 'இன்றைய விலை' : "Today's price"}</span>}
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
            {categories.map((c) => (
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
                        {isVeg && <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>{isTa ? 'இன்றைய விலை' : "Today's price"}</div>}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {inCart ? <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>✓</span>
                          : <span style={{ fontSize: 14, color: 'var(--ink3)', fontWeight: 600 }}>+</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 4, width: '100%' }}>
                      {m.price
                        ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--secondary-dark)', background: inCart ? 'var(--success-soft)' : '#FFF4D9', padding: '2px 7px', borderRadius: 5 }}>₹{Number(m.price).toFixed(0)}</span>
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
      <button className="cart-fab" onClick={() => setDrawerOpen(true)} aria-label={isTa ? 'தற்போதைய ரசீதைத் திறக்கவும்' : 'Open current bill'}>
        <span>🛒</span>
        <span className="cart-fab-label">{cart.length ? money(cartTotal()) : (isTa ? 'கூடை' : 'Cart')}</span>
        {cart.length > 0 && <span className="cart-fab-badge">{cart.length}</span>}
      </button>

      {lastBill && (
        <div className="drawer-overlay">
          <div className="bill-card" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, calc(100% - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', zIndex: 20, margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{isTa ? 'ரசீது தயார்' : 'Bill ready'}</div>
                <div style={{ color: 'var(--ink3)', fontSize: 13, marginTop: 3 }}>{isTa ? 'ரசீது எண்' : 'Bill No'}: #{lastBill.billNo}</div>
              </div>
              <button className="drawer-close" onClick={() => setLastBill(null)}>✕</button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 390 }}>
                <thead>
                  <tr style={{ background: 'var(--paper)', color: 'var(--ink3)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 7px' }}>#</th>
                    <th style={{ padding: '8px 7px' }}>{isTa ? 'பொருள்' : 'Item'}</th>
                    <th style={{ padding: '8px 7px', textAlign: 'right' }}>{isTa ? 'அளவு' : 'Qty'}</th>
                    <th style={{ padding: '8px 7px', textAlign: 'right' }}>{isTa ? 'ஒரு அலகு விலை' : 'Rate'}</th>
                    <th style={{ padding: '8px 7px', textAlign: 'right' }}>{isTa ? 'தொகை' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(lastBill.items || []).map((item, index) => {
                    const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
                    const unit = item.unit === 'kg' ? 'kg' : 'pc';
                    return (
                      <tr key={`${item.name}-${index}`} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 7px', color: 'var(--ink3)' }}>{index + 1}</td>
                        <td style={{ padding: '8px 7px', fontWeight: 600 }}>{getProductName(item, lang)}</td>
                        <td style={{ padding: '8px 7px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qty} {unit}</td>
                        <td style={{ padding: '8px 7px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(item.price)} / {unit}</td>
                        <td style={{ padding: '8px 7px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink3)', marginBottom: 5 }}>
                <span>{isTa ? 'ரவுண்டு ஆஃப்' : 'Round off'}</span>
                <span>{lastBill.roundOff > 0 ? '+' : ''}{money(lastBill.roundOff)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800 }}>
                <span>{isTa ? 'மொத்தம்' : 'Total'}</span>
                <span style={{ color: 'var(--primary-dark)' }}>{money(lastBill.total)}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn-primary" onClick={handleBluetoothPrint}>
                📡 {isTa ? 'Bluetooth மூலம் அச்சிடு' : 'Bluetooth print'}
              </button>
              <button className="btn-secondary" onClick={handleEditLastBill}>
                ✏️ {isTa ? 'ரசீதைத் திருத்து' : 'Edit bill'}
              </button>
              <button className="btn-secondary" onClick={() => setLastBill(null)}>
                {isTa ? 'முடிந்தது' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onComplete={handleComplete} />
    </>
  );
}
