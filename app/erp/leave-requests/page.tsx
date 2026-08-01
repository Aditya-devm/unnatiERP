'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ShieldAlert,
  Loader2,
  User,
  FileText,
  AlertCircle,
  Check,
  X,
  Trash2
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  studentId: string;
  studentName?: string;
  batchId?: string;
  batchName?: string;
  leaveType: 'casual' | 'sick' | 'emergency' | 'other';
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
}

interface Student {
  id: string;
  fullName: string;
  rollNumber?: string;
  batchIds: string[];
}

interface Batch {
  id: string;
  name: string;
}

// Generate date strings (YYYY-MM-DD) for every day in range inclusive (timezone safe)
function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  try {
    const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

    const curr = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);

    while (curr <= end) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      curr.setDate(curr.getDate() + 1);
    }
  } catch (err) {
    console.error('Error computing date range:', err);
  }
  return dates;
}

function calculateDaysCount(fromDateStr: string, toDateStr: string): number {
  try {
    const start = new Date(fromDateStr).getTime();
    const end = new Date(toDateStr).getTime();
    const diff = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
  }
}

export default function ErpLeaveRequests() {
  const { user, instituteId, role, loading: authLoading } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [batches, setBatches] = useState<Record<string, Batch>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const isAdmin = ['owner', 'admin'].includes(role || '');

  // 1. Fetch Students & Batches for metadata mapping
  useEffect(() => {
    if (!instituteId) return;

    const fetchMetadata = async () => {
      try {
        // Students
        const stSnap = await getDocs(collection(db, 'institutes', instituteId, 'students'));
        const stMap: Record<string, Student> = {};
        stSnap.forEach((d) => {
          stMap[d.id] = { id: d.id, ...d.data() } as Student;
        });
        setStudents(stMap);

        // Batches
        const bSnap = await getDocs(collection(db, 'institutes', instituteId, 'batches'));
        const bMap: Record<string, Batch> = {};
        bSnap.forEach((d) => {
          bMap[d.id] = { id: d.id, ...d.data() } as Batch;
        });
        setBatches(bMap);
      } catch (err) {
        console.error('Error fetching metadata for leave requests:', err);
      }
    };

    fetchMetadata();
  }, [instituteId]);

  // 2. Real-time listener for Leave Requests
  useEffect(() => {
    if (!instituteId) return;

    const leaveRef = collection(db, 'institutes', instituteId, 'leaveRequests');
    const unsub = onSnapshot(leaveRef, (snap) => {
      const list: LeaveRequest[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as LeaveRequest);
      });
      list.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      setLeaveRequests(list);
      setLoading(false);
    });

    return () => unsub();
  }, [instituteId]);

  // Approve Action (Strict Server-Side / Function Enforcement)
  const handleApprove = async (request: LeaveRequest) => {
    if (!isAdmin || !user || !instituteId) {
      alert('Access Denied: Only Owner and Admin accounts can approve leave requests.');
      return;
    }

    setActioningId(request.id);
    try {
      const nowIso = new Date().toISOString();

      // 1. Update Leave Request Status
      const reqRef = doc(db, 'institutes', instituteId, 'leaveRequests', request.id);
      await updateDoc(reqRef, {
        status: 'approved',
        reviewedBy: user.uid,
        reviewedByName: user.displayName || 'Admin',
        reviewedAt: nowIso,
      });

      // 2. Auto-populate Attendance Records as "leave" for EVERY date in the range (inclusive)
      const datesList = getDatesInRange(request.fromDate, request.toDate);

      if ((request as any).applicantType === 'staff') {
        const staffAttCollRef = collection(db, 'institutes', instituteId, 'staffAttendance');
        for (const dateStr of datesList) {
          const qExist = query(
            staffAttCollRef,
            where('userId', '==', request.studentId),
            where('date', '==', dateStr)
          );
          const existSnap = await getDocs(qExist);

          if (!existSnap.empty) {
            for (const existDoc of existSnap.docs) {
              await updateDoc(doc(db, 'institutes', instituteId, 'staffAttendance', existDoc.id), {
                status: 'leave',
                updatedAt: nowIso,
              });
            }
          } else {
            await setDoc(doc(db, 'institutes', instituteId, 'staffAttendance', `${request.studentId}_${dateStr}`), {
              userId: request.studentId,
              date: dateStr,
              status: 'leave',
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }
      } else {
        const attendanceCollRef = collection(db, 'institutes', instituteId, 'attendanceRecords');

        for (const dateStr of datesList) {
          // Query existing attendance record for this student and date
          const qExist = query(
            attendanceCollRef,
            where('studentId', '==', request.studentId),
            where('date', '==', dateStr)
          );
          const existSnap = await getDocs(qExist);

          if (!existSnap.empty) {
            // OVERWRITE existing record(s) to status: 'leave'
            for (const existDoc of existSnap.docs) {
              await updateDoc(doc(db, 'institutes', instituteId, 'attendanceRecords', existDoc.id), {
                status: 'leave',
                markedBy: user.uid,
                method: 'manual',
                remarks: `Leave Approved (${request.leaveType})`,
                updatedAt: nowIso,
              });
            }
          } else {
            // Create new attendance record doc for this date
            const newAttDocId = `${request.studentId}_${dateStr}`;
            await setDoc(doc(db, 'institutes', instituteId, 'attendanceRecords', newAttDocId), {
              studentId: request.studentId,
              batchId: request.batchId || '',
              date: dateStr,
              status: 'leave',
              markedBy: user.uid,
              method: 'manual',
              remarks: `Leave Approved (${request.leaveType})`,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }
      }

      console.log(`Leave approved for ${request.studentId} from ${request.fromDate} to ${request.toDate}.`);
    } catch (err: any) {
      console.error('Error approving leave request:', err);
      alert(`Failed to approve leave request: ${err.message || 'Unknown error'}`);
    } finally {
      setActioningId(null);
    }
  };

  // Reject Action (Strict Server-Side / Function Enforcement)
  const handleReject = async (request: LeaveRequest) => {
    if (!isAdmin || !user || !instituteId) {
      alert('Access Denied: Only Owner and Admin accounts can reject leave requests.');
      return;
    }

    setActioningId(request.id);
    try {
      const nowIso = new Date().toISOString();
      const reqRef = doc(db, 'institutes', instituteId, 'leaveRequests', request.id);
      await updateDoc(reqRef, {
        status: 'rejected',
        reviewedBy: user.uid,
        reviewedByName: user.displayName || 'Admin',
        reviewedAt: nowIso,
      });

      console.log(`Leave rejected for student ${request.studentId}.`);
    } catch (err: any) {
      console.error('Error rejecting leave request:', err);
      alert(`Failed to reject leave request: ${err.message || 'Unknown error'}`);
    } finally {
      setActioningId(null);
    }
  };

  // Delete Leave Request Action (Before or After Approval/Rejection)
  const handleDeleteLeaveRequest = async (request: LeaveRequest) => {
    if (!isAdmin || !user || !instituteId) {
      alert('Access Denied: Only Owner and Admin accounts can delete leave requests.');
      return;
    }

    if (!confirm(`Are you sure you want to delete this leave request for ${request.studentName || 'Student'}?`)) {
      return;
    }

    setActioningId(request.id);
    try {
      // 1. If leave was approved, clean up the auto-generated attendance records for those dates
      if (request.status === 'approved') {
        const datesList = getDatesInRange(request.fromDate, request.toDate);
        const attendanceCollRef = collection(db, 'institutes', instituteId, 'attendanceRecords');

        for (const dateStr of datesList) {
          const qExist = query(
            attendanceCollRef,
            where('studentId', '==', request.studentId),
            where('date', '==', dateStr)
          );
          const existSnap = await getDocs(qExist);
          for (const d of existSnap.docs) {
            if (d.data().status === 'leave') {
              await deleteDoc(doc(db, 'institutes', instituteId, 'attendanceRecords', d.id));
            }
          }
        }
      }

      // 2. Delete the leave request document
      await deleteDoc(doc(db, 'institutes', instituteId, 'leaveRequests', request.id));
      console.log(`Leave request ${request.id} deleted successfully.`);
    } catch (err: any) {
      console.error('Error deleting leave request:', err);
      alert(`Failed to delete leave request: ${err.message || 'Unknown error'}`);
    } finally {
      setActioningId(null);
    }
  };

  // Access Control Guard Notice
  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-slate-100 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h2 className="font-extrabold text-xl text-white">Access Restricted</h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Student Leave Requests management is strictly restricted to <span className="text-white font-bold">Owner</span> and <span className="text-white font-bold">Admin</span> roles. Staff and Teacher accounts do not have permission to view or approve leave applications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Filtered Leave Requests
  const filteredRequests = leaveRequests.filter((req) => {
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const stName = req.studentName || students[req.studentId]?.fullName || '';
      const bName = req.batchName || (req.batchId ? batches[req.batchId]?.name : '') || '';
      const matchName = stName.toLowerCase().includes(q);
      const matchBatch = bName.toLowerCase().includes(q);
      const matchReason = (req.reason || '').toLowerCase().includes(q);
      return matchName || matchBatch || matchReason;
    }
    return true;
  });

  // Counters
  const totalCount = leaveRequests.length;
  const pendingCount = leaveRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter((r) => r.status === 'rejected').length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
        <p className="text-slate-400 text-xs font-semibold">Loading Leave Requests...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Student Leave Requests</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Review and approve or reject student leave applications with automatic attendance logging.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-black text-white mt-1">{totalCount}</p>
        </div>
        <div className="bg-slate-900/80 border border-amber-500/30 p-4 rounded-2xl">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending
          </p>
          <p className="text-2xl font-black text-amber-300 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-slate-900/80 border border-emerald-500/30 p-4 rounded-2xl">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </p>
          <p className="text-2xl font-black text-emerald-300 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-slate-900/80 border border-rose-500/30 p-4 rounded-2xl">
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </p>
          <p className="text-2xl font-black text-rose-300 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by student name, batch, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-indigo-400 font-bold focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses ({totalCount})</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="approved">Approved ({approvedCount})</option>
            <option value="rejected">Rejected ({rejectedCount})</option>
          </select>
        </div>
      </div>

      {/* Leave Requests Stack */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-slate-900/40 p-12 rounded-2xl text-center text-slate-400 border border-slate-800 space-y-3">
            <CalendarDays className="h-10 w-10 text-slate-600 mx-auto" />
            <p className="font-bold text-white text-base">No Leave Requests Found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No leave requests matching your current filter criteria were found.
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const studentObj = students[req.studentId];
            const studentName = req.studentName || studentObj?.fullName || 'Student';
            const batchName = req.batchName || (req.batchId ? batches[req.batchId]?.name : '') || 'General Batch';
            const daysCount = calculateDaysCount(req.fromDate, req.toDate);
            const isProcessing = actioningId === req.id;

            return (
              <div
                key={req.id}
                className={`bg-slate-900/90 border rounded-2xl p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  req.status === 'pending'
                    ? 'border-amber-500/40'
                    : req.status === 'approved'
                    ? 'border-emerald-500/30'
                    : 'border-rose-500/30'
                }`}
              >
                {/* Left Side Info */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-base text-white">{studentName}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold">
                      {batchName}
                    </span>

                    {/* Leave Type Badge */}
                    {req.leaveType === 'sick' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold uppercase">
                        Sick Leave
                      </span>
                    )}
                    {req.leaveType === 'casual' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-extrabold uppercase">
                        Casual Leave
                      </span>
                    )}
                    {req.leaveType === 'emergency' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-extrabold uppercase">
                        Emergency Leave
                      </span>
                    )}
                    {req.leaveType === 'other' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-300 text-[10px] font-extrabold uppercase">
                        Other Leave
                      </span>
                    )}
                  </div>

                  {/* Date Range & Duration */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <CalendarDays className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>
                      {req.fromDate} to {req.toDate}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] text-slate-400 font-bold">
                      {daysCount} Day{daysCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                    <span className="text-slate-400 font-bold">Reason: </span>
                    {req.reason || 'No specific reason provided.'}
                  </p>
                </div>

                {/* Right Side Status & Action Controls */}
                <div className="flex flex-col md:items-end gap-3 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
                  {/* Status Badge */}
                  {req.status === 'pending' && (
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase rounded-full flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Pending Review
                    </span>
                  )}
                  {req.status === 'approved' && (
                    <div className="text-right">
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase rounded-full inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                      </span>
                      {req.reviewedByName && (
                        <p className="text-[10px] text-slate-400 mt-1">By: {req.reviewedByName}</p>
                      )}
                    </div>
                  )}
                  {req.status === 'rejected' && (
                    <div className="text-right">
                      <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-extrabold uppercase rounded-full inline-flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" /> Rejected
                      </span>
                      {req.reviewedByName && (
                        <p className="text-[10px] text-slate-400 mt-1">By: {req.reviewedByName}</p>
                      )}
                    </div>
                  )}

                  {/* Owner/Admin Action Buttons */}
                  <div className="flex items-center gap-2 mt-1">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteLeaveRequest(req)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Delete Leave Request"
                    >
                      {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
