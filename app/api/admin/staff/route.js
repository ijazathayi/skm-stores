import { NextResponse } from 'next/server';
import { getPasskeyServices } from '@/lib/passkey-server';

function cleanName(value) {
  const name = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(name)) throw new Error('Use 3-30 letters, numbers, dots, dashes, or underscores.');
  return name;
}

function cleanRole(value) {
  if (value !== 'admin' && value !== 'staff') throw new Error('Role must be admin or staff.');
  return value;
}

async function requireAdmin(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Please sign in as an administrator.');
  const { adminAuth, adminDb } = getPasskeyServices();
  const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
  const profile = await adminDb.collection('user').doc(decoded.uid).get();
  if (!profile.exists || profile.data().role !== 'admin') throw new Error('Administrator permission required.');
  return { adminAuth, adminDb };
}

function errorResponse(error) {
  const message = error?.code === 'auth/email-already-exists'
    ? 'A staff account with this name already exists.'
    : error.message || 'Staff request failed.';
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request) {
  try {
    const { adminAuth, adminDb } = await requireAdmin(request);
    const snapshot = await adminDb.collection('user').get();
    const authUsers = [];
    let nextPageToken;
    do {
      const page = await adminAuth.listUsers(1000, nextPageToken);
      authUsers.push(...page.users);
      nextPageToken = page.pageToken;
    } while (nextPageToken);
    const authById = new Map(authUsers.map((item) => [item.uid, item]));
    const staff = snapshot.docs.map((item) => {
      const profile = item.data();
      const authUser = authById.get(item.id);
      const emailName = authUser?.email?.split('@')[0] || '';
      return {
        id: item.id,
        ...profile,
        name: profile.name || authUser?.displayName || emailName || item.id,
        email: profile.email || authUser?.email || '',
      };
    });
    return NextResponse.json({ staff });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const { adminAuth, adminDb } = await requireAdmin(request);
    const body = await request.json();
    const name = cleanName(body.name);
    const role = cleanRole(body.role);
    const password = String(body.password || '');
    if (password.length < 6) throw new Error('Password must contain at least 6 characters.');

    const user = await adminAuth.createUser({
      email: `${name}@skm.local`,
      password,
      displayName: name,
    });
    await adminDb.collection('user').doc(user.uid).set({ name, email: user.email, role }, { merge: true });
    return NextResponse.json({ staff: { id: user.uid, name, email: user.email, role } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const { adminAuth, adminDb } = await requireAdmin(request);
    const body = await request.json();
    const uid = String(body.id || '').trim();
    if (!uid) throw new Error('Staff account id is required.');
    const name = cleanName(body.name);
    const role = cleanRole(body.role);
    const updates = { displayName: name, email: `${name}@skm.local` };
    if (body.password) {
      if (String(body.password).length < 6) throw new Error('Password must contain at least 6 characters.');
      updates.password = String(body.password);
    }
    await adminAuth.updateUser(uid, updates);
    await adminDb.collection('user').doc(uid).set({ name, email: updates.email, role }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    const { adminAuth, adminDb } = await requireAdmin(request);
    const body = await request.json();
    const uid = String(body.id || '').trim();
    if (!uid) throw new Error('Staff account id is required.');
    const requesterToken = request.headers.get('authorization').slice(7);
    const requester = await adminAuth.verifyIdToken(requesterToken);
    if (uid === requester.uid) throw new Error('You cannot delete your own administrator account.');
    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      // A role document can outlive its Auth account. Admins may clean up that orphan.
      if (error.code !== 'auth/user-not-found') throw error;
    }
    await adminDb.collection('user').doc(uid).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
