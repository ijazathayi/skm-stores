import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getPasskeyServices, validLoginName } from '@/lib/passkey-server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { name, response } = await request.json();
    const cleanName = validLoginName(name);
    const { adminAuth, adminDb } = getPasskeyServices();
    const user = await adminAuth.getUserByEmail(`${cleanName}@skm.local`);
    const challengeRef = adminDb.collection('passkeyChallenges').doc(`login-${user.uid}`);
    const challengeDoc = await challengeRef.get();
    const challenge = challengeDoc.data();
    if (!challengeDoc.exists || challenge.expiresAt < Date.now()) throw new Error('Fingerprint sign-in expired. Please try again.');
    const credentialRef = adminDb.collection('passkeys').doc(user.uid).collection('credentials').doc(response.id);
    const credentialDoc = await credentialRef.get();
    if (!credentialDoc.exists) throw new Error('This fingerprint is not registered for this account.');
    const stored = credentialDoc.data();
    const verification = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.expectedOrigin, expectedRPID: challenge.rpID,
      credential: { id: credentialDoc.id, publicKey: Buffer.from(stored.publicKey, 'base64url'), counter: stored.counter, transports: stored.transports || [] },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error('Fingerprint sign-in could not be verified.');
    await credentialRef.update({ counter: verification.authenticationInfo.newCounter, lastUsedAt: Date.now() });
    await challengeRef.delete();
    return Response.json({ token: await adminAuth.createCustomToken(user.uid) });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to sign in with fingerprint.' }, { status: 400 });
  }
}
