'use client';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
import { useRouter } from 'next/navigation';

export default function CartDrawer({ open, onClose, onComplete }) {
  const { cart, removeFromCart, updateCartItem, clearCart, completeSale, isSubmittingSale, cartTotal } = useStore();

  const handleComplete = async () => {
    try {
      const bill = await completeSale();
      if (bill) onComplete(bill);
    } catch (e) {
      alert(e.message);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="cart-drawer">
        {/* head */}
        <div className="drawer-head">
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            🛒 Current Bill
            {cart.length > 0 && (
              <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>
                {cart.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {cart.length > 0 && (
              <button onClick={() => { if (confirm('Clear all items?')) clearCart(); }}
                style={{ background: 'transparent', border: 'none', fontSize: 13, color: 'var(--danger)', cursor: 'pointer', padding: '8px 4px' }}>
                Clear all
              </button>
            )}
            <button className="drawer-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* body */}
        <div className="drawer-body">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
              <div style={{ color: 'var(--ink3)', fontSize: 15 }}>Cart is empty.<br />Search and tap a product to add.</div>
            </div>
          ) : cart.map((c, i) => {
            const isKg = c.unit === 'kg';
            const kgQty = isKg && Number(c.price) > 0 && Number(c.budget) > 0
              ? String(Math.max(Number(c.budget) / Number(c.price), 0).toFixed(3))
              : (c.qty ? String(c.qty) : '');
            const qtyDisplay = isKg ? kgQty : (c.qty || '');
            const lineAmt = (Number(qtyDisplay) || 0) * (Number(c.price) || 0);

            return (
              <div key={i} className="cart-item">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-dark)', background: '#E8F0E6', borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap' }}>{c.unit}</span>
                  </div>
                  <button className="cart-item-delete" onClick={() => removeFromCart(i)}>✕</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <div className="qty-stepper">
                    <button onClick={() => {
                      if (!isKg && (Number(c.qty) || 0) <= 1) { removeFromCart(i); return; }
                      updateCartItem(i, 'qty', String(Math.max((Number(c.qty) || 0) - 1, 0)));
                    }} style={{ opacity: !isKg && (Number(c.qty) || 0) <= 1 ? .35 : 1 }}>−</button>
                    <input type="text" inputMode="decimal" value={qtyDisplay} placeholder="0"
                      onChange={(e) => updateCartItem(i, 'qty', e.target.value)} />
                    <button onClick={() => !isKg && updateCartItem(i, 'qty', String((Number(c.qty) || 0) + 1))}>+</button>
                  </div>

                  {c.unit === 'both' && (
                    <select value={c.unit} onChange={(e) => updateCartItem(i, 'unit', e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--paper)', fontSize: 14, fontWeight: 600, padding: '0 8px', color: 'var(--ink)', width: 'auto', minWidth: 58, height: 44 }}>
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                    </select>
                  )}

                  <div className="cart-price-wrap">
                    <span style={{ fontSize: 14, color: 'var(--ink3)', flexShrink: 0 }}>₹</span>
                    <input type="text" inputMode="decimal" placeholder="price" value={c.price}
                      onChange={(e) => updateCartItem(i, 'price', e.target.value)} />
                  </div>
                  <span style={{ fontFamily: "'SFMono-Regular',Consolas,monospace", fontSize: 15, fontWeight: 700, color: 'var(--primary-dark)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {money(lineAmt)}
                  </span>
                </div>

                {isKg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>Customer ₹</span>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--paper)', padding: '0 10px', height: 40, flex: 1, maxWidth: 140 }}>
                      <input type="text" inputMode="decimal" placeholder="e.g. 30" value={c.budget || ''}
                        onChange={(e) => updateCartItem(i, 'budget', e.target.value)}
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 15, color: 'var(--ink)', padding: 0, height: 40 }} />
                    </div>
                    {Number(qtyDisplay) > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--primary-dark)', fontWeight: 600, background: '#E8F0E6', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                        ≈ {(Number(qtyDisplay) * 1000).toFixed(0)} g
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* foot */}
        <div className="drawer-foot">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: "'SFMono-Regular',Consolas,monospace", fontSize: 26, fontWeight: 700, color: 'var(--primary-dark)' }}>
              {money(cartTotal())}
            </span>
          </div>
          <button className="btn-primary" style={{ width: '100%' }}
            onClick={handleComplete}
            disabled={cart.length === 0 || isSubmittingSale}>
            {isSubmittingSale ? 'Saving…' : 'Complete sale'}
          </button>
        </div>
      </div>
    </>
  );
}
