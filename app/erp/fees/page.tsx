'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import { generateFeeReceiptPDF } from '@/lib/fee-receipt-pdf';
import {
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Users,
  Loader2,
  X,
  Search,
  CheckCircle,
  AlertCircle,
  Clock3,
  Download,
  CreditCard,
  FileText,
  TrendingUp,
  BarChart3,
  RefreshCw,
  DollarSign,
  MessageSquare,
  Mail,
  Lock,
  Gift
} from 'lucide-react';
import { sendNotification } from '@/lib/notifications';
import { calculateStudentMultiBatchFees, calculateStudentDueDate } from '@/lib/fee-calculations';

interface FeeStructure {
  id: string;
  batchId: string | null;
  name: string;
  amount: number;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  dueDayOfMonth: number;
  status?: 'active' | 'closed';
  createdAt?: string;
}

interface FeePayment {
  id: string;
  studentId: string;
  batchId?: string | null;
  feeStructureId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer';
  receiptNumber: string;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
  notes: string;
  periodPaidFor?: string;
  createdAt?: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt?: string;
}

interface Student {
  id: string;
  fullName: string;
  email?: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  batchIds: string[];
  batchHistory?: any[];
  previousBatches?: any[];
  enrollmentDate?: string;
  currentBatchEnrollmentDate?: string;
  closingDate?: string | null;
  collectFeeOnMonthStart?: boolean;
  monthlyFee?: number;
  customFeeAmount?: number | null;
  status?: 'active' | 'inactive' | 'dropped';
}

interface Batch {
  id: string;
  name: string;
  subject: string;
}

interface InstituteInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export default function ErpFees() {
  const { instituteId, role, hasPermission } = useAuth();

  // Data state
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [instituteInfo, setInstituteInfo] = useState<InstituteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'dashboard' | 'structures' | 'ledger'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'structures' | 'ledger'>('dashboard');

  // Filter States for Dashboard Cards
  const [collectedPeriod, setCollectedPeriod] = useState<'this_month' | 'this_quarter' | 'this_year' | 'all_time'>('this_month');
  const [chartMonthOffset, setChartMonthOffset] = useState<number>(0);

  // Due Students Bulk Selection State
  const [selectedDueStudentIds, setSelectedDueStudentIds] = useState<string[]>([]);
  const [dueSearchQuery, setDueSearchQuery] = useState('');
  const [bulkReminderSubmitting, setBulkReminderSubmitting] = useState<boolean>(false);

  // Fee Structure Modal State
  const [structModalOpen, setStructModalOpen] = useState(false);
  const [editingStruct, setEditingStruct] = useState<FeeStructure | null>(null);
  const [structName, setStructName] = useState('');
  const [structAmount, setStructAmount] = useState<number>(2000);
  const [structFrequency, setStructFrequency] = useState<'one_time' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [structDueDay, setStructDueDay] = useState<number>(15);
  const [structBatchId, setStructBatchId] = useState<string>(''); // empty string = institute wide (null)

