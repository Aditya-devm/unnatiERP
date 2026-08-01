'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  doc,
  onSnapshot,
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
  Clock3,
  Loader2,
  Shield,
  Briefcase,
  Award,
  DollarSign,
  UserCheck,
  AlertCircle,
  Key,
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

interface StaffUser {
  id: string;
  staffId?: string | null;
  password?: string | null;
  batchIds?: string[];
  name?: string;
  fullName?: string;
  email: string;
  role: string;
  position?: string | null;
  qualification?: string | null;
  salary?: number | null;
  startDate?: string | null;
  phone?: string | null;
  address?: string | null;
  isDeactivated?: boolean;
}

interface Batch {
  id: string;
  name: string;
  subject: string;
  scheduleDays?: string[];
  startTime?: string;
  endTime?: string;
  teacherId?: string;
}

interface StaffAttendance {
  id: string;
  userId?: string;
  firebaseUid?: string;
  staffId?: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: string;
}

export default function StaffDetail() {
  const { instituteId } = useAuth();
  const { staffId } = useParams() as { staffId: string };
  const router = useRouter();

  const [staffMember, setStaffMember] = useState<StaffUser | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [allAttendance, setAllAttendance] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!instituteId || !staffId) return;

    // 1. Fetch Staff Profile from users collection
    const userDocRef = doc(db, 'users', staffId);
    const unsubStaff = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setStaffMember({ id: docSnap.id, ...docSnap.data() } as StaffUser);
        setLoading(false);
      } else {
        // Fallback: search by staffId field if URL param is staffId string
        const qStaff = query(collection(db, 'users'), where('staffId', '==', staffId));
        getDocs(qStaff).then((snap) => {
          if (!snap.empty) {
            const firstDoc = snap.docs[0];
            setStaffMember({ id: firstDoc.id, ...firstDoc.data() } as StaffUser);
          } else {
            setStaffMember(null);
          }
          setLoading(false);
        }).catch((err) => {
          console.error('Error fetching staff fallback:', err);
          setLoading(false);
        });
      }
    }, (err) => {
      console.error('Error fetching staff detail:', err);
      setLoading(false);
    });

    // 2. Fetch ALL Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Batch);
      });
      setAllBatches(list);
    });

    // 3. Fetch Staff Attendance history
    const staffAttendCol = collection(db, 'institutes', instituteId, 'staffAttendance');
    const unsubAttendance = onSnapshot(staffAttendCol, (snapshot) => {
      const list: StaffAttendance[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StaffAttendance);
      });
      setAllAttendance(list);
    });

    return () => {
      unsubStaff();
      unsubBatches();
      unsubAttendance();
    };
  }, [instituteId, staffId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Staff Profile...</p>
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-extrabold text-white">Staff Member Not Found</h3>
        <p className="text-slate-400 text-xs mt-2 font-medium">
          The requested staff profile does not exist or has been removed.
        </p>
        <Link
          href="/erp/staff"
          className="mt-5 inline-flex items-center gap-2 bg-slate-850 border border-slate-750 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Staff Directory
        </Link>
      </div>
    );
  }

  // Derive Assigned Taught Batches (matches batchIds array or teacherId)
  const assignedBatches = allBatches.filter((b) => {
    const isTeacherMatch =
      b.teacherId === staffId ||
      b.teacherId === staffMember.id ||
      (staffMember.staffId && b.teacherId === staffMember.staffId);

    const isBatchIdMatch =
      Array.isArray(staffMember.batchIds) && staffMember.batchIds.includes(b.id);

    return isTeacherMatch || isBatchIdMatch;
  });

  // Derive Staff Attendance History
  const staffAttendanceList = allAttendance.filter((r) => {
    return (
      r.userId === staffId ||
      r.userId === staffMember.id ||
      r.firebaseUid === staffId ||
      r.firebaseUid === staffMember.id ||
      (staffMember.staffId && r.staffId === staffMember.staffId)
    );
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Attendance metrics
  const totalDays = staffAttendanceList.length;
  const presentCount = staffAttendanceList.filter(
    (r) => r.status === 'present' || r.status === 'checked_in' || r.status === 'checked_out'
  ).length;
  const leaveCount = staffAttendanceList.filter((r) => r.status === 'leave').length;
  const absentCount = staffAttendanceList.filter((r) => r.status === 'absent').length;

  const displayName = staffMember.name || staffMember.fullName || staffMember.email;

  const roleBadgeStyles: Record<string, string> = {
    owner: 'bg-amber-950/40 text-amber-400 border-amber-900/40',
    admin: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/40',
    teacher: 'bg-blue-950/40 text-blue-400 border-blue-900/40',
    staff: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/erp/staff"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Staff Directory
        </Link>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center font-black text-3xl text-indigo-400 shrink-0 shadow-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-black text-white tracking-tight">{displayName}</h1>
              <span className={`px-2.5 py-0.5 text-[10px] font-black border rounded uppercase tracking-wider ${roleBadgeStyles[staffMember.role?.toLowerCase()] || roleBadgeStyles.staff}`}>
                {staffMember.role}
              </span>
              {staffMember.isDeactivated ? (
                <span className="px-2.5 py-0.5 text-[9px] font-black bg-red-950/40 text-red-400 border border-red-900/40 rounded uppercase">
                  Deactivated
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[9px] font-black bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded uppercase">
                  Active Member
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs font-semibold">{staffMember.position || 'Faculty Member'}</p>
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-2">
              <span className="text-indigo-400 font-bold">Staff ID: {staffMember.staffId || 'N/A'}</span>
              <span>• {staffMember.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section 1: Detailed Staff Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Credentials & Login Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Key className="h-4 w-4 text-indigo-400" /> Portal Credentials
          </h3>
          <div className="space-y-3 text-xs font-bold">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Staff Login ID</span>
              <span className="font-mono text-indigo-400 text-sm font-extrabold">{staffMember.staffId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Portal Password</span>
              <div className="flex items-center justify-between bg-slate-955 border border-slate-800 rounded-xl px-3 py-2">
                <span className="font-mono text-emerald-400 font-extrabold">
                  {staffMember.password ? (showPassword ? staffMember.password : '••••••••') : 'Not Set'}
                </span>
                {staffMember.password && (
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-white cursor-pointer">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Email Address</span>
              <span className="font-mono text-slate-200">{staffMember.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Phone Number</span>
              <span className="text-slate-200">{staffMember.phone || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Professional Profile */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Briefcase className="h-4 w-4 text-indigo-400" /> Job Profile & Info
          </h3>
          <div className="space-y-3 text-xs font-bold">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Position / Title</span>
              <span className="text-slate-200">{staffMember.position || 'Faculty Member'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Assigned System Role</span>
              <span className="text-indigo-400 font-extrabold uppercase">{staffMember.role}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Educational Qualification</span>
              <span className="text-slate-200">{staffMember.qualification || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Joining / Start Date</span>
              <span className="text-slate-200">{staffMember.startDate || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Financials & Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <DollarSign className="h-4 w-4 text-emerald-400" /> Payroll & Status
          </h3>
          <div className="space-y-3 text-xs font-bold">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Monthly Salary</span>
              <span className="text-emerald-400 text-lg font-black">
                ₹{Number(staffMember.salary || 0).toLocaleString()} <span className="text-xs text-slate-500 font-medium">/ month</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Account Status</span>
              {staffMember.isDeactivated ? (
                <span className="text-red-400 font-extrabold flex items-center gap-1"><XCircle className="h-4 w-4" /> Deactivated Access</span>
              ) : (
                <span className="text-emerald-400 font-extrabold flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Active & Authorized</span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Assigned Batches Count</span>
              <span className="text-indigo-400 font-black text-sm">{assignedBatches.length} Batches</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section 2: Assigned Taught Batches ("Batch Assigned") */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" /> Assigned Batches ({assignedBatches.length})
          </h3>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-950/60 border border-indigo-850 px-3 py-1 rounded-full">
            Allotted Access
          </span>
        </div>

        {assignedBatches.length === 0 ? (
          <div className="bg-slate-955 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 italic text-xs font-bold">
            No batches assigned to this staff member yet. Use Edit Staff Profile to assign batches.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {assignedBatches.map((batch) => (
              <div key={batch.id} className="bg-slate-955 border border-slate-800 p-4 rounded-2xl space-y-2 hover:border-indigo-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/50">
                    {batch.subject || 'General'}
                  </span>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Batch ID: {batch.id.substring(0, 6)}</span>
                </div>
                <h4 className="font-extrabold text-white text-sm pt-1">{batch.name}</h4>
                <div className="text-[11px] font-semibold text-slate-400 space-y-1 pt-1 border-t border-slate-850">
                  {batch.scheduleDays && batch.scheduleDays.length > 0 && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" /> {batch.scheduleDays.join(', ')}
                    </div>
                  )}
                  {batch.startTime && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Clock3 className="h-3.5 w-3.5 text-indigo-400" /> {batch.startTime} - {batch.endTime || ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid Section 3: Staff Attendance Summary & History Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-500" /> Staff Attendance Summary & Activity Logs
          </h3>

          {/* Attendance Stats Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-xl bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold">
              Total Logged: {totalDays}
            </span>
            <span className="px-3 py-1 rounded-xl bg-emerald-950/60 border border-emerald-900/60 text-emerald-400 text-xs font-bold">
              Present / Shift: {presentCount}
            </span>
            <span className="px-3 py-1 rounded-xl bg-blue-950/60 border border-blue-900/60 text-blue-400 text-xs font-bold">
              Leave: {leaveCount}
            </span>
            <span className="px-3 py-1 rounded-xl bg-red-950/60 border border-red-900/60 text-red-400 text-xs font-bold">
              Absent: {absentCount}
            </span>
          </div>
        </div>

        {staffAttendanceList.length === 0 ? (
          <div className="bg-slate-955 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 italic text-xs font-bold">
            No check-in or attendance records logged for this staff member yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Check-In Time</th>
                  <th className="p-3.5">Check-Out Time</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                {staffAttendanceList.map((record) => {
                  const statusColors: Record<string, string> = {
                    checked_in: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60',
                    checked_out: 'bg-indigo-950/60 text-indigo-400 border-indigo-900/60',
                    present: 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60',
                    absent: 'bg-red-950/60 text-red-400 border-red-900/60',
                    leave: 'bg-blue-950/60 text-blue-400 border-blue-900/60',
                    holiday: 'bg-purple-950/60 text-purple-400 border-purple-900/60',
                  };

                  return (
                    <tr key={record.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-3.5 text-white font-mono">{record.date}</td>
                      <td className="p-3.5 text-emerald-400 font-mono">{record.checkInTime || '-'}</td>
                      <td className="p-3.5 text-indigo-400 font-mono">{record.checkOutTime || (record.status === 'checked_in' ? 'Active Shift' : '-')}</td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 text-[9px] font-extrabold border rounded uppercase tracking-wider ${statusColors[record.status] || 'bg-slate-850 text-slate-400'}`}>
                          {record.status === 'checked_in' ? 'Checked In' : record.status === 'checked_out' ? 'Completed Shift' : record.status}
                        </span>
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
  );
}

