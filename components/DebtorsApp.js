'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  collection, onSnapshot, addDoc, doc, deleteDoc, query, orderBy, writeBatch, getDocs, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStore } from '@/lib/store';

/* ── helpers ── */
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return d;
  }
};
const initials = (name) =>
  name ? name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
function escapeHtml(s) {
  return String(s == null ? '' : s);
}
function mobileLabel(mobile) {
  return String(mobile || '').trim() || 'Mobile number not registered';
}

export default function DebtorsApp() {
  const { lang } = useStore();
  const isTa = lang === 'ta';
  const [customers, setCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Customer form
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  // Debt form
  const [debtProduct, setDebtProduct] = useState('');
  const [debtQty, setDebtQty] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDate, setDebtDate] = useState(today());
  const [debtNote, setDebtNote] = useState('');
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payNote, setPayNote] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Firestore Realtime Listeners
  useEffect(() => {
    const unsubCust = onSnapshot(
      query(collection(db, 'debtors_customers'), orderBy('name', 'asc')),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCustomers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching debtors customers:', err);
        setLoading(false);
      }
    );

    const unsubEntries = onSnapshot(
      collection(db, 'debtors_entries'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEntries(list);
      },
      (err) => {
        console.error('Error fetching debtors entries:', err);
      }
    );

    return () => {
      unsubCust();
      unsubEntries();
    };
  }, []);

  // Compute stats
  const totalDebt = entries.filter((e) => e.kind === 'debt').reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const totalPaid = entries.filter((e) => e.kind === 'payment').reduce((t, e) => t + (Number(e.amount) || 0), 0);

  const getCustomerEntries = useCallback((cId) => {
    return entries
      .filter((e) => e.customerId === cId)
      .sort((a, b) => {
        const da = (a.date || '') + (a.timestamp || a.id);
        const db = (b.date || '') + (b.timestamp || b.id);
        return da.localeCompare(db);
      });
  }, [entries]);

  const getCustomerBalance = useCallback((cId) => {
    const cEntries = entries.filter((e) => e.customerId === cId);
    return cEntries.reduce((t, e) => t + (e.kind === 'debt' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0)), 0);
  }, [entries]);

  const balances = customers.map((c) => ({ c, bal: getCustomerBalance(c.id) }));
  const statOutstanding = balances.reduce((t, b) => t + Math.max(b.bal, 0), 0);
  const statOpen = balances.filter((b) => b.bal > 0).length;

  const q = searchQuery.trim().toLowerCase();
  const filteredList = balances
    .filter(({ c }) => !q || (c.name || '').toLowerCase().includes(q) || (c.mobile || '').includes(q))
    .sort((a, b) => b.bal - a.bal || (a.c.name || '').localeCompare(b.c.name || ''));

  const currentCustomer = customers.find((c) => c.id === selectedId) || null;

  /* ── Customer CRUD ── */
  async function registerCustomer(e) {
    e.preventDefault();
    const name = custName.trim();
    const mobile = custMobile.trim();
    if (!name || isSubmittingCust) return;

    try {
      setIsSubmittingCust(true);
      const docRef = await addDoc(collection(db, 'debtors_customers'), {
        name,
        mobile,
        createdAt: new Date().toISOString()
      });
      setSelectedId(docRef.id);
      setCustName('');
      setCustMobile('');
    } catch (err) {
      alert('Error registering customer: ' + err.message);
    } finally {
      setIsSubmittingCust(false);
    }
  }

  async function deleteCustomer() {
    if (!selectedId || !currentCustomer) return;
    if (!confirm(isTa ? `"${currentCustomer.name}" மற்றும் அவரது அனைத்து கடன் கணக்குகளையும் நீக்கவா?` : `Delete "${currentCustomer.name}" and all their debt/payment entries?`)) return;

    try {
      const cId = selectedId;
      setSelectedId(null);

      // Delete customer document
      await deleteDoc(doc(db, 'debtors_customers', cId));

      // Batch delete related entries
      const entriesSnap = await getDocs(query(collection(db, 'debtors_entries'), where('customerId', '==', cId)));
      const batch = writeBatch(db);
      entriesSnap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      alert('Error deleting customer: ' + err.message);
    }
  }

  /* ── Debt / Payment CRUD ── */
  async function addDebt(e) {
    e.preventDefault();
    if (!selectedId || isSubmittingDebt) return;
    const amount = Number(debtAmount);
    if (!amount || amount <= 0) {
      alert(isTa ? 'சரியான தொகையை உள்ளிடவும்' : 'Enter valid amount');
      return;
    }

    try {
      setIsSubmittingDebt(true);
      await addDoc(collection(db, 'debtors_entries'), {
        customerId: selectedId,
        kind: 'debt',
        product: debtProduct.trim() || '',
        qty: debtQty.trim() || '',
        amount,
        date: debtDate || today(),
        note: debtNote.trim() || '',
        timestamp: new Date().toISOString()
      });
      setDebtProduct('');
      setDebtQty('');
      setDebtAmount('');
      setDebtNote('');
    } catch (err) {
      alert('Error adding debt: ' + err.message);
    } finally {
      setIsSubmittingDebt(false);
    }
  }

  async function addPayment(e) {
    e.preventDefault();
    if (!selectedId || isSubmittingPay) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      alert(isTa ? 'சரியான தொகையை உள்ளிடவும்' : 'Enter valid amount');
      return;
    }

    try {
      setIsSubmittingPay(true);
      await addDoc(collection(db, 'debtors_entries'), {
        customerId: selectedId,
        kind: 'payment',
        amount,
        date: payDate || today(),
        note: payNote.trim() || '',
        timestamp: new Date().toISOString()
      });
      setPayAmount('');
      setPayNote('');
    } catch (err) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  }

  async function deleteEntry(entryId) {
    if (!confirm(isTa ? 'இந்த பதிவை நீக்கவா?' : 'Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'debtors_entries', entryId));
    } catch (err) {
      alert('Error deleting entry: ' + err.message);
    }
  }

  /* ── WhatsApp share ── */
  function shareWhatsApp() {
    if (!currentCustomer) return;
    const bal = getCustomerBalance(currentCustomer.id);
    const text = isTa
      ? `வணக்கம் ${currentCustomer.name},\nஎஸ்.கே.எம் ஸ்டோர்ஸில் உங்கள் கடன் நிலுவை தொகை: ${money(bal)}.\nதயவுசெய்து விரைவில் செலுத்தவும். நன்றி!`
      : `Hello ${currentCustomer.name},\nYour outstanding balance at SKM Stores is ${money(bal)}.\nPlease clear it at your earliest convenience. Thank you!`;
    const cleanMobile = currentCustomer.mobile.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  /* ── Ledger calculations ── */
  const ledgerRows = currentCustomer ? getCustomerEntries(currentCustomer.id) : [];
  const customerBalance = currentCustomer ? getCustomerBalance(currentCustomer.id) : 0;

  let running = 0;
  const ledgerWithRunning = ledgerRows.map((e) => {
    running += e.kind === 'debt' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0);
    return { ...e, running };
  });

  return (
    <div style={{
      minHeight: '100dvh', background: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
      color: '#3a2415', fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>

      {/* Glow blobs */}
      <div style={{ position: 'fixed', width: 520, height: 520, right: -140, top: -140, background: 'rgba(224,163,37,.45)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 480, height: 480, left: -140, bottom: -160, background: 'rgba(226,120,110,.35)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Topbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px clamp(16px,4vw,40px)', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#c2410c,#e8b04b)',
            boxShadow: '0 10px 24px rgba(194,65,12,.3)', flexShrink: 0
          }}>
            <Image src="/skm-logo.png" alt="SKM Stores" width={44} height={44} style={{ objectFit: 'cover' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 24, lineHeight: 1 }}>
              {isTa ? 'எஸ்.கே.எம் ஸ்டோர்ஸ்' : 'SKM Stores'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8a6a4f' }}>
              {isTa ? 'கடன் புத்தகம்' : 'Debtors Book'} {loading ? '• Loading...' : '• Synced Live'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/" style={topbarBtn}>← {isTa ? 'முகப்பு' : 'Home'}</Link>
        </div>
      </header>

      <main style={{ padding: '0 clamp(16px,4vw,40px) 56px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Stats */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
          {[
            [isTa ? 'மொத்த நிலுவை' : 'Total outstanding', money(statOutstanding)],
            [isTa ? 'நிலுவை கணக்குகள்' : 'Open accounts', String(statOpen)],
            [isTa ? 'வழங்கப்பட்ட கடன்' : 'Credit given', money(totalDebt)],
            [isTa ? 'பெறப்பட்ட தொகை' : 'Repayments', money(totalPaid)],
          ].map(([label, val]) => (
            <div key={label} style={cardStyle}>
              <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>{label}</p>
              <p style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 28 }}>{val}</p>
            </div>
          ))}
        </section>

        {/* Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 18, alignItems: 'start' }}>

          {/* Left: customer list */}
          <section style={cardStyle}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', fontSize: 22 }}>
              {isTa ? 'வாடிக்கையாளர்கள்' : 'Customers'}
            </h2>
            <form onSubmit={registerCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder={isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer name'} required style={fieldStyle} />
              <input value={custMobile} onChange={(e) => setCustMobile(e.target.value)} placeholder={isTa ? 'அலைபேசி எண்' : 'Mobile number'} inputMode="tel" pattern="[0-9 +\-]{6,15}" style={fieldStyle} />
              <button type="submit" disabled={isSubmittingCust} style={{ ...brandBtn, opacity: isSubmittingCust ? 0.7 : 1 }}>
                {isSubmittingCust ? (isTa ? 'பதிவாகிறது…' : 'Registering...') : (isTa ? '+ வாடிக்கையாளரை சேர்க்க' : 'Register customer')}
              </button>
            </form>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={isTa ? 'பெயர் அல்லது அலைபேசியைத் தேடுங்கள்' : 'Search name or mobile'} style={{ ...fieldStyle, margin: '14px 0 10px', width: '100%' }} />
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {filteredList.length === 0 ? (
                <li style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>
                  {loading ? (isTa ? 'வாடிக்கையாளர் விவரங்கள் ஏற்றப்படுகிறது…' : 'Loading customers...') : (isTa ? 'வாடிக்கையாளர்கள் யாரும் இல்லை.' : 'No customers found.')}
                </li>
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
                      <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, background: 'rgba(224,163,37,.28)' }}>
                        {initials(c.name)}
                      </span>
                      <span>
                        <strong style={{ display: 'block' }}>{escapeHtml(c.name)}</strong>
                        <small style={{ display: 'block', color: '#8a6a4f' }}>{mobileLabel(c.mobile)}</small>
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
            {!currentCustomer ? (
              <p style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>Select a customer to see their ledger.</p>
            ) : (
              <>
                {/* Detail head */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 22 }}>{currentCustomer.name}</h2>
                    <p style={{ color: '#8a6a4f', margin: '2px 0 0', fontSize: 14 }}>{mobileLabel(currentCustomer.mobile)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>Balance due</p>
                    <p style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 28, color: customerBalance > 0 ? '#A8321C' : '#3f7d3f' }}>
                      {money(customerBalance)}
                    </p>
                  </div>
                </div>

                {/* Forms */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 18 }}>
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
                    <button type="submit" disabled={isSubmittingDebt} style={{ ...brandBtn, opacity: isSubmittingDebt ? 0.7 : 1 }}>
                      {isSubmittingDebt ? 'Adding...' : 'Add debt'}
                    </button>
                  </form>

                  {/* Payment form */}
                  <form onSubmit={addPayment} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Record repayment</p>
                    <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="Amount ₹" required style={fieldStyle} />
                    <input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" required style={fieldStyle} />
                    <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" style={fieldStyle} />
                    <button type="submit" disabled={isSubmittingPay} style={{ ...softStrongBtn, opacity: isSubmittingPay ? 0.7 : 1 }}>
                      {isSubmittingPay ? 'Recording...' : 'Record payment'}
                    </button>
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
                            <td style={{ ...ledgerTd, textAlign: 'right', fontWeight: 600 }}>{money(e.running)}</td>
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
const cardStyle = { background: 'rgba(255,251,244,.85)', border: '1px solid rgba(122,84,48,.18)', borderRadius: 20, padding: 20, backdropFilter: 'blur(12px)', boxShadow: '0 18px 40px rgba(122,84,48,.12)' };
const fieldStyle = { width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(122,84,48,.18)', background: 'rgba(255,255,255,.8)', fontFamily: 'inherit', fontSize: 14, color: '#3a2415', boxSizing: 'border-box' };
const brandBtn = { background: 'linear-gradient(135deg,#c2410c,#e8b04b)', color: '#fff', fontWeight: 600, borderRadius: 12, padding: '11px 14px', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, boxShadow: '0 10px 22px rgba(194,65,12,.25)' };
const softStrongBtn = { background: 'rgba(58,36,21,.9)', color: '#fff5e6', borderColor: 'transparent', fontWeight: 600, borderRadius: 12, padding: '11px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 };
const topbarBtn = { background: 'rgba(255,255,255,.72)', border: '1px solid rgba(122,84,48,.18)', color: '#3a2415', fontWeight: 600, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textDecoration: 'none', display: 'inline-block' };
const ledgerTd = { padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', whiteSpace: 'nowrap' };
