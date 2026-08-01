import { calculateStudentMultiBatchFees, parseFlexibleDate } from '../lib/fee-calculations';

async function testUserExactScenario() {
  console.log("=== TESTING USER EXACT SCENARIO FOR AFTER MONTH COMPLETION ===");

  const mockBatches = [{ id: 'b1', name: 'Class 10th - Science', subject: 'Physics' }];
  const mockPayments: any[] = [];

  // User Scenario Student: Enrolled on 2026-03-10, Monthly Fee 1500, Option "After Month Completion"
  // Today's Date: 2026-07-31
  const studentUserScenario = {
    id: 's_user_exact',
    fullName: 'Test Student',
    phone: '9876543210',
    enrollmentDate: '2026-03-10', // March 10th, 2026
    currentBatchEnrollmentDate: '2026-03-10',
    batchIds: ['b1'],
    monthlyFee: 1500,
    collectFeeOnMonthStart: false, // After Month Completion
    status: 'active'
  };

  console.log("\nCalculating Multi-Batch Fees for Student Enrolled on 2026-03-10 @ ₹1500 (After Month Completion)...");
  const res = calculateStudentMultiBatchFees(
    studentUserScenario as any,
    mockBatches,
    mockPayments,
    1500,
    0
  );

  console.log(`Elapsed Completed Months: ${res.currentBatch.elapsedMonths}`);
  console.log(`Total Required Dues: ₹${res.currentBatch.totalRequired}`);
  console.log(`Outstanding Balance: ₹${res.totalAllBatchesOutstanding}`);

  if (res.currentBatch.elapsedMonths === 4 && res.currentBatch.totalRequired === 6000) {
    console.log("[PASS] Student enrolled on 2026-03-10 has EXACTLY 4 completed months and ₹6,000 required dues (excludes 5th running month)!");
  } else {
    console.error(`[FAIL] Expected 4 completed months (₹6,000), but got ${res.currentBatch.elapsedMonths} months (₹${res.currentBatch.totalRequired})!`);
    process.exit(1);
  }

  // Compare with Month Advance student enrolled on same date (2026-03-10)
  const studentAdvanceScenario = { ...studentUserScenario, collectFeeOnMonthStart: true };
  const resAdv = calculateStudentMultiBatchFees(
    studentAdvanceScenario as any,
    mockBatches,
    mockPayments,
    1500,
    0
  );

  console.log(`\nMonth Advance Student (Same Date 2026-03-10 @ ₹1500):`);
  console.log(`Elapsed Months (includes running month in advance): ${resAdv.currentBatch.elapsedMonths}`);
  console.log(`Total Required Dues: ₹${resAdv.currentBatch.totalRequired}`);

  if (resAdv.currentBatch.elapsedMonths === 5 && resAdv.currentBatch.totalRequired === 7500) {
    console.log("[PASS] Month Advance student correctly includes current running month (5 months = ₹7,500)!");
  } else {
    console.error(`[FAIL] Month Advance expected 5 months (₹7,500), got ${resAdv.currentBatch.elapsedMonths} months!`);
    process.exit(1);
  }

  console.log("\nALL EXACT SCENARIO TESTS PASSED 100% SUCCESSFULLY!");
  process.exit(0);
}

testUserExactScenario().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
