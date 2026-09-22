'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStore } from '@/lib/store';

/* ── constants ── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Not fixed'];
const DAYS_TA = {
  'Monday': 'திங்கள் (Monday)',
  'Tuesday': 'செவ்வாய் (Tuesday)',
  'Wednesday': 'புதன் (Wednesday)',
  'Thursday': 'வியாழன் (Thursday)',
  'Friday': 'வெள்ளி (Friday)',
  'Saturday': 'சனி (Saturday)',
  'Sunday': 'ஞாயிறு (Sunday)',
  'Not fixed': 'குறிப்பிட்ட நாள் இல்லை',
};

/* ── utils ── */
const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) => '₹' + (Number(n) || 0).toFixed(2);
const esc = (s) => String(s == null ? '' : s);
const phoneLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

/* ── sub-components ── */
function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 26,
      transform: visible ? 'translateX(-50%)' : 'translateX(-50%) translateY(20px)',
      background: 'rgba(58,36,21,.92)', color: '#fff', padding: '11px 20px', borderRadius: 12,
      opacity: visible ? 1 : 0, transition: '.25s', zIndex: 90, fontSize: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,.2)', pointerEvents: 'none',
      backdropFilter: 'blur(8px)'
    }}>
      {message}
    </div>
  );
}

function Modal({ open, onClose, children, maxWidth = 860 }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(58,36,21,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '34px 16px', zIndex: 60, overflowY: 'auto',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{
        background: '#fffdfa', borderRadius: 20, width: '100%', maxWidth,
        boxShadow: '0 24px 60px rgba(90,40,15,.25)', border: '1px solid rgba(122,84,48,.18)',
        overflow: 'hidden'
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── main component ── */
export default function AgencyOrderApp() {
  const { lang } = useStore();
  const isTa = lang === 'ta';
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterDay, setFilterDay] = useState('');
  const [toast, setToast] = useState({ msg: '', visible: false });
  const toastTimer = useRef(null);

  // Agency modal
  const [agencyModal, setAgencyModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [aName, setAName] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aPerson, setAPerson] = useState('');
  const [aDay, setADay] = useState('Monday');
  const [isSavingAgency, setIsSavingAgency] = useState(false);

  // Products modal
  const [productModal, setProductModal] = useState(false);
  const [productAgencyId, setProductAgencyId] = useState(null);
  const [pName, setPName] = useState('');
  const [pUnit, setPUnit] = useState('');
  const [pWhole, setPWhole] = useState('');
  const [pRetail, setPRetail] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Order modal
  const [orderModal, setOrderModal] = useState(false);
  const [orderAgencyId, setOrderAgencyId] = useState(null);
  const [priceMode, setPriceMode] = useState('wholesale');
  const [cart, setCart] = useState({});
  const [lineOrder, setLineOrder] = useState([]);
  const [orderView, setOrderView] = useState('all');

  // Firestore Realtime Listener
  useEffect(() => {
    const q = query(collection(db, 'agencies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          products: [],
          ...d.data()
        }));
        setAgencies(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching agencies:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }, []);

  const agency = (id) => agencies.find((a) => a.id === id);
  const priceOf = (p) => +(priceMode === 'retail' ? p.retail : p.wholesale) || 0;

  /* ── filtered list ── */
  const filteredAgencies = [...agencies]
    .filter((a) => {
      if (filterDay && a.day !== filterDay) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (a.name + ' ' + (a.phone || '') + ' ' + (a.person || '')).toLowerCase().includes(q) ||
        (Array.isArray(a.products) && a.products.some((p) => (p.name || '').toLowerCase().includes(q)))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'day') return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'products') return ((b.products && b.products.length) || 0) - ((a.products && a.products.length) || 0);
      return (b.created || 0) - (a.created || 0);
    });

  /* ── agency CRUD ── */
  function openAgency(id) {
    setEditingId(id || null);
    const a = id ? agency(id) : null;
    setAName(a ? a.name : '');
    setAPhone(a ? (a.phone || '') : '');
    setAPerson(a ? (a.person || '') : '');
    setADay(a ? (a.day || 'Monday') : 'Monday');
    setAgencyModal(true);
  }

  async function saveAgency(e) {
    e.preventDefault();
    const name = aName.trim();
    if (!name || isSavingAgency) return;

    try {
      setIsSavingAgency(true);
      if (editingId) {
        await updateDoc(doc(db, 'agencies', editingId), {
          name, phone: aPhone.trim(), person: aPerson.trim(), day: aDay
        });
        showToast(isTa ? '✓ ஏஜென்சி புதுப்பிக்கப்பட்டது' : '✓ Agency updated');
      } else {
        await addDoc(collection(db, 'agencies'), {
          name, phone: aPhone.trim(), person: aPerson.trim(), day: aDay,
          products: [], created: Date.now()
        });
        showToast(isTa ? '✓ ஏஜென்சி சேர்க்கப்பட்டது' : '✓ Agency added');
      }
      setAgencyModal(false);
    } catch (err) {
      alert('Error saving agency: ' + err.message);
    } finally {
      setIsSavingAgency(false);
    }
  }

  async function deleteAgency(id) {
    const a = agency(id);
    if (!a) return;
    if (!confirm(isTa ? `"${a.name}" ஏஜென்சியை நீக்கவா?` : `Delete agency "${a.name}" and all its products?`)) return;

    try {
      await deleteDoc(doc(db, 'agencies', id));
      showToast(isTa ? 'ஏஜென்சி நீக்கப்பட்டது' : 'Agency deleted');
    } catch (err) {
      alert('Error deleting agency: ' + err.message);
    }
  }

  /* ── product CRUD ── */
  function openProducts(agencyId) {
    setProductAgencyId(agencyId);
    setPName('');
    setPUnit('');
    setPWhole('');
    setPRetail('');
    setEditingProductId(null);
    setProductModal(true);
  }

  function editProduct(product) {
    setEditingProductId(product.id);
    setPName(product.name || '');
    setPUnit(product.unit || '');
    setPWhole(String(product.wholesale ?? ''));
    setPRetail(String(product.retail ?? ''));
  }

  function clearProductForm() {
    setEditingProductId(null);
    setPName('');
    setPUnit('');
    setPWhole('');
    setPRetail('');
  }

  async function addProduct(e) {
    e.preventDefault();
    const name = pName.trim();
    if (!name || !productAgencyId || isSavingProduct) return;

    const a = agency(productAgencyId);
    if (!a) return;

    const product = {
      id: editingProductId || uid(),
      name,
      unit: pUnit.trim() || 'pcs',
      wholesale: +pWhole || 0,
      retail: +pRetail || 0
    };

    try {
      setIsSavingProduct(true);
      const updatedProducts = editingProductId
        ? (a.products || []).map((p) => p.id === editingProductId ? product : p)
        : [...(a.products || []), product];
      await updateDoc(doc(db, 'agencies', productAgencyId), { products: updatedProducts });
      clearProductForm();
      showToast(editingProductId
        ? (isTa ? '✓ பொருள் புதுப்பிக்கப்பட்டது' : '✓ Product updated')
        : (isTa ? '✓ பொருள் சேர்க்கப்பட்டது' : '✓ Product added'));
    } catch (err) {
      alert('Error adding product: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function deleteProduct(agencyId, prodId) {
    const a = agency(agencyId);
    if (!a) return;
    if (!confirm(isTa ? 'இந்த பொருளை நீக்கவா?' : 'Remove this product?')) return;
    try {
      const updatedProducts = (a.products || []).filter((p) => p.id !== prodId);
      await updateDoc(doc(db, 'agencies', agencyId), { products: updatedProducts });
      if (editingProductId === prodId) clearProductForm();
      showToast(isTa ? 'பொருள் நீக்கப்பட்டது' : 'Product removed');
    } catch (err) {
      alert('Error removing product: ' + err.message);
    }
  }

  /* ── order cart ── */
  function openOrder(agencyId) {
    setOrderAgencyId(agencyId);
    setPriceMode('wholesale');
    setCart({});
    setLineOrder([]);
    setOrderView('all');
    setOrderModal(true);
  }

  function updateCartQuantity(productId, value) {
    setCart((current) => {
      const next = { ...current };
      if (!value || value <= 0) delete next[productId];
      else next[productId] = value;
      return next;
    });
    setLineOrder((current) => {
      if (value > 0 && !current.includes(productId)) return [...current, productId];
      if (value <= 0) return current.filter((id) => id !== productId);
      return current;
    });
  }

  function moveLine(lineId, direction) {
    setLineOrder((current) => {
      const index = current.indexOf(lineId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function cartLines(agencyId, currentCart, mode, orderedIds = []) {
    const a = agency(agencyId);
    if (!a || !Array.isArray(a.products)) return [];
    const productsById = new Map(a.products.map((p) => [p.id, p]));
    const selectedProducts = [
      ...orderedIds.map((id) => productsById.get(id)).filter(Boolean),
      ...a.products.filter((p) => currentCart[p.id] > 0 && !orderedIds.includes(p.id))
    ];
    return selectedProducts
      .filter((p) => currentCart[p.id] > 0)
      .map((p) => {
        const rate = +(mode === 'retail' ? p.retail : p.wholesale) || 0;
        const qty = currentCart[p.id];
        return { id: p.id, name: p.name, unit: p.unit || '', rate, qty, amount: qty * rate };
      });
  }

  function orderData(agencyId, currentCart, mode, orderedIds = []) {
    const a = agency(agencyId);
    const lines = cartLines(agencyId, currentCart, mode, orderedIds);
    return {
      agency: a,
      lines,
      total: lines.reduce((s, l) => s + l.amount, 0),
      qty: lines.reduce((s, l) => s + l.qty, 0),
      date: new Date().toLocaleString('en-IN'),
      mode: mode === 'retail' ? 'Retail rates' : 'Wholesale rates',
    };
  }

  /* ── printing ── */
  function printHTML(html) {
    const w = window.open('', '_blank', 'width=420,height=700');
    if (!w) return showToast('Allow pop-ups to print');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 350);
  }

  function a4Template(d) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Purchase list - ${esc(d.agency.name)}</title><style>
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;margin:32px;color:#3a2415}
  h1{margin:0 0 4px;font-size:22px;color:#c2410c}.sub{color:#8a6a4f;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:22px}
  th,td{border-bottom:1px solid #e0d0c0;padding:9px 6px;font-size:13px;text-align:left}
  th{background:#f8f2ea;text-transform:uppercase;font-size:11px;letter-spacing:.6px;color:#8a6a4f}
  .num{text-align:right}tfoot td{font-weight:700;font-size:15px;border-top:2px solid #3a2415}
  .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c2410c;padding-bottom:12px}
  </style></head><body>
  <div class="hd"><div><h1>${esc(d.agency.name)}</h1>
  <div class="sub">${esc(d.agency.day)} • ${esc(d.agency.phone || '')}${d.agency.person ? ' • ' + esc(d.agency.person) : ''}</div></div>
  <div class="sub" style="text-align:right">Purchase list<br>${esc(d.date)}<br>${esc(d.mode)}</div></div>
  <table><thead><tr><th>#</th><th>Product</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
  ${d.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.unit)}</td><td class="num">${l.qty}</td><td class="num">${l.rate.toFixed(2)}</td><td class="num">${l.amount.toFixed(2)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${d.qty}</td><td></td><td class="num">${d.total.toFixed(2)}</td></tr></tfoot></table>
  <p class="sub" style="margin-top:34px">Signature: ______________________</p></body></html>`;
  }

  function thermalTemplate(d, width) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.agency.name)}</title><style>
  @page{size:${width}mm auto;margin:3mm}
  body{width:${width - 6}mm;margin:0;font-family:"Courier New",monospace;font-size:11px;color:#000}
  h1{font-size:14px;margin:0;text-align:center}.c{text-align:center}
  hr{border:0;border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top;font-size:11px}
  .r{text-align:right}.b{font-weight:700}
  </style></head><body>
  <h1>${esc(d.agency.name)}</h1>
  <div class="c">${esc(d.agency.phone || '')}</div>
  <div class="c">${esc(d.agency.day)} • ${esc(d.mode)}</div>
  <div class="c">${esc(d.date)}</div><hr>
  <table>${d.lines.map((l) => `<tr><td colspan="2">${esc(l.name)}</td></tr>
  <tr><td>${l.qty} ${esc(l.unit)} x ${l.rate.toFixed(2)}</td><td class="r">${l.amount.toFixed(2)}</td></tr>`).join('')}</table>
  <hr><table><tr><td class="b">TOTAL QTY</td><td class="r b">${d.qty}</td></tr>
  <tr><td class="b">TOTAL</td><td class="r b">${d.total.toFixed(2)}</td></tr></table><hr>
  <div class="c">Items: ${d.lines.length}</div><br><br></body></html>`;
  }

  /* ── image share ── */
  async function shareImage(agencyId, currentCart, mode, orderedIds) {
    const d = orderData(agencyId, currentCart, mode, orderedIds);
    if (!d.lines.length) return showToast('Select at least one product');
    const W = 760, pad = 36, rowH = 34, head = 190, foot = 150;
    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = (head + d.lines.length * rowH + foot) * dpr;
    const x = canvas.getContext('2d');
    x.scale(dpr, dpr);
    const H = canvas.height / dpr;
    x.fillStyle = '#fffdfa'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#c2410c'; x.fillRect(0, 0, W, 108);
    x.fillStyle = '#fff'; x.font = '700 26px Segoe UI, Arial'; x.fillText(d.agency.name.slice(0, 34), pad, 50);
    x.font = '14px Segoe UI, Arial'; x.fillStyle = 'rgba(255,255,255,.9)';
    x.fillText(`${d.agency.day}  •  ${d.agency.phone || ''}`, pad, 76);
    x.textAlign = 'right'; x.fillText(d.mode, W - pad, 50); x.fillText(d.date, W - pad, 76); x.textAlign = 'left';
    let y = head - 42;
    x.fillStyle = '#8a6a4f'; x.font = '700 12px Segoe UI, Arial';
    x.fillText('PRODUCT', pad, y); x.textAlign = 'right'; x.fillText('QTY', W - 330, y); x.fillText('RATE', W - 190, y); x.fillText('AMOUNT', W - pad, y); x.textAlign = 'left';
    y += 12; x.strokeStyle = '#e0d0c0'; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke();
    y += 26;
    d.lines.forEach((l, i) => {
      if (i % 2) { x.fillStyle = '#f8f2ea'; x.fillRect(pad - 8, y - 20, W - 2 * pad + 16, rowH - 4); }
      x.fillStyle = '#3a2415'; x.font = '15px Segoe UI, Arial'; x.fillText(l.name.slice(0, 36), pad, y);
      x.textAlign = 'right';
      x.fillText(String(l.qty) + ' ' + (l.unit || ''), W - 330, y);
      x.fillText(l.rate.toFixed(2), W - 190, y);
      x.font = '700 15px Segoe UI, Arial'; x.fillText(l.amount.toFixed(2), W - pad, y); x.textAlign = 'left';
      y += rowH;
    });
    y += 6; x.strokeStyle = '#3a2415'; x.lineWidth = 2; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke();
    y += 34; x.fillStyle = '#3a2415'; x.font = '700 20px Segoe UI, Arial'; x.fillText('Total', pad, y);
    x.textAlign = 'right'; x.fillText('₹' + d.total.toFixed(2), W - pad, y);
    x.font = '14px Segoe UI, Arial'; x.fillStyle = '#8a6a4f'; y += 26;
    x.fillText(`${d.lines.length} items  •  ${d.qty} units`, W - pad, y); x.textAlign = 'left';

    canvas.toBlob(async (blob) => {
      const file = new File([blob], `${d.agency.name.replace(/\W+/g, '-')}-list.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: d.agency.name, text: 'Purchase list' }); return; } catch (e) {}
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast('Image saved to downloads');
    }, 'image/png');
  }

  /* ── order panel calculations ── */
  const currentLines = orderModal ? cartLines(orderAgencyId, cart, priceMode, lineOrder) : [];
  const orderCount = currentLines.length;
  const orderQty = currentLines.reduce((s, l) => s + l.qty, 0);
  const orderTotal = currentLines.reduce((s, l) => s + l.amount, 0);
  const orderAgency = orderAgencyId ? agency(orderAgencyId) : null;
  const productAgency = productAgencyId ? agency(productAgencyId) : null;

  return (
    <div style={{ minHeight: '100vh', color: '#3a2415', fontFamily: 'Figtree, system-ui, sans-serif', background: 'linear-gradient(135deg,#fbe9cf,#f6d3b4 45%,#f2b9ac)', overflowX: 'hidden' }}>

      {/* Glow blobs */}
      <div style={{ position: 'fixed', width: 520, height: 520, right: -140, top: -140, background: 'rgba(224,163,37,.45)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 480, height: 480, left: -140, bottom: -160, background: 'rgba(226,120,110,.35)', borderRadius: '50%', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Topbar Header */}
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
            <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 24, lineHeight: 1 }}>SKM Stores</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8a6a4f' }}>
              Agency Orders {loading ? '• Loading...' : '• Synced Live'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/" style={topbarBtn}>← Home</Link>
          <button onClick={() => openAgency(null)} style={brandBtn}>+ New agency</button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ padding: '0 clamp(16px,4vw,40px) 56px', maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', margin: '14px 0 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} style={fieldStyle} placeholder="Agency, phone or product…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={fieldStyle}>
              <option value="name">Agency name (A–Z)</option>
              <option value="day">Visit day (Mon → Sun)</option>
              <option value="products">Most products</option>
              <option value="recent">Recently added</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Visit day</label>
            <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)} style={fieldStyle}>
              <option value="">All days</option>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Agency grid */}
        {filteredAgencies.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '44px 20px', color: '#8a6a4f' }}>
            <h3 style={{ margin: '0 0 6px', fontFamily: 'Georgia, serif', fontSize: 20, color: '#3a2415' }}>
              {loading ? 'Loading agencies...' : 'No agencies yet'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14 }}>
              {loading ? 'Please wait while data is synced with Firebase.' : 'Add the agencies that supply your shop, then list their products with wholesale and retail prices.'}
            </p>
            {!loading && (
              <button onClick={() => openAgency(null)} style={brandBtn}>+ Add your first agency</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {filteredAgencies.map((a) => {
              const prods = Array.isArray(a.products) ? a.products : [];
              const ws = prods.length ? Math.min(...prods.map((p) => +p.wholesale || 0)) : 0;
              return (
                <article key={a.id} style={cardStyle}>
                  <div style={{ padding: '0 0 14px' }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 18, fontFamily: 'Georgia, serif' }}>{esc(a.name)}</h3>
                    <div style={{ color: '#8a6a4f', fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{ background: 'rgba(224,163,37,.22)', color: '#99600a', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {a.day || 'Not fixed'}
                      </span>
                      <span style={{ background: 'rgba(194,65,12,.12)', color: '#a8321c', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {prods.length} products
                      </span>
                    </div>
                    <div style={{ color: '#8a6a4f', fontSize: 13, display: 'flex', gap: 12, marginTop: 8 }}>
                      <span>Ph: {esc(a.phone || '—')}</span>
                      {a.person && <span>Contact: {esc(a.person)}</span>}
                    </div>
                    {prods.length > 0 && (
                      <div style={{ color: '#8a6a4f', fontSize: 13, marginTop: 6 }}>
                        From <strong style={{ color: '#3a2415' }}>{money(ws)}</strong> wholesale
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(122,84,48,.18)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => openOrder(a.id)} style={primarySmBtn}>Make list</button>
                    <button onClick={() => openProducts(a.id)} style={smBtn}>Products</button>
                    {a.phone && <a href={phoneLink(a.phone)} style={{ ...smBtn, textDecoration: 'none' }} aria-label={`Call ${a.name}`}>Call</a>}
                    <button onClick={() => openAgency(a.id)} style={smBtn}>Edit</button>
                    <button onClick={() => deleteAgency(a.id)} style={dangerSmBtn}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Agency Modal ── */}
      <Modal open={agencyModal} onClose={() => setAgencyModal(false)} maxWidth={560}>
        <div style={sheetHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Georgia, serif' }}>{editingId ? 'Edit agency' : 'New agency'}</h3>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Agency name</label>
              <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Sri Balaji Agencies" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Phone number</label>
              <input value={aPhone} onChange={(e) => setAPhone(e.target.value)} placeholder="98765 43210" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Contact person (optional)</label>
              <input value={aPerson} onChange={(e) => setAPerson(e.target.value)} placeholder="Ramesh" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Visit day</label>
              <select value={aDay} onChange={(e) => setADay(e.target.value)} style={fieldStyle}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setAgencyModal(false)} style={topbarBtn}>Cancel</button>
          <button onClick={saveAgency} disabled={isSavingAgency} style={brandBtn}>
            {isSavingAgency ? 'Saving...' : 'Save agency'}
          </button>
        </div>
      </Modal>

      {/* ── Products Modal ── */}
      <Modal open={productModal} onClose={() => setProductModal(false)}>
        <div style={sheetHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Georgia, serif' }}>
              {productAgency ? productAgency.name + ' — Products' : 'Products'}
            </h3>
            <span style={{ fontSize: 12, color: '#8a6a4f' }}>
              {productAgency ? productAgency.day + ' • ' + (productAgency.phone || 'No phone') : ''}
            </span>
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Product</label>
              <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Toor Dal 1kg" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Unit</label>
              <input value={pUnit} onChange={(e) => setPUnit(e.target.value)} placeholder="pkt / kg / box" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Wholesale ₹</label>
              <input value={pWhole} onChange={(e) => setPWhole(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Retail ₹</label>
              <input value={pRetail} onChange={(e) => setPRetail(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>&nbsp;</label>
              <button onClick={addProduct} disabled={isSavingProduct} style={{ ...brandBtn, padding: '11px 16px' }}>
                {isSavingProduct ? 'Saving...' : editingProductId ? 'Save changes' : 'Add product'}
              </button>
              {editingProductId && <button onClick={clearProductForm} style={topbarBtn}>Cancel</button>}
            </div>
          </div>

          <div style={{ marginTop: 20, overflowX: 'auto', border: '1px solid rgba(122,84,48,.18)', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 540 }}>
              <thead>
                <tr>
                  {['Product', 'Unit', 'Wholesale', 'Retail', 'Margin', ''].map((h, i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productAgency && (!productAgency.products || productAgency.products.length === 0) ? (
                  <tr><td colSpan={6} style={{ color: '#8a6a4f', padding: '22px 12px', textAlign: 'center' }}>No products listed for this agency yet.</td></tr>
                ) : productAgency && productAgency.products.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{esc(p.name)}</td>
                    <td style={tdStyle}>{esc(p.unit || '—')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(p.wholesale)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(p.retail)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: (+p.retail || 0) >= (+p.wholesale || 0) ? '#3f7d3f' : '#a8321c' }}>
                      {money((+p.retail || 0) - (+p.wholesale || 0))}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => editProduct(p)} style={smBtn}>Edit</button>
                        <button onClick={() => deleteProduct(productAgencyId, p.id)} style={dangerSmBtn}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setProductModal(false)} style={brandBtn}>Done</button>
        </div>
      </Modal>

      {/* ── Order Modal ── */}
      <Modal open={orderModal} onClose={() => setOrderModal(false)}>
        <div style={{ ...sheetHeaderStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Georgia, serif' }}>
            {orderAgency ? orderAgency.name + ' — Purchase List' : 'Purchase List'}
          </h3>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid rgba(122,84,48,.22)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            {['wholesale', 'retail'].map((m) => (
              <button
                key={m}
                onClick={() => setPriceMode(m)}
                style={{
                  border: 0,
                  background: priceMode === m ? 'linear-gradient(135deg,#c2410c,#e8b04b)' : 'transparent',
                  color: priceMode === m ? '#fff' : '#3a2415',
                  padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ color: '#8a6a4f', fontSize: 13 }}>
              {orderView === 'all' ? 'Select products and quantities' : 'Arrange the selected lines before printing'}
            </div>
            <div style={{ display: 'inline-flex', border: '1px solid rgba(122,84,48,.22)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <button type="button" onClick={() => setOrderView('all')} style={{ ...orderViewBtn, ...(orderView === 'all' ? orderViewActiveBtn : {}) }}>
                All products
              </button>
              <button type="button" onClick={() => setOrderView('selected')} disabled={!currentLines.length} style={{ ...orderViewBtn, ...(orderView === 'selected' ? orderViewActiveBtn : {}) }}>
                Selected lines ({currentLines.length})
              </button>
            </div>
          </div>

          {orderView === 'all' ? <div style={{ overflowX: 'auto', border: '1px solid rgba(122,84,48,.18)', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 520 }}>
              <thead>
                <tr>
                  {['Product', 'Unit', 'Rate', 'Qty', 'Amount'].map((h, i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderAgency && (!orderAgency.products || orderAgency.products.length === 0) ? (
                  <tr><td colSpan={5} style={{ padding: '22px 12px', color: '#8a6a4f', textAlign: 'center' }}>Add products to this agency first.</td></tr>
                ) : orderAgency && orderAgency.products.map((p) => {
                  const q = cart[p.id] || 0;
                  const rate = priceOf(p);
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>{esc(p.name)}</td>
                      <td style={tdStyle}>{esc(p.unit || '—')}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{money(rate)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input
                          type="number" min="0" step="0.5"
                          value={q || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            updateCartQuantity(p.id, v);
                          }}
                          style={{ width: 80, textAlign: 'right', border: '1px solid rgba(122,84,48,.25)', borderRadius: 8, padding: '7px 8px', fontFamily: 'inherit', fontSize: 14, background: '#fff' }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: q > 0 ? 600 : 400 }}>{q > 0 ? money(q * rate) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div> : (
            <div style={{ display: 'grid', gap: 8, border: '1px solid rgba(122,84,48,.18)', borderRadius: 14, padding: 10 }}>
              {currentLines.length ? currentLines.map((line, index) => (
                <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: '#fff', border: '1px solid rgba(122,84,48,.14)', borderRadius: 9 }}>
                  <span style={{ width: 22, color: '#8a6a4f', fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{esc(line.name)}</span>
                  <input type="number" min="0" step="0.5" value={line.qty} onChange={(e) => updateCartQuantity(line.id, parseFloat(e.target.value))} style={{ width: 70, textAlign: 'right', border: '1px solid rgba(122,84,48,.25)', borderRadius: 8, padding: '7px 8px', fontFamily: 'inherit', fontSize: 14, background: '#fff' }} />
                  <button type="button" onClick={() => moveLine(line.id, -1)} disabled={index === 0} aria-label={`Move ${line.name} up`} style={orderMoveBtn}>&uarr;</button>
                  <button type="button" onClick={() => moveLine(line.id, 1)} disabled={index === currentLines.length - 1} aria-label={`Move ${line.name} down`} style={orderMoveBtn}>&darr;</button>
                </div>
              )) : <div style={{ padding: 22, color: '#8a6a4f', textAlign: 'center' }}>Select products first.</div>}
            </div>
          )}

          {orderView === 'all' && currentLines.length > 0 && (
            <div style={{ marginTop: 16, padding: 14, border: '1px solid rgba(194,65,12,.22)', borderRadius: 14, background: 'rgba(255,248,237,.78)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <strong style={{ fontSize: 14 }}>Image order</strong>
                <span style={{ color: '#8a6a4f', fontSize: 12 }}>Move items into the order you want</span>
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {currentLines.map((line, index) => (
                  <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: '#fff', border: '1px solid rgba(122,84,48,.14)', borderRadius: 9 }}>
                    <span style={{ width: 22, color: '#8a6a4f', fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{esc(line.name)}</span>
                    <span style={{ color: '#8a6a4f', fontSize: 12 }}>{line.qty} {esc(line.unit)}</span>
                    <button type="button" onClick={() => moveLine(line.id, -1)} disabled={index === 0} aria-label={`Move ${line.name} up`} style={orderMoveBtn}>&uarr;</button>
                    <button type="button" onClick={() => moveLine(line.id, 1)} disabled={index === currentLines.length - 1} aria-label={`Move ${line.name} down`} style={orderMoveBtn}>&darr;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 16 }}>
            {[['Items selected', orderCount], ['Total quantity', orderQty]].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '6px 0', color: '#8a6a4f' }}>
                <span>{label}</span><strong style={{ color: '#3a2415' }}>{val}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, borderTop: '2px solid #3a2415', marginTop: 8, paddingTop: 12 }}>
              <span>Total</span><span style={{ color: '#c2410c' }}>{money(orderTotal)}</span>
            </div>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setOrderModal(false)} style={topbarBtn}>Close</button>
          <button onClick={() => { setCart({}); setLineOrder([]); }} style={topbarBtn}>Clear</button>
          <button onClick={() => shareImage(orderAgencyId, cart, priceMode, lineOrder)} style={topbarBtn}>Save / share image</button>
          <button onClick={() => {
            const d = orderData(orderAgencyId, cart, priceMode, lineOrder);
            if (!d.lines.length) return showToast('Select at least one product');
            const w = prompt('Thermal paper width in mm (58 or 80)?', '80');
            if (!w) return;
            printHTML(thermalTemplate(d, Math.max(40, parseInt(w, 10) || 80)));
          }} style={topbarBtn}>Thermal print</button>
          <button onClick={() => {
            const d = orderData(orderAgencyId, cart, priceMode, lineOrder);
            if (!d.lines.length) return showToast('Select at least one product');
            printHTML(a4Template(d));
          }} style={brandBtn}>Print A4</button>
        </div>
      </Modal>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}

/* ── inline styles ── */
const cardStyle = { background: 'rgba(255,251,244,.85)', border: '1px solid rgba(122,84,48,.18)', borderRadius: 20, padding: 20, backdropFilter: 'blur(12px)', boxShadow: '0 18px 40px rgba(122,84,48,.12)' };
const labelStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: '#8a6a4f', fontWeight: 700 };
const fieldStyle = { width: '100%', padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(122,84,48,.18)', background: 'rgba(255,255,255,.85)', fontFamily: 'inherit', fontSize: 14, color: '#3a2415', boxSizing: 'border-box' };
const brandBtn = { background: 'linear-gradient(135deg,#c2410c,#e8b04b)', color: '#fff', fontWeight: 600, borderRadius: 12, padding: '11px 16px', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, boxShadow: '0 10px 22px rgba(194,65,12,.25)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const topbarBtn = { background: 'rgba(255,255,255,.72)', border: '1px solid rgba(122,84,48,.18)', color: '#3a2415', fontWeight: 600, borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const orderViewBtn = { border: 0, background: 'transparent', color: '#3a2415', padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const orderViewActiveBtn = { background: 'linear-gradient(135deg,#c2410c,#e8b04b)', color: '#fff' };
const orderMoveBtn = { width: 30, height: 30, padding: 0, border: '1px solid rgba(122,84,48,.2)', borderRadius: 7, background: '#fffdfa', color: '#3a2415', cursor: 'pointer', fontSize: 16, lineHeight: 1 };
const smBtn = { border: '1px solid rgba(122,84,48,.18)', background: 'rgba(255,255,255,.8)', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#3a2415' };
const primarySmBtn = { ...smBtn, background: 'linear-gradient(135deg,#c2410c,#e8b04b)', border: '1px solid transparent', color: '#fff' };
const dangerSmBtn = { ...smBtn, color: '#a8321c', borderColor: 'rgba(168,50,28,.25)', background: 'rgba(168,50,28,.06)' };
const sheetHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(122,84,48,.18)', flexWrap: 'wrap' };
const sheetFooterStyle = { padding: '16px 22px', borderTop: '1px solid rgba(122,84,48,.18)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', background: 'rgba(255,251,244,.95)' };
const thStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', color: '#8a6a4f', padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', background: 'rgba(255,251,244,.6)' };
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid rgba(122,84,48,.18)', fontSize: 14 };
