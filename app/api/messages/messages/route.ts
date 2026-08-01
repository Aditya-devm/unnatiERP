import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import {
  getScopedUserContext,
  validateReadConversationPermission
} from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get('instituteId') || req.headers.get('x-institute-id');
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!instituteId || !conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, conversationId, userId).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Context for sender
    const userContext = await getScopedUserContext(instituteId, userId);

    // 2. Fetch Conversation Doc
    const convRef = db.collection('institutes').doc(instituteId).collection('conversations').doc(conversationId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    const conversationData = convSnap.data() || {};

    // 3. Validate Read Permission Server-Side
    if (!validateReadConversationPermission(userContext, conversationData)) {
      return NextResponse.json(
        { error: 'Access denied: You do not have permission to view this conversation.' },
        { status: 403 }
      );
    }

    // 4. Fetch Messages
    const messagesSnap = await convRef.collection('messages').get();
    const messagesList: any[] = [];

    messagesSnap.forEach(docSnap => {
      messagesList.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort by sentAt ascending
    messagesList.sort((a, b) => {
      const tA = new Date(a.sentAt || 0).getTime();
      const tB = new Date(b.sentAt || 0).getTime();
      return tA - tB;
    });

    return NextResponse.json({ messages: messagesList }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching messages:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch messages.' },
      { status: 500 }
    );
  }
}
