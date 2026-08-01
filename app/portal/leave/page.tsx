'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  studentId: string;
  studentName?: string;
  batchId?: string;
  leaveType: 'casual' | 'sick' | 'emergency' | 'other';
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedByName?: string;
}

interface Student {
  id: string;
  fullName: string;
  batchIds: string[];
}

export default function PortalLeave() {
  const { user, role, instituteId, loading: authLoading } = useAuth();
  const isStaff = ['owner', 'admin', 'teacher', 'staff'].includes(role || '');
  const [student, setStudent] = useState<Student | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<'casual' | 'sick' | 'emergency' | 'other'>('casual');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch Student Profile (if student)
  useEffect(() => {
    if (!user || !instituteId || isStaff) return;

    const fetchStudent = async () => {
      try {
        const stRef = collection(db, 'institutes', instituteId, 'students');
        const q = query(stRef, where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setStudent({ ...docSnap.data(), id: docSnap.id } as Student);
        } else {
          const qDirect = query(stRef, where('email', '==', user.email));
          const snapDirect = await getDocs(qDirect);
          if (!snapDirect.empty) {
            setStudent({ ...snapDirect.docs[0].data(), id: snapDirect.docs[0].id } as Student);
          } else {
            setStudent({ id: user.uid, fullName: user.displayName || 'Student', batchIds: [] });
          }
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
      }
    };

    fetchStudent();
  }, [user, instituteId, isStaff]);

  // 2. Listen to Leave Requests
  useEffect(() => {
    if (!instituteId || (!student && !isStaff && !user)) return;

    const leaveRef = collection(db, 'institutes', instituteId, 'leaveRequests');
    const unsub = onSnapshot(leaveRef, (snap) => {
      const list: LeaveRequest[] = [];
      snap.forEach((d) => {
        const data = d.data() as LeaveRequest;
        const isMine = isStaff
          ? (data as any).applicantId === user?.uid || data.studentId === user?.uid
          : data.studentId === student?.id || data.studentId === user?.uid;
        if (isMine) {
          list.push({ ...data, id: d.id });
        }
      });
      list.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      setLeaveRequests(list);
      setLoading(false);
    });

    return () => unsub();
  }, [instituteId, student, isStaff, user]);

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || (!student && !isStaff)) return;

    if (!fromDate || !toDate) {
      setFormError('Please select both From and To dates.');
      return;
    }

    if (fromDate > toDate) {
      setFormError('The From date cannot be after the To date.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please provide a reason for your leave request.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const nowIso = new Date().toISOString();
      await addDoc(collection(db, 'institutes', instituteId, 'leaveRequests'), {
        studentId: isStaff ? user!.uid : student!.id,
        applicantId: user!.uid,
        applicantType: isStaff ? 'staff' : 'student',
        studentName: isStaff ? (user!.displayName || user!.email || 'Staff Member') : student!.fullName,
        batchId: (!isStaff && student?.batchIds && student.batchIds.length > 0) ? student.batchIds[0] : '',
        leaveType,
        fromDate,
        toDate,
        reason: reason.trim(),
        status: 'pending',
        requestedAt: nowIso,
        reviewedBy: null,
        reviewedAt: null,
      });

      setSuccessMsg('Your leave request has been submitted successfully.');
      setIsModalOpen(false);
      setReason('');

      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error('Error submitting leave request:', err);
      setFormError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-[#f59e0b] mb-2" />
        <p className="text-slate-400 text-xs font-semibold">Loading Leave Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-body-md pb-16">
      {/* Navigation Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900/80 border border-white/10 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Portal
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-2 space-y-6">
        {/* Top Title & Apply Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">Leave Applications</h1>
            <p className="text-slate-400 text-xs mt-1">
              Apply for leave and track approval status from institute admin.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            className="px-5 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-[#0f172a] font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Apply for Leave
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Leave Requests History List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#f59e0b]" /> My Leave History ({leaveRequests.length})
          </h2>

          {leaveRequests.length === 0 ? (
            <div className="bg-slate-900/60 p-10 rounded-2xl text-center text-slate-400 border border-white/10 space-y-3">
              <CalendarDays className="h-10 w-10 text-slate-600 mx-auto" />
              <p className="font-bold text-white text-base">No Leave Requests</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven't submitted any leave applications yet. Click "Apply for Leave" above to submit a request.
              </p>
            </div>
          ) : (
            leaveRequests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                      {req.leaveType} Leave
                    </span>

                    {/* Status Badge */}
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-500/40 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pending Review
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold tracking-wider uppercase border border-rose-500/40 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 font-semibold">
                    Dates: <span className="text-white font-bold">{req.fromDate}</span> to{' '}
                    <span className="text-white font-bold">{req.toDate}</span>
                  </div>

                  <p className="text-xs text-slate-400 bg-slate-950/80 p-3 rounded-xl border border-white/5 leading-relaxed">
                    <span className="text-slate-300 font-bold">Reason: </span> {req.reason}
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-500 shrink-0">
                  Requested: {new Date(req.requestedAt).toLocaleDateString()}
                  {req.reviewedByName && req.status !== 'pending' && (
                    <p className="text-slate-400 text-[10px] mt-0.5">Reviewed by: {req.reviewedByName}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EXACT GROUND TRUTH REFERENCE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50 backdrop-blur-xs">
          <div className="bg-campus-modal bg-[#182032] border border-[#2b3752] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-5 pb-2">
              <h2 className="text-campus-accent text-[#f59e0b] text-lg font-bold">Apply for Leave</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-red-400 hover:text-red-300 cursor-pointer p-1"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>
            </div>

            {/* Student Name */}
            <div className="px-5 pb-2">
              <p className="text-gray-300 font-semibold mb-6">
                {student?.fullName || user?.displayName || 'Student'}
              </p>
            </div>

            {formError && (
              <div className="mx-5 mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitLeave} className="px-5 space-y-6">
              {/* Leave Type Select */}
              <div className="field-container relative">
                <span className="field-label block text-xs font-bold text-slate-400 mb-1">Leave Type</span>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="block w-full bg-transparent border border-campus-border border-[#2b3752] rounded-xl py-4 pl-4 pr-10 text-white appearance-none focus:outline-none focus:ring-1 focus:ring-campus-accent focus:ring-[#f59e0b] cursor-pointer"
                >
                  <option value="casual" className="bg-[#182032] text-white">
                    Casual
                  </option>
                  <option value="sick" className="bg-[#182032] text-white">
                    Sick Leave
                  </option>
                  <option value="emergency" className="bg-[#182032] text-white">
                    Emergency
                  </option>
                  <option value="other" className="bg-[#182032] text-white">
                    Other
                  </option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-9 text-slate-400 pointer-events-none text-sm">
                  expand_more
                </span>
              </div>

              {/* From Date Picker */}
              <div className="field-container">
                <span className="field-label block text-xs font-bold text-slate-400 mb-1">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="block w-full bg-transparent border border-campus-border border-[#2b3752] rounded-xl py-4 px-4 text-white font-bold focus:outline-none focus:ring-1 focus:ring-campus-accent focus:ring-[#f59e0b] cursor-pointer"
                  required
                />
              </div>

              {/* To Date Picker */}
              <div className="field-container">
                <span className="field-label block text-xs font-bold text-slate-400 mb-1">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="block w-full bg-transparent border border-campus-border border-[#2b3752] rounded-xl py-4 px-4 text-white font-bold focus:outline-none focus:ring-1 focus:ring-campus-accent focus:ring-[#f59e0b] cursor-pointer"
                  required
                />
              </div>

              {/* Reason Textarea */}
              <div className="relative">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="block w-full bg-transparent border border-campus-border border-[#2b3752] rounded-xl py-4 px-4 text-campus-text-muted text-slate-200 focus:outline-none focus:ring-1 focus:ring-campus-accent focus:ring-[#f59e0b] resize-none placeholder:text-slate-500 text-sm"
                  placeholder="Reason"
                  rows={2}
                  required
                ></textarea>
              </div>

              {/* Submit Button */}
              <div className="pt-4 pb-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-campus-accent bg-[#f59e0b] hover:bg-[#d97706] text-campus-dark text-[#0f172a] font-bold py-4 rounded-2xl shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin text-[#0f172a]" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
