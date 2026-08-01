// Test Script to verify 0% attendance calculation when no days are marked

function testAttendancePercentageZero() {
  console.log("=== TESTING ATTENDANCE PERCENTAGE CALCULATION ===");

  // Scenario 1: Month with 0 marked days
  const presentCount1 = 0;
  const absentCount1 = 0;
  const holidayCount1 = 0;
  const leaveCount1 = 0;

  const totalMarkedDays1 = presentCount1 + absentCount1 + holidayCount1 + leaveCount1;
  const attendancePercentage1 = totalMarkedDays1 > 0
    ? Math.min(100, Math.round(((presentCount1 + holidayCount1 + leaveCount1) / totalMarkedDays1) * 100))
    : 0;

  console.log(`Scenario 1 (0 marked days): Total Marked = ${totalMarkedDays1}, Attendance % = ${attendancePercentage1}%`);

  if (attendancePercentage1 === 0) {
    console.log("[PASS] Month with 0 marked days correctly displays 0% attendance!");
  } else {
    console.error(`[FAIL] Expected 0%, but got ${attendancePercentage1}%`);
  }

  // Scenario 2: Month with marked days (e.g. 8 present out of 10 marked)
  const presentCount2 = 8;
  const absentCount2 = 2;
  const holidayCount2 = 0;
  const leaveCount2 = 0;

  const totalMarkedDays2 = presentCount2 + absentCount2 + holidayCount2 + leaveCount2;
  const attendancePercentage2 = totalMarkedDays2 > 0
    ? Math.min(100, Math.round(((presentCount2 + holidayCount2 + leaveCount2) / totalMarkedDays2) * 100))
    : 0;

  console.log(`Scenario 2 (8/10 present): Total Marked = ${totalMarkedDays2}, Attendance % = ${attendancePercentage2}%`);

  if (attendancePercentage2 === 80) {
    console.log("[PASS] Month with marked days correctly calculates 80% attendance!");
  } else {
    console.error(`[FAIL] Expected 80%, but got ${attendancePercentage2}%`);
  }
}

testAttendancePercentageZero();
