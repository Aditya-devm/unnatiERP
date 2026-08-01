import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  getScopedUserContext,
  validateDirectConversationPermission
} from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instituteId, userId, targetUserId } = body;

    if (!instituteId || !userId || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId, targetUserId).' },
        { status: 400 }
      );
    }

    if (userId === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot start a conversation with yourself.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Contexts for both sender and target
    const senderContext = await getScopedUserContext(instituteId, userId);
    const targetContext = await getScopedUserContext(instituteId, targetUserId);

    // 2. Enforce Permission Rules Server-Side
    const permission = validateDirectConversationPermission(senderContext, targetContext);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Forbidden: Conversation not allowed.' },
        { status: 403 }
      );
    }

    // 3. Search for existing direct conversation between sender & target using resolved UIDs
    const resolvedSenderId = senderContext.userId;
    const resolvedTargetId = targetContext.userId;

    const conversationsCol = db.collection('institutes').doc(instituteId).collection('conversations');
    const existingSnap = await conversationsCol
      .where('type', '==', 'direct')
      .where('participantIds', 'array-contains', resolvedSenderId)
      .get();

    let existingDoc: any = null;
    existingSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (Array.isArray(data.participantIds) && data.participantIds.includes(resolvedTargetId)) {
        existingDoc = { id: docSnap.id, ...data };
      }
    });

    if (existingDoc) {
      return NextResponse.json({ conversation: existingDoc, created: false }, { status: 200 });
    }

    // 4. Create New Direct Conversation Doc
    const nowIso = new Date().toISOString();
    const newConvRef = conversationsCol.doc();
    const newConvData = {
      id: newConvRef.id,
      type: 'direct' as const,
      participantIds: [resolvedSenderId, resolvedTargetId],
      createdBy: resolvedSenderId,
      createdByName: senderContext.name,
      targetName: targetContext.name,
      createdAt: nowIso,
      lastMessageAt: nowIso,
      lastMessagePreview: ''
    };

    await newConvRef.set(newConvData);

    return NextResponse.json({ conversation: newConvData, created: true }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating/fetching direct conversation:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process direct conversation.' },
      { status: 500 }
    );
  }
}
