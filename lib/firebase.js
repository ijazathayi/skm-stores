import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDrXvdFnJYY6zJPdZ2U3tkB9Lm4LDL7M5I",
  authDomain: "skm-billing-33a82.firebaseapp.com",
  projectId: "skm-billing-33a82",
  storageBucket: "skm-billing-33a82.firebasestorage.app",
  messagingSenderId: "655676809016",
  appId: "1:655676809016:web:d5d1514b8f752dc37a2bcd"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
