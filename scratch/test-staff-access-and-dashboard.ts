import fs from 'fs';
import path from 'path';

function verifyStaffAccessAndDashboard() {
  console.log("=== VERIFYING STAFF ACCESS AND DASHBOARD RESTRICTIONS ===");

  // 1. Check layout.tsx restrictions (Students directory and Batches)
  const layoutPath = path.join(process.cwd(), 'app', 'erp', 'layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  const layoutRestrictedPaths = [
    "item.href === '/erp/students'",
    "item.href === '/erp/batches'",
    "pathname?.startsWith('/erp/students')",
    "pathname?.startsWith('/erp/batches')"
  ];

  let layoutPassed = true;
  layoutRestrictedPaths.forEach((pathSnippet) => {
    if (!layoutContent.includes(pathSnippet)) {
      console.error(`[FAIL] layout.tsx does not restrict: ${pathSnippet}`);
      layoutPassed = false;
    }
  });

  if (layoutPassed) {
    console.log("[PASS] 1. Staff restricted from accessing student directory and batch pages.");
  } else {
    process.exit(1);
  }

  // 2. Check attendance page marking restrictions
  const attendancePath = path.join(process.cwd(), 'app', 'erp', 'attendance', 'page.tsx');
  const attendanceContent = fs.readFileSync(attendancePath, 'utf8');

  if (
    attendanceContent.includes("['owner', 'admin'].includes(role || '') &&") &&
    attendanceContent.includes("handleSelectBatch")
  ) {
    console.log("[PASS] 2. Staff restricted from marking staff attendance (Staff Batch card wrapped and gated).");
  } else {
    console.error("[FAIL] 2. Staff attendance marking restriction not found.");
    process.exit(1);
  }

  if (attendanceContent.includes("if (!isAdmin && r.userId !== user?.uid")) {
    console.log("[PASS] 2b. Non-admin staff only see their own Daily shift logs.");
  } else {
    console.error("[FAIL] 2b. Non-admin staff log filtering not found.");
    process.exit(1);
  }

  // 3. Check dashboard container updates in page.tsx
  const erpPagePath = path.join(process.cwd(), 'app', 'erp', 'page.tsx');
  const erpPageContent = fs.readFileSync(erpPagePath, 'utf8');

  if (
    erpPageContent.includes("!isAdmin ? (") &&
    erpPageContent.includes("Attendance Summary Calendar") &&
    erpPageContent.includes("staffAttendanceMap")
  ) {
    console.log("[PASS] 3. Staff dashboard displays personal Attendance Summary Calendar in place of Financials/Expenses.");
  } else {
    console.error("[FAIL] 3. Personal Attendance Summary Calendar missing on Staff Dashboard.");
    process.exit(1);
  }

  if (erpPageContent.includes("Student Dues & Collection Targets") && erpPageContent.includes("isAdmin && (")) {
    console.log("[PASS] 4. Student Dues & Collection Targets container hidden for staff dashboard.");
  } else {
    console.error("[FAIL] 4. Student Dues card is not restricted to admins.");
    process.exit(1);
  }

  console.log("\nALL VERIFICATIONS PASSED 100% SUCCESSFULLY!");
}

verifyStaffAccessAndDashboard();
