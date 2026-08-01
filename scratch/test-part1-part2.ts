import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getAdminDb } from '../lib/firebase/admin';

// Re-creating the calculations from student portal vs admin ERP
async function testStudentVsAdminFeeCalculation() {
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

  console.log("==========================================================================");
  console.log("=== TASK 1 & 2: VERIFYING STUDENT PORTAL VS ADMIN ERP CALCULATIONS ===");
  console.log("==========================================================================");
  console.log(`Student: ${student.fullName} (ID: ${student.id})`);

  // --- 1. STUDENT PORTAL DATA FETCHING & MULTI-BATCH CALCULATION LOGIC ---
  const studentPayments = feePayments.filter(
    (p) =>
      p.studentId === student.id ||
      p.studentId === student.email ||
      p.studentId === student.phone
  );

  const primaryBatchId = student?.batchIds?.[0] || '';
  const currentMonthlyFee = Number(student?.monthlyFee || student?.customFeeAmount || 2000);
  const currentEnrollmentDateStr = student?.currentBatchEnrollmentDate || student?.enrollmentDate || new Date().toISOString().substring(0, 10);

  let currentElapsedMonths = 1;
  if (currentEnrollmentDateStr) {
    const enrollDateObj = new Date(currentEnrollmentDateStr);
    const targetDateObj = new Date();
    if (!isNaN(enrollDateObj.getTime())) {
      const monthsDiff =
        (targetDateObj.getFullYear() - enrollDateObj.getFullYear()) * 12 +
        (targetDateObj.getMonth() - enrollDateObj.getMonth());
      currentElapsedMonths = Math.max(1, monthsDiff + 1);
    }
  }

  const currentTotalApplicable = currentMonthlyFee * currentElapsedMonths;
  const currentPayments = studentPayments.filter((p) =>
    (p as any).batchId
      ? (p as any).batchId === primaryBatchId
      : new Date(p.paymentDate) >= new Date(currentEnrollmentDateStr)
  );
  const currentTotalPaid = currentPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const currentOutstanding = Math.max(0, currentTotalApplicable - currentTotalPaid);

  const rawHistoryList = [
    ...(student?.batchHistory || []),
    ...(student?.previousBatches || [])
  ];

  const pastBatchesCalculated: any[] = [];
  const processedBatchIds = new Set<string>();

  rawHistoryList.forEach((item: any) => {
    const pastBatchId = item.batchId || (item.batchIds && item.batchIds[0]);
    if (!pastBatchId || pastBatchId === primaryBatchId || processedBatchIds.has(pastBatchId)) return;
    processedBatchIds.add(pastBatchId);

    const bObj = batches.find((b) => b.id === pastBatchId);
    const bName = item.batchName || bObj?.name || 'Previous Batch';
    const startDateStr = item.joinedDate || item.enrollmentDate || student?.enrollmentDate || item.shiftedAt || item.promotedAt;
    const endDateStr = item.leftDate || item.shiftedAt || item.promotedAt || new Date().toISOString();

    const sDate = new Date(startDateStr);
    const eDate = new Date(endDateStr);
    let monthsDiff = 1;
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      let m = (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth());
      if (eDate.getDate() < sDate.getDate()) m -= 1;
      monthsDiff = Math.max(1, m + 1);
    }

    const itemMonthlyFee = Number(item.monthlyFee || currentMonthlyFee);
    const itemTotalRequired = itemMonthlyFee * monthsDiff;

    const pbPayments = studentPayments.filter((p) =>
      (p as any).batchId
        ? (p as any).batchId === pastBatchId
        : new Date(p.paymentDate) < new Date(endDateStr)
    );

    const itemTotalPaid = pbPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const itemOutstanding = Math.max(0, itemTotalRequired - itemTotalPaid);

    pastBatchesCalculated.push({
      batchId: pastBatchId,
      batchName: bName,
      outstanding: itemOutstanding,
      paid: itemTotalPaid,
      required: itemTotalRequired,
      monthlyFee: itemMonthlyFee,
      payments: pbPayments
    });
  });

  console.log("\n[STUDENT PORTAL CALCULATION OUTPUT]:");
  console.log(`- Current Batch Outstanding: ₹${currentOutstanding}`);
  console.log(`- Past Batches Count: ${pastBatchesCalculated.length}`);
  pastBatchesCalculated.forEach(pb => {
    console.log(`  * Past Batch "${pb.batchName}" (ID: ${pb.batchId}): Required=₹${pb.required}, Paid=₹${pb.paid}, Outstanding=₹${pb.outstanding}`);
  });

  // --- 2. ADMIN ERP CURRENT CALCULATION LOGIC ---
  const calculateStudentFeeSummaryAdmin = (std: any) => {
    const monthlyFee = Number(std.monthlyFee || std.customFeeAmount || 2000);
    const primBatchId = std.batchIds?.[0] || '';
    const currentEnrollDateStr = std.currentBatchEnrollmentDate || std.enrollmentDate;

    let elapsedMonths = 1;
    if (currentEnrollDateStr) {
      const enrollDateObj = new Date(currentEnrollDateStr);
      let targetDateObj = new Date();
      if (!isNaN(enrollDateObj.getTime())) {
        let months = (targetDateObj.getFullYear() - enrollDateObj.getFullYear()) * 12 + (targetDateObj.getMonth() - enrollDateObj.getMonth());
        if (targetDateObj.getDate() < enrollDateObj.getDate()) months -= 1;
        elapsedMonths = Math.max(1, months + 1);
      }
    }
    const totalRequired = monthlyFee * elapsedMonths;
    const allStudentPayments = feePayments.filter((p) => p.studentId === std.id);
    const currentBatchPayments = allStudentPayments.filter((p) =>
      (p as any).batchId
        ? (p as any).batchId === primBatchId
        : new Date(p.paymentDate) >= new Date(currentEnrollDateStr || new Date().toISOString())
    );
    const totalPaid = currentBatchPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const balance = Math.max(0, totalRequired - totalPaid);
    return { balance, totalRequired, totalPaid };
  };

  const adminSummary = calculateStudentFeeSummaryAdmin(student);

  console.log("\n[ADMIN ERP CURRENT CALCULATION OUTPUT]:");
  console.log(`- Admin calculateStudentFeeSummary Balance: ₹${adminSummary.balance}`);
  console.log(`- Admin Due Dashboard Metric Total for Amit Mishra: ₹${adminSummary.balance} (COMPLETELY OMITTING PAST BATCH OUTSTANDING OF ₹3,000!)`);

  process.exit(0);
}

testStudentVsAdminFeeCalculation().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
