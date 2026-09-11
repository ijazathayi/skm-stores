'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const AUTH_SESSION_KEY = 'skm_auth_session_expires_at';

function getSessionExpiry() {
  const raw = Number(localStorage.getItem(AUTH_SESSION_KEY) || '0');
  return Number.isFinite(raw) ? raw : 0;
}

function setSessionExpiry() {
  localStorage.setItem(AUTH_SESSION_KEY, String(Date.now() + AUTH_SESSION_TTL_MS));
}

function clearSessionExpiry() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    const now = Date.now();
    if (!nextUser) {
      clearSessionExpiry();
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const expiry = getSessionExpiry();
    if (expiry && now > expiry) {
      await firebaseSignOut(auth);
      clearSessionExpiry();
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    setSessionExpiry();

    try {
      const profile = await getDoc(doc(db, 'user', nextUser.uid));
      const nextRole = profile.exists() ? profile.data().role : null;
      setUser(nextUser);
      setRole(nextRole === 'admin' || nextRole === 'staff' ? nextRole : null);
    } catch {
      setUser(nextUser);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }), []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    clearSessionExpiry();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
