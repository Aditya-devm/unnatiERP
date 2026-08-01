'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import AttendanceSummaryChart from '@/components/attendance-summary-chart';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Clock3,
  HelpCircle,
  Users,
  CheckCheck,
  Save,
  Loader2,
  LogIn,
  LogOut,
  Layers,
  Search,
  UserCheck,
  FileSpreadsheet,
  AlertCircle,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  TrendingUp,
  Download,
  Lock,
  Check,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import {
  enqueueOfflineAction,
  getPendingOfflineQueue,
  flushOfflineQueue
} from '@/lib/offline-sync';

interface Batch {
  id: string;
  name: string;
  subject: string;
}

interface Student {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  batchIds: string[];
  photoUrl?: string | null;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  batchId: string;
  date: string;
  status: 'present' | 'absent' | 'leave' | 'holiday';
  markedBy: string;
  method: 'manual' | 'qr' | 'face_recognition';
  createdAt?: string;
}

interface StaffAttendance {
  id: string;
  userId: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  createdAt?: string;
}

interface StaffMember {
  id: string;
  fullName: string;
  staffId?: string;
  position?: string;
  role: string;
  photoUrl?: string | null;
  firebaseUid?: string | null;
}

export default function ErpAttendance() {
  const { user, instituteId, role, hasPermission } = useAuth();

  // Tab State: 'mark' | 'matrix' | 'staff'
  const [activeTab, setActiveTab] = useState<'mark' | 'matrix' | 'staff'>('mark');

  // Data Collections
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [staffAttendanceRecords, setStaffAttendanceRecords] = useState<StaffAttendance[]>([]);
  const [staffAttendanceState, setStaffAttendanceState] = useState<{ [userId: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // Mark Attendance State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  const markingSectionRef = useRef<HTMLDivElement>(null);

  const handleSelectBatch = (batchId: string) => {
    if (batchId === 'STAFF_BATCH' && !['owner', 'admin'].includes(role || '')) {
      return;
    }
    setSelectedBatchId(batchId);
    setTimeout(() => {
      markingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Student Attendance Calendar Overview Modal State
  const [selectedCalendarStudent, setSelectedCalendarStudent] = useState<Student | null>(null);
  const [modalCalendarDate, setModalCalendarDate] = useState<Date>(new Date());

  const handlePrevDate = () => {
    const parts = attendanceDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setAttendanceDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const handleNextDate = () => {
    const parts = attendanceDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setAttendanceDate(`${yyyy}-${mm}-${dd}`);
    }
  };
  // Map of studentId -> status ('present' | 'absent' | 'leave' | 'holiday')
  const [attendanceState, setAttendanceState] = useState<{ [studentId: string]: 'present' | 'absent' | 'leave' | 'holiday' }>({});
  // Map of studentId -> sync status ('saving' | 'saved' | 'error')
  const [rowSyncStatus, setRowSyncStatus] = useState<{ [studentId: string]: 'saving' | 'saved' | 'error' }>({});
  const studentDebounceTimerRef = React.useRef<{ [studentId: string]: NodeJS.Timeout }>({});

  // Matrix Filter State
  const [matrixBatchId, setMatrixBatchId] = useState<string>('');

  // Status & Submit Action
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Offline Sync State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !instituteId) return;

    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setPendingOfflineCount(getPendingOfflineQueue(instituteId).length);
    };

    updateStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      if (instituteId) {
        setSyncingOffline(true);
        await flushOfflineQueue(instituteId);
        setPendingOfflineCount(getPendingOfflineQueue(instituteId).length);
        setSyncingOffline(false);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('unnati_offline_queue_updated', updateStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('unnati_offline_queue_updated', updateStatus);
    };
  }, [instituteId]);

  // Subscribe to collections
  useEffect(() => {
    if (!instituteId) return;

    // 1. Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      let list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, name: d.name, subject: d.subject, teacherId: d.teacherId } as any);
      });

      // Teacher role restriction: filter to assigned batches
      if (role === 'teacher' && user) {
        list = list.filter((b: any) => b.teacherId === user.uid);
      }

      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
        setMatrixBatchId(list[0].id);
      }
      setLoading(false);
    });

    // 2. Students
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          fullName: d.fullName || 'Unknown',
          phone: d.phone || '',
          status: d.status || 'active',
          batchIds: d.batchIds || [],
          photoUrl: d.photoUrl || null
        });
      });
      setStudents(list);
    });

    // 3. Attendance Records
    const attendanceCol = collection(db, 'institutes', instituteId, 'attendanceRecords');
    const unsubAttendance = onSnapshot(attendanceCol, (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
      });
      setAttendanceRecords(list);
    });

    // 4. Staff Attendance
    const staffCol = collection(db, 'institutes', instituteId, 'staffAttendance');
    const unsubStaff = onSnapshot(staffCol, (snapshot) => {
      const list: StaffAttendance[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StaffAttendance);
      });
      setStaffAttendanceRecords(list);
    });

    // 5. Staff Users List (with deduplication by email/staffId)
    const usersCol = collection(db, 'users');
    const qStaffUsers = query(usersCol, where('instituteId', '==', instituteId));
    const unsubStaffUsers = onSnapshot(qStaffUsers, (snapshot) => {
      const deduplicatedMap = new Map<string, StaffMember>();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const roleLower = (d.role || '').toLowerCase();
        if (['teacher', 'staff', 'admin', 'owner'].includes(roleLower)) {
          const item: StaffMember = {
            id: docSnap.id,
            fullName: d.fullName || d.name || d.displayName || d.email || 'Staff Member',
            staffId: d.staffId || 'STF',
            position: d.position || 'Faculty',
            role: d.role,
            photoUrl: d.photoUrl || null,
            firebaseUid: d.firebaseUid || docSnap.id
          };

          const normEmail = (d.email || '').toLowerCase().trim();
          const normStaffId = (d.staffId || '').toLowerCase().trim();
          const key = normEmail || normStaffId || docSnap.id;

          if (!deduplicatedMap.has(key)) {
            deduplicatedMap.set(key, item);
          } else {
            // Keep existing entry with most complete information
            const existing = deduplicatedMap.get(key)!;
            deduplicatedMap.set(key, {
              ...item,
              ...existing,
              staffId: existing.staffId !== 'STF' ? existing.staffId : item.staffId,
              fullName: existing.fullName !== 'Staff Member' ? existing.fullName : item.fullName,
              photoUrl: existing.photoUrl || item.photoUrl
            });
          }
        }
      });

      setStaffMembers(Array.from(deduplicatedMap.values()));
    });

    return () => {
      unsubBatches();
      unsubStudents();
      unsubAttendance();
      unsubStaff();
      unsubStaffUsers();
    };
  }, [instituteId]);

  // Handle single staff status change
  const handleStaffStatusChange = async (userId: string, status: string) => {
    if (!instituteId || !attendanceDate) return;

    setStaffAttendanceState((prev) => ({ ...prev, [userId]: status }));
    const docId = `${userId}_${attendanceDate}`;
    const markedBy = user?.email || user?.uid || 'Admin';

    // Find the staff member to get their firebaseUid and staffId
    const staffMember = staffMembers.find((s) => s.id === userId);

    try {
      const recordDocRef = doc(db, 'institutes', instituteId, 'staffAttendance', docId);
      await setDoc(recordDocRef, {
        userId,
        staffId: staffMember?.staffId || null,
        firebaseUid: (staffMember as any)?.firebaseUid || null,
        date: attendanceDate,
        status,
        markedBy,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error('Error marking staff attendance:', err);
    }
  };

  // Bulk Mark All Staff Present
  const handleMarkAllStaffPresent = async () => {
    if (!instituteId || !attendanceDate || staffMembers.length === 0) return;

    const markedBy = user?.email || user?.uid || 'Admin';
    const nextState: Record<string, string> = {};
    staffMembers.forEach((s) => { nextState[s.id] = 'present'; });
    setStaffAttendanceState((prev) => ({ ...prev, ...nextState }));

    await Promise.all(
      staffMembers.map(async (staff) => {
        const docId = `${staff.id}_${attendanceDate}`;
        const recordDocRef = doc(db, 'institutes', instituteId, 'staffAttendance', docId);
        await setDoc(recordDocRef, {
          userId: staff.id,
          staffId: staff.staffId,
          firebaseUid: staff.firebaseUid || null,
          date: attendanceDate,
          status: 'present',
          markedBy,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      })
    );
  };

  // Bulk Mark All Staff Holiday
  const handleMarkAllStaffHoliday = async () => {
    if (!instituteId || !attendanceDate || staffMembers.length === 0) return;

    const markedBy = user?.email || user?.uid || 'Admin';
    const nextState: Record<string, string> = {};
    staffMembers.forEach((s) => { nextState[s.id] = 'holiday'; });
    setStaffAttendanceState((prev) => ({ ...prev, ...nextState }));

    await Promise.all(
      staffMembers.map(async (staff) => {
        const docId = `${staff.id}_${attendanceDate}`;
        const recordDocRef = doc(db, 'institutes', instituteId, 'staffAttendance', docId);
        await setDoc(recordDocRef, {
          userId: staff.id,
          staffId: staff.staffId,
          firebaseUid: staff.firebaseUid || null,
          date: attendanceDate,
          status: 'holiday',
          markedBy,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      })
    );
  };

  // Load roster & pre-fill marked attendance when batch or date changes
  useEffect(() => {
    if (!selectedBatchId || !attendanceDate) return;

    // Filter active students in selected batch
    const batchRoster = students.filter(
      (s) => s.status === 'active' && s.batchIds && s.batchIds.includes(selectedBatchId)
    );

    // Existing attendance records for this batch and date
    const dayRecords = attendanceRecords.filter(
      (r) => r.batchId === selectedBatchId && r.date === attendanceDate
    );

    const initialStates: { [studentId: string]: 'present' | 'absent' | 'leave' | 'holiday' } = {};

    batchRoster.forEach((student) => {
      const foundRecord = dayRecords.find((r) => r.studentId === student.id);
      if (foundRecord) {
        let s: any = foundRecord.status;
        if (s === 'late' || s === 'excused') s = 'leave';
        initialStates[student.id] = s as any;
      }
    });

    setAttendanceState(initialStates);
  }, [selectedBatchId, attendanceDate, students, attendanceRecords]);

  // Active roster for currently selected batch
  const activeRoster = students.filter(
    (s) => s.status === 'active' && s.batchIds && s.batchIds.includes(selectedBatchId)
  );

  // Status Change Handler with Auto-Save
  const handleStatusChange = (studentId: string, newStatus: 'present' | 'absent' | 'leave' | 'holiday') => {
    setAttendanceState((prev) => ({ ...prev, [studentId]: newStatus }));
    setRowSyncStatus((prev) => ({ ...prev, [studentId]: 'saving' }));

    if (studentDebounceTimerRef.current[studentId]) {
      clearTimeout(studentDebounceTimerRef.current[studentId]);
    }

    studentDebounceTimerRef.current[studentId] = setTimeout(() => {
      saveStudentAttendanceSingle(studentId, newStatus);
    }, 400);
  };

  // Deterministic Single Student Save
  const saveStudentAttendanceSingle = async (studentId: string, status: 'present' | 'absent' | 'leave' | 'holiday') => {
    if (!instituteId || !selectedBatchId || !attendanceDate) return;

    const docId = `${selectedBatchId}_${attendanceDate}_${studentId}`;
    const markedBy = user?.email || user?.uid || 'Staff';

    const payload = {
      studentId,
      batchId: selectedBatchId,
      date: attendanceDate,
      status,
      markedBy,
      method: 'manual' as const,
      updatedAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      enqueueOfflineAction(instituteId, {
        type: 'attendance',
        collectionPath: `institutes/${instituteId}/attendanceRecords`,
        docId,
        payload
      });
      setPendingOfflineCount(getPendingOfflineQueue(instituteId).length);
      setRowSyncStatus((prev) => ({ ...prev, [studentId]: 'saved' }));
      setTimeout(() => {
        setRowSyncStatus((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }, 1500);
      return;
    }

    try {
      const recordDocRef = doc(db, 'institutes', instituteId, 'attendanceRecords', docId);
      await setDoc(recordDocRef, { ...payload, createdAt: new Date().toISOString() }, { merge: true });

      setRowSyncStatus((prev) => ({ ...prev, [studentId]: 'saved' }));
      setTimeout(() => {
        setRowSyncStatus((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
      }, 1500);
    } catch (err) {
      console.error('Error writing attendance status:', err);
      setRowSyncStatus((prev) => ({ ...prev, [studentId]: 'error' }));
    }
  };

  // Bulk Mark All Present Handler
  const handleMarkAllPresent = async () => {
    if (!instituteId || !selectedBatchId || !attendanceDate || activeRoster.length === 0) return;

    const updatedMap: { [studentId: string]: 'present' } = {};
    activeRoster.forEach((s) => {
      updatedMap[s.id] = 'present';
    });
    setAttendanceState((prev) => ({ ...prev, ...updatedMap }));

    const markedBy = user?.email || user?.uid || 'Staff';

    await Promise.all(
      activeRoster.map(async (student) => {
        const docId = `${selectedBatchId}_${attendanceDate}_${student.id}`;
        const payload = {
          studentId: student.id,
          batchId: selectedBatchId,
          date: attendanceDate,
          status: 'present' as const,
          markedBy,
          method: 'manual' as const,
          updatedAt: new Date().toISOString()
        };

        if (typeof window !== 'undefined' && !navigator.onLine) {
          enqueueOfflineAction(instituteId, {
            type: 'attendance',
            collectionPath: `institutes/${instituteId}/attendanceRecords`,
            docId,
            payload
          });
        } else {
          const recordDocRef = doc(db, 'institutes', instituteId, 'attendanceRecords', docId);
          await setDoc(recordDocRef, { ...payload, createdAt: new Date().toISOString() }, { merge: true });
        }
      })
    );
  };

  // Bulk Mark All Holiday Handler
  const handleMarkAllHoliday = async () => {
    if (!instituteId || !selectedBatchId || !attendanceDate || activeRoster.length === 0) return;

    const updatedMap: { [studentId: string]: 'holiday' } = {};
    activeRoster.forEach((s) => {
      updatedMap[s.id] = 'holiday';
    });
    setAttendanceState((prev) => ({ ...prev, ...updatedMap }));

    const markedBy = user?.email || user?.uid || 'Staff';

    await Promise.all(
      activeRoster.map(async (student) => {
        const docId = `${selectedBatchId}_${attendanceDate}_${student.id}`;
        const payload = {
          studentId: student.id,
          batchId: selectedBatchId,
          date: attendanceDate,
          status: 'holiday' as const,
          markedBy,
          method: 'manual' as const,
          updatedAt: new Date().toISOString()
        };

        if (typeof window !== 'undefined' && !navigator.onLine) {
          enqueueOfflineAction(instituteId, {
            type: 'attendance',
            collectionPath: `institutes/${instituteId}/attendanceRecords`,
            docId,
            payload
          });
        } else {
          const recordDocRef = doc(db, 'institutes', instituteId, 'attendanceRecords', docId);
          await setDoc(recordDocRef, { ...payload, createdAt: new Date().toISOString() }, { merge: true });
        }
      })
    );
  };

  // Staff Check-In / Check-Out Handlers
  const todayStr = new Date().toISOString().substring(0, 10);
  const currentUserId = user?.uid || 'staff-user';

  const todayStaffRecord = staffAttendanceRecords.find(
    (r) => r.userId === currentUserId && r.date === todayStr
  );

  const handleStaffCheckIn = async () => {
    if (!instituteId) return;
    setSubmitting(true);
    try {
      const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await addDoc(collection(db, 'institutes', instituteId, 'staffAttendance'), {
        userId: currentUserId,
        date: todayStr,
        checkInTime: nowTimeStr,
        checkOutTime: null,
        status: 'checked_in',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error checking in staff:', err);
      alert('Failed to check in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffCheckOut = async () => {
    if (!instituteId || !todayStaffRecord) return;
    setSubmitting(true);
    try {
      const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await updateDoc(doc(db, 'institutes', instituteId, 'staffAttendance', todayStaffRecord.id), {
        checkOutTime: nowTimeStr,
        status: 'checked_out',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error checking out staff:', err);
      alert('Failed to check out.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for Batch Attendance Matrix
  const matrixBatchRoster = students.filter(
    (s) => s.batchIds && s.batchIds.includes(matrixBatchId)
  );

  const matrixDates = Array.from(
    new Set(
      attendanceRecords
        .filter((r) => r.batchId === matrixBatchId)
        .map((r) => r.date)
    )
  ).sort().reverse();

  if (!hasPermission('canMarkAttendance') && role !== 'owner' && role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-sans p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <Lock className="h-10 w-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-black text-white">Attendance Marking Disabled</h2>
          <p className="text-slate-400 text-xs font-semibold">
            Attendance marking has been turned OFF for your role by the Institute Owner.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Attendance System...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Attendance Management</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Mark daily class attendance by selecting a batch, view batch matrices, and record staff check-in/out.
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('mark')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'mark'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Mark Attendance
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Batch Matrix
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Staff Check-In
          </button>
        </div>
      </div>

      {/* Offline / Pending Sync Indicator Banner */}
      {(pendingOfflineCount > 0 || !isOnline) && (
        <div className="bg-amber-955/60 border border-amber-900/60 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              {!isOnline ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5 text-amber-400" />}
            </div>
            <div>
              <span className="text-xs font-bold text-amber-200 block">
                {!isOnline ? 'Offline Mode Active' : 'Pending Offline Sync Queue'}
              </span>
              <span className="text-[11px] text-amber-400/80 font-medium block">
                {pendingOfflineCount > 0
                  ? `${pendingOfflineCount} record(s) queued locally. Writes will sync when online.`
                  : 'You are offline. Marked attendance will queue locally.'}
              </span>
            </div>
          </div>

          {pendingOfflineCount > 0 && (
            <button
              onClick={async () => {
                if (!instituteId) return;
                setSyncingOffline(true);
                const res = await flushOfflineQueue(instituteId);
                setPendingOfflineCount(getPendingOfflineQueue(instituteId).length);
                setSyncingOffline(false);
                if (res.syncedCount > 0) {
                  alert(`Successfully synced ${res.syncedCount} queued attendance record(s) to cloud!`);
                }
              }}
              disabled={syncingOffline}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
              Sync Now ({pendingOfflineCount})
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MARK ATTENDANCE */}
      {/* ========================================================================= */}
      {activeTab === 'mark' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* BATCH SELECTION CARDS GRID (NO DROPDOWN) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white tracking-tight uppercase flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" /> Click a Batch to Access Student Attendance
              </span>
              <span className="text-[10px] font-bold text-slate-400">{batches.length} Batches Available</span>
            </div>

            {batches.length === 0 ? (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs font-bold text-slate-500">
                No batches created yet. Please create a batch in Batches page.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* DEDICATED STAFF ATTENDANCE CARD */}
                {['owner', 'admin'].includes(role || '') && (() => {
                  const staffTodayRecords = staffAttendanceRecords.filter((r) => r.date === attendanceDate);
                  let sPresent = 0, sAbsent = 0, sLeave = 0, sHoliday = 0;
                  staffTodayRecords.forEach((r) => {
                    if (r.status === 'checked_in' || r.status === 'checked_out' || r.status === 'present') sPresent++;
                    else if (r.status === 'absent') sAbsent++;
                    else if (r.status === 'leave') sLeave++;
                    else if (r.status === 'holiday') sHoliday++;
                  });
                  const sMarked = sPresent + sAbsent + sLeave + sHoliday;
                  const sNotMarked = Math.max(0, staffMembers.length - sMarked);

                  return (
                    <button
                      type="button"
                      onClick={() => handleSelectBatch('STAFF_BATCH')}
                      className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                        selectedBatchId === 'STAFF_BATCH'
                          ? 'bg-gradient-to-br from-purple-950/90 to-slate-900 border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500'
                          : 'bg-slate-900 border-purple-900/40 hover:border-purple-500/50 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest block">
                            Institute Faculty
                          </span>
                          <h3 className={`text-sm font-extrabold mt-0.5 ${selectedBatchId === 'STAFF_BATCH' ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            Staff Attendance
                          </h3>
                        </div>

                        <div className="w-6 h-6 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                          <UserCheck className="h-3.5 w-3.5" />
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                          <span>{staffMembers.length} Staff Members</span>
                          <span className="text-[10px] font-extrabold uppercase text-purple-400">
                            {selectedBatchId === 'STAFF_BATCH' ? 'ACTIVE' : 'STAFF ONLY'}
                          </span>
                        </div>

                        {/* Breakdown Row with Small Icons */}
                        <div className="grid grid-cols-5 gap-1 bg-slate-955/80 p-1.5 rounded-xl border border-slate-850 text-[10px] font-extrabold text-center">
                          <div className="flex flex-col items-center gap-0.5" title="Present">
                            <div className="flex items-center gap-0.5 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>{sPresent}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">P</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Absent">
                            <div className="flex items-center gap-0.5 text-red-400">
                              <XCircle className="h-3 w-3 shrink-0" />
                              <span>{sAbsent}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">A</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Leave">
                            <div className="flex items-center gap-0.5 text-amber-400">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{sLeave}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">L</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Holiday">
                            <div className="flex items-center gap-0.5 text-purple-400">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>{sHoliday}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">H</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Not Marked">
                            <div className="flex items-center gap-0.5 text-slate-400">
                              <HelpCircle className="h-3 w-3 shrink-0" />
                              <span>{sNotMarked}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">N/M</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })()}

                {batches.map((batch) => {
                  const isSelected = selectedBatchId === batch.id;
                  const enrolledCount = students.filter(
                    (s) => s.status === 'active' && s.batchIds && s.batchIds.includes(batch.id)
                  ).length;

                  // Today's attendance records for this batch
                  const batchTodayRecords = attendanceRecords.filter(
                    (r) => r.batchId === batch.id && r.date === attendanceDate
                  );

                  let presentCount = 0;
                  let absentCount = 0;
                  let leaveCount = 0;
                  let holidayCount = 0;

                  batchTodayRecords.forEach((r) => {
                    if (r.status === 'present') presentCount++;
                    else if (r.status === 'absent') absentCount++;
                    else if (r.status === 'leave') leaveCount++;
                    else if (r.status === 'holiday') holidayCount++;
                  });

                  const markedCount = presentCount + absentCount + leaveCount + holidayCount;
                  const notMarkedCount = Math.max(0, enrolledCount - markedCount);

                  return (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => handleSelectBatch(batch.id)}
                      className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-950/80 to-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                            {batch.subject}
                          </span>
                          <h3 className={`text-sm font-extrabold mt-0.5 ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            {batch.name}
                          </h3>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                          <span>{enrolledCount} Enrolled</span>
                          <span className={`text-[10px] font-extrabold uppercase ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {isSelected ? 'ACTIVE' : 'Tap to Access'}
                          </span>
                        </div>

                        {/* Breakdown Row with Small Icons */}
                        <div className="grid grid-cols-5 gap-1 bg-slate-955/80 p-1.5 rounded-xl border border-slate-850 text-[10px] font-extrabold text-center">
                          <div className="flex flex-col items-center gap-0.5" title="Present">
                            <div className="flex items-center gap-0.5 text-emerald-400">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span>{presentCount}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">P</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Absent">
                            <div className="flex items-center gap-0.5 text-red-400">
                              <XCircle className="h-3 w-3 shrink-0" />
                              <span>{absentCount}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">A</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Leave">
                            <div className="flex items-center gap-0.5 text-amber-400">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{leaveCount}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">L</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Holiday">
                            <div className="flex items-center gap-0.5 text-purple-400">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>{holidayCount}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">H</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5" title="Not Marked">
                            <div className="flex items-center gap-0.5 text-slate-400">
                              <HelpCircle className="h-3 w-3 shrink-0" />
                              <span>{notMarkedCount}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">N/M</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Picker & Quick Actions Bar */}
          <div ref={markingSectionRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-center justify-between scroll-mt-6">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Calendar className="h-5 w-5 text-indigo-400 shrink-0" />
              <div className="space-y-0.5 flex-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Attendance Date
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevDate}
                    title="Previous Day"
                    className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={handleNextDate}
                    title="Next Day"
                    className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {selectedBatchId === 'STAFF_BATCH' ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleMarkAllStaffPresent}
                  disabled={staffMembers.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4 text-emerald-400" />
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllStaffHoliday}
                  disabled={staffMembers.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-purple-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Calendar className="h-4 w-4 text-purple-400" />
                  Mark All Holiday
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  disabled={activeRoster.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4 text-emerald-400" />
                  Mark All Present
                </button>

                <button
                  type="button"
                  onClick={handleMarkAllHoliday}
                  disabled={activeRoster.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-purple-400 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Calendar className="h-4 w-4 text-purple-400" />
                  Mark All Holiday
                </button>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3.5 rounded-xl text-center font-bold">
              {error}
            </div>
          )}

          {/* Roster Table (Staff vs Student) */}
          {selectedBatchId === 'STAFF_BATCH' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden space-y-4 p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                <div className="text-xs font-bold text-slate-300">
                  Staff Roster Count: <strong className="text-purple-400">{staffMembers.length} Active Faculty / Staff Members</strong>
                </div>
              </div>

              {staffMembers.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-slate-500">
                  No staff members registered in the institute yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {staffMembers.map((staff) => {
                    const staffRec = staffAttendanceRecords.find(
                      (r) => (r.userId === staff.id || (r as any).staffId === staff.id) && r.date === attendanceDate
                    );
                    const currentStatus = staffAttendanceState[staff.id] || staffRec?.status;

                    return (
                      <div
                        key={staff.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-850/30 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {staff.photoUrl ? (
                            <img
                              src={staff.photoUrl}
                              alt={staff.fullName}
                              className="w-9 h-9 rounded-xl object-cover border border-purple-500/30 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-purple-955 border border-purple-800 flex items-center justify-center font-black text-purple-300 shrink-0">
                              {staff.fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-extrabold text-white">{staff.fullName}</h4>
                              <span className="text-[9px] font-extrabold uppercase bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-800/60 font-mono">
                                {staff.staffId || 'STF'}
                              </span>
                              {!currentStatus ? (
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                                  Not Marked
                                </span>
                              ) : (
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                  currentStatus === 'present' || currentStatus === 'checked_in'
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                                    : currentStatus === 'absent'
                                    ? 'bg-red-950/60 text-red-400 border-red-900/60'
                                    : currentStatus === 'leave'
                                    ? 'bg-blue-950/60 text-blue-400 border-blue-900/60'
                                    : 'bg-purple-950/60 text-purple-400 border-purple-900/60'
                                }`}>
                                  {currentStatus}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">{staff.position || 'Faculty'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleStaffStatusChange(staff.id, 'present')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              currentStatus === 'present' || currentStatus === 'checked_in'
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                                : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-emerald-800'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStaffStatusChange(staff.id, 'absent')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              currentStatus === 'absent'
                                ? 'bg-red-600 border-red-500 text-white shadow-md'
                                : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-red-800'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStaffStatusChange(staff.id, 'leave')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              currentStatus === 'leave'
                                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                                : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-blue-800'
                            }`}
                          >
                            Leave
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStaffStatusChange(staff.id, 'holiday')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                              currentStatus === 'holiday'
                                ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                                : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-purple-800'
                            }`}
                          >
                            Holiday
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeRoster.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
              <Users className="h-10 w-10 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-extrabold text-white">No Active Students</h3>
              <p className="text-slate-400 text-xs mt-2 font-medium">
                There are no active students enrolled in this batch. Select another batch above.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden space-y-4 p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                <div className="text-xs font-bold text-slate-300">
                  Roster Count: <strong className="text-white">{activeRoster.length} Active Students</strong>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {activeRoster.map((student) => {
                  const currentStatus = attendanceState[student.id];
                  const syncState = rowSyncStatus[student.id];

                  return (
                    <div
                      key={student.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-850/30 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.fullName}
                            className="w-9 h-9 rounded-xl object-cover border border-indigo-500/30 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-indigo-400 shrink-0">
                            {student.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-white">{student.fullName}</h4>

                            {!currentStatus ? (
                              <span className="text-[9px] font-extrabold text-slate-500 uppercase bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                                Not Marked
                              </span>
                            ) : (
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                currentStatus === 'present'
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/60'
                                  : currentStatus === 'absent'
                                  ? 'bg-red-950/60 text-red-400 border-red-900/60'
                                  : currentStatus === 'leave'
                                  ? 'bg-blue-950/60 text-blue-400 border-blue-900/60'
                                  : 'bg-purple-950/60 text-purple-400 border-purple-900/60'
                              }`}>
                                {currentStatus}
                              </span>
                            )}

                            {/* Calendar Overview Icon Button at Extreme Right */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCalendarStudent(student);
                                setModalCalendarDate(new Date());
                              }}
                              className="ml-auto p-1.5 bg-slate-800 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/50 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                              title="Click to view student attendance calendar & percentage overview"
                            >
                              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                              <span className="hidden sm:inline">Calendar</span>
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">{student.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'present')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            currentStatus === 'present'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                              : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-emerald-800'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'absent')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            currentStatus === 'absent'
                              ? 'bg-red-600 border-red-500 text-white shadow-md'
                              : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-red-800'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'leave')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            currentStatus === 'leave'
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                              : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-blue-800'
                          }`}
                        >
                          Leave
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.id, 'holiday')}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            currentStatus === 'holiday'
                              ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                              : 'bg-slate-955 border-slate-800 text-slate-400 hover:border-purple-800'
                          }`}
                        >
                          Holiday
                        </button>

                        {/* Sync status indicator */}
                        {syncState === 'saving' && (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-400 ml-2" />
                        )}
                        {syncState === 'saved' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-2 animate-in zoom-in" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BATCH ATTENDANCE MATRIX & LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Matrix Batch Selector Cards */}
          <div className="space-y-3">
            <span className="text-xs font-extrabold text-white tracking-tight uppercase flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-indigo-400" /> Select Batch for Matrix View
            </span>

            <div className="flex flex-wrap gap-2">
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setMatrixBatchId(b.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    matrixBatchId === b.id
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {b.name} ({b.subject})
                </button>
              ))}
            </div>
          </div>

          {matrixBatchRoster.length === 0 || matrixDates.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs font-bold">
              No historical attendance records logged for this batch yet.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="p-3.5">Student Name</th>
                      {matrixDates.map((dateStr) => (
                        <th key={dateStr} className="p-3.5 text-center">
                          {dateStr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                    {matrixBatchRoster.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3.5 text-white">{student.fullName}</td>
                        {matrixDates.map((dateStr) => {
                          const record = attendanceRecords.find(
                            (r) =>
                              r.batchId === matrixBatchId &&
                              r.studentId === student.id &&
                              r.date === dateStr
                          );
                          const st = record ? record.status : '-';

                          return (
                            <td key={dateStr} className="p-3.5 text-center">
                              {st === 'present' && (
                                <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 text-[9px] font-extrabold rounded">
                                  P
                                </span>
                              )}
                              {st === 'absent' && (
                                <span className="px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-900/60 text-[9px] font-extrabold rounded">
                                  A
                                </span>
                              )}
                              {st === 'leave' && (
                                <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 border border-blue-900/60 text-[9px] font-extrabold rounded">
                                  L
                                </span>
                              )}
                              {st === 'holiday' && (
                                <span className="px-2 py-0.5 bg-purple-950/60 text-purple-400 border border-purple-900/60 text-[9px] font-extrabold rounded">
                                  H
                                </span>
                              )}
                              {st === '-' && <span className="text-slate-600">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Embedded Batch Attendance Summary & Trends Chart (Batch Matrix Tab) */}
          <div className="pt-4">
            <AttendanceSummaryChart
              records={attendanceRecords.filter((r) => !matrixBatchId || r.batchId === matrixBatchId)}
              title="Batch Attendance Summary & Trends"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STAFF CHECK-IN / CHECK-OUT */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">Daily Staff Attendance Log</h3>
              <p className="text-xs text-slate-400 font-medium">
                Record your daily shift check-in and check-out times.
              </p>
              <div className="text-xs text-indigo-400 font-bold pt-1">
                Today's Date: {todayStr}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!todayStaffRecord ? (
                <button
                  onClick={handleStaffCheckIn}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs transition-all shadow-lg cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" /> Check In Now
                </button>
              ) : todayStaffRecord.checkOutTime === null ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-3 py-1.5 rounded-xl">
                    Checked In at {todayStaffRecord.checkInTime}
                  </span>
                  <button
                    onClick={handleStaffCheckOut}
                    disabled={submitting}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-2xl text-xs transition-all shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" /> Check Out
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-4 py-2.5 rounded-2xl">
                  Completed Shift: {todayStaffRecord.checkInTime} - {todayStaffRecord.checkOutTime}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
            <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
              Staff Attendance Activity Log
            </h4>

            {staffAttendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-500">
                No staff attendance records logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-slate-955 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Staff ID / Email</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Check-In Time</th>
                      <th className="p-3">Check-Out Time</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {(() => {
                      const isAdmin = ['owner', 'admin'].includes(role || '');
                      // Deduplicate logs by date + staff identifier
                      const uniqueLogsMap = new Map<string, StaffAttendance>();
                      staffAttendanceRecords.forEach((r) => {
                        const sObj = staffMembers.find((s) => s.id === r.userId || s.firebaseUid === r.userId || (r as any).staffId === s.staffId);
                        
                        // If not admin, only include the logged-in staff user's own records
                        if (!isAdmin && r.userId !== user?.uid && sObj?.firebaseUid !== user?.uid) {
                          return;
                        }

                        const key = `${r.date}_${sObj?.staffId || sObj?.id || r.userId}`;
                        if (!uniqueLogsMap.has(key)) {
                          uniqueLogsMap.set(key, r);
                        }
                      });
                      const logs = Array.from(uniqueLogsMap.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                      return logs.map((r) => {
                        const sObj = staffMembers.find((s) => s.id === r.userId || s.firebaseUid === r.userId || (r as any).staffId === s.staffId);
                        const displayName = sObj ? `${sObj.fullName} (${sObj.staffId || 'STF'})` : (r as any).staffId || r.userId;

                        return (
                          <tr key={r.id} className="hover:bg-slate-850/40">
                            <td className="p-3 font-bold text-indigo-300">{displayName}</td>
                            <td className="p-3 font-mono">{r.date}</td>
                            <td className="p-3 text-emerald-400 font-mono">{r.checkInTime || '-'}</td>
                            <td className="p-3 text-red-400 font-mono">{r.checkOutTime || (r.status === 'checked_in' ? 'Active Shift' : '-')}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-900/60 text-indigo-300 rounded text-[9px] font-extrabold uppercase">
                                {r.status === 'checked_in' ? 'Checked In' : r.status === 'checked_out' ? 'Completed Shift' : r.status}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STUDENT ATTENDANCE CALENDAR & PERCENTAGE OVERVIEW MODAL */}
      {/* ========================================================================= */}
      {selectedCalendarStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-6 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                {selectedCalendarStudent.photoUrl ? (
                  <img
                    src={selectedCalendarStudent.photoUrl}
                    alt={selectedCalendarStudent.fullName}
                    className="w-10 h-10 rounded-2xl object-cover border border-indigo-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-black flex items-center justify-center text-lg shrink-0">
                    {selectedCalendarStudent.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-white">{selectedCalendarStudent.fullName}</h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Student Attendance Calendar & Monthly Overview
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCalendarStudent(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                title="Close Overview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Attendance Percentage & Breakdown Cards */}
            {(() => {
              const yearNum = modalCalendarDate.getFullYear();
              const monthNum = modalCalendarDate.getMonth();
              const monthPrefix = `${yearNum}-${String(monthNum + 1).padStart(2, '0')}`;

              // Filter records for this student and month
              const studentMonthRecords = attendanceRecords.filter((r) => {
                const matchesStudent =
                  r.studentId === selectedCalendarStudent.id ||
                  (selectedCalendarStudent.phone && r.studentId === selectedCalendarStudent.phone);
                return matchesStudent && r.date && r.date.startsWith(monthPrefix);
              });

              const totalMarked = studentMonthRecords.length;
              const pCount = studentMonthRecords.filter((r) => r.status === 'present').length;
              const aCount = studentMonthRecords.filter((r) => r.status === 'absent').length;
              const lCount = studentMonthRecords.filter((r) => r.status === 'leave').length;
              const hCount = studentMonthRecords.filter((r) => r.status === 'holiday').length;

              const pct = totalMarked > 0 ? Math.round(((pCount + hCount + lCount) / totalMarked) * 100) : 0;

              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-955 border border-slate-800 p-3.5 rounded-2xl text-center">
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
                      <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">Leave / Hol</span>
                      <span className="text-xl font-black text-white block mt-0.5">{lCount + hCount}</span>
                    </div>
                  </div>

                  {/* Month Switcher Header */}
                  <div className="flex items-center justify-between bg-slate-955 p-3 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalCalendarDate(new Date(yearNum, monthNum - 1, 1))}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <span className="text-xs font-extrabold text-white tracking-wide">
                      {modalCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalCalendarDate(new Date(yearNum, monthNum + 1, 1))}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Calendar Days Grid */}
                  {(() => {
                    const firstDayObj = new Date(yearNum, monthNum, 1);
                    const daysInM = new Date(yearNum, monthNum + 1, 0).getDate();
                    let startDay = firstDayObj.getDay() - 1;
                    if (startDay === -1) startDay = 6;

                    // Build day map for this month
                    const dayStatusMap: Record<number, string> = {};
                    studentMonthRecords.forEach((r) => {
                      if (r.date) {
                        const dayNum = parseInt(r.date.split('-')[2], 10);
                        dayStatusMap[dayNum] = r.status;
                      }
                    });

                    return (
                      <div className="space-y-2">
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
                            <div key={`empty-${idx}`} className="h-9 rounded-xl bg-slate-955/30" />
                          ))}

                          {Array.from({ length: daysInM }).map((_, idx) => {
                            const day = idx + 1;
                            const st = dayStatusMap[day];

                            let bgClass = 'bg-slate-955 text-slate-500 border border-slate-850';
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
                    );
                  })()}
                </div>
              );
            })()}

            {/* Modal Footer Back Button */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCalendarStudent(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" /> Back to Attendance List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
