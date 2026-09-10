'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function AuthGate({ children }) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const adminOnly = pathname.startsWith('/admin');

  useEffect(() => {
    if (loading) return;
    if (isLoginPage && user && role) {
      router.replace(role === 'admin' ? '/admin' : '/');
    } else if (!isLoginPage && (!user || !role)) {
      router.replace('/login');
    } else if (adminOnly && role !== 'admin') {
      router.replace('/');
    }
  }, [adminOnly, isLoginPage, loading, role, router, user]);

  if (isLoginPage) return children;
  if (loading || !user || !role || (adminOnly && role !== 'admin')) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#6b6258', fontFamily: 'system-ui, sans-serif' }}>
        Checking access…
      </main>
    );
  }

  return children;
}
