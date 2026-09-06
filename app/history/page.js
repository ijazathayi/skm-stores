'use client';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';

/* Group bills array into { "Sunday, 6 Sep 2026": [bill, …], … } */
function groupByDate(bills) {
  const groups = {};
  bills.forEach((b) => {
    const label = new Date(b.timestamp).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!groups[label]) groups[label] = [];
    groups[label].push(b);
  });
  return groups; // keys are already in desc order because bills arrive desc from Firestore
}

export default function HistoryPage() {
  const { bills, todaySales } = useStore();

  const printBill = (b) => {
    const area = document.getElementById('printAreaHistory');
    if (!area) return;
    area.innerHTML = `
      <div class="pr-center pr-title">SKM STORES</div>
      <div class="pr-center" style="font-size:10px;font-weight:700;margin-bottom:4px;">RETAIL INVOICE</div>
      <div class="pr-meta"><div>BILL NO - ${b.billNo || ''}</div><div>DATE - ${new Date(b.timestamp).toLocaleDateString('en-GB')}</div><div>TIME - ${new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
      <div class="pr-line"></div>
      <div class="pr-row pr-table-head" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;"><span>#</span><span>ITEM</span><span style="text-align:center">Q</span><span style="text-align:right">RATE</span><span style="text-align:right">TOTAL</span></div>
      <div class="pr-line"></div>
      ${(b.items || []).map((it, idx) => `<div class="pr-row pr-item" style="grid-template-columns:5% 40% 6% 21% 22%;column-gap:2px;margin-top:2px;"><span>${idx + 1}</span><span>${it.name}</span><span style="text-align:center">${it.qty}</span><span style="text-align:right">₹${Number(it.price).toFixed(2)}</span><span style="text-align:right">₹${(it.qty * it.price).toFixed(2)}</span></div>`).join('')}
      <div class="pr-line"></div>
      <div class="pr-row pr-total" style="grid-template-columns:1fr auto;"><span>GRAND TOTAL</span><span>₹${b.total.toFixed(2)}</span></div>
      <div class="pr-line"></div>
      <div class="pr-center pr-thanks">THANK YOU VISIT AGAIN</div>
    `;
    setTimeout(() => window.print(), 80);
  };

  const grouped = groupByDate(bills);

  return (
    <>
      <Header backHref="/" title="📊 Sales" />
      <main className="wrap">
        {bills.length === 0 ? (
          <div className="empty-box">No sales recorded yet.</div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 14 }}>
              {bills.length} bills recorded · Today&apos;s sales {money(todaySales())}
            </div>

            {Object.entries(grouped).map(([dateLabel, dayBills]) => {
              const dayTotal = dayBills.reduce((s, b) => s + (b.total || 0), 0);
              return (
                <div key={dateLabel} style={{ marginBottom: 24 }}>
                  {/* ── Date header ── */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', borderRadius: 8, marginBottom: 8,
                    background: 'var(--primary)', color: '#fff',
                    flexWrap: 'wrap', gap: 6,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>📅 {dateLabel}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
                      {dayBills.length} bill{dayBills.length !== 1 ? 's' : ''} · {money(dayTotal)}
                    </span>
                  </div>

                  {/* ── Bills for this day ── */}
                  {dayBills.map((b) => (
                    <div key={b.id} className="bill-card" style={{ marginLeft: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {b.billNo && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink3)', fontWeight: 500 }}>
                              #{b.billNo}
                            </span>
                          )}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--primary-dark)' }}>
                            {money(b.total)}
                          </span>
                          <button className="icon-btn" onClick={() => printBill(b)}>🖨</button>
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                        {(b.items || []).length} items
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--ink2)' }}>
                        {(b.items || []).map((it, i) => (
                          <span key={i}>{it.name} × {it.qty} @ {money(it.price)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </main>
      <div id="printAreaHistory" style={{ display: 'none' }} />
    </>
  );
}
