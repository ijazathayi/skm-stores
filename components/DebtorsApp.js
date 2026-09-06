'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

/* ── constants ── */
const KEY = 'skm-debtors-v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
const initials = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── state helpers ── */
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { customers: raw.customers || [], entries: raw.entries || [] };
  } catch {
    return { customers: [], entries: [] };
  }
}
function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const entriesOf = (state, id) =>
  state.entries
    .filter((e) => e.customerId === id)
    .sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));

const balanceOf = (state, id) =>
  entriesOf(state, id).reduce((t, e) => t + (e.kind === 'debt' ? e.amount : -e.amount), 0);

/* ── main component ── */
export default function DebtorsApp() {
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');

  // Customer form
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');

  // Debt form
  const [debtProduct, setDebtProduct] = useState('');
  const [debtQty, setDebtQty] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDate, setDebtDate] = useState('');
  const [debtNote, setDebtNote] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payNote, setPayNote] = useState('');

  const fileRef = useRef(null);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setDebtDate(today());
    setPayDate(today());
  }, []);

  const persist = useCallback((newState) => {
    setState(newState);
    saveState(newState);
  }, []);

  if (!state) return null;

  /* ── computed values ── */
  const totalDebt = state.entries.filter((e) => e.kind === 'debt').reduce((t, e) => t + e.amount, 0);
  const totalPaid = state.entries.filter((e) => e.kind === 'payment').reduce((t, e) => t + e.amount, 0);
  const balances = state.customers.map((c) => ({ c, bal: balanceOf(state, c.id) }));
  const statOutstanding = balances.reduce((t, b) => t + Math.max(b.bal, 0), 0);
  const statOpen = balances.filter((b) => b.bal > 0).length;

  const q = query.trim().toLowerCase();
  const filteredList = balances
    .filter(({ c }) => !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q))
    .sort((a, b) => b.bal - a.bal || a.c.name.localeCompare(b.c.name));

  const customer = state.customers.find((c) => c.id === selectedId) || null;

  /* ── customer CRUD ── */
  function registerCustomer(e) {
    e.preventDefault();
    const name = custName.trim();
    const mobile = custMobile.trim();
    if (!name || !mobile) return;
    const c = { id: uid(), name, mobile, createdAt: new Date().toISOString() };
    const newState = { ...state, customers: [...state.customers, c] };
    persist(newState);
    setSelectedId(c.id);
    setCustName('');
    setCustMobile('');
  }

  function deleteCustomer() {
    if (!selectedId) return;
    if (!confirm('Delete this customer and all their entries?')) return;
    persist({
      entries: state.entries.filter((e) => e.customerId !== selectedId),
      customers: state.customers.filter((c) => c.id !== selectedId),
    });
    setSelectedId(null);
  }

  /* ── debt / payment ── */
  function addDebt(e) {
    e.preventDefault();
    if (!selectedId) return;
    persist({
      ...state,
      entries: [...state.entries, {
        id: uid(), customerId: selectedId, kind: 'debt',
        product: debtProduct.trim(),
        quantity: debtQty ? Number(debtQty) : null,
        amount: Number(debtAmount),
        note: debtNote.trim() || null,
        date: debtDate || today(),
      }],
    });
    setDebtProduct(''); setDebtQty(''); setDebtAmount(''); setDebtNote('');
    setDebtDate(today());
  }

  function addPayment(e) {
    e.preventDefault();
    if (!selectedId) return;
    persist({
      ...state,
      entries: [...state.entries, {
        id: uid(), customerId: selectedId, kind: 'payment',
        product: null, quantity: null,
        amount: Number(payAmount),
        note: payNote.trim() || null,
        date: payDate || today(),
      }],
    });
    setPayAmount(''); setPayNote('');
    setPayDate(today());
  }

  function deleteEntry(entryId) {
    persist({ ...state, entries: state.entries.filter((x) => x.id !== entryId) });
  }

  /* ── backup ── */
  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'skm-debtors-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      persist({ customers: data.customers || [], entries: data.entries || [] });
      setSelectedId(null);
    } catch {
      alert('That file could not be read.');
    }
    e.target.value = '';
  }

  /* ── ledger rows ── */
  const ledgerRows = customer ? entriesOf(state, customer.id) : [];
  const customerBalance = customer ? balanceOf(state, customer.id) : 0;

  let running = 0;
  const ledgerWithRunning = ledgerRows.map((e) => {
    running += e.kind === 'debt' ? e.amount : -e.amount;
    return { ...e, running };
  });

  /* ─────────────────── JSX ─────────────────── */
  return (
    <div style={{ minHeight: '100vh', color: '#3a2415', fontFamily: 'Figtree, system-ui, sans-serif', background: 'linear-gradient(135deg,#fbe9cf,#f6d3b4 45%,#f2b9ac)', overflowX: 'hidden' }}>

      {/* Glow blobs */}
      <div style={{ position: 'fixed', width: 520, height: 520, right: -140, top: -140, background: 'rgba(224,163,37,.45)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 480, height: 480, left: -140, bottom: -160, background: 'rgba(226,120,110,.35)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Topbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px clamp(16px,4vw,40px)', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 14, color: '#fff', fontSize: 22, fontFamily: 'Georgia, serif', background: 'linear-gradient(135deg,#c2410c,#e8b04b)', boxShadow: '0 10px 24px rgba(194,65,12,.3)' }}>S</div>
          <div>
            <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 24, lineHeight: 1 }}>SKM Stores</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8a6a4f' }}>Debtors book</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/" style={topbarBtn}>← Home</Link>
          <button onClick={exportBackup} style={topbarBtn}>Export backup</button>
          <label style={{ ...topbarBtn, cursor: 'pointer' }} htmlFor="importFileDebtors">Import backup</label>
          <input id="importFileDebtors" type="file" accept="application/json" hidden ref={fileRef} onChange={importBackup} />
        </div>
      </header>

      <main style={{ padding: '0 clamp(16px,4vw,40px) 56px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Stats */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
          {[
            ['Total outstanding', money(statOutstanding)],
            ['Open accounts', String(statOpen)],
            ['Credit given', money(totalDebt)],
            ['Repayments', money(totalPaid)],
          ].map(([label, val]) => (
            <div key={label} style={cardStyle}>
              <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>{label}</p>
              <p style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 28 }}>{val}</p>
            </div>
          ))}
        </section>

        {/* Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,360px) 1fr', gap: 18, alignItems: 'start' }}>

          {/* Left: customer list */}
          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', fontSize: 22 }}>Customers</h2>
            <form onSubmit={registerCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input className="" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name" required style={fieldStyle} />
              <input value={custMobile} onChange={(e) => setCustMobile(e.target.value)} placeholder="Mobile number" inputMode="tel" pattern="[0-9 +\-]{6,15}" required style={fieldStyle} />
              <button type="submit" style={brandBtn}>Register customer</button>
            </form>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or mobile" style={{ ...fieldStyle, margin: '14px 0 10px', width: '100%' }} />
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {filteredList.length === 0 ? (
                <li style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>No customers yet. Register one above.</li>
              ) : filteredList.map(({ c, bal }) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      background: c.id === selectedId ? 'rgba(255,244,222,.95)' : 'rgba(255,255,255,.6)',
                      border: `1px solid ${c.id === selectedId ? '#e0a325' : 'rgba(122,84,48,.18)'}`,
                      borderRadius: 12, padding: '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, background: 'rgba(224,163,37,.28)' }}>{initials(c.name)}</span>
                      <span>
                        <strong style={{ display: 'block' }}>{escapeHtml(c.name)}</strong>
                        <small style={{ display: 'block', color: '#8a6a4f' }}>{escapeHtml(c.mobile)}</small>
                      </span>
                    </span>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: bal > 0 ? '#3a2415' : '#3f7d3f' }}>
                      {bal > 0 ? money(bal) : 'Clear'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Right: detail */}
          <section style={cardStyle}>
            {!customer ? (
              <p style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>Select a customer to see their ledger.</p>
            ) : (
              <>
                {/* Detail head */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 22 }}>{customer.name}</h2>
                    <p style={{ color: '#8a6a4f', margin: '2px 0 0', fontSize: 14 }}>{customer.mobile}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>Balance due</p>
                    <p style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 28 }}>{money(customerBalance)}</p>
                  </div>
                </div>

                {/* Forms */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
                  {/* Debt form */}
                  <form onSubmit={addDebt} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Add debt / purchase</p>
                    <input value={debtProduct} onChange={(e) => setDebtProduct(e.target.value)} placeholder="Product (e.g. Rice 5kg)" required style={fieldStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                      <input value={debtQty} onChange={(e) => setDebtQty(e.target.value)} type="number" min="0" step="0.01" placeholder="Qty" style={fieldStyle} />
                      <input value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="Amount ₹" required style={fieldStyle} />
                    </div>
                    <input value={debtDate} onChange={(e) => setDebtDate(e.target.value)} type="date" required style={fieldStyle} />
                    <input value={debtNote} onChange={(e) => setDebtNote(e.target.value)} placeholder="Note (optional)" style={fieldStyle} />
                    <button type="submit" style={brandBtn}>Add debt</button>
                  </form>

                  {/* Payment form */}
                  <form onSubmit={addPayment} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Record repayment</p>
                    <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="Amount ₹" required style={fieldStyle} />
                    <input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" required style={fieldStyle} />
                    <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" style={fieldStyle} />
                    <button type="submit" style={softStrongBtn}>Record payment</button>
                  </form>
                </div>

                {/* Ledger */}
                <h3 style={{ margin: '22px 0 10px', fontFamily: 'Georgia, serif', fontSize: 18 }}>Ledger</h3>
                <div style={{ overflowX: 'auto', border: '1px solid rgba(122,84,48,.18)', borderRadius: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 520 }}>
                    <thead>
                      <tr>
                        {['Date', 'Details', 'Debt', 'Paid', 'Running', ''].map((h, i) => (
                          <th key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8a6a4f', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerWithRunning.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '26px 12px', textAlign: 'center', color: '#8a6a4f' }}>No entries yet.</td></tr>
                      ) : ledgerWithRunning.map((e) => {
                        const details = e.kind === 'debt'
                          ? `${escapeHtml(e.product || 'Purchase')}${e.quantity ? ` × ${e.quantity}` : ''}${e.note ? ` — ${escapeHtml(e.note)}` : ''}`
                          : `Repayment${e.note ? ` — ${escapeHtml(e.note)}` : ''}`;
                        return (
                          <tr key={e.id}>
                            <td style={ledgerTd}>{fmtDate(e.date)}</td>
                            <td style={{ ...ledgerTd, maxWidth: 200 }}>{details}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right' }}>{e.kind === 'debt' ? money(e.amount) : '—'}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right' }}>{e.kind === 'payment' ? money(e.amount) : '—'}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right' }}>{money(e.running)}</td>
                            <td style={ledgerTd}>
                              <button type="button" onClick={() => deleteEntry(e.id)} style={{ background: 'transparent', border: 'none', color: '#a8321c', padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button type="button" onClick={deleteCustomer} style={{ marginTop: 18, background: 'transparent', borderRadius: 12, padding: '11px 14px', border: '1px solid rgba(180,50,30,.35)', color: '#a8321c', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                  Delete customer
                </button>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ── inline styles ── */
const cardStyle = { background: 'rgba(255,251,244,.78)', border: '1px solid rgba(122,84,48,.18)', borderRadius: 20, padding: 20, backdropFilter: 'blur(12px)', boxShadow: '0 18px 40px rgba(122,84,48,.12)' };
const fieldStyle = { width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(122,84,48,.18)', background: 'rgba(255,255,255,.7)', fontFamily: 'inherit', fontSize: 14, color: '#3a2415', boxSizing: 'border-box' };
const brandBtn = { background: 'linear-gradient(135deg,#c2410c,#e8b04b)', color: '#fff', fontWeight: 600, borderRadius: 12, padding: '11px 14px', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, boxShadow: '0 10px 22px rgba(194,65,12,.25)' };
const softStrongBtn = { background: 'rgba(58,36,21,.9)', color: '#fff5e6', borderColor: 'transparent', fontWeight: 600, borderRadius: 12, padding: '11px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 };
const topbarBtn = { background: 'rgba(255,255,255,.72)', border: '1px solid rgba(122,84,48,.18)', color: '#3a2415', fontWeight: 600, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textDecoration: 'none', display: 'inline-block' };
const ledgerTd = { padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', whiteSpace: 'nowrap' };
