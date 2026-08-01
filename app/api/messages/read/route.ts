import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instituteId, userId, conversationId } = body;

    if (!instituteId || !userId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId, conversationId).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const convRef = db.collection('institutes').doc(instituteId).collection('conversations').doc(conversationId);
    await convRef.set({
      lastReadAt: {
        [userId]: nowIso
      }
    }, { merge: true });

    return NextResponse.json({ success: true, conversationId, userId, lastReadAt: nowIso });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
