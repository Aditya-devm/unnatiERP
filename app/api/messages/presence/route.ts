import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, instituteId, offline } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter.' }, { status: 400 });
    }

    const db = getAdminDb();
    const nowIso = offline ? '1970-01-01T00:00:00.000Z' : new Date().toISOString();

    // 1. Update users/{userId} doc
    const userRef = db.collection('users').doc(userId);
    await userRef.set({ lastActiveAt: nowIso }, { merge: true });

    // 2. Also update presence collection if instituteId is provided
    if (instituteId) {
      const presenceRef = db.collection('institutes').doc(instituteId).collection('userPresence').doc(userId);
      await presenceRef.set({ userId, lastActiveAt: nowIso }, { merge: true });
    }

    return NextResponse.json({ success: true, lastActiveAt: nowIso });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
