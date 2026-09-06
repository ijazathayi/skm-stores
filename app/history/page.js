'use client';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';

export default function HistoryPage() {
  const { bills, deleteSale, todaySales } = useStore();

  const printBill = (b) => {
    const area = document.getElementById('printAreaHistory');
    if (!area) return;
    area.innerHTML = `
      <div class="pr-center pr-title">SKM STORES</div>
      <div class="pr-center" style="font-size:10px;font-weight:700;margin-bottom:4px;">RETAIL INVOICE</div>
      <div class="pr-meta"><div>BILL NO - ${b.billNo || ''}</div><div>DATE - ${new Date(b.timestamp).toLocaleDateString('en-GB')}</div><div>TIME - ${new Date(b.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
      <div class="pr-line"></div>
      <div class="pr-row pr-table-head" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;"><span>#</span><span>ITEM</span><span style="text-align:center">Q</span><span style="text-align:right">RATE</span><span style="text-align:right">TOTAL</span></div>
      <div class="pr-line"></div>
      ${(b.items||[]).map((it,idx)=>`<div class="pr-row pr-item" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;margin-top:2px;"><span>${idx+1}</span><span>${it.name}</span><span style="text-align:center">${it.qty}</span><span style="text-align:right">₹${Number(it.price).toFixed(2)}</span><span style="text-align:right">₹${(it.qty*it.price).toFixed(2)}</span></div>`).join('')}
      <div class="pr-line"></div>
      <div class="pr-row pr-total" style="grid-template-columns:1fr auto;"><span>GRAND TOTAL</span><span>₹${b.total.toFixed(2)}</span></div>
      <div class="pr-line"></div>
      <div class="pr-center pr-thanks">THANK YOU VISIT AGAIN</div>
    `;
    setTimeout(() => window.print(), 80);
  };

  return (
    <>
      <Header backHref="/" title="📊 Sales" />
      <main className="wrap">
        {bills.length === 0 ? <div className="empty-box">No sales recorded yet.</div> : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 14 }}>
              {bills.length} bills recorded · Today's sales {money(todaySales())}
            </div>
            {bills.map((b) => (
              <div key={b.id} className="bill-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(b.timestamp).toLocaleString()}</div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--primary-dark)' }}>{money(b.total)}</span>
                    <button className="icon-btn" onClick={() => printBill(b)}>🖨</button>
                    <button className="icon-btn" onClick={() => { if (confirm('Delete this sale permanently?')) deleteSale(b.id); }}>🗑</button>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{(b.items||[]).length} items</div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--ink2)' }}>
                  {(b.items||[]).map((it, i) => <span key={i}>{it.name} × {it.qty} @ {money(it.price)}</span>)}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
      <div id="printAreaHistory" style={{ display: 'none' }} />
    </>
  );
}
