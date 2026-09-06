'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import { useStore } from '@/lib/store';
import { todayDateKey } from '@/lib/helpers';

const NAV = [
  { href: '/bill',      icon: '🧾', name: 'New Bill',     subFn: () => 'Create a sale' },
  { href: '/inventory', icon: '📦', name: 'Inventory',    subFn: (s) => `${s.inventory.length} products` },
  { href: '/veg',       icon: '🥕', name: 'Veg Prices',   subFn: (s) => `${s.vegPrices.length} items` },
  { href: '/history',   icon: '📊', name: 'Sales',        subFn: (s) => `${s.bills.length} records` },
  { href: '/admin',     icon: '🛡️', name: 'Admin',        subFn: () => 'Overview & tools' },
  { href: '/settings',  icon: '⚙️', name: 'Settings',     subFn: () => 'Store & printer' },
];

export default function Home() {
  const store = useStore();

  return (
    <>
      <Header />
      <main className="wrap" style={{ paddingTop: 20 }}>
        <div className="home-grid">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div className="home-card">
                <span className="hc-icon">{item.icon}</span>
                <span className="hc-name">{item.name}</span>
                <span className="hc-sub">{item.subFn(store)}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
