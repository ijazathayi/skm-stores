import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(privateKey) {
  if (typeof privateKey !== 'string') return privateKey;
  return privateKey.replace(/\\r\\n|\\n|\\r/g, '\n');
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error('Passkey sign-in is not configured on this server.');
  const serviceAccount = JSON.parse(rawServiceAccount);
  // Vercel can store a copied Firebase JSON with literal escaped PEM line breaks
  // (for example "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----").
  // Firebase Admin expects real newline characters in the PEM body.
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getPasskeyServices() {
  const app = getAdminApp();
  return { adminAuth: getAuth(app), adminDb: getFirestore(app) };
}

export function getPasskeyConfig(request) {
  const origin = request.headers.get('origin');
  if (!origin) throw new Error('This request must come from the sign-in page.');
  const configuredOrigin = process.env.PASSKEY_RP_ORIGIN;
  const expectedOrigin = configuredOrigin || origin;
  if (configuredOrigin && origin !== configuredOrigin) throw new Error('This passkey request is coming from an unexpected website.');
  return { expectedOrigin, rpID: process.env.PASSKEY_RP_ID || new URL(expectedOrigin).hostname };
}

export function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Please sign in before adding a fingerprint.');
  return header.slice(7);
}

export function validLoginName(name) {
  const cleanName = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(cleanName)) throw new Error('Enter a valid account name.');
  return cleanName;
}

export async function requireStaffOrAdmin(adminDb, uid) {
  const profile = await adminDb.collection('user').doc(uid).get();
  const storedRole = profile.exists ? profile.data().role : null;
  const role = storedRole === 'worker' ? 'staff' : storedRole;
  if (role !== 'admin' && role !== 'staff') throw new Error('This account has no assigned role.');
  return role;
}
