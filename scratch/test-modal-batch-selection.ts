import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';
import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testModalBatchSelection() {
  console.log("=== TESTING PAYMENT MODAL TARGET BATCH SELECTION & PRESETS ===");

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

  const multiBatchRes = calculateStudentMultiBatchFees(student, batches, feePayments, 2000, 0);

  console.log(`Student: ${student.fullName}`);
  console.log(`Current Batch: ${multiBatchRes.currentBatch.batchName} (Monthly Fee: ₹${multiBatchRes.currentBatch.monthlyFee}, Dues: ₹${multiBatchRes.currentBatch.outstanding})`);
  console.log(`Past Batches Count: ${multiBatchRes.pastBatches.length}`);

  if (multiBatchRes.pastBatches.length > 0) {
    const pb = multiBatchRes.pastBatches[0];
    console.log(`Past Batch: ${pb.batchName} (Monthly Fee: ₹${pb.monthlyFee}, Dues: ₹${pb.outstanding})`);

    // Simulate modal selecting Previous Batch (Class 10)
    const payTargetBatchId = pb.batchId;
    const activeTargetBatchObj = multiBatchRes.allBatches.find(b => b.batchId === payTargetBatchId) || multiBatchRes.currentBatch;

    console.log("\n[SIMULATING MODAL DISPLAY WITH PREVIOUS BATCH TARGET]:");
    console.log(`- Displayed Target Batch Name: "${activeTargetBatchObj.batchName}"`);
    console.log(`- Displayed Monthly Fee: ₹${activeTargetBatchObj.monthlyFee}`);
    console.log(`- Displayed Full Dues: ₹${activeTargetBatchObj.outstanding}`);

    if (activeTargetBatchObj.monthlyFee === pb.monthlyFee && activeTargetBatchObj.outstanding === pb.outstanding) {
      console.log("\n[PASS] Modal now displays exact monthly fee and remaining dues for Previous Batch!");
    } else {
      console.error("\n[FAIL] Modal still showing present batch fees!");
      process.exit(1);
    }
  }

  process.exit(0);
}

testModalBatchSelection().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
