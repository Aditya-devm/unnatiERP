import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { instituteId, studentId, studentIds } = await req.json();
    const instId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    const idsToDelete: string[] = studentIds && Array.isArray(studentIds)
      ? studentIds
      : (studentId ? [studentId] : []);

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No student ID provided for deletion.' }, { status: 400 });
    }

    const usersCol = adminDb.collection('users');

    for (const sid of idsToDelete) {
      // 1. Get student doc data before deleting to find email/phone
      const sRef = adminDb.collection('institutes').doc(instId).collection('students').doc(sid);
      const sSnap = await sRef.get();
      const sData = sSnap.exists ? sSnap.data() : null;

      // 2. Delete student doc from institutes/{instId}/students
      await sRef.delete();

      // 3. Delete or disable user doc in `users` collection matching sid, email, or phone
      const userDocById = await usersCol.doc(sid).get();
      if (userDocById.exists) {
        await usersCol.doc(sid).delete();
      }

      if (sData) {
        if (sData.email) {
          const uEmailSnap = await usersCol.where('email', '==', sData.email.toLowerCase()).get();
          for (const uDoc of uEmailSnap.docs) {
            await uDoc.ref.delete();
          }
        }
        if (sData.phone) {
          const uPhoneSnap = await usersCol.where('phone', '==', sData.phone).get();
          for (const uDoc of uPhoneSnap.docs) {
            await uDoc.ref.delete();
          }
        }

        // Delete/disable Firebase Auth user
        try {
          if (sData.email) {
            const authUser = await adminAuth.getUserByEmail(sData.email.toLowerCase());
            await adminAuth.deleteUser(authUser.uid);
          }
        } catch (e) {
          // Ignore if auth user doesn't exist
        }

        try {
          const authUserById = await adminAuth.getUser(sid);
          await adminAuth.deleteUser(authUserById.uid);
        } catch (e) {
          // Ignore if auth user doesn't exist
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount: idsToDelete.length });
  } catch (err: any) {
    console.error('Error deleting student:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete student record.' },
      { status: 500 }
    );
  }
}
