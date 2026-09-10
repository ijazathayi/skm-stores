'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { auth } from '@/lib/firebase';

async function readResponse(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

export default function PasskeySetup() {
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  async function registerFingerprint() {
    if (!window.PublicKeyCredential) {
      setMessage('This browser or device does not support fingerprint sign-in.');
      return;
    }
    setWorking(true);
    setMessage('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Please sign in again before setting up a fingerprint.');
      const options = await readResponse(await fetch('/api/passkeys/register/options', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }));
      const response = await startRegistration({ optionsJSON: options });
      await readResponse(await fetch('/api/passkeys/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ response }),
      }));
      setMessage('Fingerprint sign-in is ready on this device.');
    } catch (error) {
      setMessage(error.name === 'NotAllowedError' ? 'Fingerprint setup was cancelled.' : error.message || 'Fingerprint setup could not be completed.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="settings-card">
      <h4>🫆 Fingerprint sign-in</h4>
      <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '4px 0 14px' }}>
        Add this device to your account. Your fingerprint stays on the device; SKM Stores only receives a secure passkey.
      </p>
      {message && <p style={{ color: message.includes('ready') ? 'var(--primary-dark)' : 'var(--danger)', fontSize: 13, fontWeight: 700 }}>{message}</p>}
      <button className="btn-primary" style={{ width: '100%' }} onClick={registerFingerprint} disabled={working}>
        {working ? 'Waiting for fingerprint…' : 'Set up fingerprint on this device'}
      </button>
    </div>
  );
}
