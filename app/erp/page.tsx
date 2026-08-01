'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  Users,
  Layers,
  IndianRupee,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ArrowRight,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Download,
  DollarSign,
  TrendingDown,
  UserCheck,
  Loader2,
  X,
  Filter,
  BarChart2,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Student {
  id: string;
  fullName?: string;
  phone?: string;
  rollNumber?: string;
  rollNo?: string;
  status: string;
  photoUrl?: string | null;
  pendingPhotoUrl?: string | null;
  photoStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'try_again';
}

interface Batch {
  id: string;
}

interface StaffUser {
  id: string;
  role: string;
}

interface FeePayment {
  id: string;
  amountPaid: number;
  paymentDate: string;
}

interface FeeStructure {
  id: string;
  batchId?: string | null;
  amount: number;
  dueDayOfMonth: number;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
}

interface Enquiry {
  id: string;
  status: string;
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

export default function ErpDashboard() {
  const { user, instituteId, role } = useAuth();

  // Date Range Filter State: 'this_week' | 'this_month' | 'this_quarter' | 'custom'
  const [dateFilter, setDateFilter] = useState<'this_week' | 'this_month' | 'this_quarter' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Raw Collections Data
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Staff Personal Attendance Calendar States
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [staffAttendanceRecords, setStaffAttendanceRecords] = useState<any[]>([]);

  // Expense CRUD Modal State
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expCategory, setExpCategory] = useState<string>('rent');
  const [expDescription, setExpDescription] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Set default date ranges
  useEffect(() => {
    const today = new Date();
    const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = localDateStr(today);

    if (dateFilter === 'this_week') {
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      setStartDate(localDateStr(monday));
      setEndDate(todayStr);
    } else if (dateFilter === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(localDateStr(firstDay));
      setEndDate(todayStr);
    } else if (dateFilter === 'this_quarter') {
      const qMonth = Math.floor(today.getMonth() / 3) * 3;
      const firstDayQ = new Date(today.getFullYear(), qMonth, 1);
      setStartDate(localDateStr(firstDayQ));
      setEndDate(todayStr);
    }
  }, [dateFilter]);

