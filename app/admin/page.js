'use client';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
import { deleteDoc, doc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminPage() {
  const { inventory, bills, todaySales, deleteSale, deleteInventoryItem } = useStore();
  const totalRevenue = bills.reduce((s, b) => s + (b.total || 0), 0);

  const deleteAllInventory = async () => {
    if (!confirm(`Delete ALL ${inventory.length} products? Cannot be undone.`)) return;
    if (!confirm('Final confirm — delete every product?')) return;
    for (const p of inventory) await deleteInventoryItem(p.id);
  };

  return (
    <>
      <Header backHref="/" title="🛡 Admin" />
      <main className="wrap">
        {/* stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
          {[
            ['Inventory Items', inventory.length],
            ['Total Sales', bills.length],
            ["Today's Sales", money(todaySales())],
            ['Revenue', money(totalRevenue)]
          ].map(([l, v]) => (
            <div key={l} className="bill-card">
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-dark)', marginTop: 8 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* overview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Inventory</span>
              <button onClick={deleteAllInventory}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑 Delete All
              </button>
            </div>
            <div className="inv-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {inventory.length === 0 ? <div className="empty-box">No products.</div> :
                inventory.map((p) => (
                  <div key={p.id} className="inv-row">
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.price && <span style={{ background: 'var(--primary)', color: '#fff', padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600, marginLeft: 6 }}>₹{Number(p.price).toFixed(2)}</span>}
                    </div>
                    <button className="icon-btn" onClick={() => { if (confirm('Delete?')) deleteInventoryItem(p.id); }}>🗑</button>
                  </div>
                ))
              }
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Sales</div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {bills.length === 0 ? <div className="empty-box">No sales.</div> :
                bills.map((b) => (
                  <div key={b.id} className="bill-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(b.timestamp).toLocaleString()}</div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>{money(b.total)}</span>
                        <button className="icon-btn" onClick={() => { if (confirm('Delete this sale permanently?')) deleteSale(b.id); }}>🗑</button>
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{(b.items||[]).length} items</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
