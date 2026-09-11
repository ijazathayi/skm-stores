'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { browserLocalPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { startAuthentication } from '@simplewebauthn/browser';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('kasim');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function readPasskeyResponse(response) {
    const rawBody = await response.text();
    let body = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // Some static hosting services return an empty or HTML response for API routes.
    }
    if (!response.ok || !body) {
      if (body?.error) throw new Error(body.error);
      throw new Error(`Fingerprint sign-in service is unavailable (server response ${response.status}). The app must be deployed with server routes enabled.`);
    }
    return body;
  }

  async function signInWithFingerprint() {
    if (submitting) return;
    const cleanName = name.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanName)) {
      setError('Enter your name first, then use fingerprint sign-in.');
      return;
    }
    if (!window.PublicKeyCredential) {
      setError('This browser or device does not support fingerprint sign-in.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const options = await readPasskeyResponse(await fetch('/api/passkeys/login/options', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName }),
      }));
      const response = await startAuthentication({ optionsJSON: options });
      const { token } = await readPasskeyResponse(await fetch('/api/passkeys/login/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cleanName, response }),
      }));
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithCustomToken(auth, token);
      const profile = await getDoc(doc(db, 'user', result.user.uid));
      const role = profile.exists() ? profile.data().role : null;
      if (role !== 'admin' && role !== 'worker') throw new Error('This account has no assigned role.');
      localStorage.setItem('skm_auth_session_expires_at', String(Date.now() + 24 * 60 * 60 * 1000));
      router.replace('/');
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Fingerprint sign-in was cancelled.' : err.message || 'Fingerprint sign-in could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const cleanName = name.trim().toLowerCase();

    try {
      if (!/^[a-z0-9._-]{3,30}$/.test(cleanName)) {
        setError('Enter a name using 3–30 letters, numbers, dots, dashes, or underscores.');
        return;
      }
      // Firebase email/password authentication still needs an email internally.
      // The app creates it from the name, so users only enter name and password.
      const loginEmail = `${cleanName}@skm.local`;
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth, loginEmail, password);
      const profile = await getDoc(doc(db, 'user', result.user.uid));
      const role = profile.exists() ? profile.data().role : null;
      if (role !== 'admin' && role !== 'worker') {
        await signOut(auth);
        setError('This account has no assigned role. Ask the administrator to set it up.');
        return;
      }
      localStorage.setItem('skm_auth_session_expires_at', String(Date.now() + 24 * 60 * 60 * 1000));
      router.replace('/');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError(`Name or password is incorrect. Make sure the Firebase account ${cleanName}@skm.local has been created first.`);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Unable to reach Firebase. Check the internet connection and try again.');
      } else if (err.code === 'permission-denied') {
        setError('Signed in, but this user has no readable role. Ask the administrator to add the user role in Firebase.');
      } else {
        setError('Unable to sign in. Please try again.');
      }
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

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label style={labelStyle}>Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="kasim" autoComplete="username" required style={inputStyle} />
          </label>
          <label style={labelStyle}>Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
          </label>
          {error && <p style={{ margin: 0, color: '#b42318', fontSize: 13, fontWeight: 600 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ border: 0, borderRadius: 10, padding: '12px 16px', background: '#3b6e44', color: '#fff', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? .65 : 1 }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" onClick={signInWithFingerprint} disabled={submitting} style={{ border: '1px solid #3b6e44', borderRadius: 10, padding: '11px 16px', background: '#fffdf8', color: '#28582f', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? .65 : 1 }}>
            🫆 Sign in with fingerprint
          </button>
        </form>
      </section>
    </main>
  );
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#4f4b43' };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #cfc7bb', borderRadius: 9, padding: '11px 12px', background: '#fff', fontSize: 15, color: '#24211d' };
