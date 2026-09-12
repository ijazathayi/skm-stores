'use client';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
import { printReceipt } from '@/lib/printReceipt';
import { getProductName } from '@/lib/translations';
import { useAuth } from '@/components/AuthProvider';
import { printReceiptBluetooth, supportsBluetoothPrinting } from '@/lib/bluetoothPrinter';

/* Group bills array into { "Sunday, 6 Sep 2026": [bill, …], … } */
function groupByDate(bills, isTa) {
  const groups = {};
  bills.forEach((b) => {
    const label = new Date(b.timestamp).toLocaleDateString(isTa ? 'ta-IN' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!groups[label]) groups[label] = [];
    groups[label].push(b);
  });
  return groups; // keys are already in desc order because bills arrive desc from Firestore
}

export default function HistoryPage() {
  const { bills, todaySales, storeProfile, lang, editBill, deleteSale } = useStore();
  const { role } = useAuth();
  const router = useRouter();
  const isTa = lang === 'ta';

  const printBill = (b) => {
    if (typeof window !== 'undefined') {
      printReceipt(b, storeProfile, { lang });
    }
  };

  const printBillBluetooth = async (bill) => {
    if (!supportsBluetoothPrinting()) {
      alert(isTa ? 'இந்த உலாவியில் Bluetooth அச்சிடுதல் இல்லை.' : 'Bluetooth printing is not supported in this browser.');
      return;
    }
    try {
      await printReceiptBluetooth(bill, storeProfile);
    } catch (error) {
      if (error.name !== 'NotFoundError') {
        alert(isTa ? `Bluetooth அச்சிடுதல் தோல்வி: ${error.message}` : `Bluetooth printing failed: ${error.message}`);
      }
    }
  };

  const startEdit = (bill) => {
    if (typeof window !== 'undefined' && !window.confirm(isTa ? `ரசீது #${bill.billNo} ஐ திருத்த வேண்டுமா?` : `Edit bill #${bill.billNo}?`)) return;
    editBill(bill);
    router.push('/bill');
  };

  const grouped = groupByDate(bills, isTa);

  return (
    <>
      <Header backHref="/" title={isTa ? '📊 விற்பனை வரலாறு' : '📊 Sales'} />
      <main className="wrap">
        {bills.length === 0 ? (
          <div className="empty-box">{isTa ? 'விற்பனை பதிவுகள் எதுவும் இல்லை.' : 'No sales recorded yet.'}</div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 14 }}>
              {bills.length} {isTa ? 'ரசீதுகள் பதிவு செய்யப்பட்டுள்ளது' : 'bills recorded'} · {isTa ? 'இன்றைய விற்பனை' : "Today's sales"} {money(todaySales())}
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
                      {dayBills.length} {isTa ? 'ரசீதுகள்' : `bill${dayBills.length !== 1 ? 's' : ''}`} · {money(dayTotal)}
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
                          <button className="icon-btn" title={isTa ? 'Bluetooth மூலம் அச்சிடு' : 'Print via Bluetooth'} onClick={() => printBillBluetooth(b)}>📡</button>
                          <button className="icon-btn" onClick={() => printBill(b)}>🖨</button>
                          <button className="icon-btn" title={isTa ? 'ரசீதைத் திருத்து' : 'Edit bill'} onClick={() => startEdit(b)}>✏️</button>
                          {role === 'admin' && <button className="icon-btn" title="Delete sale" onClick={() => { if (window.confirm('Delete this sale permanently?')) deleteSale(b.id); }}>🗑</button>}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                        {(b.items || []).length} {isTa ? 'பொருட்கள்' : 'items'}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--ink2)' }}>
                        {(b.items || []).map((it, i) => (
                          <span key={i}>{getProductName(it, lang)} × {it.qty} @ {money(it.price)}</span>
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
    </>
  );
}
