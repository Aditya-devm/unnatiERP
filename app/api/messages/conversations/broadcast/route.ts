import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  getScopedUserContext,
  validateBroadcastCreatePermission
} from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instituteId, userId, type, batchId } = body;

    if (!instituteId || !userId || !type) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId, type).' },
        { status: 400 }
      );
    }

    if (!['batch_broadcast', 'all_staff_broadcast', 'all_students_broadcast'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid broadcast type.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Context for sender
    const senderContext = await getScopedUserContext(instituteId, userId);

    // 2. Enforce Permission Rules Server-Side
    const permission = validateBroadcastCreatePermission(senderContext, type, batchId);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Forbidden: Broadcast creation not allowed.' },
        { status: 403 }
      );
    }

    // 3. Check if Broadcast Conversation already exists
    const conversationsCol = db.collection('institutes').doc(instituteId).collection('conversations');
    let q = conversationsCol.where('type', '==', type);
    if (type === 'batch_broadcast') {
      q = q.where('batchId', '==', batchId);
    }

    const existingSnap = await q.get();
    if (!existingSnap.empty) {
      const existingDoc = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
      return NextResponse.json({ conversation: existingDoc, created: false }, { status: 200 });
    }

    // 4. Create New Shared Broadcast Conversation
    const nowIso = new Date().toISOString();
    const newConvRef = conversationsCol.doc();
    const newConvData: any = {
      id: newConvRef.id,
      type,
      batchId: batchId || null,
      createdBy: userId,
      createdByName: senderContext.name,
      createdAt: nowIso,
      lastMessageAt: nowIso,
      lastMessagePreview: ''
    };

    await newConvRef.set(newConvData);

    return NextResponse.json({ conversation: newConvData, created: true }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating broadcast conversation:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process broadcast conversation.' },
      { status: 500 }
    );
  }
}
