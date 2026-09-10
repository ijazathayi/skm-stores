import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getPasskeyConfig, getPasskeyServices, requireWorkerOrAdmin, validLoginName } from '@/lib/passkey-server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { name } = await request.json();
    const cleanName = validLoginName(name);
    const { adminAuth, adminDb } = getPasskeyServices();
    const user = await adminAuth.getUserByEmail(`${cleanName}@skm.local`);
    await requireWorkerOrAdmin(adminDb, user.uid);
    const { expectedOrigin, rpID } = getPasskeyConfig(request);
    const credentials = await adminDb.collection('passkeys').doc(user.uid).collection('credentials').get();
    if (credentials.empty) throw new Error('No fingerprint is set up for this account yet.');
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: credentials.docs.map((credential) => ({ id: credential.id, transports: credential.data().transports || [] })) });
    await adminDb.collection('passkeyChallenges').doc(`login-${user.uid}`).set({ challenge: options.challenge, expectedOrigin, rpID, expiresAt: Date.now() + 300000 });
    return Response.json(options);
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to start fingerprint sign-in.' }, { status: 400 });
  }
}
