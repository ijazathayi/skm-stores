'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';

const LS = (k, def) => typeof window !== 'undefined' ? (localStorage.getItem(k) || def) : def;

export default function SettingsPage() {
  const [storeName,    setStoreName]    = useState('SKM STORES');
  const [storePhone,   setStorePhone]   = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [receiptFooter,setReceiptFooter]= useState('THANK YOU VISIT AGAIN');
  const [printWidth,   setPrintWidth]   = useState(58);
  const [printLang,    setPrintLang]    = useState('en');
  const [curPwd,       setCurPwd]       = useState('');
  const [newPwd,       setNewPwd]       = useState('');
  const [conPwd,       setConPwd]       = useState('');
  const [saved,        setSaved]        = useState('');

  useEffect(() => {
    setStoreName(LS('skm_storeName','SKM STORES'));
    setStorePhone(LS('skm_storePhone',''));
    setStoreAddress(LS('skm_storeAddress',''));
    setReceiptFooter(LS('skm_receiptFooter','THANK YOU VISIT AGAIN'));
    setPrintWidth(Number(LS('skm_printWidth','58')) || 58);
    setPrintLang(LS('skm_printLang','en'));
  }, []);

  const saveStore = () => {
    localStorage.setItem('skm_storeName', storeName);
    localStorage.setItem('skm_storePhone', storePhone);
    localStorage.setItem('skm_storeAddress', storeAddress);
    localStorage.setItem('skm_receiptFooter', receiptFooter);
    setSaved('✓ Saved!');
    setTimeout(() => setSaved(''), 2000);
  };

  const savePrintWidth = (w) => {
    const v = Number(w);
    if (!v || v < 40 || v > 120) { alert('Enter 40–120 mm'); return; }
    setPrintWidth(v);
    localStorage.setItem('skm_printWidth', v);
    setSaved('✓ Width saved!');
    setTimeout(() => setSaved(''), 2000);
  };

  const changePwd = () => {
    const stored = LS('skm_adminPassword','skm@ijaz');
    if (curPwd !== stored) { alert('Current password incorrect'); return; }
    if (!newPwd) { alert('New password cannot be empty'); return; }
    if (newPwd !== conPwd) { alert('Passwords do not match'); return; }
    localStorage.setItem('skm_adminPassword', newPwd);
    setCurPwd(''); setNewPwd(''); setConPwd('');
    setSaved('✓ Password updated!');
    setTimeout(() => setSaved(''), 2000);
  };

  return (
    <>
      <Header backHref="/" title="⚙ Settings" />
      <main className="wrap">
        {saved && <div style={{ background: '#E8F0E6', color: 'var(--primary-dark)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontWeight: 700 }}>{saved}</div>}

        {/* Store Profile */}
        <div className="settings-card">
          <h4>🏪 Store Profile</h4>
          <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '4px 0 14px' }}>Printed on every receipt.</p>
          {[['Store Name', storeName, setStoreName], ['Phone / Mobile', storePhone, setStorePhone], ['Address', storeAddress, setStoreAddress], ['Receipt Footer', receiptFooter, setReceiptFooter]].map(([l, v, s]) => (
            <div key={l} className="setting-field">
              <label>{l}</label>
              <input type="text" value={v} onChange={(e) => s(e.target.value)} />
            </div>
          ))}
          <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={saveStore}>Save Settings</button>
        </div>

        {/* Print Settings */}
        <div className="settings-card">
          <h4>🖨 Print Settings</h4>
          <div className="setting-field" style={{ marginBottom: 14 }}>
            <label>Paper Width (mm)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[58, 72, 80].map((w) => (
                <button key={w} onClick={() => savePrintWidth(w)} style={{
                  border: `1.5px solid ${printWidth===w?'var(--primary)':'var(--border)'}`, borderRadius: 8,
                  background: printWidth===w?'var(--primary)':'var(--paper)', padding: '8px 16px',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  color: printWidth===w?'#fff':'var(--ink)', minHeight: 40
                }}>{w} mm</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={printWidth} min={40} max={120}
                onChange={(e) => setPrintWidth(e.target.value)} style={{ width: 80, textAlign: 'center' }} />
              <span style={{ fontSize: 13, color: 'var(--ink3)' }}>mm</span>
              <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 13, minHeight: 40 }} onClick={() => savePrintWidth(printWidth)}>Save</button>
            </div>
          </div>
          <div className="setting-field">
            <label>Receipt Language</label>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--paper)', overflow: 'hidden' }}>
              {[['en','English'],['ta','தமிழ்']].map(([l,name]) => (
                <button key={l} onClick={() => { setPrintLang(l); localStorage.setItem('skm_printLang',l); }} style={{
                  border: 'none', padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: printLang===l?'var(--primary)':'transparent',
                  color: printLang===l?'#fff':'var(--ink3)'
                }}>{name}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Admin Password */}
        <div className="settings-card">
          <h4>🔒 Admin Password</h4>
          <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '4px 0 14px' }}>Required for delete operations.</p>
          {[['Current Password', curPwd, setCurPwd], ['New Password', newPwd, setNewPwd], ['Confirm New Password', conPwd, setConPwd]].map(([l, v, s]) => (
            <div key={l} className="setting-field">
              <label>{l}</label>
              <input type="password" value={v} onChange={(e) => s(e.target.value)} autoComplete="off" />
            </div>
          ))}
          <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={changePwd}>Update Password</button>
        </div>
      </main>
    </>
  );
}
