'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

/* ── constants ── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Not fixed'];
const KEY = 'stockdesk.v1';

/* ── utils ── */
const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) => '₹' + (Number(n) || 0).toFixed(2);
const esc = (s) => String(s == null ? '' : s);

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.agencies)) return d;
  } catch (e) {}
  return { agencies: [], shop: 'My Grocery Shop' };
}
function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* ── sub-components ── */

function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 26,
      transform: visible ? 'translateX(-50%)' : 'translateX(-50%) translateY(20px)',
      background: '#16201a', color: '#fff', padding: '11px 18px', borderRadius: 10,
      opacity: visible ? 1 : 0, transition: '.25s', zIndex: 90, fontSize: 14,
      pointerEvents: 'none',
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
        position: 'fixed', inset: 0, background: 'rgba(16,26,20,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '34px 16px', zIndex: 60, overflowY: 'auto',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth,
        boxShadow: '0 24px 60px rgba(0,0,0,.28)',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── main component ── */
export default function AgencyOrderApp() {
  const [state, setState] = useState(null); // null = not loaded yet
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

  // Products modal
  const [productModal, setProductModal] = useState(false);
  const [productAgencyId, setProductAgencyId] = useState(null);
  const [pName, setPName] = useState('');
  const [pUnit, setPUnit] = useState('');
  const [pWhole, setPWhole] = useState('');
  const [pRetail, setPRetail] = useState('');

  // Order modal
  const [orderModal, setOrderModal] = useState(false);
  const [orderAgencyId, setOrderAgencyId] = useState(null);
  const [priceMode, setPriceMode] = useState('wholesale');
  const [cart, setCart] = useState({});

  // File input ref for import
  const fileRef = useRef(null);

  /* load from localStorage once */
  useEffect(() => {
    setState(loadState());
  }, []);

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  }, []);

  const persist = useCallback((newState) => {
    setState(newState);
    saveState(newState);
  }, []);

  if (!state) return null; // wait for localStorage

  const agency = (id) => state.agencies.find((a) => a.id === id);
  const priceOf = (p) => +(priceMode === 'retail' ? p.retail : p.wholesale) || 0;

  /* ── filtered list ── */
  const filteredAgencies = [...state.agencies]
    .filter((a) => {
      if (filterDay && a.day !== filterDay) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (a.name + ' ' + a.phone + ' ' + (a.person || '')).toLowerCase().includes(q) ||
        a.products.some((p) => p.name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'day') return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.name.localeCompare(b.name);
      if (sortBy === 'products') return b.products.length - a.products.length;
      return (b.created || 0) - (a.created || 0);
    });

  /* ── agency CRUD ── */
  function openAgency(id) {
    setEditingId(id || null);
    const a = id ? agency(id) : null;
    setAName(a ? a.name : '');
    setAPhone(a ? a.phone : '');
    setAPerson(a ? (a.person || '') : '');
    setADay(a ? a.day : 'Monday');
    setAgencyModal(true);
  }

  function saveAgency() {
    const name = aName.trim();
    if (!name) return showToast('Agency name is required');
    const data = { name, phone: aPhone.trim(), person: aPerson.trim(), day: aDay };
    if (editingId) {
      const updated = state.agencies.map((a) => a.id === editingId ? { ...a, ...data } : a);
      persist({ ...state, agencies: updated });
    } else {
      persist({ ...state, agencies: [...state.agencies, { id: uid(), created: Date.now(), products: [], ...data }] });
    }
    setAgencyModal(false);
    showToast('Saved');
  }

  function deleteAgency(id) {
    const a = agency(id);
    if (!confirm(`Delete "${a.name}" and its ${a.products.length} products?`)) return;
    persist({ ...state, agencies: state.agencies.filter((x) => x.id !== id) });
    showToast('Agency deleted');
  }

  /* ── products ── */
  function openProducts(id) {
    setProductAgencyId(id);
    setPName(''); setPUnit(''); setPWhole(''); setPRetail('');
    setProductModal(true);
  }

  function addProduct() {
    const name = pName.trim();
    if (!name) return showToast('Product name is required');
    const updated = state.agencies.map((a) =>
      a.id === productAgencyId
        ? { ...a, products: [...a.products, { id: uid(), name, unit: pUnit.trim(), wholesale: +pWhole || 0, retail: +pRetail || 0 }] }
        : a
    );
    persist({ ...state, agencies: updated });
    setPName(''); setPUnit(''); setPWhole(''); setPRetail('');
    showToast('Product added');
  }

  function removeProduct(agencyId, productId) {
    const updated = state.agencies.map((a) =>
      a.id === agencyId ? { ...a, products: a.products.filter((p) => p.id !== productId) } : a
    );
    persist({ ...state, agencies: updated });
  }

  /* ── order ── */
  function openOrder(id) {
    setOrderAgencyId(id);
    setPriceMode('wholesale');
    setCart({});
    setOrderModal(true);
  }

  function cartLines(agencyId, currentCart, mode) {
    const a = agency(agencyId);
    if (!a) return [];
    return a.products
      .filter((p) => currentCart[p.id] > 0)
      .map((p) => {
        const rate = +(mode === 'retail' ? p.retail : p.wholesale) || 0;
        const qty = currentCart[p.id];
        return { name: p.name, unit: p.unit || '', rate, qty, amount: qty * rate };
      });
  }

  function orderData(agencyId, currentCart, mode) {
    const a = agency(agencyId);
    const lines = cartLines(agencyId, currentCart, mode);
    return {
      agency: a,
      lines,
      total: lines.reduce((s, l) => s + l.amount, 0),
      qty: lines.reduce((s, l) => s + l.qty, 0),
      date: new Date().toLocaleString(),
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
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;margin:32px;color:#16201a}
  h1{margin:0 0 4px;font-size:22px}.sub{color:#5b6b60;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:22px}
  th,td{border-bottom:1px solid #ddd;padding:9px 6px;font-size:13px;text-align:left}
  th{background:#f1f4f0;text-transform:uppercase;font-size:11px;letter-spacing:.6px}
  .num{text-align:right}tfoot td{font-weight:700;font-size:15px;border-top:2px solid #16201a}
  .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1f6f4a;padding-bottom:12px}
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
  async function shareImage(agencyId, currentCart, mode) {
    const d = orderData(agencyId, currentCart, mode);
    if (!d.lines.length) return showToast('Select at least one product');
    const W = 760, pad = 36, rowH = 34, head = 190, foot = 150;
    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = (head + d.lines.length * rowH + foot) * dpr;
    const x = canvas.getContext('2d');
    x.scale(dpr, dpr);
    const H = canvas.height / dpr;
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1f6f4a'; x.fillRect(0, 0, W, 108);
    x.fillStyle = '#fff'; x.font = '700 26px Segoe UI, Arial'; x.fillText(d.agency.name.slice(0, 34), pad, 50);
    x.font = '14px Segoe UI, Arial'; x.fillStyle = 'rgba(255,255,255,.85)';
    x.fillText(`${d.agency.day}  •  ${d.agency.phone || ''}`, pad, 76);
    x.textAlign = 'right'; x.fillText(d.mode, W - pad, 50); x.fillText(d.date, W - pad, 76); x.textAlign = 'left';
    let y = head - 42;
    x.fillStyle = '#5b6b60'; x.font = '700 12px Segoe UI, Arial';
    x.fillText('PRODUCT', pad, y); x.textAlign = 'right'; x.fillText('QTY', W - 330, y); x.fillText('RATE', W - 190, y); x.fillText('AMOUNT', W - pad, y); x.textAlign = 'left';
    y += 12; x.strokeStyle = '#dfe4dc'; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke();
    y += 26;
    d.lines.forEach((l, i) => {
      if (i % 2) { x.fillStyle = '#f6f8f5'; x.fillRect(pad - 8, y - 20, W - 2 * pad + 16, rowH - 4); }
      x.fillStyle = '#16201a'; x.font = '15px Segoe UI, Arial'; x.fillText(l.name.slice(0, 36), pad, y);
      x.textAlign = 'right';
      x.fillText(String(l.qty) + ' ' + (l.unit || ''), W - 330, y);
      x.fillText(l.rate.toFixed(2), W - 190, y);
      x.font = '700 15px Segoe UI, Arial'; x.fillText(l.amount.toFixed(2), W - pad, y); x.textAlign = 'left';
      y += rowH;
    });
    y += 6; x.strokeStyle = '#16201a'; x.lineWidth = 2; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke();
    y += 34; x.fillStyle = '#16201a'; x.font = '700 20px Segoe UI, Arial'; x.fillText('Total', pad, y);
    x.textAlign = 'right'; x.fillText('₹' + d.total.toFixed(2), W - pad, y);
    x.font = '14px Segoe UI, Arial'; x.fillStyle = '#5b6b60'; y += 26;
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

  /* ── backup / restore ── */
  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stock-desk-backup.json';
    a.click();
    showToast('Backup downloaded');
  }

  function importBackup(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!Array.isArray(d.agencies)) throw new Error('invalid');
        persist(d);
        showToast('Data restored');
      } catch {
        showToast('That file could not be read');
      }
    };
    r.readAsText(f);
    e.target.value = '';
  }

  /* ── order panel helpers ── */
  const currentLines = orderModal ? cartLines(orderAgencyId, cart, priceMode) : [];
  const orderCount = currentLines.length;
  const orderQty = currentLines.reduce((s, l) => s + l.qty, 0);
  const orderTotal = currentLines.reduce((s, l) => s + l.amount, 0);
  const orderAgency = orderAgencyId ? agency(orderAgencyId) : null;
  const productAgency = productAgencyId ? agency(productAgencyId) : null;

  /* ─────────────────────────────── JSX ─────────────────────────────── */
  return (
    <div style={{ background: '#f4f6f3', minHeight: '100vh', fontFamily: "'Segoe UI',system-ui,sans-serif", color: '#16201a' }}>

      {/* Header */}
      <header style={{ background: '#1f6f4a', color: '#fff', padding: '18px 0', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 2px 14px rgba(15,61,40,.18)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 700, fontSize: 19 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', fontSize: 16 }}>◆</span>
            <span>Stock Desk<small style={{ display: 'block', fontWeight: 400, fontSize: 11, opacity: .8, letterSpacing: '.6px', textTransform: 'uppercase' }}>Agency purchase manager</small></span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.28)', color: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>← Home</Link>
            <button onClick={exportBackup} style={ghostLightBtn}>Backup</button>
            <button onClick={() => fileRef.current?.click()} style={ghostLightBtn}>Restore</button>
            <button onClick={() => openAgency(null)} style={ghostLightBtn}>+ New agency</button>
            <input type="file" ref={fileRef} accept="application/json" hidden onChange={importBackup} />
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', margin: '26px 0 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} placeholder="Agency, phone or product…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle}>
              <option value="name">Agency name (A–Z)</option>
              <option value="day">Visit day (Mon → Sun)</option>
              <option value="products">Most products</option>
              <option value="recent">Recently added</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Visit day</label>
            <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)} style={inputStyle}>
              <option value="">All days</option>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Agency grid */}
        {filteredAgencies.length === 0 ? (
          <div style={{ border: '1px dashed #dfe4dc', borderRadius: 14, padding: 44, textAlign: 'center', color: '#5b6b60', background: '#fff' }}>
            <h3 style={{ margin: '0 0 6px' }}>No agencies yet</h3>
            <p style={{ margin: '0 0 16px' }}>Add the agencies that visit your shop, then list their products with wholesale and retail prices.</p>
            <button onClick={() => openAgency(null)} style={primaryBtn}>+ Add your first agency</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {filteredAgencies.map((a) => {
              const ws = a.products.length ? Math.min(...a.products.map((p) => +p.wholesale || 0)) : 0;
              return (
                <article key={a.id} style={{ background: '#fff', border: '1px solid #dfe4dc', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,32,26,.06),0 8px 24px rgba(22,32,26,.06)' }}>
                  <div style={{ padding: '16px 18px' }}>
                    <h3 style={{ margin: '0 0 3px', fontSize: 17 }}>{esc(a.name)}</h3>
                    <div style={{ color: '#5b6b60', fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{ background: '#fbf1e0', color: '#a3671a', borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>{a.day}</span>
                      <span style={{ background: '#e6f1ea', color: '#0f3d28', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{a.products.length} products</span>
                    </div>
                    <div style={{ color: '#5b6b60', fontSize: 13, display: 'flex', gap: 12, marginTop: 6 }}>
                      <span>Ph: {esc(a.phone || '—')}</span>
                      {a.person && <span>Contact: {esc(a.person)}</span>}
                    </div>
                    {a.products.length > 0 && <div style={{ color: '#5b6b60', fontSize: 13, marginTop: 6 }}>From {money(ws)} wholesale</div>}
                  </div>
                  <div style={{ borderTop: '1px solid #dfe4dc', padding: '11px 18px', display: 'flex', gap: 8, background: '#fbfcfa', flexWrap: 'wrap' }}>
                    <button onClick={() => openOrder(a.id)} style={primarySmBtn}>Make list</button>
                    <button onClick={() => openProducts(a.id)} style={smBtn}>Products</button>
                    <button onClick={() => openAgency(a.id)} style={smBtn}>Edit</button>
                    <button onClick={() => deleteAgency(a.id)} style={dangerSmBtn}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Agency modal ── */}
      <Modal open={agencyModal} onClose={() => setAgencyModal(false)} maxWidth={560}>
        <div style={sheetHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{editingId ? 'Edit agency' : 'New agency'}</h3>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {[['Agency name', aName, setAName, 'text', 'Sri Balaji Agencies'],
              ['Phone number', aPhone, setAPhone, 'text', '98765 43210'],
              ['Contact person (optional)', aPerson, setAPerson, 'text', 'Ramesh']].map(([label, val, setter, type, ph]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>{label}</label>
                <input value={val} onChange={(e) => setter(e.target.value)} type={type} placeholder={ph} style={inputStyle} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Visit day</label>
              <select value={aDay} onChange={(e) => setADay(e.target.value)} style={inputStyle}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setAgencyModal(false)} style={outlineBtn}>Cancel</button>
          <button onClick={saveAgency} style={primaryBtn}>Save agency</button>
        </div>
      </Modal>

      {/* ── Products modal ── */}
      <Modal open={productModal} onClose={() => setProductModal(false)}>
        <div style={sheetHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{productAgency ? productAgency.name + ' — products' : 'Products'}</h3>
          <span style={{ fontSize: 12, color: '#5b6b60', marginLeft: 8 }}>{productAgency ? productAgency.day + ' • ' + (productAgency.phone || 'no phone') : ''}</span>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, alignItems: 'end' }}>
            {[['Product', pName, setPName, 'text', 'Toor Dal 1kg'],
              ['Unit', pUnit, setPUnit, 'text', 'pkt / kg / box'],
              ['Wholesale ₹', pWhole, setPWhole, 'number', ''],
              ['Retail ₹', pRetail, setPRetail, 'number', '']].map(([label, val, setter, type, ph]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>{label}</label>
                <input value={val} onChange={(e) => setter(e.target.value)} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} placeholder={ph} style={inputStyle} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>&nbsp;</label>
              <button onClick={addProduct} style={primaryBtn}>Add product</button>
            </div>
          </div>

          <div style={{ marginTop: 18, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Unit', 'Wholesale', 'Retail', 'Margin', ''].map((h, i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productAgency && productAgency.products.length === 0 ? (
                  <tr><td colSpan={6} style={{ color: '#5b6b60', padding: '22px 8px' }}>No products listed for this agency yet.</td></tr>
                ) : productAgency && productAgency.products.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{esc(p.name)}</td>
                    <td style={tdStyle}>{esc(p.unit || '—')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(p.wholesale)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(p.retail)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money((+p.retail || 0) - (+p.wholesale || 0))}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => removeProduct(productAgencyId, p.id)} style={dangerSmBtn}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setProductModal(false)} style={outlineBtn}>Done</button>
        </div>
      </Modal>

      {/* ── Order modal ── */}
      <Modal open={orderModal} onClose={() => setOrderModal(false)}>
        <div style={{ ...sheetHeaderStyle, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{orderAgency ? orderAgency.name + ' — purchase list' : 'Purchase list'}</h3>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid #dfe4dc', borderRadius: 9, overflow: 'hidden' }}>
            {['wholesale', 'retail'].map((m) => (
              <button
                key={m}
                onClick={() => setPriceMode(m)}
                style={{ border: 0, background: priceMode === m ? '#1f6f4a' : '#fff', color: priceMode === m ? '#fff' : '#16201a', padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Unit', 'Rate', 'Qty', 'Amount'].map((h, i) => (
                    <th key={i} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderAgency && orderAgency.products.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '22px 8px', color: '#5b6b60' }}>Add products to this agency first.</td></tr>
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
                            setCart((c) => {
                              const next = { ...c };
                              if (!v || v <= 0) delete next[p.id];
                              else next[p.id] = v;
                              return next;
                            });
                          }}
                          style={{ width: 78, textAlign: 'right', border: '1px solid #dfe4dc', borderRadius: 8, padding: '7px 8px', fontFamily: 'inherit', fontSize: 14 }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{q > 0 ? money(q * rate) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 16 }}>
            {[['Items selected', orderCount], ['Total quantity', orderQty]].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '6px 0' }}>
                <span>{label}</span><strong>{val}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, borderTop: '2px solid #16201a', marginTop: 8, paddingTop: 12 }}>
              <span>Total</span><span>{money(orderTotal)}</span>
            </div>
          </div>
        </div>
        <div style={sheetFooterStyle}>
          <button onClick={() => setOrderModal(false)} style={outlineBtn}>Close</button>
          <button onClick={() => setCart({})} style={outlineBtn}>Clear</button>
          <button onClick={() => shareImage(orderAgencyId, cart, priceMode)} style={outlineBtn}>Save / share image</button>
          <button onClick={() => {
            const d = orderData(orderAgencyId, cart, priceMode);
            if (!d.lines.length) return showToast('Select at least one product');
            const w = prompt('Thermal paper width in mm (58 or 80)?', '80');
            if (!w) return;
            printHTML(thermalTemplate(d, Math.max(40, parseInt(w, 10) || 80)));
          }} style={outlineBtn}>Thermal print</button>
          <button onClick={() => {
            const d = orderData(orderAgencyId, cart, priceMode);
            if (!d.lines.length) return showToast('Select at least one product');
            printHTML(a4Template(d));
          }} style={primaryBtn}>Print A4</button>
        </div>
      </Modal>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}

/* ── inline styles ── */
const labelStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.7px', color: '#5b6b60', fontWeight: 700 };
const inputStyle = { border: '1px solid #dfe4dc', background: '#fff', borderRadius: 10, padding: '10px 12px', minWidth: 180, outline: 'none', fontSize: 14, fontFamily: 'inherit', width: '100%' };
const primaryBtn = { background: '#1f6f4a', border: '1px solid #1f6f4a', color: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 7 };
const outlineBtn = { border: '1px solid #dfe4dc', background: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 7 };
const smBtn = { border: '1px solid #dfe4dc', background: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const primarySmBtn = { ...smBtn, background: '#1f6f4a', border: '1px solid #1f6f4a', color: '#fff' };
const dangerSmBtn = { ...smBtn, color: '#a32020', borderColor: '#eccaca', background: '#fdf3f3' };
const ghostLightBtn = { background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.28)', color: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const sheetHeaderStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid #dfe4dc', flexWrap: 'wrap' };
const sheetFooterStyle = { padding: '16px 22px', borderTop: '1px solid #dfe4dc', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', background: '#fbfcfa', borderRadius: '0 0 16px 16px' };
const thStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.7px', color: '#5b6b60', padding: '10px 8px', borderBottom: '1px solid #dfe4dc' };
const tdStyle = { padding: '10px 8px', borderBottom: '1px solid #dfe4dc', fontSize: 14 };
