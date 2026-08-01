import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_ADMIN_EMAILS = [
  'samxlnc56@gmail.com',
  'unnaticlasseskalol@gmail.com'
];

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and 4-digit OTP are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
      return NextResponse.json(
        { error: 'Access denied: Email is not authorized for Admin login.' },
        { status: 403 }
      );
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // 1. Retrieve OTP doc from Firestore
    const otpDocRef = adminDb.collection('otp_codes').doc(cleanEmail);
    const otpDoc = await otpDocRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ error: 'No OTP requested or OTP has expired.' }, { status: 400 });
    }

    const otpData = otpDoc.data();

    // Check expiration
    if (new Date() > otpData?.expiresAt.toDate()) {
      return NextResponse.json({ error: '4-digit OTP code has expired. Please request a new code.' }, { status: 400 });
    }

    // Verify 4-digit OTP
    if (otpData?.otp !== otp.trim()) {
      return NextResponse.json({ error: 'Invalid 4-digit OTP code. Please try again.' }, { status: 400 });
    }

    // 2. Find or Create User in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          emailVerified: true
        });
      } else {
        throw err;
      }
    }

    // Determine admin role
    const adminRole = cleanEmail === 'unnaticlasseskalol@gmail.com' ? 'owner' : 'admin';
    const defaultInstituteId = 'ZA7wk0M2oXtrl3rd5FY3';

    // 3. Ensure user doc in `users/{uid}`
    await adminDb.collection('users').doc(userRecord.uid).set(
      {
        email: cleanEmail,
        role: adminRole,
        instituteId: defaultInstituteId,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    // 4. Mint custom token
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    // Delete OTP code after verification
    await otpDocRef.delete();

    return NextResponse.json({
      success: true,
      customToken,
      role: adminRole,
      instituteId: defaultInstituteId,
      redirectUrl: '/erp'
    });
  } catch (error: any) {
    console.error('Error verifying admin OTP:', error);
    return NextResponse.json({ error: error.message || 'OTP verification failed.' }, { status: 500 });
  }
}
