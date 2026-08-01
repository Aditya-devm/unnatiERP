import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

const LOGO_URL = 'https://lh3.googleusercontent.com/aida/ADBb0uipIg5_Y-oukB1dX6dBdcbYYX0QqJV75nkli5bmhgJfopBOXkpk-vI10eZhGlLWRGX8emr1M4-gx7cq4RJrAqbhLFJFUGjO7KdJf0sBTkPERkKad9Da3-UzoM4Gtba8MsYdJ72GON9J7bckaf7cxzL6NP3up_M3n4cnZQ6JrVK5PPAK5HARN4ofzVfMeDLH9DvZ0HB9jkEiwhSXmaWKtoPv-vheAmZ6LUroojzmK1KdZFUM90QkuMizbEd0Utymm20t54neEHFBNg';

export async function POST(req: Request) {
  try {
    const {
      instituteId,
      studentId,
      studentEmail,
      studentPhone,
      studentName,
      parentName,
      batchName,
      rollNo,
      enrollmentDate,
      pendingAmount,
      monthlyFee,
      billingPeriod,
      instituteName
    } = await req.json();

    if (!instituteId || (!studentEmail && !studentId)) {
      return NextResponse.json(
        { error: 'Institute ID and Student identifier are required.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    let targetLoginEmail = (studentEmail || '').trim().toLowerCase();

    // Lookup exact Student Login Email & details from `users` and `students` collection if studentId or studentPhone provided
    let fetchedBatchName = batchName || '';
    let fetchedRollNo = rollNo || '';
    let fetchedEnrollmentDate = enrollmentDate || '';

    if (studentId) {
      const userSnap = await adminDb.collection('users').doc(studentId).get();
      if (userSnap.exists && userSnap.data()?.email) {
        targetLoginEmail = userSnap.data()!.email.toLowerCase();
      } else {
        const usersByStudentId = await adminDb.collection('users').where('studentId', '==', studentId).limit(1).get();
        if (!usersByStudentId.empty && usersByStudentId.docs[0].data().email) {
          targetLoginEmail = usersByStudentId.docs[0].data().email.toLowerCase();
        }
      }

      // Fetch student record for extra details
      const studentSnap = await adminDb.collection('institutes').doc(instituteId).collection('students').doc(studentId).get();
      if (studentSnap.exists) {
        const sData = studentSnap.data()!;
        if (!fetchedRollNo) fetchedRollNo = sData.rollNumber || sData.rollNo || 'N/A';
        if (!fetchedEnrollmentDate) fetchedEnrollmentDate = sData.currentBatchEnrollmentDate || sData.enrollmentDate || '';
      }
    }

    if (!targetLoginEmail && studentPhone) {
      const cleanPhone = studentPhone.trim();
      const usersByPhone = await adminDb.collection('users').where('phone', '==', cleanPhone).limit(1).get();
      if (!usersByPhone.empty && usersByPhone.docs[0].data().email) {
        targetLoginEmail = usersByPhone.docs[0].data().email.toLowerCase();
      }
    }

    if (!targetLoginEmail) {
      const cleanPhoneDigits = (studentPhone || '').replace(/\D/g, '');
      targetLoginEmail = cleanPhoneDigits ? `student_${cleanPhoneDigits}@unnatipowerprep.com` : 'student@unnatipowerprep.com';
    }

    const cleanEmail = targetLoginEmail;
    const instName = 'UNNATI CLASSES';
    const periodStr = billingPeriod || 'Current Billing Period';
    const formattedPending = Number(pendingAmount || 0).toLocaleString('en-IN');
    const formattedMonthly = Number(monthlyFee || 0).toLocaleString('en-IN');

    const displayBatchName = fetchedBatchName || 'General Batch';
    const displayRollNo = fetchedRollNo || 'N/A';

    // Date formatting helpers
    const now = new Date();
    const currentDateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    function getOrdinalSuffix(day: number): string {
      if (day >= 11 && day <= 13) return `${day}th`;
      switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
      }
    }

    function formatDueDateFromEnrollment(dateStr?: string): string {
      if (!dateStr) return '1st of Every Month';
      let dayNum = 1;
      const trimmed = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        dayNum = parseInt(trimmed.substring(0, 10).split('-')[2], 10) || 1;
      } else if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(trimmed)) {
        dayNum = parseInt(trimmed.split(/[\/\-]/)[0], 10) || 1;
      } else {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) dayNum = d.getDate();
      }
      return `${getOrdinalSuffix(dayNum)} of Every Month`;
    }

    const dueDateFormatted = formatDueDateFromEnrollment(fetchedEnrollmentDate);

    // 1. Generate Publication-Grade PDF-Inspired Formal HTML Email Template
    const htmlEmailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fee Payment Reminder - ${instName}</title>
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
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #d97706; color: #ffffff; font-size: 10px; font-weight: 800; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      FEES REMINDER
                    </span>
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
                Official Fee Payment Notification
              </h2>
              
              <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Dear <strong style="color: #0f172a;">${studentName}</strong> ${parentName ? `(Parent / Guardian: <strong>${parentName}</strong>)` : ''},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                We hope this message finds you well. This is an official fee reminder notification regarding the tuition fees for <strong>${periodStr}</strong>. Kindly find your student ledger summary below.
              </p>

              <!-- TWO COLUMN STUDENT DETAILS CARD -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding: 14px 16px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Student Name:</strong><br>${studentName}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Batch:</strong><br>${displayBatchName}
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Guardian Name:</strong><br>${parentName || 'N/A'}
                    </p>
                  </td>
                  <td width="50%" style="padding: 14px 16px; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Contact Phone:</strong><br>${studentPhone || 'N/A'}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Roll No.:</strong><br>${displayRollNo}
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; line-height: 1.4;">
                      <strong style="color: #0f172a;">Billing Period:</strong><br>${periodStr}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- OUTSTANDING DUE CARD (Showing ONLY Total Outstanding Due in RED) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-radius: 12px; overflow: hidden; border: 1.5px solid #fca5a5; margin-bottom: 24px; background-color: #fef2f2;">
                <tr style="background-color: #1e1b4b;">
                  <td style="padding: 12px 18px; font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                    SUMMARY OF DUES
                  </td>
                  <td align="right" style="padding: 12px 18px; font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                    AMOUNT (INR)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px; font-size: 14px; font-weight: 800; color: #991b1b;">
                    TOTAL OUTSTANDING DUE
                  </td>
                  <td align="right" style="padding: 18px; font-size: 22px; font-weight: 900; color: #dc2626;">
                    INR ${formattedPending}
                  </td>
                </tr>
              </table>

              <!-- FOOTER INFO STRIP (Notice Date and Due Date ONLY) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 28px;">
                <tr>
                  <td width="50%" style="padding: 14px 16px; border-right: 1px solid #e2e8f0; vertical-align: top;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 600; display: block; line-height: 1.2;">Notice Date</span>
                    <strong style="font-size: 13px; color: #0f172a; display: block; margin-top: 3px; line-height: 1.3;">${currentDateFormatted}</strong>
                  </td>
                  <td width="50%" style="padding: 14px 16px; vertical-align: top;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 600; display: block; line-height: 1.2;">Due Date</span>
                    <strong style="font-size: 13px; color: #0f172a; display: block; margin-top: 3px; line-height: 1.3;">${dueDateFormatted}</strong>
                  </td>
                </tr>
              </table>

              <!-- Payment Methods & Instructions Box -->
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #4f46e5; margin-bottom: 28px;">
                <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; color: #1e1b4b;">
                  📍 How to Pay Dues
                </h4>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #334155;">
                  Payments can be deposited at the Institute Office counter in Cash or via UPI payment. If you have already made this payment, kindly disregard this notice or share your receipt with the office desk.
                </p>
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
              <p style="margin: 0 0 4px 0; font-weight: 600;">This is an official automated fee payment reminder from UNNATI CLASSES ERP System.</p>
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

    console.log(`[FEE REMINDER EMAIL] To: ${cleanEmail} | Student: ${studentName} | Pending: ₹${formattedPending} | Period: ${periodStr}`);

    // 2. Dispatch Email via Resend if API key present
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Unnati Powerprep <onboarding@veroq.in>',
          to: [cleanEmail],
          subject: `Fee Payment Reminder: ₹${formattedPending} Pending for ${periodStr} - ${instName}`,
          html: htmlEmailContent
        });
      } catch (resendErr) {
        console.error('Failed to send Resend fee reminder email:', resendErr);
      }
    }

    // 3. Log notification attempt in Firestore
    const notificationsCol = adminDb.collection('institutes').doc(instituteId).collection('notifications');

    await notificationsCol.add({
      recipientStudentId: studentId || null,
      recipientEmail: cleanEmail,
      channel: 'email',
      message: `Fee Payment Reminder: ₹${formattedPending} pending for ${periodStr} sent to ${cleanEmail}.`,
      status: 'sent',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Formal PDF-inspired fee reminder email successfully sent to ${cleanEmail}!`
    });
  } catch (error: any) {
    console.error('Error sending fee reminder email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send fee reminder email.' },
      { status: 500 }
    );
  }
}
