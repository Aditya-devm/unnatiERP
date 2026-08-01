export interface StudentFeeData {
  id: string;
  fullName: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  enrollmentDate?: string;
  currentBatchEnrollmentDate?: string;
  batchIds: string[];
  batchHistory?: any[];
  previousBatches?: any[];
  monthlyFee?: number;
  customFeeAmount?: number | null;
  collectFeeOnMonthStart?: boolean;
  closingDate?: string | null;
  status?: string;
}

export interface BatchData {
  id: string;
  name: string;
  subject?: string;
}

export interface FeePaymentData {
  id: string;
  studentId: string;
  batchId?: string | null;
  feeStructureId?: string;
  amountPaid: number;
  paymentDate: string;
  receiptNumber: string;
  paymentMethod?: string;
  periodPaidFor?: string;
}

export interface SingleBatchFeeSummary {
  batchId: string;
  batchName: string;
  isCurrent: boolean;
  monthlyFee: number;
  elapsedMonths: number;
  totalRequired: number;
  totalPaid: number;
  outstanding: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  payments: FeePaymentData[];
}

export interface MultiBatchFeeResult {
  currentBatch: SingleBatchFeeSummary;
  pastBatches: SingleBatchFeeSummary[];
  allBatches: SingleBatchFeeSummary[];
  totalAllBatchesOutstanding: number;
  totalAllBatchesPaid: number;
  hasUnpaidPastBatches: boolean;
}

/**
 * Parse any date string format safely (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD, ISO).
 */
