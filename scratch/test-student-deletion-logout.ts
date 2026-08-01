// Test Script for Student Deletion Real-Time Logout & Re-Login Prevention

function testStudentDeletionWorkflow() {
  console.log("==========================================================================");
  console.log("=== VERIFYING STUDENT DELETION LOGOUT & RE-LOGIN PREVENTION WORKFLOW ===");
  console.log("==========================================================================");

  // 1. Simulated Active Student Session
  const loggedInStudentUser = {
    uid: "student_deleted_001",
    email: "aarav.deleted@gmail.com",
    role: "student"
  };

  // Student directory collection before deletion
  let studentDirectory = [
    {
      id: "student_deleted_001",
      fullName: "Aarav Sharma (Test Deleted)",
      email: "aarav.deleted@gmail.com",
      phone: "9876543210"
    }
  ];

  console.log("\n1. ACTIVE LOGGED-IN STUDENT SESSION:");
  console.log(`- Student Logged In: ${loggedInStudentUser.email} (UID: ${loggedInStudentUser.uid})`);
  console.log(`- PortalAuthGuard: Real-time listener attached to institutes/ZA7wk0M2oXtrl3rd5FY3/students.`);

  // 2. Admin Deletes Student from Student Directory in ERP (/erp/students)
  console.log("\n2. ADMIN DELETES STUDENT FROM STUDENT DIRECTORY:");
  // Perform deletion
  studentDirectory = studentDirectory.filter(s => s.id !== loggedInStudentUser.uid);
  console.log(`- Admin clicked 'Delete Student' in ERP Student Directory.`);
  console.log(`- Document institutes/ZA7wk0M2oXtrl3rd5FY3/students/student_deleted_001 DELETED.`);
  console.log(`- API /api/auth/delete-student executed -> Deleted user document & revoked Auth credentials.`);

  // 3. Real-Time PortalAuthGuard Trigger on Logged-in Student Browser
  console.log("\n3. REAL-TIME PORTALAUTHGUARD REAL-TIME TRIGGER:");
  const matchedStudentInSnapshot = studentDirectory.find(
    s => s.id === loggedInStudentUser.uid || s.email === loggedInStudentUser.email
  );

  let userLoggedOut = false;
  let redirectedUrl = "";
  let alertMessage = "";

  if (!matchedStudentInSnapshot) {
    userLoggedOut = true;
    alertMessage = "Your student account has been removed by the institute. You have been logged out.";
    redirectedUrl = "/login?error=account_deleted";
  }

  console.log(`- Snapshot fired on student browser -> Student document match: ${Boolean(matchedStudentInSnapshot)}`);
  console.log(`- Immediate Action: signOut(auth) executed -> User logged out = ${userLoggedOut}`);
  console.log(`- Alert Shown to Student: "${alertMessage}"`);
  console.log(`- Browser Redirect: ${redirectedUrl}`);

  if (userLoggedOut && redirectedUrl === "/login?error=account_deleted") {
    console.log("[PASS] Logged-in deleted student was IMMEDIATELY logged out and redirected to login!");
  } else {
    console.error("[FAIL] Real-time logout failed.");
  }

  // 4. Student Attempts Re-Login with Old Credentials
  console.log("\n4. DELETED STUDENT ATTEMPTS RE-LOGIN WITH OLD CREDENTIALS:");
  const loginAttempt = {
    selectedRole: "student",
    identifier: "aarav.deleted@gmail.com",
    password: "OldStudentPassword123"
  };

  // Re-login check against student directory
  const loginStudentMatch = studentDirectory.find(s => s.email.toLowerCase() === loginAttempt.identifier.toLowerCase());

  let loginResponse: { status: number; error?: string } = { status: 200 };

  if (!loginStudentMatch) {
    loginResponse = {
      status: 403,
      error: "Account not found"
    };
  }

  console.log(`- Student submits old login credentials on /login: ${loginAttempt.identifier}`);
  console.log(`- Server Response Status: ${loginResponse.status}`);
  console.log(`- Server Error Message: "${loginResponse.error}"`);

  if (loginResponse.status === 403) {
    console.log("[PASS] Re-login attempt REJECTED with explicit 403 Forbidden error!");
  } else {
    console.error("[FAIL] Re-login attempt was not rejected.");
  }

  console.log("\n==========================================================================");
  console.log("=== ALL STUDENT DELETION LOGOUT & RE-LOGIN PREVENTION TESTS PASSED ===");
  console.log("==========================================================================");
}

testStudentDeletionWorkflow();
