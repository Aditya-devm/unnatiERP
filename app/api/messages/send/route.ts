import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  getScopedUserContext,
  validatePostMessagePermission
} from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instituteId, userId, conversationId, text, attachmentUrl } = body;

    if (!instituteId || !userId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId, conversationId).' },
        { status: 400 }
      );
    }

    if (!text && !attachmentUrl) {
      return NextResponse.json(
        { error: 'Message must contain text or attachment.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Context for sender
    const senderContext = await getScopedUserContext(instituteId, userId);

    // 2. Fetch Conversation Document
    const convRef = db.collection('institutes').doc(instituteId).collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    const conversationData = convSnap.data() || {};

    // 3. Validate Posting Permission Server-Side
    const permission = validatePostMessagePermission(senderContext, conversationData);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Forbidden: Not authorized to post to this conversation.' },
        { status: 403 }
      );
    }

    // 4. Create Message Document in Subcollection
    const nowIso = new Date().toISOString();
    const msgRef = convRef.collection('messages').doc();
    const messageData = {
      id: msgRef.id,
      conversationId,
      senderId: senderContext.userId,
      senderName: senderContext.name,
      senderRole: senderContext.role,
      text: (text || '').trim(),
      attachmentUrl: attachmentUrl || null,
      sentAt: nowIso
    };

    await msgRef.set(messageData);

    // 5. Update Conversation Summary Doc (lastMessageAt, lastMessagePreview)
    const preview = text ? (text.length > 100 ? text.substring(0, 97) + '...' : text) : 'Attachment';
    await convRef.update({
      lastMessageAt: nowIso,
      lastMessagePreview: `${senderContext.name}: ${preview}`
    });

    return NextResponse.json({ message: messageData, success: true }, { status: 201 });
  } catch (err: any) {
    console.error('Error sending message:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send message.' },
      { status: 500 }
    );
  }
}
