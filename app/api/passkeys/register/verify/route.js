import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getBearerToken, getPasskeyServices } from '@/lib/passkey-server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { response } = await request.json();
    const { adminAuth, adminDb } = getPasskeyServices();
    const decoded = await adminAuth.verifyIdToken(getBearerToken(request));
    const challengeRef = adminDb.collection('passkeyChallenges').doc(`register-${decoded.uid}`);
    const challengeDoc = await challengeRef.get();
    const challenge = challengeDoc.data();
    if (!challengeDoc.exists || challenge.expiresAt < Date.now()) throw new Error('Fingerprint setup expired. Please try again.');
    const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.expectedOrigin, expectedRPID: challenge.rpID, requireUserVerification: true });
    if (!verification.verified || !verification.registrationInfo) throw new Error('Fingerprint setup could not be verified.');
    const credential = verification.registrationInfo.credential;
    await adminDb.collection('passkeys').doc(decoded.uid).collection('credentials').doc(credential.id).set({
      publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
      transports: response.response.transports || [], deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp, createdAt: Date.now(),
    });
    await challengeRef.delete();
    return Response.json({ verified: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to save fingerprint sign-in.' }, { status: 400 });
  }
}
