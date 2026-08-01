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
    const userId = searchParams.get('userId') || req.headers.get('x-user-id');

    if (!instituteId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters (instituteId, userId).' },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 1. Resolve User Context for sender
    const userContext = await getScopedUserContext(instituteId, userId);

    // 2. Fetch All Conversations for the Institute
    const conversationsSnap = await db
      .collection('institutes')
      .doc(instituteId)
      .collection('conversations')
      .get();

    const allowedConversations: any[] = [];

    conversationsSnap.forEach(docSnap => {
      const convData = { id: docSnap.id, ...docSnap.data() };
      // Filter each conversation against server-side read permission
      if (validateReadConversationPermission(userContext, convData)) {
        allowedConversations.push(convData);
      }
    });

    // 3. Sort by lastMessageAt descending
    allowedConversations.sort((a, b) => {
      const tA = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
      const tB = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    return NextResponse.json({ conversations: allowedConversations }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching conversations:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch conversations.' },
      { status: 500 }
    );
  }
}
