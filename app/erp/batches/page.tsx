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
  Layers,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Users,
  Loader2,
  X,
  Search,
  CreditCard,
  MoreVertical,
  ArrowRightLeft,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Download
} from 'lucide-react';
import { generateBulkIdCardsPDF } from '@/lib/id-card-pdf';

interface Batch {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  scheduleDays: string[];
  startTime: string;
  endTime: string;
  capacity: number;
  status?: 'active' | 'closed';
  createdAt?: any;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Student {
  id: string;
  fullName: string;
  rollNumber?: string;
  parentName: string;
  phone: string;
  enrollmentDate?: string;
  status: string;
  batchIds: string[];
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export default function ErpBatches() {
  const { instituteId } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [studentCounts, setStudentCounts] = useState<{ [batchId: string]: number }>({});
  const [loading, setLoading] = useState(true);

  // Active Action Dropdown Open ID
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Form State (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState<number>(30);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Shift Batch Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [sourceBatch, setSourceBatch] = useState<Batch | null>(null);
  const [targetBatchId, setTargetBatchId] = useState('');
  const [shifting, setShifting] = useState(false);

  // Blocked Deletion Warning Modal State
  const [deleteBlockedModalOpen, setDeleteBlockedModalOpen] = useState(false);
  const [blockedBatch, setBlockedBatch] = useState<Batch | null>(null);

  // Batch Roster Report Modal State
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterBatch, setRosterBatch] = useState<Batch | null>(null);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Fetch batches, teachers, and student counts
  useEffect(() => {
    if (!instituteId) return;

    // 1. Listen to batches
    const batchesQuery = collection(db, 'institutes', instituteId, 'batches');
    const unsubscribeBatches = onSnapshot(batchesQuery, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Batch);
      });
      setBatches(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching batches:', err);
      setLoading(false);
    });

    // 2. Fetch staff/teachers
    const teachersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['owner', 'admin', 'teacher', 'staff'])
    );
    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const list: Teacher[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || data.fullName || data.email?.split('@')[0] || 'Unknown',
          email: data.email || '',
          role: data.role || ''
        });
      });
      setTeachers(list);
    });

    // 3. Listen to students to compute batch counts reactively
    const studentsQuery = collection(db, 'institutes', instituteId, 'students');
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const counts: { [batchId: string]: number } = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const batchIds = data.batchIds || [];
        batchIds.forEach((bId: string) => {
          counts[bId] = (counts[bId] || 0) + 1;
        });
      });
      setStudentCounts(counts);
    });

    return () => {
      unsubscribeBatches();
      unsubscribeTeachers();
      unsubscribeStudents();
    };
  }, [instituteId]);

  // Open Modals
  const openCreateModal = () => {
    setEditingBatch(null);
    setName('');
    setSubject('');
    setTeacherId('');
    setScheduleDays([]);
    setStartTime('09:00');
    setEndTime('10:30');
    setCapacity(30);
    setError('');
    setModalOpen(true);
    setOpenMenuId(null);
  };

  const openEditModal = (batch: Batch) => {
    setEditingBatch(batch);
    setName(batch.name);
    setSubject(batch.subject);
    setTeacherId(batch.teacherId);
    setScheduleDays(batch.scheduleDays || []);
    setStartTime(batch.startTime);
    setEndTime(batch.endTime);
    setCapacity(batch.capacity || 30);
    setError('');
    setModalOpen(true);
    setOpenMenuId(null);
  };

  // Toggle Batch Status (Active / Closed)
  const handleToggleCloseBatch = async (batch: Batch) => {
    if (!instituteId) return;
    const newStatus = batch.status === 'closed' ? 'active' : 'closed';
    const actionText = newStatus === 'closed' ? 'close' : 're-open';

    if (!confirm(`Are you sure you want to ${actionText} batch "${batch.name}"?`)) return;

    try {
      const batchDocRef = doc(db, 'institutes', instituteId, 'batches', batch.id);
      await updateDoc(batchDocRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Error toggling batch status:', err);
      alert(`Failed to ${actionText} batch.`);
    }
  };

  // Open Shift Batch Modal
  const openShiftModal = (batch: Batch) => {
    setSourceBatch(batch);
    setTargetBatchId('');
    setShiftModalOpen(true);
    setOpenMenuId(null);
  };

  // Execute Shift Batch (Move all students from sourceBatch to targetBatch)
  const handleExecuteShiftBatch = async () => {
    if (!instituteId || !sourceBatch || !targetBatchId) return;

    if (sourceBatch.id === targetBatchId) {
      alert('Target batch must be different from the current batch.');
      return;
    }

    setShifting(true);

    try {
      // Query all students enrolled in sourceBatch
      const studentsQuery = query(
        collection(db, 'institutes', instituteId, 'students'),
        where('batchIds', 'array-contains', sourceBatch.id)
      );
      const studentSnap = await getDocs(studentsQuery);

      if (studentSnap.empty) {
        alert('There are no students currently enrolled in this batch to shift.');
        setShiftModalOpen(false);
        setShifting(false);
        return;
      }

      const shiftDate = new Date().toISOString();

      const promises = studentSnap.docs.map((studentDoc) => {
        const data = studentDoc.data();
        const existingBatchIds: string[] = data.batchIds || [];
        const existingHistory: any[] = data.batchHistory || [];
        const existingPrevHistory: any[] = data.previousBatches || [];

        const historyEntry = {
          batchId: sourceBatch.id,
          batchIds: [sourceBatch.id],
          batchName: sourceBatch.name,
          shiftedAt: shiftDate,
          leftDate: shiftDate.substring(0, 10),
          joinedDate: data.currentBatchEnrollmentDate || data.enrollmentDate || shiftDate.substring(0, 10),
          enrollmentDate: data.currentBatchEnrollmentDate || data.enrollmentDate || shiftDate.substring(0, 10),
          monthlyFee: Number(data.monthlyFee || data.customFeeAmount || 2000),
          promotedAt: shiftDate
        };

        // Remove source batch ID and add target batch ID if not already present
        const updated = existingBatchIds
          .filter((id) => id !== sourceBatch.id)
          .concat(targetBatchId);

        // Deduplicate
        const uniqueBatchIds = Array.from(new Set(updated));

        return updateDoc(doc(db, 'institutes', instituteId, 'students', studentDoc.id), {
          batchIds: uniqueBatchIds,
          batchHistory: [...existingHistory, historyEntry],
          previousBatches: [...existingPrevHistory, historyEntry],
          currentBatchEnrollmentDate: shiftDate,
          updatedAt: shiftDate
        });
      });

      await Promise.all(promises);

      const targetBatchObj = batches.find((b) => b.id === targetBatchId);
      alert(`Successfully shifted ${studentSnap.docs.length} students from "${sourceBatch.name}" to "${targetBatchObj?.name || 'Target Batch'}"! All historical records are preserved.`);

      setShiftModalOpen(false);
    } catch (err: any) {
      console.error('Error shifting batch students:', err);
      alert('Failed to shift batch students.');
    } finally {
      setShifting(false);
    }
  };

  // Delete Batch Safeguard (Blocked if students or history records exist)
  const handleDeleteBatch = async (batch: Batch) => {
    if (!instituteId) return;
    setOpenMenuId(null);

    const count = studentCounts[batch.id] || 0;

    // 1. Check if any student currently enrolled
    if (count > 0) {
      setBlockedBatch(batch);
      setDeleteBlockedModalOpen(true);
      return;
    }

    // 2. Check if attendance or exam history records exist for this batch
    const attSnap = await getDocs(
      query(
        collection(db, 'institutes', instituteId, 'attendanceRecords'),
        where('batchId', '==', batch.id)
      )
    );

    const examSnap = await getDocs(
      query(
        collection(db, 'institutes', instituteId, 'exams'),
        where('batchId', '==', batch.id)
      )
    );

    if (!attSnap.empty || !examSnap.empty) {
      setBlockedBatch(batch);
      setDeleteBlockedModalOpen(true);
      return;
    }

    // 3. Only if count === 0 and zero history exists, allow deletion
    if (!confirm(`Are you sure you want to permanently delete batch "${batch.name}"? This action cannot be undone.`)) return;

    try {
      const batchDocRef = doc(db, 'institutes', instituteId, 'batches', batch.id);
      await deleteDoc(batchDocRef);
    } catch (err: any) {
      console.error('Error deleting batch:', err);
      alert('Failed to delete batch.');
    }
  };

  // Open Batch Assigned Students Report Modal
  const openRosterReportModal = async (batch: Batch) => {
    if (!instituteId) return;
    setRosterBatch(batch);
    setLoadingRoster(true);
    setRosterModalOpen(true);
    setOpenMenuId(null);

    try {
      const snap = await getDocs(
        query(
          collection(db, 'institutes', instituteId, 'students'),
          where('batchIds', 'array-contains', batch.id)
        )
      );

      const list: Student[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Student);
      });
      setRosterStudents(list);
    } catch (err) {
      console.error('Error loading batch roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Download Roster Report CSV
  const downloadRosterCSV = () => {
    if (!rosterBatch || rosterStudents.length === 0) return;

    const headers = ['Roll Number', 'Full Name', 'Parent Name', 'Phone / WhatsApp', 'Status', 'Enrollment Date'];
    const rows = rosterStudents.map((s) => [
      s.rollNumber || '',
      s.fullName || '',
      s.parentName || '',
      s.phone || '',
      s.status || 'active',
      s.enrollmentDate || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${rosterBatch.name.replace(/\s+/g, '_')}_Assigned_Students.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleDay = (day: string) => {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter((d) => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (!name || !subject || !teacherId || scheduleDays.length === 0 || !startTime || !endTime) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const batchPayload = {
        name,
        subject,
        teacherId,
        scheduleDays,
        startTime,
        endTime,
        capacity: Number(capacity),
        status: editingBatch?.status || 'active',
        updatedAt: new Date().toISOString()
      };

      if (editingBatch) {
        const batchDocRef = doc(db, 'institutes', instituteId, 'batches', editingBatch.id);
        await updateDoc(batchDocRef, batchPayload);
      } else {
        const batchesColRef = collection(db, 'institutes', instituteId, 'batches');
        await addDoc(batchesColRef, {
          ...batchPayload,
          createdAt: new Date().toISOString()
        });
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Error saving batch:', err);
      setError(err.message || 'Failed to save batch.');
    } finally {
      setSubmitting(false);
    }
  };

  const getTeacherName = (tId: string) => {
    const teacher = teachers.find((t) => t.id === tId);
    return teacher ? teacher.name : 'Unassigned';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Batches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Batches</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Define subjects, schedules, class capacities, assign teachers, and manage batch action menus.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          Create Batch
        </button>
      </div>

      {/* Batches Grid */}
      {batches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto mt-10">
          <Layers className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-extrabold text-white">No Batches Yet</h3>
          <p className="text-slate-400 text-xs mt-2 font-medium">
            Create your first batch to start organizing students and scheduling classes.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create First Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => {
            const count = studentCounts[batch.id] || 0;
            const isClosed = batch.status === 'closed';

            return (
              <div
                key={batch.id}
                className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700/80 transition-all group duration-300 relative overflow-visible ${
                  isClosed ? 'border-amber-900/40 bg-slate-950/60' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between relative">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                          {batch.subject}
                        </span>
                        {isClosed && (
                          <span className="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800 text-[9px] font-black rounded uppercase tracking-wider">
                            CLOSED
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                        {batch.name}
                      </h3>
                    </div>

                    {/* "⋮" ACTION MENU BUTTON */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === batch.id ? null : batch.id)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        title="Batch Actions Menu"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>

                      {/* DROPDOWN MENU */}
                      {openMenuId === batch.id && (
                        <div className="absolute right-0 top-10 z-30 w-56 bg-slate-955 border border-slate-800 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            onClick={() => openEditModal(batch)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4 text-indigo-400" /> Edit Batch Details
                          </button>

                          <button
                            onClick={() => handleToggleCloseBatch(batch)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-950/40 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Lock className="h-4 w-4" /> {isClosed ? 'Re-open Batch' : 'Close Batch (Mark Inactive)'}
                          </button>

                          <button
                            onClick={() => openShiftModal(batch)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <ArrowRightLeft className="h-4 w-4 text-purple-400" /> Shift Students to Another Batch
                          </button>

                          <button
                            onClick={() => openRosterReportModal(batch)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Batch Assigned Students Report
                          </button>

                          <div className="border-t border-slate-850 my-1"></div>

                          <button
                            onClick={() => handleDeleteBatch(batch)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/30 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Batch
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-3.5">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-350">
                      <Calendar className="h-4 w-4 text-indigo-450 shrink-0" />
                      <span className="truncate">
                        {batch.scheduleDays && batch.scheduleDays.length > 0
                          ? batch.scheduleDays.join(', ')
                          : 'No days set'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-350">
                      <Clock className="h-4 w-4 text-indigo-450 shrink-0" />
                      <span>
                        {batch.startTime} - {batch.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-350">
                      <Users className="h-4 w-4 text-indigo-450 shrink-0" />
                      <span>
                        Enrolled: <strong className="text-white">{count}</strong> / {batch.capacity} Students
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Teacher</span>
                    <span className="font-bold text-slate-200">{getTeacherName(batch.teacherId)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const snap = await getDocs(
                        query(
                          collection(db, 'institutes', instituteId!, 'students'),
                          where('batchIds', 'array-contains', batch.id),
                          where('status', '==', 'active')
                        )
                      );
                      const batchStudents: any[] = [];
                      snap.forEach((d) => batchStudents.push({ id: d.id, ...d.data() }));

                      if (batchStudents.length === 0) {
                        alert('No active students enrolled in this batch.');
                        return;
                      }

                      await generateBulkIdCardsPDF(batchStudents, batches, batch.name);
                    }}
                    className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer"
                    title="Download ID Cards for all enrolled students in this batch"
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Batch ID Cards
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SHIFT BATCH MODAL */}
      {shiftModalOpen && sourceBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl space-y-5">
            <button
              onClick={() => setShiftModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
                <ArrowRightLeft className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Shift Students to Another Batch</h2>
                <p className="text-slate-400 text-xs font-semibold">Bulk move students while preserving full history.</p>
              </div>
            </div>

            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs font-bold text-slate-300">
              <p>
                Source Batch: <strong className="text-indigo-400">{sourceBatch.name}</strong> ({studentCounts[sourceBatch.id] || 0} enrolled students)
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                This will move all currently enrolled students from <strong className="text-white">{sourceBatch.name}</strong> to the selected target batch. Their attendance and fee history under {sourceBatch.name} will remain 100% intact.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                Select Target Batch *
              </label>
              <select
                value={targetBatchId}
                onChange={(e) => setTargetBatchId(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Select destination batch...</option>
                {batches
                  .filter((b) => b.id !== sourceBatch.id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject}) - {studentCounts[b.id] || 0} Students
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-2xl text-xs font-bold cursor-pointer hover:bg-slate-850"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteShiftBatch}
                disabled={shifting || !targetBatchId}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl text-xs font-extrabold disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {shifting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Execute Shift Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCKED DELETION WARNING MODAL */}
      {deleteBlockedModalOpen && blockedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-900/60 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-red-950/60 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Cannot Delete Batch</h2>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                Deletion is blocked to safeguard data integrity and student history.
              </p>
            </div>

            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl text-left space-y-2 text-xs font-medium text-slate-300">
              <p className="font-extrabold text-red-400">Why was deletion blocked?</p>
              <p>
                Batch <strong className="text-white">{blockedBatch.name}</strong> has active/past student enrollments or recorded attendance & exam logs.
              </p>
              <p className="text-slate-400">
                To preserve historical records, please use <strong className="text-amber-400">"Close Batch"</strong> to mark it inactive instead of deleting it.
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setDeleteBlockedModalOpen(false)}
                className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-2xl text-xs font-bold cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteBlockedModalOpen(false);
                  handleToggleCloseBatch(blockedBatch);
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer"
              >
                Close Batch Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH ASSIGNED STUDENTS ROSTER REPORT MODAL */}
      {rosterModalOpen && rosterBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <button
              onClick={() => setRosterModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white">Batch Assigned Students Roster</h2>
                <p className="text-xs text-indigo-400 font-bold">{rosterBatch.name} ({rosterStudents.length} Students Enrolled)</p>
              </div>

              <button
                onClick={downloadRosterCSV}
                disabled={rosterStudents.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV Roster
              </button>
            </div>

            {loadingRoster ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                <p className="text-xs font-bold">Loading Roster...</p>
              </div>
            ) : rosterStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic text-xs font-bold bg-slate-955 rounded-2xl">
                No students currently enrolled in this batch.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-2xl border border-slate-850">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-slate-955 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-3">Roll No</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Parent Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-200">
                      {rosterStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-850/50">
                          <td className="p-3 font-mono text-indigo-400">{s.rollNumber || '-'}</td>
                          <td className="p-3 font-extrabold text-white">{s.fullName}</td>
                          <td className="p-3 text-slate-400">{s.parentName}</td>
                          <td className="p-3 text-slate-300">{s.phone}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[9px] font-extrabold rounded uppercase">
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT BATCH MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-6">
              {editingBatch ? 'Edit Batch' : 'Create New Batch'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs sm:text-sm p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Batch Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                  placeholder="e.g. Physics Grade 12 - Advanced"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                  placeholder="e.g. Physics"
                />
              </div>

              {/* Teacher Assign */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Assign Teacher *
                </label>
                <select
                  required
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3.5 px-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                >
                  <option value="">Select a teacher...</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} ({teacher.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Schedule Days */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Schedule Days * (Select at least one)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const selected = scheduleDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => handleToggleDay(day)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          selected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-955 border-slate-850 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time & Capacity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-slate-800/80 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-955 hover:bg-slate-850 text-slate-300 border border-slate-800 font-bold py-3.5 rounded-2xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Batch'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
