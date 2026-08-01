import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const instituteId = searchParams.get('instituteId') || body.instituteId;

    if (!instituteId) {
      return NextResponse.json({ error: 'Missing instituteId parameter.' }, { status: 400 });
    }

    const db = getAdminDb();
    const convsCol = db.collection('institutes').doc(instituteId).collection('conversations');
    const snap = await convsCol.where('type', '==', 'direct').get();

    // Group direct conversations by sorted participant IDs string e.g. "userA_userB"
    const pairMap = new Map<string, any[]>();

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (Array.isArray(data.participantIds) && data.participantIds.length === 2) {
        const sortedPair = [...data.participantIds].sort().join('_');
        if (!pairMap.has(sortedPair)) {
          pairMap.set(sortedPair, []);
        }
        pairMap.get(sortedPair)!.push({ id: docSnap.id, ...data, ref: docSnap.ref });
      }
    });

    let mergedCount = 0;
    let deletedDocsCount = 0;

    for (const [pairKey, list] of pairMap.entries()) {
      if (list.length > 1) {
        // Sort by createdAt ascending: primary doc is the earliest created
        list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

        const primaryDoc = list[0];
        const secondaryDocs = list.slice(1);

        const primaryMsgsCol = primaryDoc.ref.collection('messages');

        // Copy all messages from secondary conversations into primary conversation
        for (const secDoc of secondaryDocs) {
          const secMsgsSnap = await secDoc.ref.collection('messages').get();
          for (const msgSnap of secMsgsSnap.docs) {
            const mData = msgSnap.data();
            await primaryMsgsCol.doc(msgSnap.id).set(mData, { merge: true });
          }
          // Delete secondary conversation document
          await secDoc.ref.delete();
          deletedDocsCount++;
        }

        // Re-calculate lastMessageAt and lastMessagePreview on primary doc
        const allPrimaryMsgs = await primaryMsgsCol.get();
        if (!allPrimaryMsgs.empty) {
          const sortedMsgs = allPrimaryMsgs.docs
            .map((d: any) => d.data())
            .sort((a: any, b: any) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());

          const latestMsg = sortedMsgs[0];
          await primaryDoc.ref.update({
            lastMessageAt: latestMsg.sentAt || primaryDoc.createdAt,
            lastMessagePreview: `${latestMsg.senderName}: ${latestMsg.text ? latestMsg.text.substring(0, 80) : 'Attachment'}`
          });
        }

        mergedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      mergedPairsCount: mergedCount,
      deletedDocsCount
    });
  } catch (err: any) {
    console.error('Error cleaning up duplicate conversations:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
