import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Registered Email/Phone and Password are required.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const cleanId = identifier.trim().toLowerCase();

    // 1. Search users collection for matching email or phone
    const usersSnap = await adminDb
      .collection('users')
      .where('email', '==', cleanId)
      .limit(1)
      .get();

    let targetEmail = cleanId;
    let userId = null;

    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      userId = userDoc.id;
      targetEmail = userDoc.data().email || cleanId;
    } else {
      // 2. Search students collection by phone or email
      const studentsSnap = await adminDb
        .collectionGroup('students')
        .where('phone', '==', identifier)
        .limit(1)
        .get();

      if (!studentsSnap.empty) {
        const sData = studentsSnap.docs[0].data();
        targetEmail = sData.email || `${identifier.replace(/\D/g, '')}@unnatipowerprep.com`;
      }
    }

    // Find or create Firebase Auth user
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(targetEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: targetEmail,
          emailVerified: true
        });
      } else {
        throw err;
      }
    }

    // Mint custom token
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    return NextResponse.json({
      success: true,
      customToken,
      email: targetEmail
    });
  } catch (error: any) {
    console.error('Error executing password login:', error);
    return NextResponse.json(
      { error: error.message || 'Password authentication failed.' },
      { status: 500 }
    );
  }
}
