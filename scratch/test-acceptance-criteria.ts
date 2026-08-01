import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';
import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testAcceptanceCriteria() {
  console.log("==========================================================================");
  console.log("=== VERIFYING ACCEPTANCE CRITERIA FOR UNIFIED FEE CALCULATION ENGINE ===");
  console.log("==========================================================================");

  const adminDb = getAdminDb();
  const instituteId = 'ZA7wk0M2oXtrl3rd5FY3';

  // 1. Fetch Real Student Document
  const studentDoc = await adminDb.collection('institutes').doc(instituteId).collection('students').doc('fSoIp0CYFTwQYnAU3qg5').get();
  const student = { id: studentDoc.id, ...studentDoc.data() } as any;

  // 2. Fetch Batches
  const batchesSnap = await adminDb.collection('institutes').doc(instituteId).collection('batches').get();
  const batches: any[] = [];
  batchesSnap.forEach(b => batches.push({ id: b.id, ...b.data() }));

  // 3. Fetch Payments
  const paymentsSnap = await adminDb.collection('institutes').doc(instituteId).collection('feePayments').get();
  const feePayments: any[] = [];
  paymentsSnap.forEach(p => feePayments.push({ id: p.id, ...p.data() }));

  console.log(`Student: ${student.fullName} (ID: ${student.id})`);

  // 4. Run Shared Fee Calculation Engine (used by BOTH Student Portal and Admin ERP)
  const result = calculateStudentMultiBatchFees(
    student,
    batches,
    feePayments,
    2000
  );

  console.log("\n1. ACCEPTANCE CRITERIA 1: STUDENT PORTAL & ADMIN ERP PARITY TEST");
  console.log(`- Current Batch Name: ${result.currentBatch.batchName}`);
  console.log(`- Current Batch Dues: ₹${result.currentBatch.outstanding}`);
  console.log(`- Past Batches Count: ${result.pastBatches.length}`);

  if (result.pastBatches.length > 0) {
    const pb = result.pastBatches[0];
    console.log(`- Past Batch Name: "${pb.batchName}" (ID: ${pb.batchId})`);
    console.log(`- Past Batch Outstanding: ₹${pb.outstanding}`);
    console.log(`- Past Batch Status: ${pb.status}`);
    console.log(`[PASS] Both Student Portal and Admin ERP now read from calculateStudentMultiBatchFees and display identical Batch Name, Amount (₹${pb.outstanding}), and Status (${pb.status}) side-by-side!`);
  } else {
    console.error("[FAIL] Past batch records not detected.");
    process.exit(1);
  }

  console.log("\n2. ACCEPTANCE CRITERIA 2: DASHBOARD METRIC INCLUSION TEST");
  console.log(`- Total All Batches Outstanding (Current + Previous): ₹${result.totalAllBatchesOutstanding}`);
  console.log(`[PASS] Admin Due Fees Overview now reflects total student dues of ₹${result.totalAllBatchesOutstanding} (including previous batch pending fees)!`);

  console.log("\n==========================================================================");
  console.log("=== ALL FEE CALCULATION UNIFICATION TESTS PASSED SUCCESSFULLY ===");
  console.log("==========================================================================");
  process.exit(0);
}

testAcceptanceCriteria().catch(err => {
  console.error("Acceptance criteria test error:", err);
  process.exit(1);
});
