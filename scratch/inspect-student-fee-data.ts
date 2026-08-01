import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

async function inspectStudentFees() {
  console.log("=== INSPECTING REAL FIRESTORE INSTITUTES & STUDENTS FOR FEE DISCREPANCIES ===");

  const instSnap = await getDocs(collection(db, 'institutes'));
  console.log(`Found ${instSnap.size} institutes.`);

  for (const instDoc of instSnap.docs) {
    const instituteId = instDoc.id;
    console.log(`\n--- Institute ID: ${instituteId} ---`);

    const studentsSnap = await getDocs(collection(db, 'institutes', instituteId, 'students'));
    console.log(`Students count: ${studentsSnap.size}`);

    const paymentsSnap = await getDocs(collection(db, 'institutes', instituteId, 'feePayments'));
    console.log(`Fee Payments count: ${paymentsSnap.size}`);

    const batchesSnap = await getDocs(collection(db, 'institutes', instituteId, 'batches'));
    const batchesMap = new Map<string, string>();
    batchesSnap.forEach(b => batchesMap.set(b.id, (b.data() as any).name));

    for (const studentDoc of studentsSnap.docs) {
      const student = { id: studentDoc.id, ...studentDoc.data() } as any;

      if (student.batchHistory?.length || student.previousBatches?.length || student.batchIds?.length > 1) {
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

inspectStudentFees().catch(err => {
  console.error("Inspection error:", err);
  process.exit(1);
});
