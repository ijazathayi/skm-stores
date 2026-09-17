'use client';
import { useState } from 'react';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
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
  const [selectedBill, setSelectedBill] = useState(null);

  const printBillBluetooth = async (bill) => {
    if (!supportsBluetoothPrinting()) {
      alert(isTa ? 'இந்த உலாவியில் Bluetooth அச்சிடுதல் இல்லை.' : 'Bluetooth printing is not supported in this browser.');
      return;
    }
    try {
      await printReceiptBluetooth(bill, storeProfile, { lang });
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
                    <div
                      key={b.id}
                      className="bill-card"
                      style={{ marginLeft: 4, width: 'calc(100% - 4px)', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setSelectedBill(b)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedBill(b);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {b.billNo && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink3)', fontWeight: 500 }}>
                              #{b.billNo}
                            </span>
                          )}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(event) => event.stopPropagation()}>
                          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--primary-dark)' }}>
                            {money(b.total)}
                          </span>
                          <button className="icon-btn" title={isTa ? 'Bluetooth மூலம் அச்சிடு' : 'Print via Bluetooth'} onClick={() => printBillBluetooth(b)}>📡</button>
                          <button className="icon-btn" title={isTa ? 'ரசீதைத் திருத்து' : 'Edit bill'} onClick={() => startEdit(b)}>✏️</button>
                          {role === 'admin' && <button className="icon-btn" title="Delete sale" onClick={() => { if (window.confirm('Delete this sale permanently?')) deleteSale(b.id); }}>🗑</button>}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                        {(b.items || []).length} {isTa ? 'பொருட்கள்' : 'items'}
                      </div>
                      <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--primary-dark)', fontWeight: 600 }}>
                        {isTa ? 'முழு ரசீதைப் பார்க்க தட்டவும்' : 'Click to view full sale'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </main>
      {selectedBill && (
        <div className="drawer-overlay" onClick={() => setSelectedBill(null)}>
          <div className="bill-card" style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, calc(100% - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', zIndex: 20, margin: 0 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{isTa ? 'விற்பனை விவரங்கள்' : 'Sale details'}</div>
                <div style={{ color: 'var(--ink3)', fontSize: 13, marginTop: 3 }}>
                  {new Date(selectedBill.timestamp).toLocaleString(isTa ? 'ta-IN' : 'en-GB')} · #{selectedBill.billNo}
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedBill(null)}>✕</button>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 390 }}>
                <thead>
                  <tr style={{ background: 'var(--paper)', color: 'var(--ink3)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 7px' }}>#</th>
                    <th style={{ padding: '8px 7px' }}>{isTa ? 'பொருள்' : 'Item'}</th>
                    <th style={{ padding: '8px 7px', textAlign: 'right' }}>{isTa ? 'அளவு' : 'Qty'}</th>
                    <th style={{ padding: '8px 7px', textAlign: 'right' }}>{isTa ? 'தொகை' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBill.items || []).map((item, index) => (
                    <tr key={`${item.name}-${index}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 7px', color: 'var(--ink3)' }}>{index + 1}</td>
                      <td style={{ padding: '8px 7px', fontWeight: 600 }}>{getProductName(item, lang)}</td>
                      <td style={{ padding: '8px 7px', textAlign: 'right', whiteSpace: 'nowrap' }}>{item.qty} {item.unit === 'kg' ? 'kg' : 'pc'}</td>
                      <td style={{ padding: '8px 7px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money((Number(item.qty) || 0) * (Number(item.price) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
              <span>{isTa ? 'மொத்தம்' : 'Total'}</span>
              <span style={{ color: 'var(--primary-dark)' }}>{money(selectedBill.total)}</span>
            </div>
            <button className="btn-primary" onClick={() => printBillBluetooth(selectedBill)}>
              📡 {isTa ? 'Bluetooth மூலம் அச்சிடு' : 'Bluetooth print'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
