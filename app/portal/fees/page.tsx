'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db, auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, addDoc } from 'firebase/firestore';
import { Loader2, Lock, CreditCard, X, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { generateFeeReceiptPDF } from '@/lib/fee-receipt-pdf';
import BellNotificationIcon from '@/components/BellNotificationIcon';

interface Student {
  id: string;
  fullName: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  enrollmentDate?: string;
  currentBatchEnrollmentDate?: string;
  rollNumber?: string;
  rollNo?: string;
  email?: string;
  photoUrl?: string | null;
  batchIds: string[];
  batchHistory?: any[];
  previousBatches?: any[];
  monthlyFee?: number;
  customFeeAmount?: number | null;
}

interface Batch {
  id: string;
  name: string;
  subject?: string;
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  dueDayOfMonth?: number;
  dueDate?: string;
}

interface FeePayment {
  id: string;
  studentId: string;
  feeStructureId?: string;
  amountPaid: number;
  paymentDate: string;
  receiptNumber: string;
  paymentMethod?: string;
  periodPaidFor?: string;
}

import { calculateStudentMultiBatchFees, calculateStudentDueDate } from '@/lib/fee-calculations';

export default function PortalFeesPage() {
  const { user, role, instituteId, loading: authLoading, hasPermission } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [instituteInfo, setInstituteInfo] = useState<{ name: string; address: string; phone: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard staff
  useEffect(() => {
    if (!authLoading) {
      const erpStaffRoles = ['owner', 'admin', 'teacher', 'staff'];
      if (role && erpStaffRoles.includes(role)) {
        router.replace('/erp');
        return;
      }
      if (!user) {
        router.replace('/login');
        return;
      }
    }
  }, [user, role, authLoading, router]);

  // Firestore Subscriptions
  useEffect(() => {
    if (!instituteId || !user) return;

    // 0. Institute Doc
    const unsubInst = onSnapshot(doc(db, 'institutes', instituteId), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setInstituteInfo({
          name: d.name || 'Unnati Classes Kalol',
          address: d.address || 'F-21, Fortune Empire, Borisana Road, Kalol - 382721',
          phone: d.phone || '+91 9510434702',
          email: d.email || 'unnaticlasseskalol@gmail.com'
        });
      }
    });

    // 1. Resolve Student Profile
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      let matched: Student | null = null;
      snapshot.forEach((d) => {
        const data = d.data();
        if (
          d.id === user.uid ||
          (user.email && data.email?.toLowerCase() === user.email.toLowerCase()) ||
          (user.phoneNumber && data.phone && user.phoneNumber.includes(data.phone.replace(/\D/g, '')))
        ) {
          matched = { id: d.id, ...data } as Student;
        }
      });
      setStudent(matched);
    });

    // 2. Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Batch));
      setBatches(list);
    });

    // 3. Fee Structures
    const structsCol = collection(db, 'institutes', instituteId, 'feeStructures');
    const unsubStructs = onSnapshot(structsCol, (snapshot) => {
      const list: FeeStructure[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as FeeStructure));
      setFeeStructures(list);
    });

    // 4. Fee Payments (Loads all actual payments from Admin ERP)
    const paymentsCol = collection(db, 'institutes', instituteId, 'feePayments');
    const unsubPayments = onSnapshot(paymentsCol, (snapshot) => {
      const list: FeePayment[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as FeePayment);
      });
      setFeePayments(list);
      setLoading(false);
    });

    return () => {
      unsubInst();
      unsubStudents();
      unsubBatches();
      unsubStructs();
      unsubPayments();
    };
  }, [instituteId, user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const [selectedBatchTab, setSelectedBatchTab] = useState<string>('current');

  // Compute Multi-Batch Fee Dues using Shared Utility Source of Truth
  const feeResult = calculateStudentMultiBatchFees(
    student,
    batches,
    feePayments as any,
    feeStructures[0] ? feeStructures[0].amount : 2000
  );

  const currentBatchName = feeResult.currentBatch.batchName;
  const currentMonthlyFee = feeResult.currentBatch.monthlyFee;
  const currentTotalPaid = feeResult.currentBatch.totalPaid;
  const currentOutstanding = feeResult.currentBatch.outstanding;
  const currentPayments = feeResult.currentBatch.payments as FeePayment[];

  const pastBatchesCalculated = feeResult.pastBatches.map(pb => ({
    ...pb,
    paid: pb.totalPaid,
    required: pb.totalRequired,
    payments: pb.payments as FeePayment[]
  }));

  const unpaidPastBatches = pastBatchesCalculated.filter((pb) => pb.outstanding > 0);

  // Active Selected Ledger Data
  const activeSelectedBatchId =
    selectedBatchTab === 'current'
      ? feeResult.currentBatch.batchId
      : selectedBatchTab;

  const activeLedger =
    selectedBatchTab !== 'current'
      ? pastBatchesCalculated.find((pb) => pb.batchId === selectedBatchTab)
      : null;

  const activeBatchName = activeLedger ? activeLedger.batchName : currentBatchName;
  const totalOutstanding = activeLedger ? activeLedger.outstanding : currentOutstanding;
  const totalPaid = activeLedger ? activeLedger.paid : currentTotalPaid;
  const activeStudentPayments = activeLedger ? activeLedger.payments : currentPayments;
  const activeMonthlyFee = activeLedger ? activeLedger.monthlyFee : currentMonthlyFee;
  const isPreviousBatchSelected = Boolean(activeLedger);

  // Derive class/batch name
  const studentBatches = batches.filter(
    (b) => student?.batchIds && student.batchIds.includes(b.id)
  );
  const classNameDisplay = studentBatches.length > 0
    ? studentBatches.map((b) => b.name).join(', ')
    : 'Class 9 ICSE';

  // Compute days until next due date
  const today = new Date();
  const currentDay = today.getDate();
  const daysUntilDue = currentDay <= 15 ? 15 - currentDay : 30 - currentDay + 15;

  // Calculate actual pending months count for unpaid balance
  const pendingMonthsCount = activeMonthlyFee > 0
    ? Math.max(1, Math.round(totalOutstanding / activeMonthlyFee))
    : 1;

  // Derive Pending Payments list
  const pendingPaymentItems: { id: string; name: string; dueDate: string; amount: number }[] = [];

  if (totalOutstanding > 0) {
    const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    pendingPaymentItems.push({
      id: 'tuition_due',
      name: `${activeBatchName} ${isPreviousBatchSelected ? 'Past Dues' : 'Tuition Fee'} (${pendingMonthsCount} ${pendingMonthsCount === 1 ? 'Month' : 'Months'} Due)`,
      dueDate: isPreviousBatchSelected ? 'Overdue from Previous Batch' : calculateStudentDueDate(student?.enrollmentDate || student?.currentBatchEnrollmentDate),
      amount: totalOutstanding,
    });
  }

  // Generate Landscape A5 PDF Receipt for paid records
  const handleDownloadReceipt = async (payment: FeePayment) => {
    await generateFeeReceiptPDF({
      instituteInfo,
      payment,
      student,
      batches,
      feeStructures
    });
  };

  if (!hasPermission('canViewFees')) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 flex items-center justify-center font-body-md">
        <div className="glass-panel rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <Lock className="h-10 w-10 text-error mx-auto" />
          <h2 className="font-title-md text-on-surface text-lg">Fee Status Disabled</h2>
          <p className="text-on-surface-variant text-xs font-semibold">
            Fee status viewing has been turned OFF for student accounts by your Institute Owner.
          </p>
          <Link href="/portal" className="inline-block bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg">
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1326] text-[#dae2fd]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen font-body-md text-body-md flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md flex justify-between items-center w-full px-margin-mobile py-base border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-surface-container-high flex items-center justify-center shrink-0">
            {student?.photoUrl ? (
              <img className="w-full h-full object-cover" src={student.photoUrl} alt={student.fullName || 'Student'} />
            ) : (
              <span className="font-title-md text-primary text-sm font-bold">
                {student?.fullName ? student.fullName.charAt(0) : 'P'}
              </span>
            )}
          </div>
          <div className="pt-2">
            <h1 className="font-title-md font-extrabold text-on-surface text-base sm:text-lg">{student ? student.fullName : 'Student'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-on-surface-variant font-semibold">{classNameDisplay}</span>
              <span className="inline-flex items-center px-1.5 py-[1px] rounded-md bg-primary/10 border border-primary/30 text-primary text-[9px] font-bold font-mono -translate-y-0.5">
                Roll No: {student?.rollNumber || student?.rollNo || '101'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BellNotificationIcon />
          <button onClick={handleSignOut} className="p-2 hover:bg-white/5 rounded-full transition-colors cursor-pointer" title="Logout">
            <span className="material-symbols-outlined text-error">logout</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 px-margin-mobile pt-6 sm:pt-8 pb-12 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* BATCH SELECTION TOGGLE SLIDER (Rendered if unpaid past batches exist) */}
        {unpaidPastBatches.length > 0 && (
          <div className="w-full mt-2 mb-6 overflow-x-auto no-scrollbar touch-pan-x py-1">
            <div className="glass-panel p-1.5 rounded-2xl border border-primary/30 bg-surface-container-high/90 backdrop-blur-md shadow-xl flex items-center gap-1.5 w-max max-w-full mx-auto sm:mx-0">
              <button
                type="button"
                onClick={() => setSelectedBatchTab('current')}
                className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  selectedBatchTab === 'current'
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-[1.02]'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span>Current Batch ({currentBatchName})</span>
              </button>

              {unpaidPastBatches.map((pb) => (
                <button
                  key={pb.batchId}
                  type="button"
                  onClick={() => setSelectedBatchTab(pb.batchId)}
                  className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 ${
                    selectedBatchTab === pb.batchId
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 scale-[1.02]'
                      : 'text-red-400 hover:text-red-300 hover:bg-red-950/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0"></span>
                  <span>Previous: {pb.batchName}</span>
                  <span className="px-1.5 py-0.5 rounded-lg bg-black/40 text-[9px] sm:text-[10px] font-mono font-black border border-red-500/30">
                    ₹{pb.outstanding.toLocaleString()} Due
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TOP METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-6 mt-2">
          {/* Card 1: Total Outstanding (RED COLOR) */}
          <div className="glass-panel p-6 rounded-xl flex flex-col justify-between border-l-4 border-red-500">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label-md text-label-md text-red-400 uppercase tracking-wider font-extrabold block">
                  {isPreviousBatchSelected ? `Outstanding (${activeBatchName})` : 'Total Outstanding'}
                </span>
                {isPreviousBatchSelected && (
                  <span className="px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-800/50 text-[9px] font-black rounded uppercase tracking-wider mt-1 inline-block">
                    PREVIOUS BATCH DUES
                  </span>
                )}
              </div>
              <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
            </div>
            <div className="mt-4">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-red-500 tracking-tight font-mono">
                ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              {totalOutstanding > 0 ? (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  {isPreviousBatchSelected ? 'Overdue from previous batch assignment' : `Next due in ${daysUntilDue} days`}
                </p>
              ) : (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">check_circle</span> All dues cleared for this ledger
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Actual Paid Fees (GREEN COLOR) */}
          <div className="glass-panel p-6 rounded-xl flex flex-col justify-between border-l-4 border-emerald-500">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-emerald-400 uppercase tracking-wider font-extrabold">
                {isPreviousBatchSelected ? `Paid Dues (${activeBatchName})` : 'Actual Paid Fees'}
              </span>
              <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div className="mt-4">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-400 tracking-tight font-mono">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-emerald-400/90 mt-2 font-semibold">
                {activeStudentPayments.length > 0
                  ? `${activeStudentPayments.length} payment ${activeStudentPayments.length === 1 ? 'receipt' : 'receipts'} recorded`
                  : 'No payments recorded yet for this batch'}
              </p>
            </div>
          </div>
        </div>

        {/* PENDING PAYMENTS SECTION */}
        <section className="mt-6 sm:mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-error rounded-full animate-glow"></span>
            <h2 className="font-title-md text-title-md text-on-surface">Pending Payments</h2>
          </div>

          {pendingPaymentItems.length === 0 ? (
            <div className="glass-panel p-6 rounded-xl text-center text-on-surface-variant text-sm font-semibold">
              No pending fee payments for {activeBatchName}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingPaymentItems.map((item) => (
                <div
                  key={item.id}
                  className="glass-panel p-5 rounded-xl border-l-4 border-error flex flex-wrap md:flex-nowrap justify-between items-center gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-error-container/30 rounded-lg flex items-center justify-center text-error">
                      <span className="material-symbols-outlined">menu_book</span>
                    </div>
                    <div>
                      <h3 className="font-title-md text-body-md text-on-surface">{item.name}</h3>
                      <p className="text-xs text-on-surface-variant">Due Date: {item.dueDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <span className="font-stats-number text-stats-number text-on-surface">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="px-3 py-1 bg-error/15 text-error border border-error/30 text-xs font-extrabold rounded-lg uppercase tracking-wider">
                      {isPreviousBatchSelected ? 'Overdue' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PAYMENT HISTORY SECTION */}
        <section className="mt-8 sm:mt-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-tertiary rounded-full"></span>
            <h2 className="font-title-md text-title-md text-on-surface">Payment History ({activeBatchName})</h2>
          </div>

          <div className="glass-panel rounded-xl overflow-hidden">
            {activeStudentPayments.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant text-sm font-semibold">
                No payment history recorded for {activeBatchName} yet.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/5">
                {activeStudentPayments.map((p) => (
                  <div key={p.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-[10px] opacity-70">#{p.receiptNumber || 'EP-TXN-90223'}</span>
                      <span className="text-xs text-on-surface-variant">{p.paymentDate}</span>
                    </div>

                    <div className="font-semibold text-on-surface text-sm">{p.periodPaidFor || 'Tuition Fee'}</div>
                    <div className="text-[10px] text-on-surface-variant mb-2">
                      Paid via {(p.paymentMethod || 'CASH').toUpperCase()}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-bold text-on-surface">
                        ₹{Number(p.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 bg-tertiary/10 text-tertiary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-tertiary/20">
                          Paid
                        </span>
                        <button
                          onClick={() => handleDownloadReceipt(p)}
                          className="text-xs text-primary hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                          title="Download Receipt PDF"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span> PDF
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
