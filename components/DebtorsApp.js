'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';

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
function hasMobile(mobile) {
  return Boolean(String(mobile || '').trim());
}

export default function DebtorsApp({ customerId = null }) {
  const { lang } = useStore();
  const { role } = useAuth();
  const isTa = lang === 'ta';
  const isAdmin = role === 'admin';
  const [customers, setCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(customerId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDialog, setActiveDialog] = useState(null);
  const [overallStartDate, setOverallStartDate] = useState('');
  const [overallEndDate, setOverallEndDate] = useState('');

  // Customer form
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerMobile, setEditCustomerMobile] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

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
  const todayEntries = entries.filter((e) => e.date === today());
  const todayDebt = todayEntries.filter((e) => e.kind === 'debt').reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const todayPaidEntries = todayEntries.filter((e) => e.kind === 'payment');
  const todayPaid = todayPaidEntries.reduce((t, e) => t + (Number(e.amount) || 0), 0);

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
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const overallLedgerRows = entries
    .filter((entry) => (!overallStartDate || entry.date >= overallStartDate) && (!overallEndDate || entry.date <= overallEndDate))
    .sort((a, b) => {
    const da = `${a.date || ''}${a.timestamp || a.id}`;
    const db = `${b.date || ''}${b.timestamp || b.id}`;
    return db.localeCompare(da);
  });
  const overallPayments = overallLedgerRows.filter((entry) => entry.kind === 'payment');
  const overallReceived = overallPayments.reduce((total, entry) => total + (Number(entry.amount) || 0), 0);

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

  function startEditingCustomer() {
    if (!currentCustomer) return;
    setEditCustomerName(currentCustomer.name || '');
    setEditCustomerMobile(currentCustomer.mobile || '');
    setIsEditingCustomer(true);
  }

  function cancelEditingCustomer() {
    setIsEditingCustomer(false);
    setEditCustomerName('');
    setEditCustomerMobile('');
  }

  async function saveCustomerDetails(e) {
    e.preventDefault();
    if (!selectedId || isSavingCustomer) return;
    const name = editCustomerName.trim();
    const mobile = editCustomerMobile.trim();
    if (!name) {
      alert(isTa ? 'வாடிக்கையாளர் பெயரை உள்ளிடவும்' : 'Enter a customer name');
      return;
    }

    try {
      setIsSavingCustomer(true);
      await updateDoc(doc(db, 'debtors_customers', selectedId), { name, mobile });
      cancelEditingCustomer();
    } catch (err) {
      alert('Error updating customer: ' + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function deleteDebtEntry(entry) {
    if (!isAdmin || !window.confirm('Delete this ledger entry permanently?')) return;
    try {
      await deleteDoc(doc(db, 'debtors_entries', entry.id));
    } catch (err) {
      alert('Error deleting ledger entry: ' + err.message);
    }
  }

  async function deleteCustomer() {
    if (!isAdmin || !currentCustomer) return;
    if (!window.confirm(`Delete ${currentCustomer.name} and all of this customer's ledger entries?`)) return;
    try {
      const customerEntries = entries.filter((entry) => entry.customerId === currentCustomer.id);
      await Promise.all(customerEntries.map((entry) => deleteDoc(doc(db, 'debtors_entries', entry.id))));
      await deleteDoc(doc(db, 'debtors_customers', currentCustomer.id));
      setSelectedId(null);
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

    const entryDate = debtDate || today();
    const isDuplicate = entries.some((entry) =>
      entry.customerId === selectedId &&
      entry.kind === 'debt' &&
      entry.date === entryDate &&
      Number(entry.amount) === amount
    );
    if (isDuplicate && !window.confirm(
      isTa
        ? `இந்த வாடிக்கையாளருக்கு ${fmtDate(entryDate)} அன்று ${money(amount)} கடன் ஏற்கனவே உள்ளது. இதையும் சேர்க்க வேண்டுமா?`
        : `A debt of ${money(amount)} already exists for this customer on ${fmtDate(entryDate)}. Add this one as well?`
    )) return;

    try {
      setIsSubmittingDebt(true);
      await addDoc(collection(db, 'debtors_entries'), {
        customerId: selectedId,
        kind: 'debt',
        product: debtProduct.trim() || '',
        qty: debtQty.trim() || '',
        amount,
        date: entryDate,
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

  function getMessageDetails() {
    if (!currentCustomer) return;
    const bal = getCustomerBalance(currentCustomer.id);
    const text = isTa
      ? `வணக்கம் ${currentCustomer.name},\nஎஸ்.கே.எம் ஸ்டோர்ஸில் உங்கள் கடன் நிலுவை தொகை: ${money(bal)}.\nதயவுசெய்து விரைவில் செலுத்தவும். நன்றி!`
      : `Hello ${currentCustomer.name},\nYour outstanding balance at SKM Stores is ${money(bal)}.\nPlease clear it at your earliest convenience. Thank you!`;
    const cleanMobile = String(currentCustomer.mobile || '').replace(/[^0-9]/g, '');
    if (!cleanMobile) {
      alert(isTa ? 'இந்த வாடிக்கையாளரின் அலைபேசி எண் பதிவு செய்யப்படவில்லை.' : 'This customer does not have a registered mobile number.');
      return null;
    }
    const mobile = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile.replace(/^0+/, '')}`;
    return { mobile, text };
  }

  function shareWhatsApp() {
    const details = getMessageDetails();
    if (!details) return;
    const url = `https://wa.me/${details.mobile}?text=${encodeURIComponent(details.text)}`;
    window.open(url, '_blank');
  }

  function sendSms() {
    const details = getMessageDetails();
    if (!details) return;
    window.open(`sms:+${details.mobile}?body=${encodeURIComponent(details.text)}`, '_self');
  }

  /* ── Ledger calculations ── */
  const ledgerRows = currentCustomer ? getCustomerEntries(currentCustomer.id) : [];
  const customerBalance = currentCustomer ? getCustomerBalance(currentCustomer.id) : 0;

  const ledgerWithRunning = ledgerRows.reduce(({ running, rows }, e) => {
    const nextRunning = running + (e.kind === 'debt' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0));
    rows.push({ ...e, running: nextRunning });
    return { running: nextRunning, rows };
  }, { running: 0, rows: [] }).rows;

  return (
    <div className="debtor-shell" style={{
      minHeight: '100dvh', background: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
      color: '#3a2415', fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>

      <div className="debtor-glow debtor-glow-top" />
      <div className="debtor-glow debtor-glow-bottom" />

      {/* Topbar */}
      <header className="debtor-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px clamp(16px,4vw,40px)', position: 'relative', zIndex: 1 }}>
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

      <main className="debtor-main" style={{ padding: '0 clamp(16px,4vw,40px) 56px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Quick access */}
        <section className="debtor-quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 18 }}>
          <button type="button" onClick={() => setActiveDialog('customer')} style={{ ...cardStyle, border: '1px solid rgba(194,65,12,.28)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>Quick action</span>
            <strong style={{ display: 'block', marginTop: 6, fontFamily: 'Georgia, serif', fontSize: 22 }}>+ Add customer</strong>
            <span style={{ display: 'block', marginTop: 5, color: '#8a6a4f', fontSize: 13 }}>Register a customer and start their ledger.</span>
          </button>
          <button type="button" onClick={() => setActiveDialog('overall')} style={{ ...cardStyle, border: '1px solid rgba(58,36,21,.28)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>Quick view</span>
            <strong style={{ display: 'block', marginTop: 6, fontFamily: 'Georgia, serif', fontSize: 22 }}>Overall ledger</strong>
            <span style={{ display: 'block', marginTop: 5, color: '#8a6a4f', fontSize: 13 }}>See every customer debt and repayment together.</span>
          </button>
        </section>

        {activeDialog === 'customer' && <div style={dialogBackdrop}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-customer-title" style={{ ...cardStyle, width: 'min(460px, 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <h2 id="add-customer-title" style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 22 }}>Add customer</h2>
              <button type="button" onClick={() => setActiveDialog(null)} style={secondaryBtn}>Close</button>
            </div>
            <form onSubmit={async (event) => { await registerCustomer(event); setActiveDialog(null); }} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input autoFocus id="debtors-customer-name" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder={isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer name'} required style={fieldStyle} />
              <input value={custMobile} onChange={(e) => setCustMobile(e.target.value)} placeholder={isTa ? 'அலைபேசி எண் (விருப்பம்)' : 'Mobile number (optional)'} inputMode="tel" pattern="[0-9 +\-]{6,15}" style={fieldStyle} />
              <button type="submit" disabled={isSubmittingCust} style={{ ...brandBtn, opacity: isSubmittingCust ? 0.7 : 1 }}>
                {isSubmittingCust ? (isTa ? 'பதிவாகிறது…' : 'Registering...') : (isTa ? '+ வாடிக்கையாளரை சேர்க்க' : 'Add customer')}
              </button>
            </form>
          </section>
        </div>}

        {/* Stats */}
        <section className="debtor-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
          {[
            [isTa ? 'மொத்த நிலுவை' : 'Total outstanding', money(statOutstanding)],
            [isTa ? 'நிலுவை கணக்குகள்' : 'Open accounts', String(statOpen)],
            [isTa ? 'வழங்கப்பட்ட கடன்' : 'Credit given', money(totalDebt)],
            [isTa ? 'பெறப்பட்ட தொகை' : 'Repayments', money(totalPaid)],
            ['Payments today', `${todayPaidEntries.length} payment${todayPaidEntries.length === 1 ? '' : 's'}`],
            ['Credit given today', money(todayDebt)],
            ['Received today', money(todayPaid)],
          ].map(([label, val]) => (
            <div key={label} style={cardStyle}>
              <p style={{ margin: 0, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: '#8a6a4f' }}>{label}</p>
              <p style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 28 }}>{val}</p>
            </div>
          ))}
        </section>

        {/* Overall ledger */}
        {activeDialog === 'overall' && <div style={dialogBackdrop}>
          <section role="dialog" aria-modal="true" aria-labelledby="overall-ledger-title" style={{ ...cardStyle, width: 'min(1100px, 100%)', maxHeight: '88dvh', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 id="overall-ledger-title" style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 22 }}>Overall ledger</h2>
              <p style={{ margin: '4px 0 12px', color: '#8a6a4f', fontSize: 13 }}>All customer credit and repayment entries together.</p>
            </div>
            <button type="button" onClick={() => setActiveDialog(null)} style={secondaryBtn}>Close</button>
            <strong style={{ color: '#8a6a4f', fontSize: 13 }}>{overallPayments.length} payments · {money(overallReceived)} received</strong>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'end', flexWrap: 'wrap', marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(255,244,222,.72)' }}>
            <label style={{ ...filterLabel, flex: '1 1 180px' }}>Starting date<input type="date" value={overallStartDate} max={overallEndDate || undefined} onChange={(event) => setOverallStartDate(event.target.value)} style={fieldStyle} /></label>
            <label style={{ ...filterLabel, flex: '1 1 180px' }}>Ending date<input type="date" value={overallEndDate} min={overallStartDate || undefined} onChange={(event) => setOverallEndDate(event.target.value)} style={fieldStyle} /></label>
            {(overallStartDate || overallEndDate) && <button type="button" onClick={() => { setOverallStartDate(''); setOverallEndDate(''); }} style={secondaryBtn}>Show all dates</button>}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(122,84,48,.18)', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 650 }}>
              <thead>
                <tr>
                  {['Date', 'Customer', 'Details', 'Credit', 'Repayment'].map((heading, index) => (
                    <th key={heading} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', textAlign: index >= 3 ? 'right' : 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8a6a4f', whiteSpace: 'nowrap' }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overallLedgerRows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '26px 12px', textAlign: 'center', color: '#8a6a4f' }}>No entries yet.</td></tr>
                ) : overallLedgerRows.map((entry) => {
                  const details = entry.kind === 'debt'
                    ? `${escapeHtml(entry.product || 'Purchase')}${entry.qty ? ` × ${entry.qty}` : ''}${entry.note ? ` — ${escapeHtml(entry.note)}` : ''}`
                    : `Repayment${entry.note ? ` — ${escapeHtml(entry.note)}` : ''}`;
                  return (
                    <tr key={entry.id}>
                      <td style={ledgerTd}>{fmtDate(entry.date)}</td>
                      <td style={ledgerTd}>{escapeHtml(customerNames.get(entry.customerId) || 'Unknown customer')}</td>
                      <td style={{ ...ledgerTd, maxWidth: 240 }}>{details}</td>
                      <td style={{ ...ledgerTd, textAlign: 'right' }}>{entry.kind === 'debt' ? money(entry.amount) : '—'}</td>
                      <td style={{ ...ledgerTd, textAlign: 'right' }}>{entry.kind === 'payment' ? money(entry.amount) : '—'}{isAdmin && <button type="button" onClick={() => deleteDebtEntry(entry)} style={{ marginLeft: 8, border: 0, background: 'transparent', color: '#A8321C', cursor: 'pointer' }} title="Delete entry">🗑</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </section>
        </div>}

        {/* Layout */}
        <div className="debtors-layout" style={{ display: 'grid', gridTemplateColumns: customerId ? 'minmax(0, 760px)' : 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', justifyContent: customerId ? 'center' : 'initial', gap: 18, alignItems: 'start' }}>

          {/* Left: customer list */}
          {!customerId && <section className="debtors-customer-list" style={cardStyle}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', fontSize: 22 }}>
              {isTa ? 'வாடிக்கையாளர்கள்' : 'Customers'}
            </h2>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={isTa ? 'பெயர் அல்லது அலைபேசியைத் தேடுங்கள்' : 'Search name or mobile'} style={{ ...fieldStyle, margin: '14px 0 10px', width: '100%' }} />
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
              {filteredList.length === 0 ? (
                <li style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>
                  {loading ? (isTa ? 'வாடிக்கையாளர் விவரங்கள் ஏற்றப்படுகிறது…' : 'Loading customers...') : (isTa ? 'வாடிக்கையாளர்கள் யாரும் இல்லை.' : 'No customers found.')}
                </li>
              ) : filteredList.map(({ c, bal }) => (
                <li key={c.id}>
                  <Link
                    href={`/debtors/${c.id}`}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      background: c.id === selectedId ? 'rgba(255,244,222,.95)' : 'rgba(255,255,255,.6)',
                      border: `1px solid ${c.id === selectedId ? '#e0a325' : 'rgba(122,84,48,.18)'}`,
                      borderRadius: 12, padding: '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', color: 'inherit',
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
                  </Link>
                </li>
              ))}
            </ul>
          </section>}

          {/* Right: detail */}
          {customerId && <section className="debtors-detail" style={cardStyle}>
            {!currentCustomer ? (
              <p style={{ color: '#8a6a4f', margin: 0, padding: '26px 0', textAlign: 'center' }}>Select a customer to see their ledger.</p>
            ) : (
              <>
                <Link href="/debtors" className="debtors-back-link" style={secondaryBtn}>
                  ← {isTa ? 'அனைத்து வாடிக்கையாளர்கள்' : 'Back to all customers'}
                </Link>

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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8, marginTop: 14 }}>
                  <button type="button" onClick={sendSms} disabled={!hasMobile(currentCustomer.mobile)} style={{ ...brandBtn, opacity: hasMobile(currentCustomer.mobile) ? 1 : 0.5 }}>
                    {isTa ? '✉️ SMS அனுப்பு' : '✉️ Send SMS'}
                  </button>
                  <button type="button" onClick={shareWhatsApp} disabled={!hasMobile(currentCustomer.mobile)} style={{ ...softStrongBtn, opacity: hasMobile(currentCustomer.mobile) ? 1 : 0.5 }}>
                    {isTa ? '💬 WhatsApp அனுப்பு' : '💬 Send WhatsApp'}
                  </button>
                </div>

                {isEditingCustomer ? (
                  <form onSubmit={saveCustomerDetails} style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16, padding: 14, borderRadius: 14, background: 'rgba(255,244,222,.75)', border: '1px solid rgba(224,163,37,.38)' }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{isTa ? 'வாடிக்கையாளர் விவரங்களைத் திருத்தவும்' : 'Edit customer details'}</p>
                    <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder={isTa ? 'வாடிக்கையாளர் பெயர்' : 'Customer name'} required style={fieldStyle} />
                    <input value={editCustomerMobile} onChange={(e) => setEditCustomerMobile(e.target.value)} placeholder={isTa ? 'அலைபேசி எண் (விருப்பம்)' : 'Mobile number (optional)'} inputMode="tel" pattern="[0-9 +\\-]{6,15}" style={fieldStyle} />
                    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                      <button type="submit" disabled={isSavingCustomer} style={{ ...brandBtn, opacity: isSavingCustomer ? 0.7 : 1 }}>
                        {isSavingCustomer ? (isTa ? 'சேமிக்கிறது…' : 'Saving...') : (isTa ? 'விவரங்களைச் சேமி' : 'Save details')}
                      </button>
                      <button type="button" onClick={cancelEditingCustomer} disabled={isSavingCustomer} style={secondaryBtn}>
                        {isTa ? 'ரத்துசெய்' : 'Cancel'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    <button type="button" onClick={startEditingCustomer} style={secondaryBtn}>
                      {isTa ? 'வாடிக்கையாளர் விவரங்களைத் திருத்து' : 'Edit customer details'}
                    </button>
                    {isAdmin && <button type="button" onClick={deleteCustomer} style={{ ...secondaryBtn, color: '#A8321C', borderColor: '#A8321C' }}>
                      🗑 Delete customer
                    </button>}
                  </div>
                )}

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
                        {['Date', 'Details', 'Debt', 'Paid', 'Running'].map((h, i) => (
                          <th key={i} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8a6a4f', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerWithRunning.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '26px 12px', textAlign: 'center', color: '#8a6a4f' }}>No entries yet.</td></tr>
                      ) : ledgerWithRunning.map((e) => {
                        const details = e.kind === 'debt'
                          ? `${escapeHtml(e.product || 'Purchase')}${e.qty ? ` × ${e.qty}` : ''}${e.note ? ` — ${escapeHtml(e.note)}` : ''}`
                          : `Repayment${e.note ? ` — ${escapeHtml(e.note)}` : ''}`;
                        return (
                          <tr key={e.id}>
                            <td style={ledgerTd}>{fmtDate(e.date)}</td>
                            <td style={{ ...ledgerTd, maxWidth: 200 }}>{details}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right' }}>{e.kind === 'debt' ? money(e.amount) : '—'}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right' }}>{e.kind === 'payment' ? money(e.amount) : '—'}</td>
                            <td style={{ ...ledgerTd, textAlign: 'right', fontWeight: 600 }}>
                              <span>{money(e.running)}</span>
                              {isAdmin && <button type="button" onClick={() => deleteDebtEntry(e)} style={{ marginLeft: 8, border: 0, background: 'transparent', color: '#A8321C', cursor: 'pointer' }} title="Delete entry">🗑</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>}
        </div>
      </main>
    </div>
  );
}

/* ── inline styles ── */
const cardStyle = { background: '#fffaf3', border: '1px solid rgba(105,65,35,.14)', borderRadius: 18, padding: 20, boxShadow: '0 12px 30px rgba(91,53,24,.08)' };
const fieldStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(105,65,35,.18)', background: '#fffdf9', fontFamily: 'inherit', fontSize: 14, color: '#3a2415', boxSizing: 'border-box' };
const brandBtn = { background: '#d45118', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '12px 15px', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, boxShadow: '0 7px 16px rgba(196,72,19,.18)' };
const secondaryBtn = { background: '#fffdf9', border: '1px solid rgba(105,65,35,.22)', color: '#3a2415', fontWeight: 700, borderRadius: 10, padding: '12px 15px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 };
const softStrongBtn = { background: '#493326', color: '#fffaf2', borderColor: 'transparent', fontWeight: 700, borderRadius: 10, padding: '12px 15px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 };
const topbarBtn = { background: '#fffaf3', border: '1px solid rgba(105,65,35,.16)', color: '#3a2415', fontWeight: 700, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textDecoration: 'none', display: 'inline-block' };
const ledgerTd = { padding: '11px 12px', borderBottom: '1px solid rgba(105,65,35,.12)', whiteSpace: 'nowrap' };
const dialogBackdrop = { position: 'fixed', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(45,27,17,.52)' };
const filterLabel = { display: 'grid', gap: 5, color: '#8a6a4f', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' };
