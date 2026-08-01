import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'UP-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const { instituteName, adminName, email, password, phone } = await req.json();

    if (!instituteName || !adminName || !email || !password) {
      return NextResponse.json(
        { error: 'Institute name, admin name, email, and password are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // 1. Generate a unique 6-character short code for the institute
    let instituteCode = generateShortCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const existingSnap = await adminDb
        .collection('institutes')
        .where('code', '==', instituteCode)
        .limit(1)
        .get();

      if (existingSnap.empty) {
        isUnique = true;
      } else {
        instituteCode = generateShortCode();
      }
    }

    // 2. Create the institute document
    const instRef = await adminDb.collection('institutes').add({
      name: instituteName.trim(),
      code: instituteCode,
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      createdAt: new Date().toISOString()
    });

    const instituteId = instRef.id;

    // 3. Find or create Firebase Auth User
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
      // Update password if existing
      await adminAuth.updateUser(userRecord.uid, { password });
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          password: password,
          displayName: adminName.trim(),
          emailVerified: true
        });
      } else {
        throw err;
      }
    }

    // 4. Create or update user doc in Firestore `users/{uid}`
    await adminDb.collection('users').doc(userRecord.uid).set(
      {
        email: cleanEmail,
        fullName: adminName.trim(),
        phone: phone ? phone.trim() : '',
        role: 'owner',
        instituteId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    // 5. Mint custom token for instant sign-in
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    return NextResponse.json({
      success: true,
      customToken,
      instituteId,
      instituteCode,
      redirectUrl: '/erp'
    });
  } catch (error: any) {
    console.error('Error registering institute:', error);
    return NextResponse.json(
      { error: error.message || 'Institute registration failed.' },
      { status: 500 }
    );
  }
}
