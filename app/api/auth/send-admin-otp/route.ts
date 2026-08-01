import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

const ALLOWED_ADMIN_EMAILS = [
  'samxlnc56@gmail.com',
  'unnaticlasseskalol@gmail.com'
];

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Admin Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Enforce strict Admin Email restriction
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
      return NextResponse.json(
        {
          error: 'Access denied: Only authorized admin emails (samxlnc56@gmail.com, unnaticlasseskalol@gmail.com) are permitted for Admin login.'
        },
        { status: 403 }
      );
    }

    const adminAuth = getAdminAuth();

    // Find or create Firebase Auth user
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: cleanEmail,
          emailVerified: true
        });
      } else {
        throw error;
      }
    }

    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const adminDb = getAdminDb();

    // Store in Firestore otp_codes collection
    await adminDb.collection('otp_codes').doc(cleanEmail).set({
      otp,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ADMIN OTP] To: ${cleanEmail} | 4-Digit OTP Code: ${otp}`);

    // Send Email via Resend if API key present
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Unnati Powerprep <onboarding@veroq.in>',
          to: [cleanEmail],
          subject: 'Admin Login 4-Digit OTP Code - Unnati ERP',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
              <h2>Unnati ERP Admin Verification</h2>
              <p>Your 4-digit admin verification code is:</p>
              <h1 style="font-size: 36px; color: #4f46e5; letter-spacing: 6px;">${otp}</h1>
              <p>This code expires in 10 minutes.</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send Resend email:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `4-Digit OTP code sent to ${cleanEmail} (logged to console for testing: ${otp})`
    });
  } catch (error: any) {
    console.error('Error sending admin OTP:', error);
    return NextResponse.json({ error: error.message || 'Failed to send admin OTP.' }, { status: 500 });
  }
}
