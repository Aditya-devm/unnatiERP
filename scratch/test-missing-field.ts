import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testMissingCurrentBatchEnrollmentDateFallback() {
  console.log("==========================================================================");
  console.log("=== TESTING FALLBACK WHEN currentBatchEnrollmentDate IS MISSING ===");
  console.log("==========================================================================");

  // Student shifted batch on 2026-06-01, but currentBatchEnrollmentDate field is missing from doc
  const testStudentWithoutField = {
    id: 'test_missing_field',
    fullName: 'Priya Patel',
    phone: '9876543211',
    enrollmentDate: '2024-01-01', // Institute enrollment date 2.5 years ago
    // currentBatchEnrollmentDate is UNDEFINED!
    batchIds: ['batch_class_12'],
    batchHistory: [
      {
        batchId: 'batch_class_11',
        batchName: 'Class 11',
        joinedDate: '2024-01-01',
        leftDate: '2026-05-31',
        shiftedAt: '2026-06-01',
        monthlyFee: 1800
      }
    ],
    monthlyFee: 2500,
    status: 'active'
  };

  const batches = [
    { id: 'batch_class_11', name: 'Class 11' },
    { id: 'batch_class_12', name: 'Class 12' }
  ];

  const result = calculateStudentMultiBatchFees(
    testStudentWithoutField as any,
    batches,
    [],
    2000
  );

  console.log(`Student: ${testStudentWithoutField.fullName}`);
  console.log(`Institute Enrollment Date: ${testStudentWithoutField.enrollmentDate}`);
  console.log(`Current Batch Name: ${result.currentBatch.batchName}`);
  console.log(`Current Batch Elapsed Months: ${result.currentBatch.elapsedMonths}`);

  process.exit(0);
}

testMissingCurrentBatchEnrollmentDateFallback().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
