'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  Phone,
  User,
  MapPin,
  Clock3,
  Check,
  X,
  Loader2,
  Trash2,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Award,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { generateSingleIdCardPDF } from '@/lib/id-card-pdf';
import AttendanceSummaryChart from '@/components/attendance-summary-chart';

import { calculateStudentMultiBatchFees } from '@/lib/fee-calculations';

interface Student {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  address: string;
  photoUrl: string | null;
  pendingPhotoUrl: string | null;
  enrollmentDate: string;
  currentBatchEnrollmentDate?: string;
  closingDate?: string | null;
  collectFeeOnMonthStart?: boolean;
  monthlyFee?: number;
  customFeeAmount?: number | null;
  status: 'active' | 'inactive' | 'dropped';
  batchIds: string[];
  batchHistory?: any[];
  previousBatches?: any[];
}

interface Batch {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
}

interface Teacher {
  id: string;
  name: string;
}

const calculateAge = (dobStr?: string): number | null => {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

export default function StudentDetail() {
  const { instituteId } = useAuth();
  const { studentId } = useParams() as { studentId: string };
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [feePayments, setFeePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profileCalendarDate, setProfileCalendarDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!instituteId || !studentId) return;

    // 1. Fetch Student profile
    const studentDocRef = doc(db, 'institutes', instituteId, 'students', studentId);
    const unsubscribeStudent = onSnapshot(studentDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setStudent({ id: docSnap.id, ...docSnap.data() } as Student);
      } else {
        setStudent(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching student:', err);
      setLoading(false);
    });

    // 2. Fetch Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubscribeBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Batch);
      });
      setBatches(list);
    });

    // 3. Fetch Attendance records for this student
    const attendanceCol = collection(db, 'institutes', instituteId, 'attendanceRecords');
    const attendanceQuery = query(attendanceCol, where('studentId', '==', studentId));
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAttendanceRecords(list);
    });

    // 4. Fetch Exam Results for this student
    const resultsCol = collection(db, 'institutes', instituteId, 'examResults');
    const resultsQuery = query(resultsCol, where('studentId', '==', studentId));
    const unsubscribeResults = onSnapshot(resultsQuery, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setExamResults(list);
    });

    // 5. Fetch Exams list for title mapping
    const examsCol = collection(db, 'institutes', instituteId, 'exams');
    const unsubscribeExams = onSnapshot(examsCol, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setExamsList(list);
    });

    // 6. Fetch Fee Payments for this student
    const paymentsCol = collection(db, 'institutes', instituteId, 'feePayments');
    const paymentsQuery = query(paymentsCol, where('studentId', '==', studentId));
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setFeePayments(list);
    });

    // 7. Fetch Teachers list for mapping names
    const fetchTeachers = async () => {
      try {
        const teachersQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['owner', 'admin', 'teacher', 'staff'])
        );
        const snap = await getDocs(teachersQuery);
        const list: Teacher[] = [];
        snap.forEach((d) => {
          list.push({
            id: d.id,
            name: d.data().name || d.data().fullName || d.data().email?.split('@')[0] || 'Unknown'
          });
        });
        setTeachers(list);
      } catch (err) {
        console.error('Error loading teachers:', err);
      }
    };
    fetchTeachers();

    return () => {
      unsubscribeStudent();
      unsubscribeBatches();
      unsubscribeAttendance();
      unsubscribeResults();
      unsubscribeExams();
      unsubscribePayments();
    };
  }, [instituteId, studentId]);

  // Remove Student from Batch (unassign)
  const handleRemoveFromBatch = async (batchId: string) => {
    if (!instituteId || !student) return;
    if (!confirm('Are you sure you want to remove this student from the batch?')) return;

    setUpdating(true);
    try {
      const updatedBatchIds = (student.batchIds || []).filter((id) => id !== batchId);
      const studentDocRef = doc(db, 'institutes', instituteId, 'students', student.id);
      await updateDoc(studentDocRef, {
        batchIds: updatedBatchIds,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error removing from batch:', err);
      alert('Failed to remove student from batch.');
    } finally {
      setUpdating(false);
    }
  };

  // Photo Approvals
  const handleApprovePhoto = async () => {
    if (!instituteId || !student || !student.pendingPhotoUrl) return;
    setUpdating(true);
    try {
      const studentDocRef = doc(db, 'institutes', instituteId, 'students', student.id);
      await updateDoc(studentDocRef, {
        photoUrl: student.pendingPhotoUrl,
        pendingPhotoUrl: null,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error approving photo:', err);
      alert('Failed to approve photo.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectPhoto = async () => {
    if (!instituteId || !student || !student.pendingPhotoUrl) return;
    setUpdating(true);
    try {
      const studentDocRef = doc(db, 'institutes', instituteId, 'students', student.id);
      await updateDoc(studentDocRef, {
        pendingPhotoUrl: null,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error rejecting photo:', err);
      alert('Failed to reject photo.');
    } finally {
      setUpdating(false);
    }
  };

  const getTeacherName = (tId: string) => {
    return teachers.find((t) => t.id === tId)?.name || 'Unassigned';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Student Profile...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-extrabold text-white">Student Not Found</h3>
        <p className="text-slate-400 text-xs mt-2 font-medium">
          The student profile you are looking for does not exist or has been deleted.
        </p>
        <Link
          href="/erp/students"
          className="mt-5 inline-flex items-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
      </div>
    );
  }

  // Filter batches student is enrolled in
  const enrolledBatches = batches.filter((b) => student.batchIds && student.batchIds.includes(b.id));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Back Button */}
      <div>
        <Link
          href="/erp/students"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Photo & Quick Status Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
            {/* Background glowing indicator based on status */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              student.status === 'active' ? 'bg-emerald-500' : student.status === 'inactive' ? 'bg-slate-600' : 'bg-red-500'
            }`}></div>

            <div className="h-28 w-28 rounded-2xl bg-slate-800 border border-slate-700/80 overflow-hidden relative shadow-lg mt-4">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-3xl font-black text-indigo-400">
                  {student.fullName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h2 className="text-xl font-black text-white mt-4 tracking-tight">{student.fullName}</h2>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mt-0.5">
              Student ID: {student.id.substring(0, 8).toUpperCase()}
            </span>

            <div className="mt-4 flex items-center gap-3">
              <span className={`px-3 py-1 text-[10px] font-black border rounded-md uppercase tracking-wider ${
                student.status === 'active'
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30'
                  : student.status === 'inactive'
                  ? 'bg-slate-850 text-slate-400 border-slate-800'
                  : 'bg-red-950/30 text-red-400 border-red-900/30'
              }`}>
                {student.status}
              </span>
              <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-850">
                {student.gender ? student.gender.toUpperCase() : 'Not Set'}
              </span>
            </div>

            <div className="w-full border-t border-slate-800/80 mt-6 pt-5 space-y-3.5 text-left text-xs font-bold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Enrollment Date</span>
                <span className="text-slate-200">{student.enrollmentDate || 'Not Set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Fee Collection Timing</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                  student.collectFeeOnMonthStart !== false ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                }`}>
                  {student.collectFeeOnMonthStart !== false ? 'Month Start (Advance)' : 'After Completion (Arrears)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date of Birth & Age</span>
                <span className="text-slate-200">
                  {student.dateOfBirth
                    ? `${student.dateOfBirth}${calculateAge(student.dateOfBirth) !== null ? ` (${calculateAge(student.dateOfBirth)} yrs)` : ''}`
                    : 'Not Set'}
                </span>
              </div>

              {/* Generate ID Card Action */}
              <button
                type="button"
                onClick={() => generateSingleIdCardPDF(student, batches)}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                <CreditCard className="h-4 w-4" /> Download Student ID Card
              </button>
            </div>
          </div>

          {/* Photo Confirmation Panel */}
          {student.pendingPhotoUrl && (
            <div className="bg-amber-950/20 border border-amber-900/30 rounded-3xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-amber-400">Photo Pending Approval</h4>
                  <p className="text-slate-350 text-[11px] font-semibold mt-1 leading-relaxed">
                    This photo was uploaded by the student and is pending administrator confirmation.
                  </p>
                </div>
              </div>

              <div className="flex justify-center bg-slate-950/60 p-4 border border-slate-850 rounded-2xl">
                <div className="h-28 w-28 rounded-2xl border border-amber-500/40 overflow-hidden relative shadow-md">
                  <img src={student.pendingPhotoUrl} alt="Pending Update" className="h-full w-full object-cover" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRejectPhoto}
                  disabled={updating}
                  className="flex-1 bg-slate-950 hover:bg-slate-850 text-red-400 border border-red-950/50 hover:border-red-900/40 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="h-4 w-4" /> Reject
                </button>
                <button
                  onClick={handleApprovePhoto}
                  disabled={updating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" /> Approve & Update
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Profile Details & Enrolled Batches */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-extrabold text-white tracking-tight border-b border-slate-800 pb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-500" /> Personal & Contact Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Date of Birth & Age</span>
                <span className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-indigo-455" />
                  {student.dateOfBirth
                    ? `${student.dateOfBirth}${calculateAge(student.dateOfBirth) !== null ? ` • ${calculateAge(student.dateOfBirth)} years old` : ''}`
                    : 'No DOB Stated'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Student Contact</span>
                <span className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-indigo-455" /> {student.phone || 'No Phone Number'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Residential Address</span>
                <span className="font-bold text-slate-100 flex items-center gap-2 text-sm leading-relaxed">
                  <MapPin className="h-4 w-4 text-indigo-455 shrink-0" /> {student.address || 'No Address Stated'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Parent Name</span>
                <span className="font-bold text-slate-100 block text-sm">
                  {student.parentName || 'No Parent Stated'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Parent Phone</span>
                <span className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-indigo-455" /> {student.parentPhone || 'No Parent Phone'}
                </span>
              </div>
            </div>
          </div>

          {/* Batch Promotion History & Multi-Batch Fee Ledger Card */}
          {(() => {
            const feeResult = calculateStudentMultiBatchFees(
              student as any,
              batches as any,
              feePayments as any,
              2000
            );

            const historyList = [
              ...(student.batchHistory || []),
              ...(student.previousBatches || [])
            ];

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white tracking-tight">
                        Batch Promotion & Multi-Batch Fee History
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        Timeline of batch promotions, enrollment start dates, and present vs previous fee dues
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/erp/fees"
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer shrink-0"
                  >
                    <CreditCard className="h-4 w-4" /> Open ERP Fees Ledger
                  </Link>
                </div>

                {/* Present (Current Active) Batch Card */}
                <div className="bg-slate-955 border border-indigo-500/30 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                    Current Active Batch
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div>
                      <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                        Present Enrolled Batch
                      </span>
                      <h4 className="text-lg font-extrabold text-white mt-0.5">
                        {feeResult.currentBatch.batchName}
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-400 block mt-1">
                        Batch Enrollment Date: <span className="text-slate-200 font-bold">{student.currentBatchEnrollmentDate || student.enrollmentDate || 'N/A'}</span>
                      </span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-right shrink-0">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Monthly Fee Rate</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        ₹{feeResult.currentBatch.monthlyFee.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ month</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-850 text-xs font-bold">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Duration</span>
                      <span className="text-slate-200">{feeResult.currentBatch.elapsedMonths} Month(s)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Total Required</span>
                      <span className="text-slate-200 font-mono">₹{feeResult.currentBatch.totalRequired.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Amount Paid</span>
                      <span className="text-emerald-400 font-mono">₹{feeResult.currentBatch.totalPaid.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Present Outstanding</span>
                      <span className={`font-mono ${feeResult.currentBatch.outstanding > 0 ? 'text-amber-400 font-black' : 'text-emerald-400'}`}>
                        ₹{feeResult.currentBatch.outstanding.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Historical Batch Promotions & Previous Batch Fees */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-amber-400" /> Historical Batch Promotions & Previous Batch Fees ({feeResult.pastBatches.length})
                    </span>
                  </div>

                  {feeResult.pastBatches.length === 0 ? (
                    <div className="bg-slate-955 border border-slate-850 rounded-2xl p-4 text-center text-slate-500 italic text-xs font-bold">
                      Student has not been promoted or shifted from previous batches yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {feeResult.pastBatches.map((pb, idx) => {
                        const historyEntry = historyList.find((h: any) => h.batchId === pb.batchId);
                        const promotedOn = historyEntry?.shiftedAt || historyEntry?.promotedAt || historyEntry?.leftDate || 'N/A';
                        const formattedPromotedDate = promotedOn !== 'N/A' && !isNaN(new Date(promotedOn).getTime())
                          ? new Date(promotedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : promotedOn;

                        return (
                          <div
                            key={pb.batchId || `past-batch-${idx}`}
                            className="bg-slate-955 border border-amber-900/30 rounded-2xl p-4 space-y-3 relative"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
                              <div>
                                <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest block">
                                  Previous Batch #{idx + 1}
                                </span>
                                <h5 className="font-extrabold text-white text-base mt-0.5">
                                  {pb.batchName} <span className="text-slate-500 font-semibold text-xs">→ Promoted to {feeResult.currentBatch.batchName}</span>
                                </h5>
                                {promotedOn !== 'N/A' && (
                                  <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">
                                    Promoted On: <span className="text-slate-200 font-bold">{formattedPromotedDate}</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-1 text-[10px] font-extrabold border rounded-xl ${
                                    pb.outstanding > 0
                                      ? 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                                      : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                                  }`}
                                >
                                  {pb.outstanding > 0 ? `₹${pb.outstanding.toLocaleString()} Pending Dues` : 'Fully Settled'}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase block">Previous Monthly Fee</span>
                                <span className="text-slate-200 font-mono">₹{pb.monthlyFee.toLocaleString()} / mo</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase block">Elapsed Duration</span>
                                <span className="text-slate-200">{pb.elapsedMonths} Month(s)</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase block">Required / Paid</span>
                                <span className="text-slate-200 font-mono">₹{pb.totalRequired.toLocaleString()} / ₹{pb.totalPaid.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase block">Outstanding Dues</span>
                                <span className={`font-mono ${pb.outstanding > 0 ? 'text-amber-400 font-black' : 'text-emerald-400'}`}>
                                  ₹{pb.outstanding.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Attendance Calendar Overview & Log Card */}
          {(() => {
            const calYear = profileCalendarDate.getFullYear();
            const calMonth = profileCalendarDate.getMonth();
            const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

            // Filter records for this month
            const studentMonthRecords = attendanceRecords.filter(
              (r) => r.date && r.date.startsWith(monthPrefix)
            );

            const totalMarked = studentMonthRecords.length;
            const pCount = studentMonthRecords.filter((r) => (r.status || '').toLowerCase() === 'present').length;
            const aCount = studentMonthRecords.filter((r) => (r.status || '').toLowerCase() === 'absent').length;
            const lCount = studentMonthRecords.filter((r) => ['leave', 'late', 'excused'].includes((r.status || '').toLowerCase())).length;
            const hCount = studentMonthRecords.filter((r) => (r.status || '').toLowerCase() === 'holiday').length;

            const pct = totalMarked > 0 ? Math.round(((pCount + hCount + lCount) / totalMarked) * 100) : 100;

            const firstDayObj = new Date(calYear, calMonth, 1);
            const daysInM = new Date(calYear, calMonth + 1, 0).getDate();
            let startDay = firstDayObj.getDay() - 1;
            if (startDay === -1) startDay = 6;

            const dayStatusMap: Record<number, string> = {};
            studentMonthRecords.forEach((r) => {
              if (r.date) {
                const dayNum = parseInt(r.date.split('-')[2], 10);
                let st = (r.status || '').toLowerCase();
                if (st === 'late' || st === 'excused') st = 'leave';
                dayStatusMap[dayNum] = st;
              }
            });

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
                {/* Header & Month Navigator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white tracking-tight">
                        Student Attendance Calendar Overview
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        Interactive monthly attendance calendar and breakdown
                      </p>
                    </div>
                  </div>

                  {/* Month Switcher Header */}
                  <div className="flex items-center gap-2 bg-slate-955 p-1.5 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setProfileCalendarDate(new Date(calYear, calMonth - 1, 1))}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-extrabold text-white px-2">
                      {profileCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setProfileCalendarDate(new Date(calYear, calMonth + 1, 1))}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Percentage & Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-slate-955 border border-slate-850 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Percentage</span>
                    <span className={`text-xl font-black block mt-0.5 ${pct >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pct}%
                    </span>
                  </div>

                  <div className="bg-emerald-950/20 border border-emerald-900/40 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block">Present</span>
                    <span className="text-xl font-black text-white block mt-0.5">{pCount}</span>
                  </div>

                  <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest block">Absent</span>
                    <span className="text-xl font-black text-white block mt-0.5">{aCount}</span>
                  </div>

                  <div className="bg-blue-950/20 border border-blue-900/40 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">Leave</span>
                    <span className="text-xl font-black text-white block mt-0.5">{lCount}</span>
                  </div>

                  <div className="bg-purple-950/20 border border-purple-900/40 p-3.5 rounded-2xl text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest block">Holiday</span>
                    <span className="text-xl font-black text-white block mt-0.5">{hCount}</span>
                  </div>
                </div>

                {/* Calendar Days Grid */}
                <div className="space-y-2 bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pb-1">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: startDay }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-9 rounded-xl bg-slate-900/40" />
                    ))}

                    {Array.from({ length: daysInM }).map((_, idx) => {
                      const day = idx + 1;
                      const st = dayStatusMap[day];

                      let bgClass = 'bg-slate-900 text-slate-500 border border-slate-800';
                      if (st === 'present') bgClass = 'bg-emerald-600 text-white font-extrabold shadow-sm';
                      else if (st === 'absent') bgClass = 'bg-red-600 text-white font-extrabold shadow-sm';
                      else if (st === 'leave') bgClass = 'bg-blue-600 text-white font-extrabold shadow-sm';
                      else if (st === 'holiday') bgClass = 'bg-purple-600 text-white font-extrabold shadow-sm';

                      return (
                        <div
                          key={`day-${day}`}
                          className={`h-9 rounded-xl flex items-center justify-center text-xs transition-all ${bgClass}`}
                          title={st ? `Day ${day}: ${st.toUpperCase()}` : `Day ${day}: Unmarked`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Academic Exam Performance Card */}
          {(() => {
            // Filter to only include existing active (non-deleted) exams with uploaded marks
            const validExamResults = examResults.filter((result) => {
              const examObj = examsList.find((e) => e.id === result.examId);
              if (!examObj) return false;
              if (result.marksObtained === undefined || result.marksObtained === null || result.marksObtained === '') return false;
              return true;
            });

            const totalExams = validExamResults.length;
            const avgPercentage =
              totalExams > 0
                ? Math.round(
                    (validExamResults.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0) /
                      totalExams) *
                      10
                  ) / 10
                : 0;

            const avgColor =
              avgPercentage >= 75
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900/40'
                : avgPercentage >= 50
                ? 'text-amber-400 bg-amber-950/40 border-amber-900/40'
                : 'text-red-400 bg-red-950/40 border-red-900/40';

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                    <Award className="h-5 w-5 text-indigo-500" /> Academic Exam Performance
                  </h3>
                  {totalExams > 0 && (
                    <div className={`px-3.5 py-1 text-xs font-black border rounded-xl ${avgColor}`}>
                      Overall Avg: {avgPercentage}%
                    </div>
                  )}
                </div>

                {totalExams === 0 ? (
                  <div className="bg-slate-955 border border-slate-850 rounded-2xl p-6 text-center text-slate-500 italic text-xs font-bold">
                    No active exam results logged for this student yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block pl-1">
                      Recent Exam Scores ({totalExams} total exams taken)
                    </span>
                    <div className="space-y-2">
                      {validExamResults.map((result) => {
                        const examObj = examsList.find((e) => e.id === result.examId)!;
                        const pct = Number(result.percentage) || 0;
                        const pctBadge =
                          pct >= 75
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                            : pct >= 50
                            ? 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                            : 'bg-red-950/40 text-red-400 border-red-900/40';

                        return (
                          <div
                            key={result.id}
                            className="bg-slate-955 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold"
                          >
                            <div>
                              <span className="font-bold text-white block text-sm">
                                {examObj.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                Exam Date: {examObj.examDate || '-'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4">
                              <span className="font-mono text-slate-200">
                                {result.marksObtained} / {result.maxMarks}
                              </span>
                              <span
                                className={`px-2.5 py-1 text-xs font-black border rounded-xl ${pctBadge}`}
                              >
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Enrolled Batches */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-extrabold text-white tracking-tight border-b border-slate-800 pb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500" /> Enrolled Batches ({enrolledBatches.length})
            </h3>

            {enrolledBatches.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-8 text-center text-slate-450 italic text-xs font-bold">
                Student is not currently enrolled in any batch.
              </div>
            ) : (
              <div className="space-y-4">
                {enrolledBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="bg-slate-950/60 border border-slate-850 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                        {batch.subject}
                      </span>
                      <h4 className="font-bold text-white text-sm mt-0.5">{batch.name}</h4>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[11px] font-semibold text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" /> {batch.scheduleDays.join(', ')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 text-slate-500" /> {batch.startTime} - {batch.endTime}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-slate-500" /> Teacher: {getTeacherName(batch.teacherId)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveFromBatch(batch.id)}
                      disabled={updating}
                      className="shrink-0 flex items-center justify-center gap-1.5 border border-red-950/50 hover:bg-red-950/20 text-red-400 hover:text-red-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" /> Remove from Batch
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
