import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';
import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function inspectAmitMishra() {
  console.log("=== INSPECTING AMIT MISHRA FEES CALCULATIONS IN DETAIL ===");

  const adminDb = getAdminDb();
  const instituteId = 'ZA7wk0M2oXtrl3rd5FY3';

  const studentDoc = await adminDb.collection('institutes').doc(instituteId).collection('students').doc('fSoIp0CYFTwQYnAU3qg5').get();
  const student = { id: studentDoc.id, ...studentDoc.data() } as any;

  const batchesSnap = await adminDb.collection('institutes').doc(instituteId).collection('batches').get();
  const batches: any[] = [];
  batchesSnap.forEach(b => batches.push({ id: b.id, ...b.data() }));

  const paymentsSnap = await adminDb.collection('institutes').doc(instituteId).collection('feePayments').get();
  const feePayments: any[] = [];
  paymentsSnap.forEach(p => feePayments.push({ id: p.id, ...p.data() }));

  console.log("Student Doc Data:");
  console.log("- fullName:", student.fullName);
  console.log("- enrollmentDate:", student.enrollmentDate);
  console.log("- currentBatchEnrollmentDate:", student.currentBatchEnrollmentDate);
  console.log("- monthlyFee:", student.monthlyFee);
  console.log("- customFeeAmount:", student.customFeeAmount);
  console.log("- collectFeeOnMonthStart:", student.collectFeeOnMonthStart);
  console.log("- batchIds:", student.batchIds);

  console.log("\n1. Running calculateStudentMultiBatchFees with cycleOffset = 0 (Default):");
  const resDefault = calculateStudentMultiBatchFees(student, batches, feePayments, 2000, 0);
  console.log("- Current Batch Name:", resDefault.currentBatch.batchName);
  console.log("- Current Batch Monthly Fee:", resDefault.currentBatch.monthlyFee);
  console.log("- Current Batch Elapsed Months:", resDefault.currentBatch.elapsedMonths);
  console.log("- Current Batch Total Required:", resDefault.currentBatch.totalRequired);
  console.log("- Current Batch Outstanding:", resDefault.currentBatch.outstanding);

  console.log("\n2. Checking Admin ERP call:");
  // Let's check what simulatedCycleOffsetMonths or defaultmonthlyFee Admin ERP passes!

  process.exit(0);
}

inspectAmitMishra().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
