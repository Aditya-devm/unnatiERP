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

// Helper to verify password against Firebase Auth REST API if API Key is configured
async function verifyFirebaseAuthPassword(email: string, pass: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || apiKey === 'mock_key') return false;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: pass,
          returnSecureToken: true,
        }),
      }
    );
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { selectedRole, instituteCode, identifier, password } = await req.json();

    if (!password || !password.trim()) {
      return NextResponse.json(
        { error: 'Password is required to sign in.' },
        { status: 400 }
      );
    }

    const cleanCode = (instituteCode || '').trim().toUpperCase();
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = password.trim();
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    let instituteId: string | null = null;

    // 1. Locate Institute (if code provided)
    if (cleanCode) {
      const instSnapByCode = await adminDb
        .collection('institutes')
        .where('code', '==', cleanCode)
        .limit(1)
        .get();

      if (!instSnapByCode.empty) {
        instituteId = instSnapByCode.docs[0].id;
      } else {
        const instByIdDoc = await adminDb.collection('institutes').doc(cleanCode).get();
        if (instByIdDoc.exists) {
          instituteId = instByIdDoc.id;
          if (!instByIdDoc.data()?.code) {
            const newCode = generateShortCode();
            await adminDb.collection('institutes').doc(cleanCode).update({ code: newCode });
          }
        } else {
          const allInsts = await adminDb.collection('institutes').get();
          if (!allInsts.empty) {
            const matched = allInsts.docs.find((d) => d.data().code?.toUpperCase() === cleanCode);
            if (matched) {
              instituteId = matched.id;
            } else if (allInsts.docs.length === 1) {
              instituteId = allInsts.docs[0].id;
            }
          }
        }
      }

      if (!instituteId) {
        return NextResponse.json(
          { error: 'Invalid Institute Code. Please check the code provided by your institute admin.' },
          { status: 400 }
        );
      }
    }

    let targetEmail: string | null = null;
    let targetRole: string | null = null;
    let expectedPassword: string | null = null;
    let studentMatched = false;
    let staffProfileData: Record<string, any> | null = null;
    let staffOriginalDocId: string | null = null;

    // 2. SPECIAL HANDLER FOR STAFF LOGIN (Matching Staff ID + Password ONLY)
    if (selectedRole === 'staff') {
      const rawStaffId = (identifier || '').trim();
      if (!rawStaffId) {
        return NextResponse.json(
          { error: 'Staff ID is required to sign in.' },
          { status: 400 }
        );
      }

      // Search users collection for staffId matching rawStaffId case-insensitively
      const usersRef = adminDb.collection('users');
      const allUsersSnap = await usersRef.get();

      const matchedStaffDoc = allUsersSnap.docs.find((d) => {
        const u = d.data();
        return (
          u.staffId &&
          u.staffId.toString().trim().toLowerCase() === rawStaffId.toLowerCase()
        );
      });

      if (!matchedStaffDoc) {
        return NextResponse.json(
          { error: 'Invalid Staff ID. No staff account found with this Staff ID.' },
          { status: 401 }
        );
      }

      const staffData = matchedStaffDoc.data();

      // Check role
      if (!['staff', 'teacher', 'admin', 'owner'].includes(staffData.role)) {
        return NextResponse.json(
          { error: 'Access denied. The provided ID does not belong to a staff account.' },
          { status: 403 }
        );
      }

      // Check password strictly
      if (!staffData.password || staffData.password.trim() !== cleanPass) {
        return NextResponse.json(
          { error: 'Invalid Password. Please enter the correct Staff Password.' },
          { status: 401 }
        );
      }

      instituteId = staffData.instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
      targetEmail = staffData.email || `${staffData.staffId.toString().trim().toLowerCase()}@unnatipowerprep.com`;
      targetRole = staffData.role || 'staff';
      expectedPassword = staffData.password;
      staffProfileData = staffData;
      staffOriginalDocId = matchedStaffDoc.id;
    }

    // 3. Student Mode with Institute Code + Password (no email entered)
    if (selectedRole === 'student' && instituteId && !cleanId) {
      const studentsSnap = await adminDb
        .collection('institutes')
        .doc(instituteId)
        .collection('students')
        .get();

      const matchedStudentDoc = studentsSnap.docs.find((d) => {
        const sData = d.data();
        return sData.password && sData.password.trim() === cleanPass;
      });

      if (matchedStudentDoc) {
        const sData = matchedStudentDoc.data();
        targetEmail = sData.email || (sData.phone ? `${sData.phone.replace(/\D/g, '')}@unnatipowerprep.com` : null);
        targetRole = 'student';
        expectedPassword = sData.password ? sData.password.trim() : null;
        studentMatched = true;
      } else {
        // Check users collection under institute
        const usersSnap = await adminDb
          .collection('users')
          .where('instituteId', '==', instituteId)
          .get();

        const matchedUserDoc = usersSnap.docs.find((d) => {
          const uData = d.data();
          return ['student', 'parent'].includes(uData.role) && uData.password && uData.password.trim() === cleanPass;
        });

        if (matchedUserDoc) {
          const uData = matchedUserDoc.data();
          targetEmail = uData.email;
          targetRole = uData.role || 'student';
          expectedPassword = uData.password ? uData.password.trim() : null;
          studentMatched = true;
        }
      }

      if (!targetEmail || !studentMatched) {
        return NextResponse.json(
          { error: 'Invalid Portal Password. No student account found matching this password for this Institute Code.' },
          { status: 401 }
        );
      }
    }

    // 4. Identifier Provided (Email or Phone) for Students/Admin
    if (cleanId && selectedRole !== 'staff') {
      let matchedStudentData: any = null;
      let matchedUserData: any = null;

      // Check students subcollection first if instituteId is known
      if (instituteId) {
        const studentSnap = await adminDb
          .collection('institutes')
          .doc(instituteId)
          .collection('students')
          .where('email', '==', cleanId)
          .get();

        if (!studentSnap.empty) {
          matchedStudentData = studentSnap.docs[0].data();
        } else {
          // Check by phone
          const studentPhoneSnap = await adminDb
            .collection('institutes')
            .doc(instituteId)
            .collection('students')
            .where('phone', '==', cleanId)
            .get();

          if (!studentPhoneSnap.empty) {
            matchedStudentData = studentPhoneSnap.docs[0].data();
          }
        }
      }

      // Check across all institutes if not found yet
      if (!matchedStudentData) {
        const allInsts = await adminDb.collection('institutes').get();
        for (const instDoc of allInsts.docs) {
          const sSnap = await instDoc.ref.collection('students').where('email', '==', cleanId).get();
          if (!sSnap.empty) {
            matchedStudentData = sSnap.docs[0].data();
            instituteId = instDoc.id;
            break;
          }
          const sPhoneSnap = await instDoc.ref.collection('students').where('phone', '==', cleanId).get();
          if (!sPhoneSnap.empty) {
            matchedStudentData = sPhoneSnap.docs[0].data();
            instituteId = instDoc.id;
            break;
          }
        }
      }

      // Check users collection by email or staffId
      const usersByEmail = await adminDb
        .collection('users')
        .where('email', '==', cleanId)
        .get();

      if (!usersByEmail.empty) {
        matchedUserData = usersByEmail.docs[0].data();
        if (!instituteId) instituteId = matchedUserData.instituteId;
      } else {
        const usersByStaffId = await adminDb
          .collection('users')
          .where('staffId', '==', cleanId.toUpperCase())
          .get();

        if (!usersByStaffId.empty) {
          matchedUserData = usersByStaffId.docs[0].data();
          if (!instituteId) instituteId = matchedUserData.instituteId;
        }
      }

      if (selectedRole === 'student') {
        if (!matchedStudentData || matchedStudentData.deleted || matchedStudentData.status === 'deleted') {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 403 }
          );
        }
        targetEmail = matchedStudentData.email || cleanId;
        targetRole = 'student';
        expectedPassword = matchedStudentData.password ? matchedStudentData.password.trim() : null;
      } else if (matchedStudentData) {
        targetEmail = matchedStudentData.email || cleanId;
        targetRole = 'student';
        expectedPassword = matchedStudentData.password ? matchedStudentData.password.trim() : null;
      } else if (matchedUserData) {
        targetEmail = matchedUserData.email || cleanId;
        targetRole = matchedUserData.role || 'teacher';
        expectedPassword = matchedUserData.password ? matchedUserData.password.trim() : null;
      } else {
        targetEmail = cleanId;
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'No account found for the provided email or phone.' },
        { status: 404 }
      );
    }

    const finalTargetEmail: string = targetEmail;

    // STRICT PASSWORD VERIFICATION
    if (expectedPassword) {
      if (cleanPass !== expectedPassword) {
        const isFbValid = await verifyFirebaseAuthPassword(finalTargetEmail, cleanPass);
        if (!isFbValid) {
          return NextResponse.json(
            { error: 'Invalid password. Please enter the correct Portal Password provided by your institute.' },
            { status: 401 }
          );
        }
      }
    } else {
      try {
        const userRec = await adminAuth.getUserByEmail(finalTargetEmail);
        if (userRec) {
          const isFbValid = await verifyFirebaseAuthPassword(finalTargetEmail, cleanPass);
          if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'mock_key' && !isFbValid) {
            return NextResponse.json(
              { error: 'Invalid password. Please check your password and try again.' },
              { status: 401 }
            );
          }
        }
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' && selectedRole === 'student') {
          return NextResponse.json(
            { error: 'No student account found for this email address. Please contact your institute admin.' },
            { status: 404 }
          );
        }
      }
    }

    if (!instituteId) instituteId = 'ZA7wk0M2oXtrl3rd5FY3';
    if (!targetRole) {
      targetRole = selectedRole === 'admin' ? 'owner' : (selectedRole === 'staff' ? 'teacher' : 'student');
    }

    // Role compatibility checks
    if (selectedRole === 'admin' && !['owner', 'admin'].includes(targetRole)) {
      return NextResponse.json(
        { error: `This account is registered as ${targetRole.toUpperCase()}. Please select 'Login as ${targetRole === 'teacher' || targetRole === 'staff' ? 'Staff' : 'Student'}'.` },
        { status: 403 }
      );
    }
    if (selectedRole === 'staff' && !['teacher', 'staff'].includes(targetRole)) {
      return NextResponse.json(
        { error: `This account is registered as ${targetRole.toUpperCase()}. Please select 'Login as ${['owner', 'admin'].includes(targetRole) ? 'Admin' : 'Student'}'.` },
        { status: 403 }
      );
    }
    if (selectedRole === 'student' && !['student', 'parent'].includes(targetRole)) {
      return NextResponse.json(
        { error: `This account is registered as ${targetRole.toUpperCase()}. Please select 'Login as ${['owner', 'admin'].includes(targetRole) ? 'Admin' : 'Staff'}'.` },
        { status: 403 }
      );
    }

    // Firebase Auth user lookup or creation
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(finalTargetEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email: finalTargetEmail,
          password: cleanPass,
          emailVerified: true
        });
      } else {
        throw err;
      }
    }

    // Ensure user record in Firestore — merge full staff profile if staff login
    const userDocPayload: Record<string, any> = {
      email: finalTargetEmail,
      role: targetRole,
      instituteId: instituteId,
      password: cleanPass,
      updatedAt: new Date().toISOString()
    };

    if (staffProfileData && staffOriginalDocId) {
      // Copy all staff profile fields into the auth user doc
      userDocPayload.staffId = staffProfileData.staffId || null;
      userDocPayload.name = staffProfileData.name || staffProfileData.fullName || null;
      userDocPayload.fullName = staffProfileData.fullName || staffProfileData.name || null;
      userDocPayload.position = staffProfileData.position || null;
      userDocPayload.qualification = staffProfileData.qualification || null;
      userDocPayload.phone = staffProfileData.phone || null;
      userDocPayload.photoUrl = staffProfileData.photoUrl || null;
      userDocPayload.batchIds = staffProfileData.batchIds || [];
      userDocPayload.salary = staffProfileData.salary || null;
      userDocPayload.startDate = staffProfileData.startDate || null;
      userDocPayload.staffOriginalDocId = staffOriginalDocId;

      // Also update the original staff doc with this firebaseUid so attendance records can link
      await adminDb.collection('users').doc(staffOriginalDocId).set(
        { firebaseUid: userRecord.uid, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    await adminDb.collection('users').doc(userRecord.uid).set(
      userDocPayload,
      { merge: true }
    );

    // Mint Custom Token
    const customToken = await adminAuth.createCustomToken(userRecord.uid);
    const redirectUrl = selectedRole === 'staff' || ['teacher', 'staff'].includes(targetRole) ? '/portal' : (['owner', 'admin'].includes(targetRole) ? '/erp' : '/portal');

    return NextResponse.json({
      success: true,
      customToken,
      role: targetRole,
      instituteId,
      redirectUrl
    });

  } catch (error: any) {
    console.error('Error executing institute login:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed.' },
      { status: 500 }
    );
  }
}
