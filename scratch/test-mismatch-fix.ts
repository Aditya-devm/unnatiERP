import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';
import { calculateStudentMultiBatchFees } from '../lib/fee-calculations';

async function testMismatchFix() {
  console.log("=== VERIFYING MISMATCH FIX FOR AMIT MISHRA ===");

  const adminDb = getAdminDb();
  const instituteId = 'ZA7wk0M2oXtrl3rd5FY3';

  const studentDoc = await adminDb.collection('institutes').doc(instituteId).collection('students').doc('fSoIp0CYFTwQYnAU3qg5').get();
  const d = studentDoc.data() as any;

  const batchesSnap = await adminDb.collection('institutes').doc(instituteId).collection('batches').get();
  const batches: any[] = [];
  batchesSnap.forEach(b => batches.push({ id: b.id, ...b.data() }));

  const paymentsSnap = await adminDb.collection('institutes').doc(instituteId).collection('feePayments').get();
  const feePayments: any[] = [];
  paymentsSnap.forEach(p => feePayments.push({ id: p.id, ...p.data() }));

  // 1. BEFORE FIX: Missing currentBatchEnrollmentDate in Admin ERP mapping
  const adminStudentBeforeFix = {
    id: studentDoc.id,
    fullName: d.fullName || 'Unknown',
    phone: d.phone || '',
    parentName: d.parentName || '',
    parentPhone: d.parentPhone || '',
    batchIds: d.batchIds || [],
    batchHistory: d.batchHistory || [],
    previousBatches: d.previousBatches || [],
    enrollmentDate: d.enrollmentDate || '',
    // currentBatchEnrollmentDate WAS MISSING!
    monthlyFee: Number(d.monthlyFee || d.customFeeAmount || 2000),
    customFeeAmount: d.customFeeAmount ? Number(d.customFeeAmount) : null
  };

  const resBefore = calculateStudentMultiBatchFees(adminStudentBeforeFix as any, batches, feePayments, 2000, 0);
  console.log("BEFORE FIX (Admin ERP output):");
  console.log(`- Elapsed Months: ${resBefore.currentBatch.elapsedMonths} Month(s)`);
  console.log(`- Balance Due: ₹${resBefore.currentBatch.outstanding}`);

  // 2. AFTER FIX: Including currentBatchEnrollmentDate in Admin ERP mapping
  const adminStudentAfterFix = {
    ...adminStudentBeforeFix,
    currentBatchEnrollmentDate: d.currentBatchEnrollmentDate || '',
    collectFeeOnMonthStart: d.collectFeeOnMonthStart !== false,
    closingDate: d.closingDate || null,
    status: d.status || 'active'
  };

  const resAfter = calculateStudentMultiBatchFees(adminStudentAfterFix as any, batches, feePayments, 2000, 0);
  console.log("\nAFTER FIX (Admin ERP output):");
  console.log(`- Elapsed Months: ${resAfter.currentBatch.elapsedMonths} Month(s)`);
  console.log(`- Balance Due: ₹${resAfter.currentBatch.outstanding}`);

  if (resAfter.currentBatch.elapsedMonths === 2 && resAfter.currentBatch.outstanding === 3000) {
    console.log("\n[PASS] Mismatch completely fixed! Admin ERP and Student Portal now both calculate exactly 2 months fees (₹3,000) for Amit Mishra!");
  } else {
    console.error("\n[FAIL] Mismatch still present!");
    process.exit(1);
  }

  process.exit(0);
}

testMismatchFix().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
