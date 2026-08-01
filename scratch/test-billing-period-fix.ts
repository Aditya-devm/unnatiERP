import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getStudentNextPayPeriod(
  student: any,
  payments: any[],
  monthsToAdd: number = 1,
  targetBatchId?: string | null
): string {
  const effectiveBatchId = targetBatchId || student.batchIds?.[0] || '';
  const batchPayments = payments.filter(
    (p) => p.studentId === student.id && (p.batchId ? p.batchId === effectiveBatchId : effectiveBatchId === student.batchIds?.[0])
  );
  const paidMonthsCount = batchPayments.length;

  let baseDateStr = student.currentBatchEnrollmentDate || student.enrollmentDate;
  if (effectiveBatchId && effectiveBatchId !== student.batchIds?.[0]) {
    const historyList = [...(student.batchHistory || []), ...(student.previousBatches || [])];
    const hEntry = historyList.find((h: any) => h.batchId === effectiveBatchId);
    if (hEntry) {
      baseDateStr = hEntry.joinedDate || hEntry.enrollmentDate || hEntry.shiftedAt || hEntry.promotedAt || baseDateStr;
    }
  }

  let baseDate = new Date();
  if (baseDateStr) {
    const d = new Date(baseDateStr);
    if (!isNaN(d.getTime())) {
      baseDate = d;
    }
  }

  const m1Date = new Date(baseDate.getFullYear(), baseDate.getMonth() + paidMonthsCount, 1);
  const m1Str = m1Date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  if (monthsToAdd <= 1) {
    return m1Str;
  } else {
    const m2Date = new Date(baseDate.getFullYear(), baseDate.getMonth() + paidMonthsCount + (monthsToAdd - 1), 1);
    const m1MonthOnly = m1Date.toLocaleString('en-US', { month: 'long' });
    const m2MonthYear = m2Date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return `${m1MonthOnly} - ${m2MonthYear}`;
  }
}

function testBillingPeriod() {
  console.log("=== TESTING BILLING MONTH / PERIOD PAID FORMATTER ===");

  const testStudent = {
    id: 'student_123',
    enrollmentDate: '2026-03-01',
    currentBatchEnrollmentDate: '2026-06-01',
    batchIds: ['current_batch'],
    batchHistory: [
      { batchId: 'previous_batch', joinedDate: '2026-03-01', leftDate: '2026-05-31' }
    ]
  };

  const payments: any[] = [];

  // Test 1: 1 Month for Current Batch
  const period1 = getStudentNextPayPeriod(testStudent, payments, 1, 'current_batch');
  console.log(`1 Month (Current Batch): "${period1}"`);

  // Test 2: 2 Months for Current Batch
  const period2 = getStudentNextPayPeriod(testStudent, payments, 2, 'current_batch');
  console.log(`2 Months (Current Batch): "${period2}"`);

  // Test 3: 1 Month for Previous Batch
  const periodPrev = getStudentNextPayPeriod(testStudent, payments, 1, 'previous_batch');
  console.log(`1 Month (Previous Batch): "${periodPrev}"`);

  if (period1 === 'June 2026' && period2 === 'June - July 2026' && periodPrev === 'March 2026') {
    console.log("\n[PASS] Billing Month displays clean Month Names without batch names or month count text!");
  } else {
    console.error("\n[FAIL] Incorrect month formatting!");
    process.exit(1);
  }

  process.exit(0);
}

testBillingPeriod();
