import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testPromotionFeeCycle() {
  console.log("==========================================================================");
  console.log("=== TESTING BATCH PROMOTION FEE CYCLE START DATE LOGIC ===");
  console.log("==========================================================================");

  // Scenario: Student joined institute on 2025-01-01 in Batch 1.
  // On 2026-07-01 (July 1, 2026), student was promoted to Batch 2 (Class 10 -> Class 11).
  // Current Date: 2026-07-30 (July 2026).

  const testStudent = {
    id: 'test_promoted_student',
    fullName: 'Rahul Sharma',
    phone: '9876543210',
    enrollmentDate: '2025-01-01', // Institute enrollment date (18 months ago!)
    currentBatchEnrollmentDate: '2026-07-01', // New Batch Start Date (July 1, 2026)
    batchIds: ['batch_class_11'],
    batchHistory: [
      {
        batchId: 'batch_class_10',
        batchName: 'Class 10',
        joinedDate: '2025-01-01',
        leftDate: '2026-06-30',
        shiftedAt: '2026-07-01',
        monthlyFee: 1500
      }
    ],
    monthlyFee: 2000,
    status: 'active'
  };

  const batches = [
    { id: 'batch_class_10', name: 'Class 10' },
    { id: 'batch_class_11', name: 'Class 11' }
  ];

  const feePayments = [
    // Paid 18 months of Class 10 fee
    {
      id: 'pay_1',
      studentId: 'test_promoted_student',
      batchId: 'batch_class_10',
      amountPaid: 27000, // 18 * 1500
      paymentDate: '2026-06-15',
      receiptNumber: 'RCPT-001'
    }
  ];

  const result = calculateStudentMultiBatchFees(
    testStudent as any,
    batches,
    feePayments as any,
    2000
  );

  console.log(`Student: ${testStudent.fullName}`);
  console.log(`Institute Enrollment Date: ${testStudent.enrollmentDate}`);
  console.log(`New Batch Start Date: ${testStudent.currentBatchEnrollmentDate}`);
  console.log(`Current Batch Name: ${result.currentBatch.batchName}`);
  console.log(`Current Batch Monthly Fee: ₹${result.currentBatch.monthlyFee}`);
  console.log(`Current Batch Elapsed Months: ${result.currentBatch.elapsedMonths} Month(s)`);
  console.log(`Current Batch Total Required Dues: ₹${result.currentBatch.totalRequired}`);
  console.log(`Current Batch Outstanding: ₹${result.currentBatch.outstanding}`);

  console.log(`\nPrevious Batch Name: ${result.pastBatches[0].batchName}`);
  console.log(`Previous Batch Outstanding: ₹${result.pastBatches[0].outstanding}`);

  if (result.currentBatch.elapsedMonths === 1 && result.currentBatch.totalRequired === 2000) {
    console.log("\n[SUCCESS PASS]: Current batch fee cycle correctly started from New Batch Start Date (2026-07-01) = 1 month (₹2,000), NOT from Institute Enrollment Date (2025-01-01 = 19 months / ₹38,000)!");
  } else {
    console.error("\n[FAIL]: Current batch fee cycle calculated incorrectly!");
    process.exit(1);
  }

  process.exit(0);
}

testPromotionFeeCycle().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
