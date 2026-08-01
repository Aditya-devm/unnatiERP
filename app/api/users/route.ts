import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
    try {
        const db = getAdminDb();
        const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        const users = usersSnapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));
        return NextResponse.json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { 
            name, email, password, role, batchId,
            // Student specific
            fatherName, motherName, dob, gender, whatsappNo, contactNo, address, schoolName, rollNo, standard,
            joiningDate, closingDate, fees, feesType,
            // Staff specific
            startDate, qualification, position, salary
        } = body;

        if (!name || !email || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const auth = getAdminAuth();
        const db = getAdminDb();

        // Check if user already exists in Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({
                    email,
                    password,
                    displayName: name,
                });
            } else {
                throw e;
            }
        }

        // Prepare Firestore data
        const userData: any = {
            name,
            email,
            password, // Saved for student portal verification
            instCode: body.instCode || null, // Saved for student portal verification
            role: role || 'student',
            instituteId: body.instituteId || null,
            batchId: (role === 'student' || !role) ? (standard || null) : (batchId || null),
            gender: gender || null,
            whatsappNo: whatsappNo || null,
            contactNo: contactNo || null,
            address: address || null,
            updatedAt: new Date().toISOString(),
        };

        if (role === 'student') {
            Object.assign(userData, {
                fatherName: fatherName || null,
                motherName: motherName || null,
                dob: dob || null,
                schoolName: schoolName || null,
                rollNo: rollNo || null,
                standard: standard || null,
                joiningDate: joiningDate || null,
                closingDate: closingDate || 'running',
                fees: fees || 0,
                feesType: feesType || 'monthly'
            });
        } else if (role === 'staff') {
            Object.assign(userData, {
                startDate: startDate || null,
                qualification: qualification || null,
                position: position || null,
                salary: salary || 0
            });
        }

        if (!userData.createdAt) {
            userData.createdAt = new Date().toISOString();
        }

        // Save to Firestore
        await db.collection('users').doc(userRecord.uid).set(userData, { merge: true });

        // Send Welcome Email for Students
        if (role === 'student' && email) {
            try {
                if (!process.env.RESEND_API_KEY) {
                    console.warn('RESEND_API_KEY is missing. Mocking email output.');
                    console.log(`[MOCK EMAIL] To: ${email} | Roll No: ${userData.rollNo} | Password: ${password}`);
                } else {
                    await resend.emails.send({
                        from: 'Unnati Powerprep <onboarding@veroq.in>',
                        to: [email],
                        subject: 'Welcome to Unnati Powerprep',
                        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Unnati Powerprep</title>
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
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #9b3f00; letter-spacing: -0.025em;">Unnati Powerprep</h1>
            </td>
          </tr>
        </table>

        <!-- Main Content Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e6e8ea;">
          <tr>
            <td style="padding: 48px 40px;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="margin: 0 0 12px; font-size: 32px; font-weight: 800; color: #2858b2; letter-spacing: -0.05em;">Welcome, ${name}!</h2>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #595c5d;">Your account has been successfully created on Unnati Powerprep. Use the credentials below to log in and access your AI Tutor dashboard.</p>
              </div>

              <!-- Credentials Box -->
              <div style="background-color: #f8fafc; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0; margin-bottom: 40px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding-bottom: 20px;">
                      <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">Institute Code</span>
                      <span style="font-size: 18px; font-weight: 800; color: #1e293b;">${userData.instCode || 'Not Assigned'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 20px;">
                      <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">Roll Number</span>
                      <span style="font-size: 18px; font-weight: 800; color: #2858b2;">${userData.rollNo || 'Not Assigned'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">Password</span>
                      <span style="font-size: 18px; font-weight: 800; color: #9b3f00;">${password}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center;">
                <a href="https://unnatipowerprep.com/login" style="display: inline-block; background-color: #2858b2; color: #ffffff; font-weight: 800; font-size: 16px; text-decoration: none; padding: 16px 40px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(40, 88, 178, 0.3);">
                  Login to Unnati Powerprep
                </a>
              </div>
            </td>
          </tr>
        </table>

        <!-- Brand Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 48px;">
          <tr>
            <td align="center" style="padding: 0 40px;">
              <p style="margin: 0 0 16px; font-size: 14px; color: #595c5d;">© 2026 Unnatipowerprep. All rights reserved.</p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">If you did not expect this email, please ignore it or contact our support team.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
                    });
                }
            } catch (err) {
                console.error('Failed to send welcome email:', err);
            }
        }

        return NextResponse.json(
            { message: 'User created/updated successfully' },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const db = getAdminDb();
        const auth = getAdminAuth();

        // If user is a student, ensure their batchId matches their standard
        const userDoc = await db.collection('users').doc(id).get();
        const currentRole = userDoc.exists ? userDoc.data()?.role : null;
        const mergedUpdate = { ...updateData };
        if (currentRole === 'student' || updateData.role === 'student') {
            if (updateData.standard !== undefined) {
                mergedUpdate.batchId = updateData.standard;
            }
        }

        // Update in Firestore
        await db.collection('users').doc(id).set({
            ...mergedUpdate,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Optionally update Auth if name or email changed
        if (updateData.name || updateData.email) {
            const authUpdate: any = {};
            if (updateData.name) authUpdate.displayName = updateData.name;
            if (updateData.email) authUpdate.email = updateData.email;
            await auth.updateUser(id, authUpdate);
        }

        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error: any) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const db = getAdminDb();
        const auth = getAdminAuth();

        // Delete from Firestore
        await db.collection('users').doc(id).delete();

        // Delete from Auth
        try {
            await auth.deleteUser(id);
        } catch (e: any) {
            console.warn("User not found in Auth or already deleted:", e.message);
        }

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
    }
}
