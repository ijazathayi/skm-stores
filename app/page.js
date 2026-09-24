'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const store = useStore();
  const { role } = useAuth();
  const { lang } = store;
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
      href: '/restock',
      icon: '📦',
      name: 'Restock Manager',
      sub: isTa ? 'சரக்கு மேலாண்மை' : 'Manage stock restocks'
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
    ...(role === 'admin' ? [{
      href: '/admin',
      icon: '🛡️',
      name: isTa ? 'நிர்வாகம்' : 'Admin',
      sub: isTa ? 'மேலாண்மை கருவிகள்' : 'Overview & tools'
    }] : []),
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
        <section className="home-intro">
          <p className="home-eyebrow">{isTa ? 'இன்றைய வேலை' : "Today's work"}</p>
          <h1>{isTa ? 'கடையை நிர்வகிக்கவும்' : 'What do you need to do?'}</h1>
          <p>{isTa ? 'அடிக்கடி பயன்படுத்தும் செயல்களை முதலில் தேர்வு செய்யவும்.' : 'Start with a common task, or open more tools below.'}</p>
        </section>
        <h2 className="home-section-title">{isTa ? 'விரைவான செயல்கள்' : 'Quick actions'}</h2>
        <div className="home-grid">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`home-link${['/bill', '/inventory', '/history'].includes(item.href) ? ' home-link-primary' : ''}`}>
              <div className="home-card" data-primary={['/bill', '/inventory', '/history'].includes(item.href) ? 'true' : undefined}>
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
