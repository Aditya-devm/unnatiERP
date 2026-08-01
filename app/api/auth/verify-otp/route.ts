import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, otp, type } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // Retrieve OTP from Firestore
    const otpDocRef = adminDb.collection('otp_codes').doc(email);
    const otpDoc = await otpDocRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ error: 'No OTP found or expired' }, { status: 400 });
    }

    const otpData = otpDoc.data();
    
    // Check if expired
    if (new Date() > otpData?.expiresAt.toDate()) {
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    // Verify code
    if (otpData?.otp !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    // OTP is valid. Now we find or create the user in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      // If user doesn't exist, Create them automatically
      if (error.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email,
          emailVerified: true,
        });
      } else {
        throw error;
      }
    }


    // Mint a custom token for the client to sign in with
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    // Delete the OTP code so it can't be reused
    await otpDocRef.delete();

    return NextResponse.json({ success: true, customToken });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
