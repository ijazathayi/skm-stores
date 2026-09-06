'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { t } from '@/lib/translations';

export default function Home() {
  const store = useStore();
  const { lang, setLang } = store;
  const isTa = lang === 'ta';

  const NAV = [
    {
      href: '/bill',
      icon: '🧾',
      name: isTa ? 'புதிய ரசீது' : 'New Bill',
      sub: isTa ? 'விற்பனை ரசீது போடு' : 'Create a sale'
    },
    {
      href: '/inventory',
      icon: '📦',
      name: isTa ? 'சரக்கு இருப்பு' : 'Inventory',
      sub: isTa ? `${store.inventory?.length || 0} பொருட்கள்` : `${store.inventory?.length || 0} products`
    },
    {
      href: '/veg',
      icon: '🥕',
      name: isTa ? 'காய்கறி விலை' : 'Veg Prices',
      sub: isTa ? `${store.vegPrices?.length || 0} வகைகள்` : `${store.vegPrices?.length || 0} items`
    },
    {
      href: '/history',
      icon: '📊',
      name: isTa ? 'விற்பனை வரலாறு' : 'Sales',
      sub: isTa ? `${store.bills?.length || 0} ரசீதுகள்` : `${store.bills?.length || 0} records`
    },
    {
      href: '/buy-milk',
      icon: '🥛',
      name: isTa ? 'பால் கொள்முதல்' : 'Buy Milk',
      sub: isTa ? 'தினசரி பால் கணக்கு' : 'Daily dairy order'
    },
    {
      href: '/agency',
      icon: '🏢',
      name: isTa ? 'ஏஜென்சி ஆர்டர்கள்' : 'Agency Orders',
      sub: isTa ? 'சரக்கு கொள்முதல் மேலாளர்' : 'Purchase manager'
    },
    {
      href: '/debtors',
      icon: '📒',
      name: isTa ? 'கடன் புத்தகம்' : 'Debtors Book',
      sub: isTa ? 'வாடிக்கையாளர் கடன் கணக்கு' : 'Customer debt ledger'
    },
    {
      href: '/admin',
      icon: '🛡️',
      name: isTa ? 'நிர்வாகம்' : 'Admin',
      sub: isTa ? 'மேலாண்மை கருவிகள்' : 'Overview & tools'
    },
    {
      href: '/settings',
      icon: '⚙️',
      name: isTa ? 'அமைப்புகள்' : 'Settings',
      sub: isTa ? 'கடை & பிரின்டர்' : 'Store & printer'
    },
  ];

  return (
    <>
      <Header />
      <main className="wrap" style={{ paddingTop: 12 }}>
        {/* Language Selection Bar on Main Page */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card)',
          border: '1.5px solid var(--border)',
          borderRadius: 14,
          padding: '10px 16px',
          marginBottom: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🌐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                {isTa ? 'செயலியின் மொழி' : 'App Language'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                {isTa ? 'தமிழ் தேர்ந்தெடுக்கப்பட்டுள்ளது' : 'English is active'}
              </div>
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            border: '1.5px solid var(--primary)',
            borderRadius: 999,
            background: 'var(--paper)',
            padding: 3,
            gap: 4
          }}>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                background: !isTa ? 'var(--primary)' : 'transparent',
                color: !isTa ? '#fff' : 'var(--ink3)',
                transition: 'all 0.15s ease'
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('ta')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                background: isTa ? 'var(--primary)' : 'transparent',
                color: isTa ? '#fff' : 'var(--ink3)',
                transition: 'all 0.15s ease'
              }}
            >
              தமிழ்
            </button>
          </div>
        </div>

        <div className="home-grid">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="home-card">
                <span className="hc-icon">{item.icon}</span>
                <span className="hc-name">{item.name}</span>
                <span className="hc-sub">{item.sub}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