export function parseFlexibleDate(dateStr?: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmYMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmYMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // Pattern: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

/**
 * Calculate personalized due date for a student based on their enrollment day of month.
 * Extracts the day of month from enrollmentDate (e.g. "20th of Every Month" if enrolled on 20/04/2026).
 */
export function calculateStudentDueDate(enrollmentDateStr?: string): string {
  const dObj = parseFlexibleDate(enrollmentDateStr);
  const dueDay = dObj ? dObj.getDate() : 1;
  return `${getOrdinalSuffix(dueDay)} of Every Month`;
}

/**
 * Shared Source of Truth for Student Multi-Batch Fee Calculations.
 * Computes exact fee dues, payments, and outstanding balances across
 * current primary batch and all historical/previous shifted batches.
 */
export function calculateStudentMultiBatchFees(
  student: StudentFeeData | null,
  batches: BatchData[],
  feePayments: FeePaymentData[],
  defaultMonthlyFee: number = 2000,
  cycleOffset: number = 0
): MultiBatchFeeResult {
  const fallbackResult: MultiBatchFeeResult = {
    currentBatch: {
      batchId: '',
      batchName: 'Current Batch',
      isCurrent: true,
      monthlyFee: defaultMonthlyFee,
      elapsedMonths: 1,
      totalRequired: defaultMonthlyFee,
      totalPaid: 0,
      outstanding: defaultMonthlyFee,
      status: 'pending',
      payments: []
    },
    pastBatches: [],
    allBatches: [],
    totalAllBatchesOutstanding: defaultMonthlyFee,
    totalAllBatchesPaid: 0,
    hasUnpaidPastBatches: false
  };

  if (!student) return fallbackResult;

  // Filter actual payments for this student
  const studentPayments = feePayments.filter(
    (p) =>
      p.studentId === student.id ||
      (student.phone && p.studentId === student.phone)
  );

  // 1. PRIMARY / CURRENT BATCH CALCULATIONS
  const primaryBatchId = student.batchIds?.[0] || '';
  const currentBatchObj = batches.find((b) => b.id === primaryBatchId);
  const currentBatchName = currentBatchObj?.name || 'Current Batch';
  const currentMonthlyFee = Number(
    student.monthlyFee !== undefined && student.monthlyFee !== null
      ? student.monthlyFee
      : (student.customFeeAmount !== undefined && student.customFeeAmount !== null
          ? student.customFeeAmount
          : defaultMonthlyFee)
  );

  // Determine effective fee cycle start date for the current batch:
  // Primary enrollment date is the student's institute enrollmentDate,
  // falling back to currentBatchEnrollmentDate or earliest batch history date.
  let currentEnrollmentDateStr = student.enrollmentDate || student.currentBatchEnrollmentDate;

  if (!currentEnrollmentDateStr) {
    const historyList = [
      ...(student.batchHistory || []),
      ...(student.previousBatches || [])
    ];
    if (historyList.length > 0) {
      const earliestHistory = historyList[0];
      if (earliestHistory) {
        currentEnrollmentDateStr =
          earliestHistory.joinedDate ||
          earliestHistory.enrollmentDate ||
          earliestHistory.shiftedAt ||
          earliestHistory.leftDate ||
          earliestHistory.promotedAt;
      }
    }
  }

  if (!currentEnrollmentDateStr) {
    currentEnrollmentDateStr = new Date().toISOString().substring(0, 10);
  }

  let currentElapsedMonths = 1;
  const enrollDateObj = parseFlexibleDate(currentEnrollmentDateStr);
  if (enrollDateObj) {
    let targetDateObj = new Date();
    targetDateObj.setMonth(targetDateObj.getMonth() + cycleOffset);

    const isInactiveStudent = student.status === 'inactive' || student.status === 'dropped' || Boolean(student.closingDate);
    if (isInactiveStudent && student.closingDate) {
      const cDate = parseFlexibleDate(student.closingDate);
      if (cDate) {
        targetDateObj = cDate;
      }
    }

    let months =
      (targetDateObj.getFullYear() - enrollDateObj.getFullYear()) * 12 +
      (targetDateObj.getMonth() - enrollDateObj.getMonth());
    if (targetDateObj.getDate() < enrollDateObj.getDate()) {
      months -= 1;
    }
    const collectOnStart = student.collectFeeOnMonthStart !== false;
    if (collectOnStart) {
      // Month Advance Mode: includes current running month (billed at start of cycle)
      currentElapsedMonths = Math.max(1, months + 1);
    } else {
      // After Month Completion Mode: counts ONLY fully completed month cycles (excludes uncompleted running month)
      currentElapsedMonths = Math.max(0, months);
    }
  }

  const currentTotalRequired = currentMonthlyFee * currentElapsedMonths;
  const currentPayments = studentPayments.filter((p) => {
    if (p.batchId) {
      return p.batchId === primaryBatchId;
    }
    if (!enrollDateObj) return true;
    const pDate = parseFlexibleDate(p.paymentDate);
    return pDate ? pDate >= enrollDateObj : true;
  });
  const currentTotalPaid = currentPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  const currentOutstanding = Math.max(0, currentTotalRequired - currentTotalPaid);

  const isPastDue = new Date().getDate() > 15 || cycleOffset > 0;
  let currentStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
  if (currentTotalPaid >= currentTotalRequired) {
    currentStatus = 'paid';
  } else if (currentTotalPaid > 0) {
    currentStatus = isPastDue ? 'overdue' : 'partial';
  } else {
    currentStatus = isPastDue ? 'overdue' : 'pending';
  }

  const currentBatchSummary: SingleBatchFeeSummary = {
    batchId: primaryBatchId,
    batchName: currentBatchName,
    isCurrent: true,
    monthlyFee: currentMonthlyFee,
    elapsedMonths: currentElapsedMonths,
    totalRequired: currentTotalRequired,
    totalPaid: currentTotalPaid,
    outstanding: currentOutstanding,
    status: currentStatus,
    payments: currentPayments
  };

  // 2. PREVIOUS / HISTORICAL BATCH CALCULATIONS
  const rawHistoryList = [
    ...(student.batchHistory || []),
    ...(student.previousBatches || [])
  ];

  // Collect payments for batches other than primaryBatchId
  studentPayments.forEach((p) => {
    const bId = p.batchId;
    if (
      bId &&
      bId !== primaryBatchId &&
      !rawHistoryList.some((h: any) => h.batchId === bId || (h.batchIds && h.batchIds.includes(bId)))
    ) {
      rawHistoryList.push({
        batchId: bId,
        batchName: batches.find((b) => b.id === bId)?.name || 'Previous Batch',
        shiftedAt: p.paymentDate || new Date().toISOString(),
        enrollmentDate: student.enrollmentDate || new Date().toISOString(),
        monthlyFee: currentMonthlyFee
      });
    }
  });

  const pastBatchesCalculated: SingleBatchFeeSummary[] = [];
  const processedBatchIds = new Set<string>();

  rawHistoryList.forEach((item: any) => {
    const pastBatchId = item.batchId || (item.batchIds && item.batchIds[0]);
    if (!pastBatchId || pastBatchId === primaryBatchId || processedBatchIds.has(pastBatchId)) return;
    processedBatchIds.add(pastBatchId);

    const bObj = batches.find((b) => b.id === pastBatchId);
    const bName = item.batchName || bObj?.name || 'Previous Batch';
    const startDateStr = item.joinedDate || item.enrollmentDate || student.enrollmentDate || item.shiftedAt || item.promotedAt;
    const endDateStr = item.leftDate || item.shiftedAt || item.promotedAt || new Date().toISOString();

    const sDate = parseFlexibleDate(startDateStr);
    const eDate = parseFlexibleDate(endDateStr);
    let monthsDiff = 1;
    if (sDate && eDate) {
      let m = (eDate.getFullYear() - sDate.getFullYear()) * 12 + (eDate.getMonth() - sDate.getMonth());
      if (eDate.getDate() < sDate.getDate()) m -= 1;
      monthsDiff = Math.max(1, m + 1);
    }

    const itemMonthlyFee = Number(item.monthlyFee || currentMonthlyFee);
    const itemTotalRequired = itemMonthlyFee * monthsDiff;

    const pbPayments = studentPayments.filter((p) => {
      if (p.batchId) {
        return p.batchId === pastBatchId;
      }
      if (!eDate) return false;
      const pDate = parseFlexibleDate(p.paymentDate);
      return pDate ? pDate < eDate : false;
    });

    const itemTotalPaid = pbPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const itemOutstanding = Math.max(0, itemTotalRequired - itemTotalPaid);

    let pbStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
    if (itemTotalPaid >= itemTotalRequired) {
      pbStatus = 'paid';
    } else if (itemTotalPaid > 0) {
      pbStatus = 'partial';
    } else {
      pbStatus = 'overdue';
    }

    pastBatchesCalculated.push({
      batchId: pastBatchId,
      batchName: bName,
      isCurrent: false,
      monthlyFee: itemMonthlyFee,
      elapsedMonths: monthsDiff,
      totalRequired: itemTotalRequired,
      totalPaid: itemTotalPaid,
      outstanding: itemOutstanding,
      status: pbStatus,
      payments: pbPayments
    });
  });

  const allBatches = [currentBatchSummary, ...pastBatchesCalculated];
  const totalAllBatchesOutstanding = allBatches.reduce((sum, b) => sum + b.outstanding, 0);
  const totalAllBatchesPaid = allBatches.reduce((sum, b) => sum + b.totalPaid, 0);
  const hasUnpaidPastBatches = pastBatchesCalculated.some((pb) => pb.outstanding > 0);

  return {
    currentBatch: currentBatchSummary,
    pastBatches: pastBatchesCalculated,
    allBatches,
    totalAllBatchesOutstanding,
    totalAllBatchesPaid,
    hasUnpaidPastBatches
  };
}
