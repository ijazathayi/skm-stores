'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    if (!nextUser) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await getDoc(doc(db, 'user', nextUser.uid));
      const nextRole = profile.exists() ? profile.data().role : null;
      setUser(nextUser);
      setRole(nextRole === 'admin' || nextRole === 'worker' ? nextRole : null);
    } catch {
      setUser(nextUser);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }), []);

  const signOut = () => firebaseSignOut(auth);

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
