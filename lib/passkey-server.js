import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) throw new Error('Passkey sign-in is not configured on this server.');
  return initializeApp({ credential: cert(JSON.parse(rawServiceAccount)) });
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

export async function requireWorkerOrAdmin(adminDb, uid) {
  const profile = await adminDb.collection('user').doc(uid).get();
  const role = profile.exists ? profile.data().role : null;
  if (role !== 'admin' && role !== 'worker') throw new Error('This account has no assigned role.');
  return role;
}
