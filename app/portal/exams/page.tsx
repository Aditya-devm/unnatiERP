'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Lock, X, Plus, Edit2, Trash2, Save, Calendar, Award, Users, Search, CheckCircle2, Clock, FileText, Layers } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Student {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  batchIds: string[];
}

interface Batch {
  id: string;
  name: string;
  subject: string;
}

interface Exam {
  id: string;
  name: string;
  batchId: string;
  examDate: string;
  maxMarks: number;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  chapters?: string[];
  instructions?: string;
  type?: string;
}

interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

function getSubjectIcon(subject?: string): string {
  if (!subject) return 'menu_book';
  const lower = subject.toLowerCase();
  if (lower.includes('data') || lower.includes('database') || lower.includes('sql')) return 'database';
  if (lower.includes('math') || lower.includes('algebra') || lower.includes('geometry')) return 'calculate';
  if (lower.includes('physic') || lower.includes('chem') || lower.includes('bio') || lower.includes('sci')) return 'science';
  if (lower.includes('code') || lower.includes('program') || lower.includes('comp')) return 'code';
  return 'menu_book';
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return 'NOV 24, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  if (!dateStr) return 'Oct 12, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function getGradeLabel(pct: number): string {
  if (pct >= 90) return 'Grade A';
  if (pct >= 80) return 'Grade B';
  if (pct >= 70) return 'Grade C';
  if (pct >= 60) return 'Grade D';
  return 'Grade F';
}

function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (trimmed.toLowerCase().includes('am') || trimmed.toLowerCase().includes('pm')) {
    return trimmed;
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2);
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

function formatExamTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime && !endTime) return '10:00 AM - 11:30 AM';
  const start = formatTimeDisplay(startTime);
  const end = formatTimeDisplay(endTime);
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return '10:00 AM - 11:30 AM';
}

function parseExamDateTimeRange(
  examDateStr?: string,
  startTimeStr?: string,
  endTimeStr?: string,
  durationMins?: number
) {
  if (!examDateStr) return { start: null, end: null };

  const partsDate = examDateStr.split('-').map(Number);
  if (partsDate.length < 3 || partsDate.some(isNaN)) return { start: null, end: null };
  const [year, month, day] = partsDate;

  let startHours = 10;
  let startMins = 0;

  if (startTimeStr) {
    const trimmed = startTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      startHours = parts[0];
      if (isPM && startHours < 12) startHours += 12;
      if (isAM && startHours === 12) startHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) startMins = parts[1];
    }
  }

  const startDate = new Date(year, month - 1, day, startHours, startMins, 0);

  let endDate: Date;
  if (endTimeStr) {
    let endHours = 11;
    let endMins = 30;
    const trimmed = endTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      endHours = parts[0];
      if (isPM && endHours < 12) endHours += 12;
      if (isAM && endHours === 12) endHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) endMins = parts[1];
    }
    endDate = new Date(year, month - 1, day, endHours, endMins, 0);
  } else {
    const duration = durationMins && durationMins > 0 ? durationMins : 90;
    endDate = new Date(startDate.getTime() + duration * 60000);
  }

  return { start: startDate, end: endDate };
}

function getRemainingTimeText(endDate: Date | null): string {
  if (!endDate) return 'Ending Soon';
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return '0m left';
  const totalMins = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }
  return `${mins}m left`;
}

function getScoreColorConfig(percentage: number) {
  if (percentage <= 33) {
    return {
      textClass: 'text-red-400',
      bgClass: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
    };
  } else if (percentage <= 80) {
    return {
      textClass: 'text-yellow-400',
      bgClass: 'bg-yellow-500 shadow-[0_0_8px_#eab308]',
    };
  } else {
    return {
      textClass: 'text-emerald-400',
      bgClass: 'bg-emerald-500 shadow-[0_0_8px_#22c55e]',
    };
  }
}

