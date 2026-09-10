'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState('worker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile = await getDoc(doc(db, 'users', result.user.uid));
      const role = profile.exists() ? profile.data().role : null;
      if (role !== accountType) {
        await signOut(auth);
        setError(role ? `This account is registered as ${role}, not ${accountType}.` : 'This account has no assigned role. Ask the administrator to set it up.');
        return;
      }
      router.replace(role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Email or password is incorrect.' : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20, background: 'linear-gradient(145deg, #f8f2e7, #e7f0e4)', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: 'min(410px, 100%)', background: '#fffdf8', border: '1px solid #ded5c7', borderRadius: 20, padding: '32px 28px', boxShadow: '0 18px 48px rgba(62, 77, 54, .16)' }}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 10, marginBottom: 24 }}>
          <Image src="/skm-logo.png" alt="SKM Stores" width={58} height={58} style={{ borderRadius: 16 }} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 25, color: '#244b29' }}>SKM Stores</h1>
            <p style={{ margin: '5px 0 0', color: '#6b6258', fontSize: 14 }}>Sign in to continue</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 4, background: '#f0ece4', borderRadius: 12 }}>
          {['worker', 'admin'].map((type) => (
            <button key={type} type="button" onClick={() => setAccountType(type)} style={{ border: 0, borderRadius: 9, padding: '10px 8px', cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize', background: accountType === type ? '#3b6e44' : 'transparent', color: accountType === type ? '#fff' : '#5e584f' }}>
              {type === 'worker' ? '👷 Worker' : '🛡️ Admin'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label style={labelStyle}>Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
          </label>
          {error && <p style={{ margin: 0, color: '#b42318', fontSize: 13, fontWeight: 600 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ border: 0, borderRadius: 10, padding: '12px 16px', background: '#3b6e44', color: '#fff', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? .65 : 1 }}>
            {submitting ? 'Signing in…' : `Sign in as ${accountType}`}
          </button>
        </form>
      </section>
    </main>
  );
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#4f4b43' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #cfc7bb', borderRadius: 9, padding: '11px 12px', background: '#fff', fontSize: 15, color: '#24211d' };
