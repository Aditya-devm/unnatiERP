import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, rollNumber } = await req.json();

    if (!email || !rollNumber) {
      return NextResponse.json(
        { error: 'Both Registered Email and Roll Number are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRoll = rollNumber.trim();
    const adminDb = getAdminDb();

    // Search across all institutes for a matching student by email & roll number
    const institutesSnap = await adminDb.collection('institutes').get();
    let matchedStudent: { id: string; instituteId: string; data: any; ref: any } | null = null;

    for (const instDoc of institutesSnap.docs) {
      const studentsSnap = await instDoc.ref.collection('students').get();
      for (const studDoc of studentsSnap.docs) {
        const d = studDoc.data();
        const studEmail = (d.email || '').toString().trim().toLowerCase();
        const studRoll = (d.rollNumber || d.rollNo || '').toString().trim();

        if (studEmail === cleanEmail && studRoll === cleanRoll) {
          matchedStudent = {
            id: studDoc.id,
            instituteId: instDoc.id,
            data: d,
            ref: studDoc.ref
          };
          break;
        }
      }
      if (matchedStudent) break;
    }

    // Check if matching student was found
    if (!matchedStudent) {
      return NextResponse.json(
        { error: 'Invalid credentials. The Registered Email and Roll Number do not match any registered student.' },
        { status: 400 }
      );
    }

    const { data: studentData, ref: studentRef } = matchedStudent;
    const currentAttempts = Number(studentData.forgotPasswordAttempts || 0);

    // 5-Chance Limit Check
    if (currentAttempts >= 5) {
      return NextResponse.json(
        { error: 'Your forgot password chances are exhausted. Please contact Admin for password.' },
        { status: 403 }
      );
    }

    // Increment attempts
    const newAttempts = currentAttempts + 1;
    await studentRef.update({
      forgotPasswordAttempts: newAttempts,
      lastForgotPasswordAt: new Date().toISOString()
    });

    const studentPassword = studentData.password || studentData.studentPassword || studentData.code || 'Unnati@123';
    const studentName = studentData.fullName || 'Student';

    console.log(`[FORGOT PASSWORD EMAIL] Sent to: ${cleanEmail} | Password: ${studentPassword} | Attempts: ${newAttempts}/5`);

    // Send Email via Resend if API key present
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Unnati Classes <onboarding@veroq.in>',
          to: [cleanEmail],
          subject: 'Your Password Recovery - Unnati Classes',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #4f46e5; margin-top: 0;">Unnati Classes Password Recovery</h2>
              <p>Hello <strong>${studentName}</strong>,</p>
              <p>You requested your account password using your Roll No. (<strong>${cleanRoll}</strong>).</p>
              <div style="background-color: #f1f5f9; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
                <span style="font-size: 12px; color: #64748b; font-weight: bold; display: block; text-transform: uppercase;">Your Account Password</span>
                <span style="font-size: 24px; color: #0f172a; font-weight: bold; font-family: monospace;">${studentPassword}</span>
              </div>
              <p style="font-size: 12px; color: #64748b;">
                Forgot password attempts used: <strong>${newAttempts}/5</strong>.
                ${newAttempts >= 5 ? '<br/><strong style="color: #ef4444;">You have used all 5 attempts. Contact Admin if you forget your password again.</strong>' : ` Remaining chances: ${5 - newAttempts}.`}
              </p>
              <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px;">
                If you did not request this email, please secure your account or inform your Institute Admin immediately.
              </p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send Resend email:', emailErr);
      }
    }

    const remainingChances = 5 - newAttempts;
    return NextResponse.json({
      success: true,
      message: `Password sent successfully to your registered email (${cleanEmail})! (Remaining chances: ${remainingChances}/5)`,
      remainingChances
    });

  } catch (error: any) {
    console.error('Error handling forgot password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process forgot password request.' },
      { status: 500 }
    );
  }
}