  // Payment Recording Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [selectedStructForPayment, setSelectedStructForPayment] = useState<FeeStructure | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('upi');
  const [payDate, setPayDate] = useState<string>(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [payNotes, setPayNotes] = useState<string>('');
  const [payPeriod, setPayPeriod] = useState<string>(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  const [payTargetBatchId, setPayTargetBatchId] = useState<string>('');

  // Selected Student for Ledger View
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchText, setStudentSearchText] = useState<string>('');
  const [adminSelectedBatchTab, setAdminSelectedBatchTab] = useState<string>('current');

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1. Subscribe to Firestore Collections
  useEffect(() => {
    if (!instituteId) return;

    // Fetch Institute info
    getDocs(query(collection(db, 'institutes'))).then((snap) => {
      snap.forEach((docSnap) => {
        if (docSnap.id === instituteId) {
          setInstituteInfo(docSnap.data() as InstituteInfo);
        }
      });
    });

    // Sub to Fee Structures
    const structsCol = collection(db, 'institutes', instituteId, 'feeStructures');
    const unsubStructs = onSnapshot(structsCol, (snapshot) => {
      const list: FeeStructure[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({ id: doc.id, status: d.status || 'active', ...d } as FeeStructure);
      });
      setFeeStructures(list);
      setLoading(false);
    });

    // Sub to Fee Payments
    const paymentsCol = collection(db, 'institutes', instituteId, 'feePayments');
    const unsubPayments = onSnapshot(paymentsCol, (snapshot) => {
      const list: FeePayment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as FeePayment);
      });
      setFeePayments(list);
    });

    // Sub to Expenses Collection
    const expensesCol = collection(db, 'institutes', instituteId, 'expenses');
    const unsubExpenses = onSnapshot(expensesCol, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(list);
    });

    // Sub to Students
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
          id: doc.id,
          fullName: d.fullName || 'Unknown',
          email: d.email || d.loginEmail || '',
          phone: d.phone || '',
          parentName: d.parentName || '',
          parentPhone: d.parentPhone || '',
          batchIds: d.batchIds || [],
          batchHistory: d.batchHistory || [],
          previousBatches: d.previousBatches || [],
          enrollmentDate: d.enrollmentDate || '',
          currentBatchEnrollmentDate: d.currentBatchEnrollmentDate || '',
          collectFeeOnMonthStart: d.collectFeeOnMonthStart !== false,
          closingDate: d.closingDate || null,
          status: d.status || 'active',
          monthlyFee: d.monthlyFee !== undefined && d.monthlyFee !== null ? Number(d.monthlyFee) : (d.customFeeAmount ? Number(d.customFeeAmount) : 2000),
          customFeeAmount: d.customFeeAmount !== undefined && d.customFeeAmount !== null ? Number(d.customFeeAmount) : null
        });
      });
      setStudents(list);
      if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].id);
      }
    });

    // Sub to Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({ id: doc.id, name: d.name, subject: d.subject });
      });
      setBatches(list);
    });

    return () => {
      unsubStructs();
      unsubPayments();
      unsubExpenses();
      unsubStudents();
      unsubBatches();
    };
  }, [instituteId]);

  // Cycle Rollover Simulation State (0 = Current Month, 1 = Next Month, etc.)
  const [simulatedCycleOffsetMonths, setSimulatedCycleOffsetMonths] = useState<number>(0);

  // Helper: Get Applicable Fee Structures for a Student
  const getApplicableStructures = (student: Student) => {
    return feeStructures.filter((struct) => {
      // Institute wide (batchId is null or empty)
      if (!struct.batchId) return true;
      // Batch specific
      return student.batchIds && student.batchIds.includes(struct.batchId);
    });
  };

  // Helper: Calculate Direct Enrollment-Date Student Fee Dues & Status across all batches
  const calculateStudentFeeSummary = (student: Student, cycleOffset: number = simulatedCycleOffsetMonths) => {
    const feeResult = calculateStudentMultiBatchFees(
      student as any,
      batches,
      feePayments as any,
      2000,
      cycleOffset
    );

    const isPastDue = new Date().getDate() > 15 || cycleOffset > 0;
    let status: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';

    if (feeResult.totalAllBatchesOutstanding === 0) {
      status = 'paid';
    } else if (feeResult.totalAllBatchesPaid > 0) {
      status = isPastDue ? 'overdue' : 'partial';
    } else {
      status = isPastDue ? 'overdue' : 'pending';
    }

    return {
      monthlyFee: feeResult.currentBatch.monthlyFee,
      elapsedMonths: feeResult.currentBatch.elapsedMonths,
      totalRequired: feeResult.currentBatch.totalRequired,
      totalPaid: feeResult.currentBatch.totalPaid,
      balance: feeResult.totalAllBatchesOutstanding,
      status,
      payments: feeResult.currentBatch.payments as FeePayment[],
      allPayments: feePayments.filter((p) => p.studentId === student.id),
      feeResult
    };
  };

  // Helper for backward compatibility
  const calculateFeeStatus = (studentId: string, struct: FeeStructure, cycleOffset: number = simulatedCycleOffsetMonths) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { totalPaid: 0, amount: struct.amount, amountPerCycle: struct.amount, balance: struct.amount, status: 'pending' as const, activeCyclesCount: 1 };
    const summary = calculateStudentFeeSummary(student, cycleOffset);
    return {
      totalPaid: summary.totalPaid,
      amount: summary.totalRequired,
      amountPerCycle: summary.monthlyFee,
      balance: summary.balance,
      status: summary.status,
      activeCyclesCount: summary.elapsedMonths
    };
  };

  // =========================================================================
  // METRICS CALCULATION FOR DASHBOARD
  // =========================================================================
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const currentMonthStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  const currentYearStr = String(_now.getFullYear()); // YYYY

  // 1. Collected Fees Card Calculations
  const totalCollectedToday = feePayments
    .filter((p) => p.paymentDate === todayStr)
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  const totalCollectedAllTime = feePayments
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  let totalCollectedPeriod = 0;
  if (collectedPeriod === 'this_month') {
    totalCollectedPeriod = feePayments
      .filter((p) => p.paymentDate && p.paymentDate.startsWith(currentMonthStr))
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  } else if (collectedPeriod === 'this_quarter') {
    const qMonth = Math.floor(new Date().getMonth() / 3) * 3;
    const qStart = `${new Date().getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
    totalCollectedPeriod = feePayments
      .filter((p) => p.paymentDate && p.paymentDate >= qStart)
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  } else if (collectedPeriod === 'this_year') {
    totalCollectedPeriod = feePayments
      .filter((p) => p.paymentDate && p.paymentDate.startsWith(currentYearStr))
      .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  } else {
    totalCollectedPeriod = totalCollectedAllTime;
  }

  // 2. Active vs Closed Fee Structure Counts
  const activeStructuresCount = feeStructures.filter((s) => s.status !== 'closed').length;
  const closedStructuresCount = feeStructures.filter((s) => s.status === 'closed').length;

  // 3. Due Dues & Students List Computation
  let totalPendingAmount = 0;
  let totalOverdueAmount = 0;
  const dueStudentsMap = new Map<string, { student: Student; totalBalance: number; status: 'overdue' | 'pending' }>();

  students.forEach((student) => {
    const summary = calculateStudentFeeSummary(student);
    if (summary.balance > 0) {
      if (summary.status === 'pending') {
        totalPendingAmount += summary.balance;
      } else {
        totalOverdueAmount += summary.balance;
      }

      dueStudentsMap.set(student.id, {
        student,
        totalBalance: summary.balance,
        status: summary.status === 'overdue' ? 'overdue' : 'pending'
      });
    }
  });

  const dueStudentsList = Array.from(dueStudentsMap.values());
  const dueStudentsCount = dueStudentsList.length;

  // Filtered due students list for search
  const filteredDueStudentsList = dueStudentsList.filter((item) => {
    const q = dueSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.student.fullName || '').toLowerCase().includes(q) ||
      (item.student.phone || '').toLowerCase().includes(q) ||
      (item.student.parentName || '').toLowerCase().includes(q) ||
      (item.student.parentPhone || '').toLowerCase().includes(q)
    );
  });

  // 4. Monthly Summary Chart Calculations (Income vs Expenses vs Net)
  const targetChartDate = new Date();
  targetChartDate.setMonth(targetChartDate.getMonth() + chartMonthOffset);
  const targetChartMonthStr = `${targetChartDate.getFullYear()}-${String(targetChartDate.getMonth() + 1).padStart(2, '0')}`;
  const targetChartMonthLabel = targetChartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthlyIncome = feePayments
    .filter((p) => p.paymentDate && p.paymentDate.startsWith(targetChartMonthStr))
    .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  const monthlyExpense = expenses
    .filter((e) => e.date && e.date.startsWith(targetChartMonthStr))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const monthlyNet = monthlyIncome - monthlyExpense;

  // Handle Fee Structure Create/Edit
  const openCreateStructModal = () => {
    setEditingStruct(null);
    setStructName('');
    setStructAmount(2000);
    setStructFrequency('monthly');
    setStructDueDay(15);
    setStructBatchId('');
    setError('');
    setStructModalOpen(true);
  };

  const openEditStructModal = (struct: FeeStructure) => {
    setEditingStruct(struct);
    setStructName(struct.name);
    setStructAmount(struct.amount);
    setStructFrequency(struct.frequency);
    setStructDueDay(struct.dueDayOfMonth);
    setStructBatchId(struct.batchId || '');
    setError('');
    setStructModalOpen(true);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (!structName || structAmount <= 0 || structDueDay < 1 || structDueDay > 31) {
      setError('Please provide valid name, positive amount, and due day (1-31).');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        batchId: structBatchId ? structBatchId : null,
        name: structName,
        amount: Number(structAmount),
        frequency: structFrequency,
        dueDayOfMonth: Number(structDueDay),
        status: editingStruct ? (editingStruct.status || 'active') : 'active',
        updatedAt: new Date().toISOString()
      };

      if (editingStruct) {
        await updateDoc(doc(db, 'institutes', instituteId, 'feeStructures', editingStruct.id), payload);
      } else {
        await addDoc(collection(db, 'institutes', instituteId, 'feeStructures'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      setStructModalOpen(false);
    } catch (err: any) {
      console.error('Error saving fee structure:', err);
      setError(err.message || 'Failed to save fee structure.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Fee Structure Active / Closed Status
  const handleToggleStructureStatus = async (structId: string, currentStatus: 'active' | 'closed') => {
    if (!instituteId) return;
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    const actionText = newStatus === 'closed' ? 'Close' : 'Reopen';

    if (!confirm(`Are you sure you want to ${actionText.toLowerCase()} this fee structure? Closed structures stop generating future cycles, while existing student ledgers remain preserved.`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'institutes', instituteId, 'feeStructures', structId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Error toggling structure status:', err);
      alert('Failed to update fee structure status.');
    }
  };

  // Bulk Fee Reminder Dispatch Handler (Rich HTML Email sent ONLY to Student Registered Emails)
  const handleSendBulkReminders = async () => {
    if (!instituteId || selectedDueStudentIds.length === 0) return;

    setBulkReminderSubmitting(true);

    try {
      let sentCount = 0;
      let skippedCount = 0;

      for (const studentId of selectedDueStudentIds) {
        const item = dueStudentsMap.get(studentId);
        if (item) {
          const registeredEmail = (item.student.email || (item.student as any).loginEmail || '').trim();
          if (!registeredEmail || !registeredEmail.includes('@')) {
            skippedCount++;
            continue;
          }

          const bObj = batches.find((b) => item.student.batchIds?.includes(b.id));
          const batchName = bObj ? bObj.name : 'General Batch';
          const rollNo = (item.student as any).rollNumber || (item.student as any).rollNo || 'N/A';
          const enrollmentDate = (item.student as any).currentBatchEnrollmentDate || (item.student as any).enrollmentDate || '';

          const res = await fetch('/api/auth/send-fee-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instituteId,
              studentId: item.student.id,
              studentEmail: registeredEmail,
              studentPhone: item.student.phone,
              studentName: item.student.fullName,
              parentName: item.student.parentName,
              batchName,
              rollNo,
              enrollmentDate,
              pendingAmount: item.totalBalance,
              monthlyFee: (item.student as any).monthlyFee || (item.student as any).customFeeAmount || 2000,
              billingPeriod: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
              instituteName: 'UNNATI CLASSES'
            })
          });

          if (res.ok) {
            sentCount++;
          } else {
            skippedCount++;
          }
        }
      }

      let alertMsg = `Successfully sent ${sentCount} formal fee reminder email(s) to student registered emails!`;
      if (skippedCount > 0) {
        alertMsg += ` (${skippedCount} student(s) skipped: No registered email address in Student Directory).`;
      }
      alert(alertMsg);
      setSelectedDueStudentIds([]);
    } catch (err: any) {
      console.error('Error sending bulk fee reminder emails:', err);
      alert(`Bulk Email Reminder Error: ${err.message}`);
    } finally {
      setBulkReminderSubmitting(false);
    }
  };

  const handleDeleteStructure = async (structId: string) => {
    if (!instituteId) return;
    if (!confirm('Are you sure you want to delete this fee structure? Existing payments linked to it will remain.')) return;

    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'feeStructures', structId));
    } catch (err) {
      console.error('Error deleting fee structure:', err);
      alert('Failed to delete fee structure.');
    }
  };

  const handleDeletePayment = async (payment: FeePayment) => {
    if (!instituteId) return;

    const confirmMsg = `Are you sure you want to delete fee payment entry receipt #${payment.receiptNumber || payment.id} of ₹${payment.amountPaid} (${payment.periodPaidFor})? This will revert the student's payment history and fee dues accordingly.`;

    if (!confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'feePayments', payment.id));
      alert(`Payment receipt #${payment.receiptNumber || payment.id} deleted successfully.`);
    } catch (err: any) {
      console.error('Error deleting payment entry:', err);
      alert(`Failed to delete payment entry: ${err.message}`);
    }
  };

  // Helper: Calculate sequential month paid for based on student enrollment date & payment history
  const getStudentNextPayPeriod = (
    student: Student,
    payments: FeePayment[],
    monthsToAdd: number = 1,
    targetBatchId?: string | null
  ): string => {
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
  };

  // Payment Recording Modal Handler
  const openPaymentModal = (student: Student, struct?: FeeStructure) => {
    const multiBatchRes = calculateStudentMultiBatchFees(
      student as any,
      batches,
      feePayments as any,
      2000
    );
    const targetBatchId = struct?.batchId || student.batchIds?.[0] || '';
    const targetBatchObj = multiBatchRes.allBatches.find((b) => b.batchId === targetBatchId) || multiBatchRes.currentBatch;

    const dummyStruct: FeeStructure = struct || {
      id: 'direct_student_fee',
      batchId: targetBatchObj.batchId || null,
      name: `${targetBatchObj.batchName} Tuition Fee`,
      amount: targetBatchObj.monthlyFee,
      frequency: 'monthly',
      dueDayOfMonth: 15
    };

    setSelectedStudentForPayment(student);
    setSelectedStructForPayment(dummyStruct);
    setPayTargetBatchId(targetBatchObj.batchId);
    setPayAmount(targetBatchObj.outstanding > 0 ? targetBatchObj.outstanding : targetBatchObj.monthlyFee);
    setPayMethod('upi');
    { const _d = new Date(); setPayDate(`${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`); }
    setPayPeriod(getStudentNextPayPeriod(student, feePayments, 1, targetBatchObj.batchId));
    setPayNotes('');
    setError('');
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !selectedStudentForPayment) return;

    if (payAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const summary = calculateStudentFeeSummary(selectedStudentForPayment);
      const newTotalPaid = summary.totalPaid + Number(payAmount);

      let calculatedStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';

      if (newTotalPaid >= summary.totalRequired) {
        calculatedStatus = 'paid';
      } else if (newTotalPaid > 0) {
        calculatedStatus = 'partial';
      } else {
        calculatedStatus = 'pending';
      }

      // Fetch persistent atomic receipt counter to guarantee UC-0001, UC-0002, etc., never repeat even if payments are deleted
      const counterRef = doc(db, 'institutes', instituteId, 'counters', 'receiptCounter');
      const counterSnap = await getDoc(counterRef);

      let nextNum = 1;
      if (counterSnap.exists() && typeof counterSnap.data().lastReceiptNum === 'number') {
        nextNum = counterSnap.data().lastReceiptNum + 1;
      } else {
        let maxExisting = 0;
        feePayments.forEach((p) => {
          if (p.receiptNumber) {
            const match = p.receiptNumber.match(/(\d+)/);
            if (match) {
              const val = parseInt(match[1], 10);
              if (val > maxExisting) maxExisting = val;
            }
          }
        });
        nextNum = Math.max(maxExisting, feePayments.length) + 1;
      }

      const receiptNum = `UC-${String(nextNum).padStart(4, '0')}`;

      // Update persistent counter immediately
      await setDoc(counterRef, {
        lastReceiptNum: nextNum,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const paymentPayload = {
        studentId: selectedStudentForPayment.id,
        batchId: payTargetBatchId || selectedStructForPayment?.batchId || selectedStudentForPayment.batchIds?.[0] || null,
        feeStructureId: selectedStructForPayment?.id || 'direct_student_fee',
        amountPaid: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        receiptNumber: receiptNum,
        status: calculatedStatus,
        periodPaidFor: payPeriod || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        notes: payNotes,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'institutes', instituteId, 'feePayments'), paymentPayload);

      setPaymentModalOpen(false);
    } catch (err: any) {
      console.error('Error saving payment:', err);
      setError(err.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Download Landscape A5 PDF Receipt
  const handleDownloadPDF = async (payment: FeePayment) => {
    const student = students.find((s) => s.id === payment.studentId) || null;
    await generateFeeReceiptPDF({
      instituteInfo,
      payment,
      student,
      batches,
      feeStructures
    });
  };

  // Filter students for ledger search
  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(studentSearchText.toLowerCase()) ||
      s.phone.includes(studentSearchText)
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Fee Management Module...</p>
      </div>
    );
  }

  if (!hasPermission('canViewFees')) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mx-auto text-amber-400">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-white">Access Denied</h3>
          <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-2">
            Fee status viewing capability has been turned OFF for your role by the Institute Owner in **Settings &gt; Access Control**.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Fee Management</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Setup fee structures, monitor payments, view student ledgers, and download receipts.
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Dashboard Metrics
          </button>
          <button
            onClick={() => setActiveTab('structures')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'structures'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Fee Structures
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Student Ledgers & Payments
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DASHBOARD METRICS */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Cycle Rollover Simulator Bar */}
          <div className="bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <RefreshCw className={`h-5 w-5 ${simulatedCycleOffsetMonths > 0 ? 'animate-spin-slow text-indigo-400' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white tracking-wide uppercase">Fee Cycle Rollover Simulator</span>
                  {simulatedCycleOffsetMonths > 0 && (
                    <span className="text-[10px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full">
                      +{simulatedCycleOffsetMonths} Month{simulatedCycleOffsetMonths > 1 ? 's' : ''} Advanced
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                  Test and verify automatic fee status rollover for active batch students across billing cycles.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setSimulatedCycleOffsetMonths(0)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simulatedCycleOffsetMonths === 0
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'bg-slate-955 text-slate-400 hover:text-white'
                }`}
              >
                Current Cycle
              </button>
              <button
                type="button"
                onClick={() => setSimulatedCycleOffsetMonths(1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simulatedCycleOffsetMonths === 1
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/50 hover:bg-indigo-900/60'
                }`}
              >
                Simulate Next Month (+1)
              </button>
              <button
                type="button"
                onClick={() => setSimulatedCycleOffsetMonths(2)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  simulatedCycleOffsetMonths === 2
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/50 hover:bg-indigo-900/60'
                }`}
              >
                +2 Months
              </button>
            </div>
          </div>

          {/* Dashboard Main Widgets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Widget 1: Due Fees Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Due Fees Overview</h3>
                    <p className="text-[11px] font-bold text-slate-400">Pending & overdue balances across students</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold bg-slate-955 px-2.5 py-1 rounded-xl border border-slate-800">
                  <span className="text-emerald-400">{activeStructuresCount} Active</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{closedStructuresCount} Closed Structs</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Students with Dues</span>
                  <span className="text-2xl font-black text-white mt-1 block">{dueStudentsCount}</span>
                  <span className="text-[10px] font-bold text-red-400/90 block mt-0.5">Active pending/overdue</span>
                </div>
                <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Overdue Dues</span>
                  <span className="text-2xl font-black text-red-400 mt-1 block">₹{totalOverdueAmount.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-0.5">+₹{totalPendingAmount.toLocaleString()} pending</span>
                </div>
              </div>

              <div className="bg-slate-955/60 border border-slate-850 p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Structures Status:</span>
                <span className="text-slate-200">{activeStructuresCount} Active | {closedStructuresCount} Closed Settled</span>
              </div>
            </div>

            {/* Widget 2: Collected Fees Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Collected Fees</h3>
                    <p className="text-[11px] font-bold text-slate-400">Total fee collections to date</p>
                  </div>
                </div>
                <select
                  value={collectedPeriod}
                  onChange={(e) => setCollectedPeriod(e.target.value as any)}
                  className="bg-slate-955 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-bold text-indigo-400 focus:outline-none cursor-pointer"
                >
                  <option value="this_month">This Month</option>
                  <option value="this_quarter">This Quarter</option>
                  <option value="this_year">This Year</option>
                  <option value="all_time">All-Time</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Today's Total</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">₹{totalCollectedToday.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-500 block mt-0.5">{todayStr}</span>
                </div>
                <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Period Total</span>
                  <span className="text-2xl font-black text-white mt-1 block">₹{totalCollectedPeriod.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-emerald-400/90 block mt-0.5">{collectedPeriod.replace('_', ' ').toUpperCase()}</span>
                </div>
              </div>

              <div className="bg-slate-955/60 border border-slate-850 p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold">
                <span className="text-slate-400">All-Time Total Collections:</span>
                <span className="text-emerald-400 font-extrabold text-sm">₹{totalCollectedAllTime.toLocaleString()}</span>
              </div>
            </div>

            {/* Widget 3: Monthly Summary Chart (Income vs Expenses vs Net) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Monthly Summary</h3>
                    <p className="text-[11px] font-bold text-slate-400">Income vs Expenses vs Net Total</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-955 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChartMonthOffset((prev) => prev - 1)}
                    className="px-2 py-0.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                    title="Previous Month"
                  >
                    ◄
                  </button>
                  <span className="text-[11px] font-bold text-white px-1">{targetChartMonthLabel}</span>
                  <button
                    type="button"
                    onClick={() => setChartMonthOffset((prev) => prev + 1)}
                    className="px-2 py-0.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                    title="Next Month"
                  >
                    ►
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* Income */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Income (Fee Receipts)
                    </span>
                    <span className="text-white">₹{monthlyIncome.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-955 rounded-full overflow-hidden border border-slate-850">
                    <div
                      style={{ width: `${Math.min(100, monthlyIncome > 0 ? 100 : 0)}%` }}
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Expenses */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Expenses (Analytics Ledger)
                    </span>
                    <span className="text-white">₹{monthlyExpense.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-955 rounded-full overflow-hidden border border-slate-850">
                    <div
                      style={{ width: `${Math.min(100, monthlyIncome > 0 ? (monthlyExpense / (monthlyIncome || 1)) * 100 : monthlyExpense > 0 ? 100 : 0)}%` }}
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>

                {/* Net Total */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-black">
                  <span className="text-slate-300">Net Profit / Loss:</span>
                  <span className={`text-sm ${monthlyNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {monthlyNet >= 0 ? '+' : ''}₹{monthlyNet.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Due Students Roster & Bulk Reminder Dispatch */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
              <div className="shrink-0">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-400" /> Due & Overdue Students Roster
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Select students to dispatch automated fee reminder notifications.
                </p>
              </div>

              <div className="flex items-center gap-3 ml-auto w-full md:w-auto">
                {selectedDueStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSendBulkReminders}
                    disabled={bulkReminderSubmitting}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {bulkReminderSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dispatching...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-3.5 w-3.5" /> Remind ({selectedDueStudentIds.length})
                      </>
                    )}
                  </button>
                )}
                <div className="relative flex-1 md:w-56 md:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={dueSearchQuery}
                    onChange={(e) => setDueSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl py-2 pl-9 pr-8 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 placeholder-slate-500 transition-all"
                  />
                  {dueSearchQuery && (
                    <button
                      onClick={() => setDueSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {dueStudentsList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic text-xs font-bold">
                No active pending or overdue student fees! All accounts are fully settled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                      <th className="p-3.5">
                        <input
                          type="checkbox"
                          checked={selectedDueStudentIds.length === filteredDueStudentsList.length && filteredDueStudentsList.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDueStudentIds(filteredDueStudentsList.map((item) => item.student.id));
                            } else {
                              setSelectedDueStudentIds([]);
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">Student Name</th>
                      <th className="p-3.5">Contact Phone</th>
                      <th className="p-3.5">Parent Info</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Total Dues</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                    {filteredDueStudentsList.map((item) => {
                      const isSelected = selectedDueStudentIds.includes(item.student.id);
                      const sDueDate = calculateStudentDueDate(item.student.enrollmentDate || (item.student as any).currentBatchEnrollmentDate);

                      return (
                        <tr key={item.student.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="p-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDueStudentIds((prev) => [...prev, item.student.id]);
                                } else {
                                  setSelectedDueStudentIds((prev) => prev.filter((id) => id !== item.student.id));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5 text-white">{item.student.fullName}</td>
                          <td className="p-3.5 text-slate-300">{item.student.phone}</td>
                          <td className="p-3.5 text-slate-400">{item.student.parentName} ({item.student.parentPhone})</td>
                          <td className="p-3.5 text-indigo-300 font-mono text-[11px]">{sDueDate}</td>
                          <td className="p-3.5 text-red-400 font-extrabold">₹{item.totalBalance.toLocaleString()}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 text-[9px] font-extrabold border rounded uppercase ${
                                item.status === 'overdue'
                                  ? 'bg-red-950/40 text-red-400 border-red-900/40'
                                  : 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(item.student.id);
                                setActiveTab('ledger');
                              }}
                              className="inline-flex items-center gap-1 bg-slate-850 hover:bg-slate-800 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              View Ledger
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payments Receipts Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <CreditCard className="h-4.5 w-4.5 text-indigo-400" /> Recent Payment Receipts
              </h3>
              <span className="text-xs text-slate-400 font-bold">Total: {feePayments.length} Payments</span>
            </div>

            {feePayments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic text-xs">No payments recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                      <th className="p-3.5">Receipt #</th>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Fee Structure</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Method</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                    {feePayments.slice(0, 10).map((payment) => {
                      const student = students.find((s) => s.id === payment.studentId);
                      const struct = feeStructures.find((f) => f.id === payment.feeStructureId);

                      return (
                        <tr key={payment.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="p-3.5 font-mono text-indigo-400">{payment.receiptNumber}</td>
                          <td className="p-3.5 text-white">{student ? student.fullName : 'N/A'}</td>
                          <td className="p-3.5 text-slate-300">{struct ? struct.name : 'Tuition Fee'}</td>
                          <td className="p-3.5 text-slate-400">{payment.paymentDate}</td>
                          <td className="p-3.5 uppercase text-slate-400">{payment.paymentMethod}</td>
                          <td className="p-3.5 text-emerald-400 font-extrabold">₹{Number(payment.amountPaid).toLocaleString()}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded uppercase">
                              {payment.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleDownloadPDF(payment)}
                              className="inline-flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5 text-indigo-400" /> Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FEE STRUCTURES SETUP */}
      {/* ========================================================================= */}
      {activeTab === 'structures' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Fee Structures</h2>
            <button
              onClick={openCreateStructModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Fee Structure
            </button>
          </div>

          {feeStructures.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
              <FileText className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-extrabold text-white">No Fee Structures Configured</h3>
              <p className="text-slate-400 text-xs mt-2 font-medium">
                Create a fee structure (e.g. Monthly Tuition Fee) for a batch or institute-wide.
              </p>
              <button
                onClick={openCreateStructModal}
                className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Create First Fee Structure
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feeStructures.map((struct) => {
                const batch = batches.find((b) => b.id === struct.batchId);
                return (
                  <div
                    key={struct.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition-all group duration-300 relative"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                              {batch ? `Batch: ${batch.name}` : 'Institute-Wide (All Batches)'}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[9px] font-extrabold border rounded uppercase ${
                                struct.status === 'closed'
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                              }`}
                            >
                              {struct.status === 'closed' ? 'Closed' : 'Active'}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-1">{struct.name}</h3>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditStructModal(struct)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                            title="Edit Structure"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(struct.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg cursor-pointer"
                            title="Delete Structure"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        <div className="text-2xl font-black text-emerald-400">
                          ₹{struct.amount.toLocaleString()}
                        </div>
                        <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                          <span>Frequency: <strong className="text-slate-200 capitalize">{struct.frequency}</strong></span>
                          <span>Due Day: <strong className="text-slate-200">{struct.dueDayOfMonth}th</strong></span>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleToggleStructureStatus(struct.id, struct.status || 'active')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              struct.status === 'closed'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/40'
                                : 'bg-slate-850 text-slate-300 border-slate-750 hover:bg-slate-800'
                            }`}
                          >
                            {struct.status === 'closed' ? 'Reopen Structure' : 'Close Structure'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STUDENT FEE LEDGERS & PAYMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Student Selector / Search */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Users className="h-5 w-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-extrabold text-white">Select Student for Fee Ledger</h3>
                <p className="text-[11px] font-semibold text-slate-400">View individual breakdown, dues, and record payments.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={studentSearchText}
                  onChange={(e) => setStudentSearchText(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none"
                  placeholder="Filter student list..."
                />
              </div>

              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full sm:w-64 bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-100 focus:outline-none cursor-pointer"
              >
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Ledger Breakdown */}
          {selectedStudent ? (
            <div className="space-y-6">
              {/* Student Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">Active Ledger Profile</span>
                  <h2 className="text-xl font-black text-white mt-0.5">{selectedStudent.fullName}</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Phone: {selectedStudent.phone} | Parent: {selectedStudent.parentName} ({selectedStudent.parentPhone})
                  </p>
                </div>
              </div>

              {/* Multi-Batch Fee Ledger Selector & Details */}
              {(() => {
                const multiBatchRes = calculateStudentMultiBatchFees(
                  selectedStudent as any,
                  batches,
                  feePayments as any,
                  2000,
                  simulatedCycleOffsetMonths
                );

                const activeBatchSummary =
                  adminSelectedBatchTab === 'current'
                    ? multiBatchRes.currentBatch
                    : (multiBatchRes.pastBatches.find((pb) => pb.batchId === adminSelectedBatchTab) || multiBatchRes.currentBatch);

                const statusBadgeStyles = {
                  paid: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
                  partial: 'bg-amber-950/40 text-amber-400 border-amber-900/40',
                  pending: 'bg-slate-800 text-slate-300 border-slate-700',
                  overdue: 'bg-red-950/40 text-red-400 border-red-900/40'
                };

                return (
                  <div className="space-y-6">
                    {/* Batch Selector Tabs (Current Batch vs Previous Batches) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">Select Fee Ledger Batch:</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setAdminSelectedBatchTab('current')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            adminSelectedBatchTab === 'current'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : 'bg-slate-955 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          Current Batch: {multiBatchRes.currentBatch.batchName} ({multiBatchRes.currentBatch.outstanding > 0 ? `₹${multiBatchRes.currentBatch.outstanding.toLocaleString()} Due` : 'Settled'})
                        </button>

                        {multiBatchRes.pastBatches.map((pb) => (
                          <button
                            key={pb.batchId}
                            type="button"
                            onClick={() => setAdminSelectedBatchTab(pb.batchId)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              adminSelectedBatchTab === pb.batchId
                                ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                                : pb.outstanding > 0
                                  ? 'bg-amber-955/70 text-amber-300 border-amber-900/60 hover:bg-amber-900/50'
                                  : 'bg-slate-955 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            Previous Batch: {pb.batchName} ({pb.outstanding > 0 ? `₹${pb.outstanding.toLocaleString()} Due` : 'Settled'})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Selected Batch Ledger Details Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4.5 w-4.5 text-indigo-400" />
                          Fee Ledger: <strong className="text-indigo-300">{activeBatchSummary.batchName}</strong>
                          {activeBatchSummary.isCurrent ? (
                            <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-bold">Current</span>
                          ) : (
                            <span className="text-[10px] bg-amber-955 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-bold">Previous Batch</span>
                          )}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/40 px-3 py-1 rounded-full">
                            Enrollment Date: {selectedStudent.enrollmentDate || 'N/A'}
                          </span>
                          <span className="text-xs text-amber-400 font-bold bg-amber-955/40 border border-amber-900/40 px-3 py-1 rounded-full">
                            Next Due Date: {calculateStudentDueDate(selectedStudent.enrollmentDate || (selectedStudent as any).currentBatchEnrollmentDate)}
                          </span>
                        </div>
                      </h3>

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Monthly Fee</span>
                            <span className="text-xl font-black text-emerald-400 mt-1 block">₹{activeBatchSummary.monthlyFee.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Per Month</span>
                          </div>
                          <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Active Months</span>
                            <span className="text-xl font-black text-white mt-1 block">{activeBatchSummary.elapsedMonths} Month(s)</span>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">{activeBatchSummary.isCurrent ? 'Since Enrollment' : 'In Previous Batch'}</span>
                          </div>
                          <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Total Required Dues</span>
                            <span className="text-xl font-black text-white mt-1 block">₹{activeBatchSummary.totalRequired.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Cumulative Dues</span>
                          </div>
                          <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Balance Due</span>
                            <span className="text-xl font-black text-amber-400 mt-1 block">₹{activeBatchSummary.outstanding.toLocaleString()}</span>
                            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">₹{activeBatchSummary.totalPaid.toLocaleString()} Paid</span>
                          </div>
                        </div>

                        <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-300">Account Status:</span>
                            <span className={`px-3 py-1 text-xs font-extrabold border rounded-xl uppercase tracking-wider ${statusBadgeStyles[activeBatchSummary.status]}`}>
                              {activeBatchSummary.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            {activeBatchSummary.outstanding > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/auth/send-fee-reminder', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        instituteId,
                                        studentId: selectedStudent.id,
                                        studentEmail: (selectedStudent as any).email || (selectedStudent as any).loginEmail,
                                        studentPhone: selectedStudent.phone,
                                        studentName: selectedStudent.fullName,
                                        parentName: selectedStudent.parentName,
                                        pendingAmount: activeBatchSummary.outstanding,
                                        monthlyFee: activeBatchSummary.monthlyFee,
                                        billingPeriod: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                                        instituteName: instituteInfo?.name || 'Unnati Classes Kalol'
                                      })
                                    });

                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Failed to send fee reminder email.');

                                    alert(`Attractive Fee Reminder Email with Unnati logo successfully sent to ${selectedStudent.fullName}'s Student Login Email!`);
                                  } catch (err: any) {
                                    alert(`Email Reminder Error: ${err.message}`);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                title="Send Rich HTML Fee Reminder Email with Unnati Classes Logo"
                              >
                                <Mail className="h-4 w-4" /> Send Email Reminder
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const dummyStruct: FeeStructure = {
                                  id: 'direct_student_fee',
                                  batchId: activeBatchSummary.batchId || null,
                                  name: `${activeBatchSummary.batchName} Tuition Fee`,
                                  amount: activeBatchSummary.monthlyFee,
                                  frequency: 'monthly',
                                  dueDayOfMonth: 15
                                };
                                setSelectedStudentForPayment(selectedStudent);
                                setSelectedStructForPayment(dummyStruct);
                                setPayTargetBatchId(activeBatchSummary.batchId);
                                setPayAmount(activeBatchSummary.outstanding > 0 ? activeBatchSummary.outstanding : activeBatchSummary.monthlyFee);
                                setPayMethod('upi');
                                { const _d = new Date(); setPayDate(`${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`); }
                                setPayPeriod(getStudentNextPayPeriod(selectedStudent, feePayments, 1, activeBatchSummary.batchId));
                                setPayNotes(activeBatchSummary.isCurrent ? '' : `Settling past dues for ${activeBatchSummary.batchName}`);
                                setError('');
                                setPaymentModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                            >
                              <Plus className="h-4 w-4" /> Record Payment ({activeBatchSummary.batchName})
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Individual Payment History */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                  <CreditCard className="h-4.5 w-4.5 text-indigo-400" /> Student Payment History
                </h3>

                {feePayments.filter((p) => p.studentId === selectedStudent.id).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 italic text-xs">No payments recorded for this student yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                          <th className="p-3.5">Receipt #</th>
                          <th className="p-3.5">Billing Month / Period</th>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Method</th>
                          <th className="p-3.5">Amount Paid</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                        {feePayments
                          .filter((p) => p.studentId === selectedStudent.id)
                          .map((payment) => (
                            <tr key={payment.id} className="hover:bg-slate-850/40 transition-colors">
                              <td className="p-3.5 font-mono text-indigo-400">{payment.receiptNumber}</td>
                              <td className="p-3.5 text-slate-200">
                                <div className="flex flex-col gap-1">
                                  <span className="px-2.5 py-1 bg-indigo-950/40 border border-indigo-900/40 text-indigo-300 rounded-lg text-xs font-extrabold w-fit">
                                    {payment.periodPaidFor || 'N/A'}
                                  </span>
                                  {(() => {
                                    const pBatchId = (payment as any).batchId;
                                    const bObj = batches.find((b) => b.id === pBatchId);
                                    const bName = bObj?.name || (pBatchId ? 'Previous Batch' : 'General');
                                    const isCurrent = pBatchId === selectedStudent.batchIds?.[0];
                                    return (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit ${
                                        isCurrent
                                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                                          : 'bg-amber-955/80 text-amber-300 border-amber-800'
                                      }`}>
                                        Batch: {bName} {isCurrent ? '(Current)' : '(Previous)'}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="p-3.5 text-slate-300">{payment.paymentDate}</td>
                              <td className="p-3.5 uppercase text-slate-400">{payment.paymentMethod}</td>
                              <td className="p-3.5 text-emerald-400 font-extrabold">₹{Number(payment.amountPaid).toLocaleString()}</td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded uppercase">
                                  {payment.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleDownloadPDF(payment)}
                                    className="inline-flex items-center gap-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    <Download className="h-3.5 w-3.5 text-indigo-400" /> PDF Receipt
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayment(payment)}
                                    className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Paid Fee Entry"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs font-bold">
              Please select a student above to view their fee ledger.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FEE STRUCTURE MODAL */}
      {/* ========================================================================= */}
      {structModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl">
            <button
              onClick={() => setStructModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-6">
              {editingStruct ? 'Edit Fee Structure' : 'Create Fee Structure'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveStructure} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Structure Name *
                </label>
                <input
                  type="text"
                  required
                  value={structName}
                  onChange={(e) => setStructName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Monthly Tuition Fee"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={structAmount}
                    onChange={(e) => setStructAmount(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Frequency *
                  </label>
                  <select
                    value={structFrequency}
                    onChange={(e) => setStructFrequency(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="one_time">One Time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Due Day of Month (1-31) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={31}
                    value={structDueDay}
                    onChange={(e) => setStructDueDay(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Applicable Batch
                  </label>
                  <select
                    value={structBatchId}
                    onChange={(e) => setStructBatchId(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Institute-Wide (All Batches)</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setStructModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD PAYMENT MODAL */}
      {/* ========================================================================= */}
      {paymentModalOpen && selectedStudentForPayment && selectedStructForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl">
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-1">
              Record Fee Payment
            </h2>
            <p className="text-xs text-slate-400 font-semibold mb-4">
              Recording payment for <strong className="text-white">{selectedStudentForPayment.fullName}</strong>
            </p>

            {(() => {
              const multiBatchRes = calculateStudentMultiBatchFees(
                selectedStudentForPayment as any,
                batches,
                feePayments as any,
                2000,
                simulatedCycleOffsetMonths
              );

              const activeTargetBatchId = payTargetBatchId || selectedStudentForPayment.batchIds?.[0] || '';
              const targetBatchObj =
                multiBatchRes.allBatches.find((b) => b.batchId === activeTargetBatchId) ||
                multiBatchRes.currentBatch;

              const mFee = targetBatchObj.monthlyFee;
              const bal = targetBatchObj.outstanding;
              const bName = targetBatchObj.batchName;

              return (
                <div className="mb-5 bg-slate-955 border border-slate-850 p-4 rounded-2xl space-y-3">
                  <div className="flex flex-wrap justify-between items-center text-xs font-bold gap-2">
                    <span className="text-slate-400">Target Batch: <strong className="text-indigo-300">{bName}</strong></span>
                    <span className="text-slate-400">Monthly Fee: <strong className="text-emerald-400">₹{mFee.toLocaleString()}</strong></span>
                    <span className="text-slate-400">Remaining Dues: <strong className="text-amber-400">₹{bal.toLocaleString()}</strong></span>
                  </div>

                  {/* Payment Mode Presets */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Select Payment Mode / Preset for {bName}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(mFee);
                          setPayNotes('');
                          setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, 1, activeTargetBatchId));
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          payAmount === mFee && payNotes !== 'Fee Relief (1 Month Wave Off)'
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        1 Month<br /><span className="text-[10px] text-emerald-400">₹{mFee.toLocaleString()}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(mFee * 2);
                          setPayNotes('');
                          setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, 2, activeTargetBatchId));
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          payAmount === mFee * 2 && payNotes !== 'Fee Relief (1 Month Wave Off)'
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        2 Months<br /><span className="text-[10px] text-emerald-400">₹{(mFee * 2).toLocaleString()}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const targetMonths = mFee > 0 ? Math.max(1, Math.round(bal / mFee)) : 1;
                          setPayAmount(bal > 0 ? bal : mFee);
                          setPayNotes('');
                          setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, targetMonths, activeTargetBatchId));
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          payAmount === (bal > 0 ? bal : mFee) && payNotes !== 'Fee Relief (1 Month Wave Off)'
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        Full Dues<br /><span className="text-[10px] text-amber-400">₹{(bal > 0 ? bal : mFee).toLocaleString()}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(mFee);
                          setPayNotes('Fee Relief (1 Month Wave Off)');
                          setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, 1, activeTargetBatchId));
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          payNotes === 'Fee Relief (1 Month Wave Off)'
                            ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-md ring-1 ring-purple-500'
                            : 'bg-purple-950/30 border-purple-900/60 text-purple-300 hover:bg-purple-900/40'
                        }`}
                      >
                        Fee Relief<br /><span className="text-[10px] text-purple-400">1 Mo. Wave Off</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayAmount(Math.round(mFee / 2));
                          setPayNotes('');
                          setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, 1, activeTargetBatchId));
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                          payAmount !== mFee && payAmount !== mFee * 2 && payAmount !== (bal > 0 ? bal : mFee) && payNotes !== 'Fee Relief (1 Month Wave Off)'
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        Partial<br /><span className="text-[10px] text-slate-400">Custom</span>
                      </button>
                    </div>

                    {payNotes === 'Fee Relief (1 Month Wave Off)' && (
                      <div className="mt-3 bg-purple-950/40 border border-purple-800/60 text-purple-300 text-xs p-3 rounded-xl font-bold flex items-center gap-2">
                        <Gift className="h-4 w-4 text-purple-400 shrink-0" />
                        <span>🎁 1 Month Fee Relief (Wave Off) Applied: ₹{mFee.toLocaleString()} will be credited to relax 1 month's fee for this student.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-4">
              {/* Batch Assignment Selector for Payment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Apply Payment To Batch *
                </label>
                <select
                  value={payTargetBatchId || selectedStudentForPayment.batchIds?.[0] || ''}
                  onChange={(e) => {
                    const newBatchId = e.target.value;
                    setPayTargetBatchId(newBatchId);
                    const multiBatchRes = calculateStudentMultiBatchFees(
                      selectedStudentForPayment as any,
                      batches,
                      feePayments as any,
                      2000,
                      simulatedCycleOffsetMonths
                    );
                    const targetObj = multiBatchRes.allBatches.find((b) => b.batchId === newBatchId) || multiBatchRes.currentBatch;
                    setPayAmount(targetObj.outstanding > 0 ? targetObj.outstanding : targetObj.monthlyFee);
                    setPayPeriod(getStudentNextPayPeriod(selectedStudentForPayment, feePayments, 1, newBatchId));
                  }}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-indigo-300 text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={selectedStudentForPayment.batchIds?.[0] || ''}>
                    Current Batch: {batches.find((b) => b.id === selectedStudentForPayment.batchIds?.[0])?.name || 'Current Batch'}
                  </option>
                  {(() => {
                    const rawPList = [
                      ...((selectedStudentForPayment as any).batchHistory || []),
                      ...((selectedStudentForPayment as any).previousBatches || [])
                    ];
                    const seenB = new Set<string>();
                    return rawPList.map((bh: any, idx: number) => {
                      const bId = bh.batchId || (bh.batchIds && bh.batchIds[0]);
                      if (!bId || bId === selectedStudentForPayment.batchIds?.[0] || seenB.has(bId)) return null;
                      seenB.add(bId);
                      const bName = bh.batchName || batches.find((b) => b.id === bId)?.name || 'Previous Batch';
                      return (
                        <option key={idx} value={bId}>
                          Previous Batch: {bName}
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-emerald-400 font-extrabold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Enter amount..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Billing Month / Period Paid For *
                  </label>
                  <input
                    type="text"
                    required
                    value={payPeriod}
                    onChange={(e) => setPayPeriod(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-indigo-300 font-bold text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. July 2026"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Transaction ID, Check #, or remarks"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
