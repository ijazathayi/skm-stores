import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getBearerToken, getPasskeyConfig, getPasskeyServices } from '@/lib/passkey-server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { adminAuth, adminDb } = getPasskeyServices();
    const decoded = await adminAuth.verifyIdToken(getBearerToken(request));
    const { expectedOrigin, rpID } = getPasskeyConfig(request);
    const credentials = await adminDb.collection('passkeys').doc(decoded.uid).collection('credentials').get();
    const options = await generateRegistrationOptions({
      rpName: 'SKM Stores', rpID, userID: new TextEncoder().encode(decoded.uid),
      userName: decoded.email || decoded.uid, userDisplayName: decoded.email?.split('@')[0] || 'SKM Stores user',
      attestationType: 'none',
      excludeCredentials: credentials.docs.map((credential) => ({ id: credential.id, transports: credential.data().transports || [] })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      preferredAuthenticatorType: 'localDevice',
    });
    await adminDb.collection('passkeyChallenges').doc(`register-${decoded.uid}`).set({ challenge: options.challenge, expectedOrigin, rpID, expiresAt: Date.now() + 300000 });
    return Response.json(options);
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to start fingerprint setup.' }, { status: 400 });
  }
}
