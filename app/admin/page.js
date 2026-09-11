'use client';
import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { money } from '@/lib/helpers';
import { auth } from '@/lib/firebase';

export default function AdminPage() {
  const {
    inventory, bills, todaySales,
    deleteSale, deleteInventoryItem,
    milkPrices, updateMilkPrices, lang
  } = useStore();
  const isTa = lang === 'ta';

  // ── milk price edit state ──
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft]       = useState([]);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', password: '', role: 'staff' });
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffMsg, setStaffMsg] = useState('');
  const [staffSaving, setStaffSaving] = useState(false);

  const staffRequest = useCallback(async (method, body) => {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch('/api/admin/staff', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Staff request failed.');
    return result;
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const result = await staffRequest('GET');
      setStaff(result.staff || []);
    } catch (error) {
      setStaffMsg(error.message);
    }
  }, [staffRequest]);

  useEffect(() => {
    const timer = setTimeout(() => { loadStaff(); }, 0);
    return () => clearTimeout(timer);
  }, [loadStaff]);

  async function saveStaff(event) {
    event.preventDefault();
    if (staffSaving) return;
    setStaffSaving(true);
    setStaffMsg('');
    try {
      if (editingStaff) {
        await staffRequest('PATCH', { id: editingStaff.id, ...staffForm });
      } else {
        await staffRequest('POST', staffForm);
      }
      setStaffForm({ name: '', password: '', role: 'staff' });
      setEditingStaff(null);
      setStaffMsg('Staff account saved.');
      await loadStaff();
    } catch (error) {
      setStaffMsg(error.message);
    } finally {
      setStaffSaving(false);
    }
  }

  async function removeStaff(member) {
    if (!window.confirm(`Delete the ${member.name || member.email} staff account?`)) return;
    try {
      await staffRequest('DELETE', { id: member.id });
      setStaffMsg('Staff account deleted.');
      await loadStaff();
    } catch (error) {
      setStaffMsg(error.message);
    }
  }

  function beginStaffEdit(member) {
    setEditingStaff(member);
    setStaffForm({ name: member.name || member.email?.split('@')[0] || '', password: '', role: member.role || 'staff' });
    setStaffMsg('');
  }

  const totalRevenue = bills.reduce((s, b) => s + (b.total || 0), 0);

  const enterEdit = () => {
    // deep-clone so we don't mutate store data
    setDraft(milkPrices.map((p) => ({ ...p })));
    setEditMode(true);
    setSaveMsg('');
  };

  const cancelEdit = () => {
    setEditMode(false);
    setDraft([]);
    setSaveMsg('');
  };

  const handleDraftChange = (key, field, value) => {
    setDraft((prev) =>
      prev.map((p) => p.key === key ? { ...p, [field]: value } : p)
    );
  };

  const saveEdit = async () => {
    // basic validation — reject blank / negative prices
    for (const p of draft) {
      if (p.wp === '' || p.sp === '' || Number(p.wp) < 0 || Number(p.sp) < 0) {
        setSaveMsg(isTa ? '⚠️ அனைத்து விலைகளும் 0 அல்லது அதற்கு மேல் இருக்க வேண்டும்.' : '⚠️ All prices must be 0 or above.');
        return;
      }
    }
    setSaving(true);
    setSaveMsg('');
    try {
      // normalise numbers before saving
      const normalised = draft.map((p) => ({
        ...p,
        wp: parseFloat(Number(p.wp).toFixed(2)),
        sp: parseFloat(Number(p.sp).toFixed(2)),
      }));
      await updateMilkPrices(normalised);
      setEditMode(false);
      setDraft([]);
      setSaveMsg(isTa ? '✅ விலைகள் சேமிக்கப்பட்டன!' : '✅ Prices saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(isTa ? '❌ சேமிப்பதில் பிழை: ' + err.message : '❌ Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── inventory delete all ──
  const deleteAllInventory = async () => {
    if (!confirm(isTa ? `அனைத்து ${inventory.length} பொருட்களையும் நீக்கவா? இதை திரும்பப் பெற முடியாது.` : `Delete ALL ${inventory.length} products? Cannot be undone.`)) return;
    if (!confirm(isTa ? 'உறுதிசெய்க — அனைத்து பொருட்களையும் நீக்கவா?' : 'Final confirm — delete every product?')) return;
    for (const p of inventory) await deleteInventoryItem(p.id);
  };

  // group milk prices by section for display
  const sections = milkPrices.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  return (
    <>
      <Header backHref="/" title={isTa ? '🛡 நிர்வாகம்' : '🛡 Admin'} />
      <main className="wrap">

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
          {[
            [isTa ? 'சரக்கு பொருட்கள்' : 'Inventory Items', inventory.length],
            [isTa ? 'மொத்த விற்பனைகள்' : 'Total Sales',     bills.length],
            [isTa ? 'இன்றைய விற்பனை' : "Today's Sales",   money(todaySales())],
            [isTa ? 'மொத்த வருவாய்' : 'Revenue',         money(totalRevenue)],
          ].map(([l, v]) => (
            <div key={l} className="bill-card">
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-dark)', marginTop: 8 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── Staff management ── */}
        <div className="settings-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0 }}>👥 Staff Management</h4>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>Add, edit roles, reset passwords, or remove staff accounts.</div>
            </div>
            {staffMsg && <span style={{ fontSize: 13, color: staffMsg.includes('saved') || staffMsg.includes('deleted') ? 'var(--primary-dark)' : 'var(--danger)' }}>{staffMsg}</span>}
          </div>
          <form onSubmit={saveStaff} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px auto', gap: 8, marginBottom: 14 }}>
            <input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} placeholder="Name / login" required style={priceInputStyle} />
            <input type="password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} placeholder={editingStaff ? 'New password (optional)' : 'Password'} required={!editingStaff} style={priceInputStyle} />
            <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })} style={priceInputStyle}><option value="staff">Staff</option><option value="admin">Admin</option></select>
            <button type="submit" disabled={staffSaving} style={{ background: 'var(--primary)', color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>{staffSaving ? 'Saving…' : editingStaff ? 'Update' : 'Add staff'}</button>
          </form>
            {editingStaff && <button onClick={() => { setEditingStaff(null); setStaffForm({ name: '', password: '', role: 'staff' }); }} style={{ marginBottom: 12, border: 0, background: 'transparent', color: 'var(--ink3)', textDecoration: 'underline', cursor: 'pointer' }}>Cancel editing</button>}
          <div className="inv-list">
            {staff.map((member) => <div key={member.id} className="inv-row"><div style={{ flex: 1 }}><strong>{member.name || member.email || member.id}</strong><span style={{ display: 'block', color: 'var(--ink3)', fontSize: 12 }}>{member.email} · {member.role}</span></div><button className="icon-btn" onClick={() => beginStaffEdit(member)} title="Edit staff">✏️</button><button className="icon-btn" onClick={() => removeStaff(member)} title="Delete staff">🗑</button></div>)}
          </div>
        </div>

        {/* ── 🥛 Buy Milk Prices ── */}
        <div className="settings-card" style={{ marginBottom: 24 }}>

          {/* header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h4 style={{ margin: 0 }}>{isTa ? '🥛 பால் கொள்முதல் விலை பட்டியல்' : '🥛 Buy Milk Prices'}</h4>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>
                {isTa ? 'மொத்த விலை (WP) = கொள்முதல் கணக்கீடு · சில்லறை விலை (SP) = விற்பனை விலை' : 'Wholesale Price = used for bill calculations · Price = retail display'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {saveMsg && (
                <span style={{ fontSize: 13, fontWeight: 600, color: saveMsg.startsWith('✅') ? 'var(--primary-dark)' : '#a93b2c' }}>
                  {saveMsg}
                </span>
              )}
              {!editMode ? (
                <button
                  onClick={enterEdit}
                  style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isTa ? '✏️ விலையைத் திருத்துக' : '✏️ Edit Prices'}
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--ink3)', cursor: 'pointer' }}>
                    {isTa ? 'ரத்து' : 'Cancel'}
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : '💾 Save'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* price table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--paper)' }}>
                  <th style={thStyle}>Section</th>
                  <th style={thStyle}>Packet</th>
                  <th style={thStyle}>Wholesale Price (₹)</th>
                  <th style={thStyle}>Retail Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(editMode ? draft : milkPrices).map((item, idx) => {
                  const isNewSection =
                    idx === 0 ||
                    (editMode ? draft : milkPrices)[idx - 1].section !== item.section;
                  const sectionItems = (editMode ? draft : milkPrices).filter(
                    (p) => p.section === item.section
                  );
                  const sectionStart = (editMode ? draft : milkPrices).findIndex(
                    (p) => p.section === item.section
                  );

                  return (
                    <tr key={item.key} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? '#fff' : 'var(--paper)' }}>
                      {/* section cell — rowspan per section */}
                      {isNewSection && (
                        <td
                          rowSpan={sectionItems.length}
                          style={{ ...tdStyle, fontWeight: 700, color: 'var(--primary-dark)', background: '#E8F0E6', verticalAlign: 'middle', textAlign: 'center' }}>
                          {item.section}
                        </td>
                      )}
                      <td style={tdStyle}>{item.label}</td>

                      {/* Wholesale Price */}
                      <td style={tdStyle}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={item.wp}
                            onChange={(e) => handleDraftChange(item.key, 'wp', e.target.value)}
                            style={priceInputStyle}
                          />
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>₹{Number(item.wp).toFixed(2)}</span>
                        )}
                      </td>

                      {/* Retail Price */}
                      <td style={tdStyle}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={item.sp}
                            onChange={(e) => handleDraftChange(item.key, 'sp', e.target.value)}
                            style={priceInputStyle}
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>₹{Number(item.sp).toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editMode && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink3)' }}>
              💡 Tip: changes save to Firestore and take effect on the Buy Milk page immediately.
            </div>
          )}
        </div>

        {/* ── Inventory + Sales ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18 }}>

          {/* Inventory */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Inventory</span>
              <button
                onClick={deleteAllInventory}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🗑 Delete All
              </button>
            </div>
            <div className="inv-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
              {inventory.length === 0
                ? <div className="empty-box">No products.</div>
                : inventory.map((p) => (
                  <div key={p.id} className="inv-row">
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      {p.price && (
                        <span style={{ background: 'var(--primary)', color: '#fff', padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
                          ₹{Number(p.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <button className="icon-btn" onClick={() => { if (confirm('Delete?')) deleteInventoryItem(p.id); }}>🗑</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Sales */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Sales</div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {bills.length === 0
                ? <div className="empty-box">No sales.</div>
                : bills.map((b) => (
                  <div key={b.id} className="bill-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(b.timestamp).toLocaleString()}</div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark)' }}>{money(b.total)}</span>
                        <button className="icon-btn" onClick={() => { if (confirm('Delete this sale permanently?')) deleteSale(b.id); }}>🗑</button>
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>{(b.items || []).length} items</div>
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

/* ── inline style helpers ── */
const thStyle = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 12,
  color: 'var(--ink3)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const priceInputStyle = {
  width: 90,
  padding: '6px 8px',
  border: '1.5px solid var(--primary)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink)',
  background: '#fff',
  outline: 'none',
  textAlign: 'right',
};
