'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import PasskeySetup from '@/components/PasskeySetup';
import { useStore } from '@/lib/store';

const LS = (k, def) => typeof window !== 'undefined' ? (localStorage.getItem(k) || def) : def;

export default function SettingsPage() {
  const { storeProfile, updateStoreProfile, lang, setLang } = useStore();
  const isTa = lang === 'ta';

  // ── store profile fields (seeded from Firestore via store) ──
  const [storeName,     setStoreName]     = useState('SKM STORES');
  const [storePhone,    setStorePhone]    = useState('');
  const [storeAddress,  setStoreAddress]  = useState('');
  const [receiptFooter, setReceiptFooter] = useState('THANK YOU VISIT AGAIN');

  // ── print / lang settings ──
  const [printWidth, setPrintWidth] = useState(58);
  const [printLang,  setPrintLang]  = useState('en');
  const [messageLang, setMessageLang] = useState('en');

  // ── password fields ──
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [conPwd, setConPwd] = useState('');

  const [saved, setSaved] = useState('');

  // Seed form from Firestore store profile whenever it loads/changes
  useEffect(() => {
    if (storeProfile) {
      if (storeProfile.storeName) setStoreName(storeProfile.storeName);
      if (storeProfile.storePhone !== undefined) setStorePhone(storeProfile.storePhone);
      if (storeProfile.storeAddress !== undefined) setStoreAddress(storeProfile.storeAddress);
      if (storeProfile.receiptFooter) setReceiptFooter(storeProfile.receiptFooter);
      if (storeProfile.printLang) {
        setPrintLang(storeProfile.printLang);
        if (typeof window !== 'undefined') localStorage.setItem('skm_printLang', storeProfile.printLang);
      }
      if (storeProfile.messageLang) {
        setMessageLang(storeProfile.messageLang);
        if (typeof window !== 'undefined') localStorage.setItem('skm_messageLang', storeProfile.messageLang);
      }
      if (storeProfile.printWidth) {
        setPrintWidth(Number(storeProfile.printWidth));
        if (typeof window !== 'undefined') localStorage.setItem('skm_printWidth', storeProfile.printWidth);
      }
    }
  }, [storeProfile]);

  // Seed print settings from localStorage fallback
  useEffect(() => {
    const savedWidth = Number(LS('skm_printWidth', '58')) || 58;
    const savedLang = LS('skm_lang', LS('skm_printLang', 'en'));
    const savedMessageLang = LS('skm_messageLang', 'en');
    setPrintWidth(savedWidth);
    setPrintLang(savedLang);
    setMessageLang(savedMessageLang);
  }, []);

  const flash = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 3000); };

  /* ── Save store profile to Firestore ── */
  const saveStore = async () => {
    try {
      await updateStoreProfile({
        storeName: storeName.trim() || 'SKM STORES',
        storePhone: storePhone.trim(),
        storeAddress: storeAddress.trim(),
        receiptFooter: receiptFooter.trim() || (isTa ? 'நன்றி மீண்டும் வருக!' : 'THANK YOU VISIT AGAIN'),
        printWidth,
        printLang,
        messageLang
      });
      flash(isTa ? '✓ கடை விவரங்கள் சேமிக்கப்பட்டன!' : '✓ Store profile saved to cloud!');
    } catch (err) {
      flash(isTa ? '❌ சேமிப்பதில் பிழை: ' + err.message : '❌ Save failed: ' + err.message);
    }
  };

  /* ── Print width ── */
  const savePrintWidth = async (w) => {
    const v = Number(w);
    if (!v || v < 40 || v > 120) { alert(isTa ? '40 முதல் 120 மிமீ வரை உள்ளிடவும்' : 'Enter 40–120 mm'); return; }
    setPrintWidth(v);
    if (typeof window !== 'undefined') localStorage.setItem('skm_printWidth', v);
    try {
      await updateStoreProfile({ printWidth: v });
      flash(isTa ? `✓ தாள் அகலம் (${v} mm) சேமிக்கப்பட்டது!` : `✓ Paper width saved (${v} mm)!`);
    } catch (err) {
      flash(isTa ? '✓ அகலம் சேமிக்கப்பட்டது' : '✓ Width saved locally');
    }
  };

  /* ── Print Language ── */
  const changePrintLang = async (l) => {
    setPrintLang(l);
    setLang(l);
    flash(l === 'ta' ? '✓ மொழி: தமிழ் (Tamil) மாற்றப்பட்டது!' : '✓ Language set to English!');
  };

  const changeMessageLang = async (l) => {
    setMessageLang(l);
    if (typeof window !== 'undefined') localStorage.setItem('skm_messageLang', l);
    try {
      await updateStoreProfile({ messageLang: l });
      flash(l === 'ta' ? '✓ Debtor messages will be sent in Tamil!' : '✓ Debtor messages will be sent in English!');
    } catch (err) {
      flash(isTa ? '❌ சேமிப்பதில் பிழை: ' + err.message : '❌ Could not save message language: ' + err.message);
    }
  };

  /* ── Admin password (localStorage only) ── */
  const changePwd = () => {
    const stored = LS('skm_adminPassword', 'skm@ijaz');
    if (curPwd !== stored)  { alert(isTa ? 'தற்போதைய கடவுச்சொல் தவறானது' : 'Current password incorrect'); return; }
    if (!newPwd)            { alert(isTa ? 'புதிய கடவுச்சொல் காலியாக இருக்கக்கூடாது' : 'New password cannot be empty'); return; }
    if (newPwd !== conPwd)  { alert(isTa ? 'கடவுச்சொற்கள் பொருந்தவில்லை' : 'Passwords do not match'); return; }
    localStorage.setItem('skm_adminPassword', newPwd);
    setCurPwd(''); setNewPwd(''); setConPwd('');
    flash(isTa ? '✓ கடவுச்சொல் மாற்றப்பட்டது!' : '✓ Password updated!');
  };

  return (
    <>
      <Header backHref="/" title={isTa ? '⚙ அமைப்புகள்' : '⚙ Settings'} />
      <main className="wrap">
        {saved && (
          <div style={{
            background: saved.startsWith('❌') ? '#FDECEF' : 'var(--success-soft)',
            color: saved.startsWith('❌') ? 'var(--danger)' : 'var(--primary-dark)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontWeight: 700,
          }}>
            {saved}
          </div>
        )}

        <PasskeySetup />

        {/* ── Store Profile ── */}
        <div className="settings-card">
          <h4>🏪 {isTa ? 'கடை விவரங்கள்' : 'Store Profile'}</h4>
          <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '4px 0 14px' }}>
            {isTa ? 'மேகக்கணியில் சேமிக்கப்பட்டு ஒவ்வொரு ரசீதிலும் அச்சிடப்படும்.' : 'Saved to cloud — printed on every receipt.'}
          </p>
          {[
            [isTa ? 'கடை பெயர்' : 'Store Name',      storeName,     setStoreName],
            [isTa ? 'தொலைபேசி / அலைபேசி' : 'Phone / Mobile',  storePhone,    setStorePhone],
            [isTa ? 'முகவரி' : 'Address',         storeAddress,  setStoreAddress],
            [isTa ? 'ரசீது முடிவு வாசகம்' : 'Receipt Footer',  receiptFooter, setReceiptFooter],
          ].map(([l, v, s]) => (
            <div key={l} className="setting-field">
              <label>{l}</label>
              <input type="text" value={v} onChange={(e) => s(e.target.value)} />
            </div>
          ))}
          <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={saveStore}>
            {isTa ? 'அமைப்புகளைச் சேமி' : 'Save Settings'}
          </button>
        </div>

        {/* ── Print Settings ── */}
        <div className="settings-card">
          <h4>🖨 {isTa ? 'பிரின்டர் மற்றும் மொழி அமைப்புகள்' : 'Print & Language Settings'}</h4>
          <div className="setting-field" style={{ marginBottom: 14 }}>
            <label>{isTa ? 'தாள் அகலம் (Paper Width mm)' : 'Paper Width (mm)'}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[58, 72, 80].map((w) => (
                <button key={w} onClick={() => savePrintWidth(w)} style={{
                  border: `1.5px solid ${printWidth === w ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: printWidth === w ? 'var(--primary)' : 'var(--paper)',
                  padding: '8px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  color: printWidth === w ? '#fff' : 'var(--ink)', minHeight: 40,
                }}>{w} mm</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" value={printWidth} min={40} max={120}
                onChange={(e) => setPrintWidth(e.target.value)}
                style={{ width: 80, textAlign: 'center' }}
              />
              <span style={{ fontSize: 13, color: 'var(--ink3)' }}>mm</span>
              <button
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, minHeight: 40 }}
                onClick={() => savePrintWidth(printWidth)}>
                {isTa ? 'சேமி' : 'Save'}
              </button>
            </div>
          </div>
          <div className="setting-field">
            <label>{isTa ? 'செயலி மற்றும் ரசீது மொழி' : 'App & Receipt Language'}</label>
            <div className="language-control" style={{ display: 'inline-flex', border: '1.5px solid var(--primary)', borderRadius: 999, background: 'var(--paper)', overflow: 'hidden' }}>
              {[['en', 'English'], ['ta', 'தமிழ்']].map(([l, name]) => (
                <button key={l} onClick={() => changePrintLang(l)} style={{
                  border: 'none', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: (lang || printLang) === l ? 'var(--primary)' : 'transparent',
                  color: (lang || printLang) === l ? '#fff' : 'var(--ink3)',
                }}>{name}</button>
              ))}
            </div>
          </div>
          <div className="setting-field message-language-setting">
            <label>{isTa ? 'கடன் செய்தி மொழி' : 'Debtor Message Language'}</label>
            <div className="language-control" style={{ display: 'inline-flex', border: '1.5px solid var(--primary)', borderRadius: 999, background: 'var(--paper)', overflow: 'hidden' }}>
              {['en', 'ta'].map((value) => (
                <button key={value} onClick={() => changeMessageLang(value)} style={{
                  border: 'none', padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: messageLang === value ? 'var(--primary)' : 'transparent',
                  color: messageLang === value ? '#fff' : 'var(--ink3)',
                }}>{value === 'ta' ? 'தமிழ்' : 'English'}</button>
              ))}
            </div>
            <span className="language-setting-help" style={{ fontSize: 12, color: 'var(--ink3)' }}>
              {isTa ? 'SMS மற்றும் WhatsApp கடன் செய்திகள்' : 'SMS and WhatsApp debtor messages'}
            </span>
          </div>
        </div>

        {/* ── Admin Password ── */}
        <div className="settings-card">
          <h4>🔒 {isTa ? 'நிர்வாக கடவுச்சொல்' : 'Admin Password'}</h4>
          <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '4px 0 14px' }}>
            {isTa ? 'நிர்வாக பக்கத்தை அணுக கடவுச்சொல் தேவை.' : 'Required to access the Admin panel.'}
          </p>
          {[
            [isTa ? 'தற்போதைய கடவுச்சொல்' : 'Current Password',     curPwd, setCurPwd],
            [isTa ? 'புதிய கடவுச்சொல்' : 'New Password',         newPwd, setNewPwd],
            [isTa ? 'புதிய கடவுச்சொல்லை உறுதிசெய்' : 'Confirm New Password', conPwd, setConPwd],
          ].map(([l, v, s]) => (
            <div key={l} className="setting-field">
              <label>{l}</label>
              <input type="password" value={v} onChange={(e) => s(e.target.value)} autoComplete="off" />
            </div>
          ))}
          <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={changePwd}>
            {isTa ? 'கடவுச்சொல்லை மாற்றுக' : 'Update Password'}
          </button>
        </div>
      </main>
    </>
  );
}