function PortalExamsContent() {
  const searchParams = useSearchParams();
  const highlightExamId = searchParams.get('highlightExamId');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightExamId);

  const { user, role, instituteId, loading: authLoading, hasPermission } = useAuth();
  const isStaff = ['owner', 'admin', 'teacher', 'staff'].includes(role || '');
  const [student, setStudent] = useState<Student | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Staff Create Exam State
  const [createExamModalOpen, setCreateExamModalOpen] = useState(false);
  const [examName, setExamName] = useState('');
  const [examBatchId, setExamBatchId] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().substring(0, 10));
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [submittingExam, setSubmittingExam] = useState(false);

  // Staff Admin Interface State
  const [staffUserData, setStaffUserData] = useState<any>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [staffSelectedBatch, setStaffSelectedBatch] = useState<string>('ALL');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  // Mark Entry State
  const [markEntryExamId, setMarkEntryExamId] = useState<string>('');
  const [marksState, setMarksState] = useState<Record<string, number | ''>>({});
  const [existingResultIds, setExistingResultIds] = useState<Record<string, string>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksSuccess, setMarksSuccess] = useState(false);
  // Enhanced create/edit fields
  const [examStartTime, setExamStartTime] = useState('10:00');
  const [examEndTime, setExamEndTime] = useState('11:30');
  const [examChapters, setExamChapters] = useState<string[]>([]);
  const [examChapterInput, setExamChapterInput] = useState('');
  const [examInstructions, setExamInstructions] = useState('');

  const handleCreateOrEditExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !examBatchId || !examName) return;

    setSubmittingExam(true);
    try {
      const payload = {
        name: examName.trim(),
        batchId: examBatchId,
        subject: examSubject.trim() || 'General',
        examDate,
        maxMarks: Number(maxMarks),
        durationMinutes: Number(durationMinutes),
        startTime: examStartTime || '10:00',
        endTime: examEndTime || '11:30',
        chapters: examChapters,
        instructions: examInstructions.trim(),
        createdBy: user?.uid || 'staff',
        updatedAt: new Date().toISOString()
      };

      if (editingExam) {
        await updateDoc(doc(db, 'institutes', instituteId, 'exams', editingExam.id), payload);
      } else {
        await addDoc(collection(db, 'institutes', instituteId, 'exams'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      setCreateExamModalOpen(false);
      setEditingExam(null);
      setExamName('');
      setExamChapters([]);
      setExamInstructions('');
    } catch (err) {
      console.error('Error saving exam:', err);
      alert('Failed to save exam.');
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleOpenEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setExamName(exam.name);
    setExamBatchId(exam.batchId);
    setExamSubject(batches.find(b => b.id === exam.batchId)?.subject || '');
    setExamDate(exam.examDate || new Date().toISOString().substring(0, 10));
    setMaxMarks(exam.maxMarks || 100);
    setDurationMinutes(exam.durationMinutes || 60);
    setExamStartTime(exam.startTime || '10:00');
    setExamEndTime(exam.endTime || '11:30');
    setExamChapters(exam.chapters || []);
    setExamInstructions(exam.instructions || '');
    setCreateExamModalOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    if (!instituteId) return;
    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'exams', examId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting exam:', err);
      alert('Failed to delete exam.');
    }
  };

  // Staff: Fetch user data for batchIds
  useEffect(() => {
    if (!user || !isStaff) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setStaffUserData(snap.data());
    });
    return () => unsub();
  }, [user, isStaff]);

  // Staff: Load students list
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  useEffect(() => {
    if (!instituteId || !isStaff) return;
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsub = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, fullName: data.fullName || 'Unknown', email: data.email, phone: data.phone, batchIds: data.batchIds || [] });
      });
      setAllStudents(list);
    });
    return () => unsub();
  }, [instituteId, isStaff]);

  // Staff: Pre-fill marks when selecting an exam for mark entry
  useEffect(() => {
    if (!markEntryExamId) return;
    const newMarks: Record<string, number | ''> = {};
    const newIds: Record<string, string> = {};
    results.forEach((r) => {
      if (r.examId === markEntryExamId) {
        newMarks[r.studentId] = r.marksObtained;
        newIds[r.studentId] = r.id;
      }
    });
    setMarksState(newMarks);
    setExistingResultIds(newIds);
  }, [markEntryExamId, results]);

  const handleSaveMarks = async () => {
    if (!instituteId || !markEntryExamId) return;
    const selectedExam = exams.find(e => e.id === markEntryExamId);
    if (!selectedExam) return;

    setSavingMarks(true);
    try {
      const entries = Object.entries(marksState).filter(([, v]) => v !== '' && v !== undefined);
      await Promise.all(
        entries.map(async ([studentId, marks]) => {
          const numMarks = Number(marks);
          const pct = selectedExam.maxMarks > 0 ? Math.round((numMarks / selectedExam.maxMarks) * 100) : 0;
          const payload = {
            examId: markEntryExamId,
            studentId,
            marksObtained: numMarks,
            maxMarks: selectedExam.maxMarks,
            percentage: pct,
            updatedAt: new Date().toISOString()
          };

          if (existingResultIds[studentId]) {
            await updateDoc(doc(db, 'institutes', instituteId, 'examResults', existingResultIds[studentId]), payload);
          } else {
            await addDoc(collection(db, 'institutes', instituteId, 'examResults'), {
              ...payload,
              createdAt: new Date().toISOString()
            });
          }
        })
      );
      setMarksSuccess(true);
      setTimeout(() => setMarksSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving marks:', err);
      alert('Failed to save marks.');
    } finally {
      setSavingMarks(false);
    }
  };

  // Staff batches (allotted only)
  const staffBatchIds = staffUserData?.batchIds || [];
  const staffBatches = batches.filter(b => staffBatchIds.includes(b.id));

  useEffect(() => {
    if (highlightExamId) {
      setActiveHighlightId(highlightExamId);
      const timerScroll = setTimeout(() => {
        const el = document.getElementById(`past-card-${highlightExamId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);

      // Highlight animation lasts exactly 2 seconds (2000ms)
      const timerClear = setTimeout(() => {
        setActiveHighlightId(null);
      }, 2000);

      return () => {
        clearTimeout(timerScroll);
        clearTimeout(timerClear);
      };
    }
  }, [highlightExamId]);

  // Mark all published results as seen for this student when they visit the Exams section
  useEffect(() => {
    if (student?.id && results.length > 0) {
      try {
        const studentResults = results.filter(
          (r) => r.studentId === student.id || r.studentId === user?.uid
        );
        const studentResultIds = studentResults.map((r) => r.id);
        if (studentResultIds.length > 0) {
          const stored = localStorage.getItem(`seen_results_${student.id}`);
          const existing: string[] = stored ? JSON.parse(stored) : [];
          const merged = Array.from(new Set([...existing, ...studentResultIds]));
          localStorage.setItem(`seen_results_${student.id}`, JSON.stringify(merged));
        }
      } catch (err) {
        console.error('Error marking results as seen:', err);
      }
    }
  }, [student, results, user]);

  useEffect(() => {
    if (!instituteId || !user) return;

    // 1. Fetch Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Batch));
      setBatches(list);
    });

    // 2. Resolve Student Profile
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

    // 3. Fetch Exams
    const examsCol = collection(db, 'institutes', instituteId, 'exams');
    const unsubExams = onSnapshot(examsCol, (snapshot) => {
      const list: Exam[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Exam));
      setExams(list);
    });

    // 4. Fetch Exam Results
    const resultsCol = collection(db, 'institutes', instituteId, 'examResults');
    const unsubResults = onSnapshot(resultsCol, (snapshot) => {
      const list: ExamResult[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as ExamResult));
      setResults(list);
      setLoading(false);
    });

    return () => {
      unsubBatches();
      unsubStudents();
      unsubExams();
      unsubResults();
    };
  }, [instituteId, user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!hasPermission('canViewExamResults')) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 flex items-center justify-center font-body-md">
        <div className="bg-surface-container border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <Lock className="h-10 w-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-black text-white">Exam Results Disabled</h2>
          <p className="text-on-surface-variant text-xs font-semibold">
            Exam results viewing has been turned OFF for student accounts by your Institute Owner.
          </p>
          <Link href="/portal" className="inline-block bg-primary-container text-white font-bold py-2.5 px-5 rounded-xl text-xs">
            Back to Portal
          </Link>
        </div>
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1326] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      </div>
    );
  }

  // ============================
  // STAFF ADMIN INTERFACE
  // ============================
  if (isStaff) {
    const filteredExams = exams
      .filter(e => staffBatchIds.includes(e.batchId))
      .filter(e => staffSelectedBatch === 'ALL' || e.batchId === staffSelectedBatch)
      .filter(e => !staffSearchQuery || e.name.toLowerCase().includes(staffSearchQuery.toLowerCase()))
      .sort((a, b) => (b.examDate || '').localeCompare(a.examDate || ''));

    const markEntryExam = exams.find(e => e.id === markEntryExamId);
    const markEntryStudents = markEntryExam
      ? allStudents.filter(s => s.batchIds?.includes(markEntryExam.batchId) && (!(s as any).status || (s as any).status === 'active'))
      : [];

    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-4 pt-4 md:pt-5 pb-8 md:px-6 font-body-md max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="p-2.5 bg-surface-container border border-white/10 hover:bg-white/5 rounded-2xl text-on-surface-variant hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Exam Management</h1>
              <p className="text-on-surface-variant text-xs">Create exams, enter marks, and manage assessments for your batches.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingExam(null);
              setExamName('');
              setExamBatchId(staffBatches.length > 0 ? staffBatches[0].id : '');
              setExamSubject(staffBatches.length > 0 ? staffBatches[0].subject : '');
              setExamDate(new Date().toISOString().substring(0, 10));
              setMaxMarks(100);
              setDurationMinutes(60);
              setExamStartTime('10:00');
              setExamEndTime('11:30');
              setExamChapters([]);
              setExamInstructions('');
              setCreateExamModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Create Exam
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={staffSelectedBatch}
            onChange={(e) => setStaffSelectedBatch(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs font-bold"
          >
            <option value="ALL">All My Batches</option>
            {staffBatches.map(b => (
              <option key={b.id} value={b.id}>{b.name} — {b.subject}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search exams..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-xs"
            />
          </div>
        </div>

        {/* Exam Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-indigo-400" /> Exams ({filteredExams.length})
            </h2>
          </div>

          {filteredExams.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-bold">
              No exams found. Click &quot;Create Exam&quot; to add one.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredExams.map((exam) => {
                const batch = batches.find(b => b.id === exam.batchId);
                const resultCount = results.filter(r => r.examId === exam.id).length;
                const batchStudentCount = allStudents.filter(s => s.batchIds?.includes(exam.batchId)).length;

                return (
                  <div key={exam.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-extrabold text-white">{exam.name}</h3>
                        <span className="text-[9px] font-extrabold uppercase bg-indigo-950/60 text-indigo-400 px-2 py-0.5 rounded border border-indigo-800/50">
                          {batch?.name || 'Unknown Batch'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {exam.examDate || 'No Date'}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.startTime || '10:00'} - {exam.endTime || '11:30'}</span>
                        <span>Max: {exam.maxMarks} marks</span>
                        <span>{exam.durationMinutes || 60} min</span>
                        <span className="text-emerald-400">{resultCount}/{batchStudentCount} results</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setMarkEntryExamId(exam.id); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 text-[10px] font-bold hover:bg-emerald-900/50 cursor-pointer transition-all"
                      >
                        Enter Marks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditExam(exam)}
                        className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(exam.id)}
                        className="p-1.5 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 hover:text-red-300 cursor-pointer transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mark Entry Section */}
        {markEntryExamId && markEntryExam && (
          <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Mark Entry — {markEntryExam.name}
                <span className="text-[10px] text-slate-400 font-medium ml-2">Max Marks: {markEntryExam.maxMarks}</span>
              </h2>
              <div className="flex items-center gap-2">
                {marksSuccess && (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={savingMarks}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {savingMarks ? 'Saving...' : 'Save Marks'}
                </button>
                <button
                  type="button"
                  onClick={() => setMarkEntryExamId('')}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {markEntryStudents.length === 0 ? (
              <div className="text-center text-slate-500 text-xs font-bold py-6">No students enrolled in this batch.</div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {markEntryStudents.map((st, idx) => (
                  <div key={st.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-mono w-6">{idx + 1}.</span>
                      <span className="text-sm font-bold text-white">{st.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={markEntryExam.maxMarks}
                        value={marksState[st.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setMarksState(prev => ({ ...prev, [st.id]: val }));
                        }}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs text-center"
                        placeholder="—"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">/ {markEntryExam.maxMarks}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Exam Modal */}
        {createExamModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#121929] border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">{editingExam ? 'Edit Exam' : 'Create New Exam'}</h3>
                <button onClick={() => { setCreateExamModalOpen(false); setEditingExam(null); }} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateOrEditExam} className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Exam Name *</label>
                  <input type="text" required value={examName} onChange={(e) => setExamName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="Unit Test 1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Batch *</label>
                    <select required value={examBatchId} onChange={(e) => { setExamBatchId(e.target.value); setExamSubject(staffBatches.find(b => b.id === e.target.value)?.subject || ''); }} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs">
                      <option value="">Select Batch</option>
                      {staffBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Exam Date *</label>
                    <input type="date" required value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Max Marks *</label>
                    <input type="number" required min={1} value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Start Time</label>
                    <input type="time" value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">End Time</label>
                    <input type="time" value={examEndTime} onChange={(e) => setExamEndTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Duration (Minutes)</label>
                  <input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Chapters</label>
                  <div className="flex gap-2">
                    <input type="text" value={examChapterInput} onChange={(e) => setExamChapterInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (examChapterInput.trim()) { setExamChapters(prev => [...prev, examChapterInput.trim()]); setExamChapterInput(''); } } }} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="Type chapter name + Enter" />
                  </div>
                  {examChapters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {examChapters.map((ch, i) => (
                        <span key={i} className="bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-800/50 flex items-center gap-1">
                          {ch}
                          <button type="button" onClick={() => setExamChapters(prev => prev.filter((_, j) => j !== i))} className="text-indigo-400 hover:text-white cursor-pointer"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Instructions</label>
                  <textarea value={examInstructions} onChange={(e) => setExamInstructions(e.target.value)} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs resize-none" placeholder="Exam instructions for students..." />
                </div>
                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => { setCreateExamModalOpen(false); setEditingExam(null); }} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={submittingExam} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                    {submittingExam ? 'Saving...' : editingExam ? 'Update Exam' : 'Create Exam'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#121929] border border-red-900/50 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-black text-white">Delete Exam?</h3>
              <p className="text-slate-400 text-xs">This action cannot be undone. All associated results will remain but the exam will be removed.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button type="button" onClick={() => handleDeleteExam(deleteConfirmId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filter student exams
  const studentBatchIds = student?.batchIds || [];
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  // All exams for student's enrolled batches
  const studentExams = exams.filter(
    (e) => studentBatchIds.length === 0 || studentBatchIds.includes(e.batchId)
  );

  // Completed exam results for this student
  const studentResults = results.filter(
    (r) => student && (r.studentId === student.id || r.studentId === user?.uid)
  );

  // Categorize exams: Ongoing vs Upcoming vs Past Exams without results
  const ongoingExams: Exam[] = [];
  const upcomingExams: Exam[] = [];
  const pastExamsWithoutResult: Exam[] = [];

  studentExams.forEach((e) => {
    const hasResult = studentResults.some((r) => r.examId === e.id);
    const { start, end } = parseExamDateTimeRange(e.examDate, e.startTime, e.endTime, e.durationMinutes);

    if (start && end) {
      if (now >= start && now <= end) {
        if (!hasResult) ongoingExams.push(e);
      } else if (now < start) {
        if (!hasResult) upcomingExams.push(e);
      } else {
        if (!hasResult) pastExamsWithoutResult.push(e);
      }
    } else {
      if (!e.examDate || e.examDate > todayStr) {
        if (!hasResult) upcomingExams.push(e);
      } else if (e.examDate === todayStr) {
        if (!hasResult) ongoingExams.push(e);
      } else {
        if (!hasResult) pastExamsWithoutResult.push(e);
      }
    }
  });

  // Past Performance items:
  // 1) Exams with published results
  // 2) Exams whose date/time has passed BUT no marks result uploaded yet ("Coming Soon")
  interface PastItem {
    id: string;
    exam: Exam;
    result?: ExamResult;
    isComingSoon: boolean;
  }

  const pastItems: PastItem[] = [];

  // Add published results
  studentResults.forEach((r) => {
    const examObj = exams.find((e) => e.id === r.examId);
    if (examObj) {
      pastItems.push({
        id: r.id,
        exam: examObj,
        result: r,
        isComingSoon: false,
      });
    }
  });

  // Add past exams without uploaded result
  pastExamsWithoutResult.forEach((e) => {
    pastItems.push({
      id: `coming-soon-${e.id}`,
      exam: e,
      result: undefined,
      isComingSoon: true,
    });
  });

  // Sort past performance items by exam date descending
  pastItems.sort((a, b) => (b.exam.examDate || '').localeCompare(a.exam.examDate || ''));

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-4 pt-4 md:pt-5 pb-8 md:px-margin-desktop font-body-md max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/portal"
            className="p-2.5 bg-surface-container border border-white/10 hover:bg-white/5 rounded-2xl text-on-surface-variant hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black font-title-md text-white tracking-tight">Exams & Assessments</h1>
            <p className="text-on-surface-variant text-xs">View upcoming tests, syllabus, instructions, and past performance.</p>
          </div>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => {
              if (batches.length > 0) {
                setExamBatchId(batches[0].id);
                setExamSubject(batches[0].subject || 'General');
              }
              setCreateExamModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95 ml-auto"
          >
            <Plus className="h-4 w-4" /> Add Exam
          </button>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-primary-container text-white text-xs font-bold p-4 rounded-xl shadow-lg border border-white/20 flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Layout with Ongoing Tests (if active), Upcoming Tests, & Past Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg pb-12">
        {/* ONGOING EXAMS SECTION (Rendered ONLY if an exam is currently ongoing) */}
        {ongoingExams.length > 0 && (
          <section className="lg:col-span-12 mb-2 bg-emerald-950/20 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="font-black font-title-md text-xl md:text-2xl text-emerald-400 tracking-tight">
                Ongoing Tests & Assessments
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ongoingExams.map((exam) => {
                const batch = batches.find((b) => b.id === exam.batchId);
                const subject = batch?.subject || batch?.name || 'Subject';
                const subjectIcon = getSubjectIcon(subject);
                const timeRange = formatExamTimeRange(exam.startTime, exam.endTime);
                const { end } = parseExamDateTimeRange(exam.examDate, exam.startTime, exam.endTime, exam.durationMinutes);
                const timeLeftStr = getRemainingTimeText(end);

                return (
                  <div
                    key={exam.id}
                    className="glass-card p-5 rounded-2xl border border-emerald-500/50 bg-[#121929] flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                          <span className="material-symbols-outlined">{subjectIcon}</span>
                        </div>
                        <div>
                          <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">{subject}</p>
                          <h4 className="font-bold text-white text-lg mt-0.5">{exam.name}</h4>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-rose-950/50 border border-rose-500/50 text-rose-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 animate-pulse">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {timeLeftStr}
                      </div>
                    </div>

                    <div className="border-t border-emerald-500/20 pt-3 text-xs text-slate-300 font-semibold">
                      {formatFullDate(exam.examDate)} • {timeRange}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Left Section: Upcoming Tests */}
        <section className="lg:col-span-8">
          <div className="mb-5 md:mb-6 space-y-1.5 w-fit">
            <h2 className="font-black font-title-md text-xl md:text-2xl text-on-surface tracking-tight">
              Upcoming Tests
            </h2>
            <div className="relative w-full h-1 rounded-full overflow-hidden">
              <div className="animate-running-line" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {upcomingExams.length === 0 ? (
              <div className="glass-card p-6 rounded-xl text-center text-on-surface-variant text-xs space-y-2 col-span-full">
                <p className="font-bold text-white">No Upcoming Tests</p>
                <p>There are no upcoming tests scheduled for your enrolled batches.</p>
              </div>
            ) : (
              upcomingExams.map((exam) => {
                const batch = batches.find((b) => b.id === exam.batchId);
                const subject = batch?.subject || batch?.name || 'General';
                const subjectIcon = getSubjectIcon(subject);
                const formattedDate = formatShortDate(exam.examDate);
                const timeDisplay = formatExamTimeRange(exam.startTime, exam.endTime);
                const chapterSummary = exam.chapters && exam.chapters.length > 0 
                  ? exam.chapters.join(', ') 
                  : 'Full Syllabus';

                return (
                  <div
                    key={exam.id}
                    className="glass-card p-6 rounded-2xl flex flex-col gap-5 group hover:-translate-y-2 hover:shadow-[0_15px_40px_-10px_rgba(59,130,246,0.35)] hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden"
                  >
                    {/* Backward Uplift Glow Backdrop */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                        <span className="material-symbols-outlined text-2xl">{subjectIcon}</span>
                      </div>
                      <span className="px-3 py-1 bg-surface-variant text-on-surface-variant rounded-full font-label-md text-xs font-bold border border-white/5">
                        {exam.type || 'Theory'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-xl md:text-2xl text-blue-400 font-title-md tracking-tight group-hover:text-blue-300 transition-colors">
                        {exam.name}
                      </h4>
                      <p className="font-body-md text-body-md text-on-surface-variant line-clamp-1 mt-1.5">{chapterSummary}</p>
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-auto flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-black text-base text-secondary tracking-wide uppercase">{formattedDate}</span>
                        <span className="font-body-md text-xs text-on-surface-variant font-medium mt-0.5">{timeDisplay}</span>
                      </div>
                      <Link
                        href={`/portal/exams/${exam.id}`}
                        aria-label="Open Test Details"
                        className="relative w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group/btn group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:border-blue-400 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-300 transform group-hover:scale-105 active:scale-95 overflow-hidden"
                      >
                        <span className="absolute inset-0 rounded-xl bg-blue-400/20 opacity-0 group-hover/btn:animate-ping pointer-events-none" />
                        <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform duration-300 ease-out">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Section: Past Performance */}
        <section className="lg:col-span-4 mt-8 lg:mt-0">
          <h2 className="font-black font-title-md text-xl md:text-2xl text-on-surface mb-5 md:mb-6 tracking-tight">Past Performance</h2>
          <div className="flex flex-col gap-4">
            {pastItems.length === 0 ? (
              <div className="glass-card p-6 rounded-xl text-center text-on-surface-variant text-xs space-y-2">
                <p className="font-bold">No Past Results Yet</p>
                <p>Completed exam scores will appear here once published by your institute.</p>
              </div>
            ) : (
              pastItems.slice(0, 4).map((item) => {
                const batch = batches.find((b) => b.id === item.exam.batchId);
                const subject = batch?.subject || item.exam.name || 'Subject';
                const subjectIcon = getSubjectIcon(subject);
                const examDateStr = formatFullDate(item.exam.examDate || '');
                const isHighlighted = item.exam.id === activeHighlightId;

                if (item.isComingSoon || !item.result) {
                  return (
                    <div
                      key={item.id}
                      id={`past-card-${item.exam.id}`}
                      className={`glass-card p-4 rounded-xl flex flex-col gap-3 border border-amber-500/20 transition-all duration-300 ${
                        isHighlighted ? 'animate-card-highlight border-emerald-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-amber-950/30 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-400">
                          <span className="material-symbols-outlined">{subjectIcon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-label-md text-label-md text-on-surface truncate">
                            {item.exam.name}
                          </h5>
                          <p className="text-[12px] text-on-surface-variant">
                            {examDateStr} • {item.exam.maxMarks} Marks Total
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-extrabold text-[15px] text-amber-400">Coming Soon</p>
                          <p className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold">Pending Marks</p>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400/40 animate-pulse w-full rounded-full" />
                      </div>
                    </div>
                  );
                }

                const grade = getGradeLabel(item.result.percentage);
                const scoreConfig = getScoreColorConfig(item.result.percentage);

                return (
                  <div
                    key={item.id}
                    id={`past-card-${item.exam.id}`}
                    className={`glass-card p-4 rounded-xl flex flex-col gap-3 transition-all duration-300 ${
                      isHighlighted ? 'animate-card-highlight border-emerald-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-surface-variant rounded-lg flex items-center justify-center text-secondary">
                        <span className="material-symbols-outlined">{subjectIcon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-label-md text-label-md text-on-surface truncate">
                          {item.exam.name}
                        </h5>
                        <p className="text-[12px] text-on-surface-variant">
                          {examDateStr}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-base sm:text-lg ${scoreConfig.textClass}`}>
                          {item.result.marksObtained} / {item.result.maxMarks} Marks
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                          {grade} ({item.result.percentage}%)
                        </p>
                      </div>
                    </div>
                    {/* Color-Coded Progress Bar of Scored Reach */}
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreConfig.bgClass}`}
                        style={{ width: `${Math.min(100, Math.max(0, item.result.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            <button
              onClick={() => setShowTranscriptModal(true)}
              className="w-full py-4 glass-card border-white/5 text-on-surface-variant font-label-md text-label-md hover:text-primary hover:bg-white/5 transition-all flex items-center justify-center gap-2 rounded-xl cursor-pointer"
            >
              View Complete Transcript <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </button>
          </div>
        </section>
      </div>

      {/* Transcript Modal */}
      {showTranscriptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-title-md text-lg text-white">Complete Academic Transcript</h3>
              <button
                onClick={() => setShowTranscriptModal(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {pastItems.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">No exam result records available.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs font-label-md">
                  <thead className="bg-surface-variant text-[10px] text-on-surface-variant uppercase tracking-widest">
                    <tr>
                      <th className="p-3">Exam Name</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Score</th>
                      <th className="p-3 text-right">Percentage</th>
                      <th className="p-3 text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-on-surface">
                    {pastItems.map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-white/5">
                          <td className="p-3 font-bold">{item.exam.name}</td>
                          <td className="p-3 text-on-surface-variant">{item.exam.examDate || '-'}</td>
                          <td className="p-3 text-center font-mono text-secondary">
                            {item.result ? `${item.result.marksObtained} / ${item.result.maxMarks}` : `- / ${item.exam.maxMarks}`}
                          </td>
                          <td className="p-3 text-right font-black">
                            {item.result ? (
                              <span className="text-tertiary">{item.result.percentage}%</span>
                            ) : (
                              <span className="text-amber-400 font-bold">Coming Soon</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold">
                            {item.result ? (
                              <span className="text-on-surface-variant">{getGradeLabel(item.result.percentage)}</span>
                            ) : (
                              <span className="text-amber-300/80 font-bold">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTranscriptModal(false)}
                className="px-4 py-2 bg-surface-bright text-white text-xs font-bold rounded-xl hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Create Exam Modal */}
      {createExamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setCreateExamModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-white">Create New Exam / Assessment</h3>

            <form onSubmit={handleCreateOrEditExam} className="space-y-3 text-xs font-bold">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Select Allotted Batch *</label>
                <select
                  required
                  value={examBatchId}
                  onChange={(e) => {
                    setExamBatchId(e.target.value);
                    const b = batches.find((x) => x.id === e.target.value);
                    if (b) setExamSubject(b.subject || 'General');
                  }}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Exam / Assessment Name *</label>
                <input
                  type="text"
                  required
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="e.g. Mid-Term Physics Assessment"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={examSubject}
                    onChange={(e) => setExamSubject(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                    placeholder="e.g. Physics"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Exam Date *</label>
                  <input
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Total Marks *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreateExamModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExam}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingExam ? 'Creating...' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortalExamsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0b1326] text-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        </div>
      }
    >
      <PortalExamsContent />
    </Suspense>
  );
}