  // Subscribe to all Firestore collections
  useEffect(() => {
    if (!instituteId) return;

    // 1. Students
    const unsubStudents = onSnapshot(collection(db, 'institutes', instituteId, 'students'), (snap) => {
      const list: Student[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          fullName: data.fullName || 'Student',
          phone: data.phone || '',
          rollNumber: data.rollNumber || data.rollNo || '',
          status: data.status || 'active',
          photoUrl: data.photoUrl || null,
          pendingPhotoUrl: data.pendingPhotoUrl || null,
          photoStatus: data.photoStatus || 'none'
        });
      });
      setStudents(list);
    });

    // 2. Batches
    const unsubBatches = onSnapshot(collection(db, 'institutes', instituteId, 'batches'), (snap) => {
      const list: Batch[] = [];
      snap.forEach((d) => list.push({ id: d.id }));
      setBatches(list);
    });

    // 3. Staff Users
    const unsubStaff = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['owner', 'admin', 'teacher', 'staff'])),
      (snap) => {
        const list: StaffUser[] = [];
        snap.forEach((d) => list.push({ id: d.id, role: d.data().role }));
        setStaffList(list);
      }
    );

    // 4. Fee Payments
    const unsubPayments = onSnapshot(collection(db, 'institutes', instituteId, 'feePayments'), (snap) => {
      const list: FeePayment[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          amountPaid: Number(data.amountPaid) || 0,
          paymentDate: data.paymentDate || ''
        });
      });
      setFeePayments(list);
    });

    // 5. Fee Structures
    const unsubStructures = onSnapshot(collection(db, 'institutes', instituteId, 'feeStructures'), (snap) => {
      const list: FeeStructure[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          batchId: data.batchId || null,
          amount: Number(data.amount) || 0,
          dueDayOfMonth: Number(data.dueDayOfMonth) || 10
        });
      });
      setFeeStructures(list);
    });

    // 6. Attendance Records
    const unsubAttendance = onSnapshot(collection(db, 'institutes', instituteId, 'attendanceRecords'), (snap) => {
      const list: AttendanceRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, date: data.date || '', status: data.status || 'present' });
      });
      setAttendanceRecords(list);
    });

    // 7. Enquiries
    const unsubEnquiries = onSnapshot(collection(db, 'institutes', instituteId, 'enquiries'), (snap) => {
      const list: Enquiry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, status: data.status || 'warm', createdAt: data.createdAt });
      });
      setEnquiries(list);
    });

    // 8. Expenses (Minimal CRUD collection)
    const unsubExpenses = onSnapshot(collection(db, 'institutes', instituteId, 'expenses'), (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          amount: Number(data.amount) || 0,
          category: data.category || 'other',
          description: data.description || '',
          date: data.date || '',
          createdAt: data.createdAt
        });
      });
      setExpenses(list);
      setLoading(false);
    });

    // 9. Staff Attendance Logs
    const staffAttendanceCol = collection(db, 'institutes', instituteId, 'staffAttendance');
    const unsubStaffAttendance = onSnapshot(staffAttendanceCol, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setStaffAttendanceRecords(list);
    });

    return () => {
      unsubStudents();
      unsubBatches();
      unsubStaff();
      unsubPayments();
      unsubStructures();
      unsubAttendance();
      unsubEnquiries();
      unsubExpenses();
      unsubStaffAttendance();
    };
  }, [instituteId]);

  // Date Filtering Helper
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    if (!startDate && !endDate) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // KPI Metrics
  const activeStudentsCount = students.filter((s) => s.status === 'active').length;
  const activeBatchesCount = batches.length;
  const totalStaffCount = staffList.length;

  // Filtered Payments & Expenses for date range
  const filteredPayments = feePayments.filter((p) => isDateInRange(p.paymentDate));
  const filteredExpenses = expenses.filter((e) => isDateInRange(e.date));

  const totalFeesCollected = filteredPayments.reduce((acc, p) => acc + p.amountPaid, 0);
  const totalExpensesAmount = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfitLoss = totalFeesCollected - totalExpensesAmount;

  // Total Structure Dues Estimate
  const totalStructureAmount = feeStructures.reduce((acc, s) => acc + s.amount, 0);
  const estimatedPendingFees = Math.max(0, totalStructureAmount * activeStudentsCount - totalFeesCollected);

  // Attendance Rate in Date Range
  const filteredAttendance = attendanceRecords.filter((a) => isDateInRange(a.date));
  const totalPresentCount = filteredAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRatePct =
    filteredAttendance.length > 0
      ? Math.round((totalPresentCount / filteredAttendance.length) * 100 * 10) / 10
      : 0;

  // Enquiry Funnel Metrics
  const hotLeads = enquiries.filter((e) => e.status === 'hot').length;
  const warmLeads = enquiries.filter((e) => e.status === 'warm').length;
  const coldLeads = enquiries.filter((e) => e.status === 'cold').length;
  const deadLeads = enquiries.filter((e) => e.status === 'dead').length;
  const convertedLeads = enquiries.filter((e) => e.status === 'converted').length;

  // Expense Modal Actions
  const openCreateExpenseModal = () => {
    setEditingExpense(null);
    setExpAmount(0);
    setExpCategory('rent');
    setExpDescription('');
    { const _d = new Date(); setExpDate(`${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`); }
    setError('');
    setExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setExpAmount(exp.amount);
    setExpCategory(exp.category);
    setExpDescription(exp.description);
    setExpDate(exp.date);
    setError('');
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (expAmount <= 0 || !expDate) {
      setError('Please provide a valid expense amount and date.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        amount: Number(expAmount),
        category: expCategory,
        description: expDescription,
        date: expDate,
        updatedAt: new Date().toISOString()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'institutes', instituteId, 'expenses', editingExpense.id), payload);
      } else {
        await addDoc(collection(db, 'institutes', instituteId, 'expenses'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      setExpenseModalOpen(false);
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!instituteId) return;
    if (!confirm('Are you sure you want to delete this expense record?')) return;

    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'expenses', expenseId));
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense.');
    }
  };

  // Profile Photo Approval Handlers
  const handleApprovePhoto = async (studentId: string, pendingUrl: string) => {
    if (!instituteId) return;
    try {
      await updateDoc(doc(db, 'institutes', instituteId, 'students', studentId), {
        photoUrl: pendingUrl,
        pendingPhotoUrl: null,
        photoStatus: 'approved',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error approving photo:', err);
    }
  };

  const handleRejectPhoto = async (studentId: string) => {
    if (!instituteId) return;
    try {
      await updateDoc(doc(db, 'institutes', instituteId, 'students', studentId), {
        pendingPhotoUrl: null,
        photoStatus: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error rejecting photo:', err);
    }
  };

  const handleTryAgainPhoto = async (studentId: string) => {
    if (!instituteId) return;
    try {
      await updateDoc(doc(db, 'institutes', instituteId, 'students', studentId), {
        pendingPhotoUrl: null,
        photoStatus: 'try_again',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error setting photo try again:', err);
    }
  };

  const pendingPhotosList = students.filter((s) => s.photoStatus === 'pending');

  // Export Summary Report (PDF)
  const handleExportPDF = () => {
    const pdf = new jsPDF();

    // Title & Header
    pdf.setFontSize(22);
    pdf.setTextColor(30, 41, 59);
    pdf.text('UNNATI POWERPREP', 105, 20, { align: 'center' });

    pdf.setFontSize(11);
    pdf.setTextColor(99, 102, 241);
    pdf.text('INSTITUTE ANALYTICS & EXECUTIVE FINANCIAL REPORT', 105, 27, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Date Range: ${startDate || 'All'} to ${endDate || 'Today'} | Generated: ${new Date().toLocaleDateString()}`, 105, 33, { align: 'center' });

    pdf.setLineWidth(0.5);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(14, 38, 196, 38);

    // KPI Summary Section
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('1. Key Performance Indicators', 14, 48);

    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    pdf.text(`• Active Enrolled Students: ${activeStudentsCount}`, 20, 56);
    pdf.text(`• Active Batches: ${activeBatchesCount}`, 20, 63);
    pdf.text(`• Total Staff & Faculty: ${totalStaffCount}`, 20, 70);
    pdf.text(`• Class Attendance Rate: ${attendanceRatePct}%`, 20, 77);

    // Financial Summary Section
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('2. Financial Breakdown & Net Profit/Loss', 14, 90);

    pdf.setFontSize(10);
    pdf.setTextColor(16, 185, 129); // Emerald
    pdf.text(`• Total Fees Collected: Rs. ${totalFeesCollected.toLocaleString()}`, 20, 98);

    pdf.setTextColor(239, 68, 68); // Red
    pdf.text(`• Total Institute Expenses: Rs. ${totalExpensesAmount.toLocaleString()}`, 20, 105);

    pdf.setFontSize(11);
    pdf.setTextColor(netProfitLoss >= 0 ? 16 : 239, netProfitLoss >= 0 ? 185 : 68, netProfitLoss >= 0 ? 129 : 68);
    pdf.text(`• NET PROFIT / LOSS: Rs. ${netProfitLoss.toLocaleString()}`, 20, 114);

    // Enquiry Funnel Section
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('3. Enquiry & Lead Conversion Funnel', 14, 128);

    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    pdf.text(`• Hot Leads: ${hotLeads} | Warm Leads: ${warmLeads} | Cold Leads: ${coldLeads} | Dead: ${deadLeads}`, 20, 136);
    pdf.text(`• Converted Students: ${convertedLeads}`, 20, 143);

    // Expenses Line Items Table
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('4. Recent Expense Line Items', 14, 157);

    let startY = 166;
    filteredExpenses.slice(0, 10).forEach((exp, idx) => {
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`${idx + 1}. ${exp.date} - [${exp.category.toUpperCase()}] ${exp.description || 'Expense'}: Rs. ${exp.amount.toLocaleString()}`, 20, startY);
      startY += 7;
    });

    pdf.save(`Unnati_Analytics_Report_${dateFilter}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Analytics Dashboard & Financials...</p>
      </div>
    );
  }

  const isAdmin = ['owner', 'admin'].includes(role || '');

  // Staff Calendar Calculations
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Adjust starting day of the week so Mon=0, Tue=1, ..., Sun=6
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  const MONTH_SHORT_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Match records belongs to the logged-in staff member
  const particularStaffRecords = staffAttendanceRecords.filter((rec) => {
    return (
      rec.userId === user?.uid ||
      rec.firebaseUid === user?.uid ||
      (user?.email && rec.staffId?.toLowerCase() === user.email.toLowerCase())
    );
  });

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const staffAttendanceMap: { [dayNum: number]: 'present' | 'absent' | 'holiday' | 'leave' } = {};

  let presentCount = 0;
  let absentCount = 0;
  let holidayCount = 0;
  let leaveCount = 0;

  particularStaffRecords.forEach((rec) => {
    if (rec.date && rec.date.startsWith(currentMonthPrefix)) {
      const day = parseInt(rec.date.split('-')[2], 10);
      const st = rec.status;
      if (st === 'checked_in' || st === 'checked_out' || st === 'present') {
        staffAttendanceMap[day] = 'present';
        presentCount++;
      } else if (st === 'absent') {
        staffAttendanceMap[day] = 'absent';
        absentCount++;
      } else if (st === 'leave') {
        staffAttendanceMap[day] = 'leave';
        leaveCount++;
      } else if (st === 'holiday') {
        staffAttendanceMap[day] = 'holiday';
        holidayCount++;
      }
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Bar: Date Filter & Export Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isAdmin ? "Analytics & Financial Dashboard" : "Faculty Dashboard"}
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            {isAdmin
              ? "Institute KPIs, live attendance rates, enquiry funnel conversion, expenses CRUD, and net profit/loss."
              : "Overview of your personal class schedules, staff attendance log, and conversion stats."}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filter Selector */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
              <button
                onClick={() => setDateFilter('this_week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'this_week' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter('this_month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'this_month' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter('this_quarter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'this_quarter' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                This Quarter
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Export PDF Button */}
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" /> Export PDF Report
            </button>
          </div>
        )}
      </div>

      {/* Custom Date Pickers */}
      {isAdmin && dateFilter === 'custom' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Start Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">End Date:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* PROFILE PHOTO APPROVAL PERMISSIONS BOX */}
      {isAdmin && pendingPhotosList.length > 0 && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Profile Photo Approvals
                  <span className="bg-indigo-600 text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                    {pendingPhotosList.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Review student uploaded profile pictures. Approve to set as official PFP or allow retry.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPhotosList.map((student) => (
              <div key={student.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-slate-800 shrink-0">
                    {student.pendingPhotoUrl ? (
                      <img src={student.pendingPhotoUrl} alt={student.fullName || 'Student'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-indigo-400 font-bold text-xs">NO IMG</div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-extrabold text-white truncate">{student.fullName || 'Student'}</h4>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold block">
                      Roll No: {student.rollNumber || '101'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block truncate">{student.phone || 'No phone'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => handleApprovePhoto(student.id, student.pendingPhotoUrl!)}
                    className="px-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Approve & Lock Photo"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectPhoto(student.id)}
                    className="px-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Reject Photo Request"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTryAgainPhoto(student.id)}
                    className="px-2 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Allow Student to Try Again"
                  >
                    <RefreshCw className="h-3 w-3" /> Try Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-extrabold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/40 uppercase">
              Directory
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white tracking-tight block">{activeStudentsCount}</span>
            <span className="text-[11px] font-bold text-slate-400 block mt-0.5">Active Enrolled Students</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40 uppercase">
              Batches
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white tracking-tight block">{activeBatchesCount}</span>
            <span className="text-[11px] font-bold text-slate-400 block mt-0.5">Active Class Batches</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40 uppercase">
              Staff
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white tracking-tight block">{totalStaffCount}</span>
            <span className="text-[11px] font-bold text-slate-400 block mt-0.5">Faculty & Staff Members</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-extrabold text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/40 uppercase">
              Attendance
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-white tracking-tight block">{attendanceRatePct}%</span>
            <span className="text-[11px] font-bold text-slate-400 block mt-0.5">Class Attendance Rate</span>
          </div>
        </div>
      </div>

      {/* Financials & Profit / Loss Section */}
      {!isAdmin ? (
        /* Attendance Summary Calendar (Staff only) */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" /> Attendance Summary Calendar
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                Your personal shift attendance logs and counters.
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-300 px-2 font-mono">
                {MONTH_SHORT_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-3 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-800/40 pb-2">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center">
            {/* Prev month padded days */}
            {Array.from({ length: startingDayOfWeek }).map((_, idx) => {
              const prevDayNum = daysInPrevMonth - startingDayOfWeek + idx + 1;
              return (
                <div key={`prev-${idx}`} className="text-xs font-bold text-slate-700 py-2">
                  {prevDayNum}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const formattedDayStr = String(dayNum).padStart(2, '0');
              const status = staffAttendanceMap[dayNum];

              if (status === 'present') {
                return (
                  <div
                    key={`curr-${dayNum}`}
                    className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs mx-auto shadow-md shadow-emerald-500/5"
                  >
                    {formattedDayStr}
                  </div>
                );
              }

              if (status === 'leave') {
                return (
                  <div
                    key={`curr-${dayNum}`}
                    className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-xs mx-auto shadow-md shadow-amber-500/5"
                  >
                    {formattedDayStr}
                  </div>
                );
              }

              if (status === 'absent') {
                return (
                  <div
                    key={`curr-${dayNum}`}
                    className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-450 border border-rose-500/40 flex items-center justify-center font-bold text-xs mx-auto shadow-md shadow-rose-500/5"
                  >
                    {formattedDayStr}
                  </div>
                );
              }

              if (status === 'holiday') {
                return (
                  <div
                    key={`curr-${dayNum}`}
                    className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-xs mx-auto shadow-md shadow-purple-500/5"
                  >
                    {formattedDayStr}
                  </div>
                );
              }

              return (
                <div
                  key={`curr-${dayNum}`}
                  className="w-8 h-8 rounded-full bg-slate-950/20 text-slate-400 border border-slate-800 flex items-center justify-center font-bold text-xs mx-auto hover:border-slate-700 transition-colors"
                >
                  {formattedDayStr}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800">
            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Present Days</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">{presentCount}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Absent Days</span>
              <span className="text-xl font-black text-rose-450 mt-1 block">{absentCount}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">On Leave</span>
              <span className="text-xl font-black text-amber-400 mt-1 block">{leaveCount}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl text-center">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Holidays</span>
              <span className="text-xl font-black text-purple-400 mt-1 block">{holidayCount}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Financials & Profit / Loss Section (Admin only) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Net Profit / Loss Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-indigo-400" /> Net Profit / Loss Summary
              </h3>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                {dateFilter.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Fees Collected
                </span>
                <span className="text-base font-black text-emerald-400">₹{totalFeesCollected.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-400" /> Total Expenses
                </span>
                <span className="text-base font-black text-red-400">₹{totalExpensesAmount.toLocaleString()}</span>
              </div>

              <div className={`p-5 rounded-2xl border ${
                netProfitLoss >= 0
                  ? 'bg-emerald-955/40 border-emerald-900/50'
                  : 'bg-red-955/40 border-red-900/50'
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-widest block text-slate-400">
                  Net Result ({netProfitLoss >= 0 ? 'Profit' : 'Loss'})
                </span>
                <span className={`text-2xl font-black mt-1 block ${
                  netProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  ₹{netProfitLoss.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Minimal Expense CRUD Directory */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-indigo-400" /> Expense Management ({filteredExpenses.length})
                </h3>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                  Record rent, utilities, faculty salaries, and operating supplies.
                </p>
              </div>
              <button
                onClick={openCreateExpenseModal}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Expense
              </button>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="bg-slate-955 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 italic text-xs font-bold">
                No expense records logged in this date range. Click "Add Expense" to log one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3.5 text-white">{exp.date}</td>
                        <td className="p-3.5 text-slate-300 capitalize">{exp.category}</td>
                        <td className="p-3.5 text-slate-400">{exp.description || '-'}</td>
                        <td className="p-3.5 text-red-400 font-extrabold">₹{exp.amount.toLocaleString()}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditExpenseModal(exp)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Expense"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                              title="Delete Expense"
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
      )}

      {/* Enquiry Funnel & Dues Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enquiry Lead Funnel */}
        <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 ${
          !isAdmin ? 'lg:col-span-2' : ''
        }`}>
          <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-400" /> Enquiry Lead Conversion Funnel
          </h3>

          <div className="grid grid-cols-5 gap-3 text-center">
            <div className="bg-slate-955 border border-slate-850 p-3 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Hot</span>
              <span className="text-lg font-black text-amber-400 mt-1 block">{hotLeads}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-3 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Warm</span>
              <span className="text-lg font-black text-orange-400 mt-1 block">{warmLeads}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-3 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Cold</span>
              <span className="text-lg font-black text-blue-400 mt-1 block">{coldLeads}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-3 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Dead</span>
              <span className="text-lg font-black text-slate-400 mt-1 block">{deadLeads}</span>
            </div>
            <div className="bg-slate-955 border border-slate-850 p-3 rounded-2xl">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Converted</span>
              <span className="text-lg font-black text-emerald-400 mt-1 block">{convertedLeads}</span>
            </div>
          </div>
        </div>

        {/* Fee Dues Summary */}
        {isAdmin && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-indigo-400" /> Student Dues & Collection Targets
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Estimated Pending Balance
                </span>
                <span className="text-xl font-black text-amber-400 mt-1 block">
                  ₹{estimatedPendingFees.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Total Fees Collected
                </span>
                <span className="text-xl font-black text-emerald-400 mt-1 block">
                  ₹{totalFeesCollected.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expense CRUD Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl">
            <button
              onClick={() => setExpenseModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-6">
              {editingExpense ? 'Edit Expense Record' : 'Add New Expense Record'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Expense Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. 15000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Category *
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="rent">Rent</option>
                  <option value="utilities">Utilities (Electricity/Internet)</option>
                  <option value="salaries">Faculty/Staff Salaries</option>
                  <option value="supplies">Operating Supplies</option>
                  <option value="marketing">Marketing & Ads</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Monthly premise rent payment"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
