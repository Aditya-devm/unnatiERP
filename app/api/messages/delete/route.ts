import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  getScopedUserContext,
  validateDeletePermission
} from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const instituteId = searchParams.get('instituteId') || body.instituteId;
    const userId = searchParams.get('userId') || body.userId || req.headers.get('x-user-id');
    const conversationId = searchParams.get('conversationId') || body.conversationId;
    const messageId = searchParams.get('messageId') || body.messageId || null;

    if (!instituteId || !userId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId, conversationId).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Context
    const senderContext = await getScopedUserContext(instituteId, userId);

    // 2. Enforce Admin-Only Delete Permission Server-Side
    const permission = validateDeletePermission(senderContext);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Forbidden: Only Owner or Admin can delete messages or conversations.' },
        { status: 403 }
      );
    }

    const convRef = db.collection('institutes').doc(instituteId).collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // 3. Delete Single Message OR Entire Thread
    if (messageId) {
      // Delete single message document
      const msgRef = convRef.collection('messages').doc(messageId);
      await msgRef.delete();

      // Recalculate lastMessageAt & lastMessagePreview on conversation doc
      const msgsSnap = await convRef.collection('messages').get();
      if (!msgsSnap.empty) {
        const sortedMsgs = msgsSnap.docs
          .map((d) => d.data())
          .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());
        const latestMsg = sortedMsgs[0];
        await convRef.update({
          lastMessageAt: latestMsg.sentAt || convSnap.data()?.createdAt,
          lastMessagePreview: `${latestMsg.senderName}: ${latestMsg.text ? latestMsg.text.substring(0, 80) : 'Attachment'}`
        });
      } else {
        await convRef.update({
          lastMessagePreview: 'No messages'
        });
      }

      return NextResponse.json({ success: true, deleted: 'message', messageId });
    } else {
      // Delete entire conversation thread and subcollection messages
      const msgsSnap = await convRef.collection('messages').get();
      for (const mDoc of msgsSnap.docs) {
        await mDoc.ref.delete();
      }
      await convRef.delete();

      return NextResponse.json({ success: true, deleted: 'conversation', conversationId });
    }
  } catch (err: any) {
    console.error('Error deleting message/conversation:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete message/conversation.' },
      { status: 500 }
    );
  }
}
