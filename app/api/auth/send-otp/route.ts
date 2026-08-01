import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    
    // Check if user exists
    let userExists = false;
    try {
      await adminAuth.getUserByEmail(email);
      userExists = true;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const adminDb = getAdminDb();

    // Store securely in Firestore
    await adminDb.collection('otp_codes').doc(email).set({
      otp,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send Email via Resend
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is missing. Falling back to mock console output.');
      console.log(`[MOCK EMAIL] To: ${email} | OTP: ${otp}`);
    } else {
      const { error } = await resend.emails.send({
        from: 'Unnati Powerprep <onboarding@veroq.in>',
        to: [email],
        subject: 'Verify Your Identity - Unnatipowerprep Portal',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Identity - Unnatipowerprep Portal</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f6f7; color: #2c2f30;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5f6f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Header Section -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-bottom: 32px;">
          <tr>
            <td align="center">
              <div style="width: 80px; height: 80px; background-color: #ffffff; border-radius: 40px; padding: 8px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
                <img src="https://lh3.googleusercontent.com/aida/ADBb0uipIg5_Y-oukB1dX6dBdcbYYX0QqJV75nkli5bmhgJfopBOXkpk-vI10eZhGlLWRGX8emr1M4-gx7cq4RJrAqbhLFJFUGjO7KdJf0sBTkPERkKad9Da3-UzoM4Gtba8MsYdJ72GON9J7bckaf7cxzL6NP3up_M3n4cnZQ6JrVK5PPAK5HARN4ofzVfMeDLH9DvZ0HB9jkEiwhSXmaWKtoPv-vheAmZ6LUroojzmK1KdZFUM90QkuMizbEd0Utymm20t54neEHFBNg" alt="Logo" style="width: 100%; height: auto; display: block; object-fit: contain;">
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #9b3f00; letter-spacing: -0.025em;">Unnatipowerprep Portal</h1>
            </td>
          </tr>
        </table>

        <!-- Main Identity Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e6e8ea;">
          <tr>
            <td style="padding: 48px 40px;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="margin: 0 0 12px; font-size: 32px; font-weight: 800; color: #2858b2; letter-spacing: -0.05em;">Secure Login</h2>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #595c5d;">Use the code below to complete your login to Unnatipowerprep Portal. This code expires in 10 minutes.</p>
              </div>

              <!-- Identity Verification Label -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; padding: 8px 16px; background-color: #f0f2ff; border-radius: 20px;">
                  <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2858b2;">
                    🔒 Identity Verification
                  </span>
                </div>
              </div>

              <!-- OTP Digits Grid -->
              <table border="0" cellspacing="8" cellpadding="0" align="center" style="margin-bottom: 40px;">
                <tr>
                  ${otp.split('').map(digit => `
                    <td align="center" style="width: 56px; height: 80px; background-color: #ffffff; border-radius: 12px; border: 1px solid #dadddf; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                      <span style="font-size: 32px; font-weight: 800; color: #9b3f00;">${digit}</span>
                    </td>
                  `).join('')}
                </tr>
              </table>

              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #595c5d; text-align: center;">
                Didn't request this? <a href="#" style="color: #2858b2; font-weight: 700; text-decoration: none;">Contact Security</a>
              </p>
            </td>
          </tr>
        </table>

        <!-- Trust Features -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 40px;">
          <tr>
            <td align="center">
              <div style="height: 1px; width: 80px; background-color: #dadddf; margin-bottom: 24px;"></div>
              <div style="font-size: 11px; color: #757778; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                🛡️ End-to-End Encrypted &nbsp; • &nbsp; 🛡️ Secure Gateway
              </div>
            </td>
          </tr>
        </table>

        <!-- Brand Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 48px; background-color: #eff1f2; border-radius: 24px 24px 0 0; border: 1px solid #e6e8ea;">
          <tr>
            <td align="center" style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 14px; color: #595c5d;">© 2026 Unnatipowerprep. All rights reserved.</p>
              <div style="font-size: 13px; font-weight: 600;">
                <a href="#" style="color: #595c5d; text-decoration: none; margin: 0 12px;">Support</a>
                <a href="#" style="color: #595c5d; text-decoration: none; margin: 0 12px;">Privacy Policy</a>
                <a href="#" style="color: #595c5d; text-decoration: none; margin: 0 12px;">Terms of Service</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
      });

      if (error) {
        console.error('Failed to send Resend email:', error);
        return NextResponse.json({ error: 'Failed to send OTP email' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'OTP sent to email (mock logged to console)' });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
