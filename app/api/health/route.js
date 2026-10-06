import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/pgdb';

export async function GET() {
  try {
    const result = await testConnection();
    return NextResponse.json({
      ok: true,
      neon:   { status: 'online ✅', db: result.neon.db, time: result.neon.time },
      local:  { status: result.local === 'online' ? 'online ✅' : 'offline (backup only)' },
      device: process.env.NEXT_PUBLIC_DEVICE_ID || 'unknown',
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
