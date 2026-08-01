import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';

async function inspectRealFeeStudents() {
  console.log("=== INSPECTING REAL FIRESTORE INSTITUTES & STUDENTS USING FIREBASE ADMIN SDK ===");

  const adminDb = getAdminDb();
  const instSnap = await adminDb.collection('institutes').get();
  console.log(`Found ${instSnap.size} institutes.`);

  for (const instDoc of instSnap.docs) {
    const instituteId = instDoc.id;
    console.log(`\n--- Institute ID: ${instituteId} ---`);

    const studentsSnap = await instDoc.ref.collection('students').get();
    console.log(`Students count: ${studentsSnap.size}`);

    const paymentsSnap = await instDoc.ref.collection('feePayments').get();
    console.log(`Fee Payments count: ${paymentsSnap.size}`);

    const batchesSnap = await instDoc.ref.collection('batches').get();
    const batchesMap = new Map<string, string>();
    batchesSnap.forEach(b => batchesMap.set(b.id, (b.data() as any).name));

    for (const studentDoc of studentsSnap.docs) {
      const student = { id: studentDoc.id, ...studentDoc.data() } as any;

      if (student.batchHistory?.length || student.previousBatches?.length || (student.batchIds && student.batchIds.length > 1)) {
        console.log(`\nFound Student with Batch Shift / Multiple Batches:`);
        console.log(`- ID: ${student.id}`);
        console.log(`- Name: ${student.fullName}`);
        console.log(`- Current batchIds:`, student.batchIds);
        console.log(`- batchHistory:`, student.batchHistory);
        console.log(`- previousBatches:`, student.previousBatches);

        const studentPayments = paymentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.studentId === student.id || p.studentId === student.email || p.studentId === student.phone);

        console.log(`- Total Payments Recorded: ${studentPayments.length}`);
        studentPayments.forEach(p => {
          console.log(`  * Txn #${p.receiptNumber}: ₹${p.amountPaid} for Batch ID [${p.batchId || 'N/A'}] on ${p.paymentDate}`);
        });
      }
    }
  }

  process.exit(0);
}

inspectRealFeeStudents().catch(err => {
  console.error("Inspection error:", err);
  process.exit(1);
});
