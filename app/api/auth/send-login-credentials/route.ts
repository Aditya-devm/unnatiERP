import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const {
      instituteId,
      studentId,
      studentEmail,
      studentName,
      password,
      rollNo,
      instituteName
    } = await req.json();

    if (!instituteId || (!studentEmail && !studentId)) {
      return NextResponse.json(
        { error: 'Institute ID and Student identifier are required.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    let registeredEmail = (studentEmail || '').trim().toLowerCase();
    let fetchedStudentName = studentName || '';
    let fetchedPassword = password || '';
    let fetchedRollNo = rollNo || '';

    // 1. Fetch student document directly from `institutes/{instituteId}/students/{studentId}`
    if (studentId) {
      const studentSnap = await adminDb.collection('institutes').doc(instituteId).collection('students').doc(studentId).get();
      if (studentSnap.exists) {
        const sData = studentSnap.data()!;
        const sEmail = (sData.email || sData.loginEmail || '').trim().toLowerCase();
        if (sEmail && sEmail.includes('@') && !sEmail.endsWith('@unnatipowerprep.com')) {
          registeredEmail = sEmail;
        }
        if (!fetchedStudentName) fetchedStudentName = sData.fullName || 'Student';
        if (!fetchedPassword) fetchedPassword = sData.password || sData.phone || '123456';
        if (!fetchedRollNo) fetchedRollNo = sData.rollNumber || sData.rollNo || 'N/A';
      }
    }

    // 2. Fallback check: check `users` collection if studentId present
    if (!registeredEmail && studentId) {
      const userSnap = await adminDb.collection('users').doc(studentId).get();
      if (userSnap.exists) {
        const uData = userSnap.data()!;
        const uEmail = (uData.email || '').trim().toLowerCase();
        if (uEmail && uEmail.includes('@') && !uEmail.endsWith('@unnatipowerprep.com')) {
          registeredEmail = uEmail;
        }
        if (!fetchedPassword && uData.password) fetchedPassword = uData.password;
      }
    }

    // Strict validation: Reject if student has no registered email
    if (!registeredEmail || !registeredEmail.includes('@') || registeredEmail.endsWith('@unnatipowerprep.com')) {
      return NextResponse.json(
        { error: `No registered email address found for student '${fetchedStudentName || studentId}'. Please add a valid email address in Student Directory.` },
        { status: 400 }
      );
    }

    const cleanEmail = registeredEmail;
    const instName = 'UNNATI CLASSES';
    const displayPassword = fetchedPassword || '123456';
    const displayRollNo = fetchedRollNo || 'N/A';

    // Generate Cool & Formal HTML Email Template
    const htmlEmailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Student Portal Login Credentials - ${instName}</title>
  <style>
    a, a:link, a:visited, a:hover, a:active {
      color: #ffffff !important;
      text-decoration: none !important;
    }
    .address-text, .address-text a, .address-text span {
      color: #ffffff !important;
      text-decoration: none !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; -webkit-text-size-adjust: 100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.08);">
          
          <!-- HEADER BANNER (Navy #1e1b4b with Gold Bottom Accent #d97706) -->
          <tr>
            <td style="background-color: #1e1b4b; padding: 24px 28px; border-bottom: 4px solid #d97706;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.2;">
                      UNNATI CLASSES
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 11.5px; color: #ffffff !important; font-weight: 600; line-height: 1.4;" class="address-text">
                      <span style="color: #ffffff !important; text-decoration: none !important;">F-21, Fortune Empire, Borisana Road, Kalol - 382721</span> • Phone: <span style="color: #ffffff !important; text-decoration: none !important;">+91 9510434702</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY SECTION -->
          <tr>
            <td style="padding: 28px 28px 16px 28px;">

              <!-- Title & Greeting -->
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 800; color: #1e1b4b; line-height: 1.3;">
                Welcome to Student Portal! 🎓
              </h2>
              
              <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Dear <strong style="color: #0f172a;">${fetchedStudentName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Your official student account at <strong>UNNATI CLASSES</strong> has been generated. Below are your confidential login credentials to access online study materials, homework, exam schedules, and attendance records.
              </p>

              <!-- COOL SECURE CREDENTIALS CARD -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border-radius: 14px; border: 2px solid #d97706; margin-bottom: 24px; overflow: hidden; box-shadow: 0 8px 16px rgba(15,23,42,0.15);">
                <tr style="background-color: #1e1b4b;">
                  <td style="padding: 12px 18px; font-size: 12px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #334155;">
                    🔐 CONFIDENTIAL LOGIN CREDENTIALS
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px; border-bottom: 1px solid #1e293b; vertical-align: middle;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block;">Registered Email / Login ID</span>
                    <strong style="font-size: 15px; color: #ffffff; display: block; margin-top: 4px; font-family: monospace;">${cleanEmail}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px; border-bottom: 1px solid #1e293b; vertical-align: middle;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block;">Student Portal Password</span>
                    <strong style="font-size: 16px; color: #34d399; display: block; margin-top: 4px; font-family: monospace;">${displayPassword}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px; background-color: #1e293b; vertical-align: middle;">
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block;">Roll Number / Student ID</span>
                    <strong style="font-size: 14px; color: #818cf8; display: block; margin-top: 4px; font-family: monospace;">${displayRollNo}</strong>
                  </td>
                </tr>
              </table>

              <!-- STEP BY STEP ACCESS INSTRUCTIONS BOX -->
              <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; margin-bottom: 28px;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #1e1b4b;">
                  🚀 How to Log In
                </h4>
                <ol style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #334155;">
                  <li style="margin-bottom: 6px;">Visit the student portal login page at: <a href="https://unnaticlasses.online" style="color: #4f46e5 !important; text-decoration: underline !important; font-weight: 800;">unnaticlasses.online</a></li>
                  <li style="margin-bottom: 6px;">Enter your <strong>Registered Email</strong> (${cleanEmail}) as your Login ID.</li>
                  <li style="margin-bottom: 6px;">Enter your <strong>Portal Password</strong> (${displayPassword}).</li>
                  <li>Click <strong>Sign In</strong> to access your personal dashboard.</li>
                </ol>
              </div>

              <!-- SIGN-OFF SECTION (Aditya tiwari in cursive font under Authorized Signatory) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 10px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td style="vertical-align: bottom;">
                    <p style="margin: 0; font-size: 16px; font-weight: 800; font-style: italic; color: #4f46e5; line-height: 1.2;">
                      Thank you!
                    </p>
                    <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.3;">
                      for your trust in us.
                    </p>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <p style="margin: 0; font-family: 'Brush Script MT', 'Dancing Script', 'Comic Sans MS', cursive; font-size: 20px; font-weight: 600; color: #1e1b4b; line-height: 1.2;">
                      Aditya tiwari
                    </p>
                    <p style="margin: 3px 0 0 0; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.3;">
                      Authorized Signatory
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER STRIP -->
          <tr>
            <td style="padding: 16px 28px; background-color: #1e1b4b; text-align: center; font-size: 11px; color: #cbd5e1; border-top: 1px solid #cbd5e1;">
              <p style="margin: 0 0 4px 0; font-weight: 600;">This is an official automated credential advice from UNNATI CLASSES ERP System.</p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">© 2026 UNNATI CLASSES. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    console.log(`[LOGIN CREDENTIALS EMAIL] To: ${cleanEmail} | Student: ${fetchedStudentName} | Roll: ${displayRollNo}`);

    // Dispatch Email via Resend if API key present
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Unnati Powerprep <onboarding@veroq.in>',
          to: [cleanEmail],
          subject: `Student Portal Login ID & Password - ${instName}`,
          html: htmlEmailContent
        });
      } catch (resendErr) {
        console.error('Failed to send Resend credentials email:', resendErr);
      }
    }

    // Log notification in Firestore
    const notificationsCol = adminDb.collection('institutes').doc(instituteId).collection('notifications');

    await notificationsCol.add({
      recipientStudentId: studentId || null,
      recipientEmail: cleanEmail,
      channel: 'email',
      message: `Login ID & Password email sent to ${cleanEmail}.`,
      status: 'sent',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Formal Login ID & Password email successfully sent to ${cleanEmail}!`
    });
  } catch (error: any) {
    console.error('Error sending login credentials email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send login credentials email.' },
      { status: 500 }
    );
  }
}
