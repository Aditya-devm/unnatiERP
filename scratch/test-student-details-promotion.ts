import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';
import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testStudentDetailsPromotion() {
  console.log("=== TESTING STUDENT DETAILS PROMOTION & FEE HISTORY SUMMARY ===");

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

  const feeResult = calculateStudentMultiBatchFees(student, batches, feePayments, 2000);

  console.log(`Student: ${student.fullName}`);
  console.log(`Institute Enrollment Date: ${student.enrollmentDate}`);
  console.log(`Current Batch Enrollment Date: ${student.currentBatchEnrollmentDate || 'N/A'}`);

  console.log("\n--- PRESENT BATCH DETAILS ---");
  console.log(`- Batch Name: ${feeResult.currentBatch.batchName}`);
  console.log(`- Monthly Fee: ₹${feeResult.currentBatch.monthlyFee} / month`);
  console.log(`- Elapsed Months: ${feeResult.currentBatch.elapsedMonths} Month(s)`);
  console.log(`- Total Required: ₹${feeResult.currentBatch.totalRequired}`);
  console.log(`- Total Paid: ₹${feeResult.currentBatch.totalPaid}`);
  console.log(`- Outstanding: ₹${feeResult.currentBatch.outstanding}`);
  console.log(`- Status: ${feeResult.currentBatch.status}`);

  console.log("\n--- PREVIOUS BATCH PROMOTION HISTORY ---");
  if (feeResult.pastBatches.length === 0) {
    console.log("No previous batch promotion history recorded.");
  } else {
    feeResult.pastBatches.forEach((pb, idx) => {
      const historyEntry = (student.batchHistory || student.previousBatches || []).find((h: any) => h.batchId === pb.batchId);
      const promotedOn = historyEntry?.shiftedAt || historyEntry?.leftDate || historyEntry?.promotedAt || 'N/A';
      console.log(`[Item #${idx + 1}]`);
      console.log(`- Previous Batch Name: "${pb.batchName}"`);
      console.log(`- Promoted To Batch: "${feeResult.currentBatch.batchName}"`);
      console.log(`- Promoted / Shifted Date: ${promotedOn}`);
      console.log(`- Monthly Fee: ₹${pb.monthlyFee} / month`);
      console.log(`- Elapsed Duration: ${pb.elapsedMonths} Month(s)`);
      console.log(`- Total Required Dues: ₹${pb.totalRequired}`);
      console.log(`- Total Amount Paid: ₹${pb.totalPaid}`);
      console.log(`- Outstanding Dues: ₹${pb.outstanding}`);
    });
  }

  process.exit(0);
}

testStudentDetailsPromotion().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
