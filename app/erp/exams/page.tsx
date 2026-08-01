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
  onSnapshot
} from 'firebase/firestore';
import {
  Award,
  Plus,
  Save,
  CheckCircle2,
  Loader2,
  Calendar,
  Layers,
  Users,
  Search,
  FileSpreadsheet,
  BarChart2,
  X,
  Trash2,
  Check,
  TrendingUp,
  BookOpen,
  Lock,
  Edit2,
  Clock,
  FileText
} from 'lucide-react';

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
  createdAt?: string;
}

interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  createdAt?: string;
}

function computeDuration(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  const startMins = sH * 60 + (sM || 0);
  const endMins = eH * 60 + (eM || 0);
  return Math.max(0, endMins - startMins);
}

export default function ErpExams() {
  const { instituteId, role, hasPermission } = useAuth();

  // Tab State: 'marks' | 'matrix' | 'reports'
  const [activeTab, setActiveTab] = useState<'marks' | 'matrix' | 'reports'>('marks');

  // Data State
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Mark Entry State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  // Map studentId -> marksObtained
  const [marksState, setMarksState] = useState<{ [studentId: string]: number | '' }>({});
  // Map studentId -> resultDocId (for updates)
  const [existingResultIds, setExistingResultIds] = useState<{ [studentId: string]: string }>({});

  // Matrix Filter State
  const [matrixBatchId, setMatrixBatchId] = useState<string>('');

  // Report Lookup Student State
  const [reportStudentId, setReportStudentId] = useState<string>('');

  // Create / Edit Exam Modal State
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [newExamName, setNewExamName] = useState('');
  const [newExamBatchId, setNewExamBatchId] = useState('');
  const [newExamDate, setNewExamDate] = useState(new Date().toISOString().substring(0, 10));
  const [newMaxMarks, setNewMaxMarks] = useState<number>(100);
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('11:30');
  const [chapterInput, setChapterInput] = useState('');
  const [newChapters, setNewChapters] = useState<string[]>([]);
  const [newInstructions, setNewInstructions] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Subscribe to Firestore collections
  useEffect(() => {
    if (!instituteId) return;

    // 1. Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, name: d.name, subject: d.subject });
      });
      setBatches(list);
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id);
        setMatrixBatchId(list[0].id);
        setNewExamBatchId(list[0].id);
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
          batchIds: d.batchIds || []
        });
      });
      setStudents(list);
      if (list.length > 0 && !reportStudentId) {
        setReportStudentId(list[0].id);
      }
    });

    // 3. Exams
    const examsCol = collection(db, 'institutes', instituteId, 'exams');
    const unsubExams = onSnapshot(examsCol, (snapshot) => {
      const list: Exam[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Exam);
      });
      setExams(list);
    });

    // 4. Exam Results
    const resultsCol = collection(db, 'institutes', instituteId, 'examResults');
    const unsubResults = onSnapshot(resultsCol, (snapshot) => {
      const list: ExamResult[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ExamResult);
      });
      setResults(list);
    });

    return () => {
      unsubBatches();
      unsubStudents();
      unsubExams();
      unsubResults();
    };
  }, [instituteId]);

  // Exams for selected batch
  const batchExams = exams.filter((e) => e.batchId === selectedBatchId);

  // Set default selected exam when batch changes
  useEffect(() => {
    if (batchExams.length > 0) {
      if (!batchExams.some((e) => e.id === selectedExamId)) {
        setSelectedExamId(batchExams[0].id);
      }
    } else {
      setSelectedExamId('');
    }
  }, [selectedBatchId, exams]);

  // Load existing results when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setMarksState({});
      setExistingResultIds({});
      return;
    }

    const currentExam = exams.find((e) => e.id === selectedExamId);
    if (!currentExam) return;

    const examRes = results.filter((r) => r.examId === selectedExamId);
    const initialMarks: { [studentId: string]: number | '' } = {};
    const resultDocIds: { [studentId: string]: string } = {};

    examRes.forEach((res) => {
      initialMarks[res.studentId] = res.marksObtained;
      resultDocIds[res.studentId] = res.id;
    });

    setMarksState(initialMarks);
    setExistingResultIds(resultDocIds);
    setSaveSuccess(false);
  }, [selectedExamId, results, exams]);

  // Active roster for currently selected batch
  const activeRoster = students.filter(
    (s) => s.status === 'active' && s.batchIds && s.batchIds.includes(selectedBatchId)
  );

  // Selected Exam Object
  const currentExamObj = exams.find((e) => e.id === selectedExamId);

  // Check if current user is Admin / Owner
  const isAdmin = role === 'owner' || role === 'admin';

  // Delete Exam Handler (Admin Portal Only)
  const handleDeleteExam = async (examId: string) => {
    if (!instituteId) return;
    if (!isAdmin) {
      setError('Only Institute Admin accounts have permission to delete exams.');
      return;
    }
    if (!confirm('Are you sure you want to delete this exam paper? This action cannot be undone.')) return;

    setSubmitting(true);
    setError('');

    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'exams', examId));
      if (selectedExamId === examId) {
        const remaining = batchExams.filter((e) => e.id !== examId);
        setSelectedExamId(remaining.length > 0 ? remaining[0].id : '');
      }
      if (examModalOpen) setExamModalOpen(false);
    } catch (err: any) {
      console.error('Error deleting exam:', err);
      setError(err.message || 'Failed to delete exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Create Exam Modal
  const handleOpenCreateExam = () => {
    setEditingExam(null);
    setNewExamName('');
    setNewExamBatchId(selectedBatchId || (batches[0] ? batches[0].id : ''));
    setNewExamDate(new Date().toISOString().substring(0, 10));
    setNewMaxMarks(100);
    setNewStartTime('10:00');
    setNewEndTime('11:30');
    setChapterInput('');
    setNewChapters([]);
    setNewInstructions('');
    setError('');
    setExamModalOpen(true);
  };

  // Open Edit Exam Modal
  const handleOpenEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setNewExamName(exam.name || '');
    setNewExamBatchId(exam.batchId || selectedBatchId);
    setNewExamDate(exam.examDate || new Date().toISOString().substring(0, 10));
    setNewMaxMarks(exam.maxMarks || 100);
    setNewStartTime(exam.startTime || '10:00');
    setNewEndTime(exam.endTime || '11:30');
    setChapterInput('');
    setNewChapters(exam.chapters || []);
    setNewInstructions(exam.instructions || '');
    setError('');
    setExamModalOpen(true);
  };

  // Add Chapter to Repeatable List
  const handleAddChapter = () => {
    const trimmed = chapterInput.trim();
    if (!trimmed) return;
    if (newChapters.includes(trimmed)) {
      setChapterInput('');
      return;
    }
    setNewChapters([...newChapters, trimmed]);
    setChapterInput('');
  };

  // Remove Chapter from Repeatable List
  const handleRemoveChapter = (index: number) => {
    setNewChapters(newChapters.filter((_, i) => i !== index));
  };

  // Save (Create / Update) Exam Handler
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (!newExamName || !newExamBatchId || !newExamDate || newMaxMarks <= 0) {
      setError('Please fill in exam name, batch, date, and valid max marks.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const derivedDuration = computeDuration(newStartTime, newEndTime);

      const payload = {
        name: newExamName.trim(),
        batchId: newExamBatchId,
        examDate: newExamDate,
        maxMarks: Number(newMaxMarks),
        startTime: newStartTime,
        endTime: newEndTime,
        durationMinutes: derivedDuration,
        chapters: newChapters,
        instructions: newInstructions.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingExam) {
        await updateDoc(doc(db, 'institutes', instituteId, 'exams', editingExam.id), payload);
        setSelectedExamId(editingExam.id);
      } else {
        const docRef = await addDoc(collection(db, 'institutes', instituteId, 'exams'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSelectedBatchId(newExamBatchId);
        setSelectedExamId(docRef.id);
      }

      setExamModalOpen(false);
    } catch (err: any) {
      console.error('Error saving exam:', err);
      setError(err.message || 'Failed to save exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // Save Bulk Marks Handler
  const handleSaveMarks = async () => {
    if (!instituteId || !selectedExamId || !currentExamObj) return;

    if (activeRoster.length === 0) {
      setError('No active students in selected batch.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const promises = activeRoster.map(async (student) => {
        const rawMark = marksState[student.id];
        const marksObtained = rawMark === '' || rawMark === undefined ? 0 : Number(rawMark);
        const maxMarks = currentExamObj.maxMarks;
        const percentage = Math.round((marksObtained / maxMarks) * 100 * 10) / 10;
        const existingResultId = existingResultIds[student.id];

        const payload = {
          examId: selectedExamId,
          studentId: student.id,
          marksObtained,
          maxMarks,
          percentage,
          updatedAt: new Date().toISOString()
        };

        if (existingResultId) {
          await updateDoc(
            doc(db, 'institutes', instituteId, 'examResults', existingResultId),
            payload
          );
        } else {
          await addDoc(collection(db, 'institutes', instituteId, 'examResults'), {
            ...payload,
            createdAt: new Date().toISOString()
          });
        }
      });

      await Promise.all(promises);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving exam marks:', err);
      setError(err.message || 'Failed to save exam marks.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for Batch Matrix
  const matrixBatchRoster = students.filter(
    (s) => s.batchIds && s.batchIds.includes(matrixBatchId)
  );
  const matrixExams = exams.filter((e) => e.batchId === matrixBatchId);

  // Helper for Student Report Lookup
  const reportStudent = students.find((s) => s.id === reportStudentId);
  const studentResults = results.filter((r) => {
    if (r.studentId !== reportStudentId) return false;
    // Must belong to an active, non-deleted exam in exams list
    const ex = exams.find((e) => e.id === r.examId);
    if (!ex) return false;
    // Must have marksObtained uploaded
    if (r.marksObtained === undefined || r.marksObtained === null || (r.marksObtained as any) === '') return false;
    return true;
  });

  const overallAvgPercentage =
    studentResults.length > 0
      ? Math.round(
          (studentResults.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0) / studentResults.length) * 10
        ) / 10
      : 0;

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Exams & Gradebook...</p>
      </div>
    );
  }

  if (!hasPermission('canManageExams')) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mx-auto text-amber-400">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-white">Access Denied</h3>
          <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-2">
            Exam management capability has been turned OFF for your role by the Institute Owner in **Settings &gt; Access Control**.
          </p>
        </div>
      </div>
    );
  }

  const durationBadge = computeDuration(newStartTime, newEndTime);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Exams & Gradebook</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Create test papers, syllabus chapters, instructions, bulk enter scores, and view performance.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateExam}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create New Exam
          </button>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('marks')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'marks'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Enter Marks
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Batch Matrix
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Student Transcripts
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BULK MARKS ENTRY */}
      {/* ========================================================================= */}
      {activeTab === 'marks' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              {/* Batch Selector */}
              <div className="w-full sm:w-56 space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  1. Select Batch
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam Selector */}
              <div className="w-full sm:w-64 space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  2. Select Exam Paper
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {batchExams.length === 0 ? (
                    <option value="">No exams created for batch</option>
                  ) : (
                    batchExams.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} (Max: {e.maxMarks}) - {e.examDate}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Edit & Delete Exam Buttons */}
              {currentExamObj && (
                <div className="pt-4 sm:pt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditExam(currentExamObj)}
                    className="flex items-center gap-1.5 bg-slate-955 hover:bg-slate-850 border border-slate-800 text-indigo-400 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                    title="Edit Exam Details, Syllabus & Time"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit Exam Details
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteExam(currentExamObj.id)}
                      className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/60 text-red-400 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                      title="Delete Exam Paper (Admin Only)"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete Exam
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentExamObj && (
              <div className="bg-slate-955 border border-slate-850 px-4 py-2 rounded-xl text-right">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                  Max Marks
                </span>
                <span className="text-lg font-black text-white">{currentExamObj.maxMarks}</span>
              </div>
            )}
          </div>

          {/* Exam Overview Summary Pill (If exam selected) */}
          {currentExamObj && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                  <Calendar className="h-4 w-4 text-indigo-400" /> {currentExamObj.examDate}
                </span>
                {currentExamObj.startTime && (
                  <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <Clock className="h-4 w-4 text-purple-400" /> {currentExamObj.startTime} - {currentExamObj.endTime || ''} ({currentExamObj.durationMinutes || 0} mins)
                  </span>
                )}
                {currentExamObj.chapters && currentExamObj.chapters.length > 0 && (
                  <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <BookOpen className="h-4 w-4 text-emerald-400" /> Syllabus: {currentExamObj.chapters.join(', ')}
                  </span>
                )}
              </div>

              {currentExamObj.instructions && (
                <div className="w-full bg-slate-955 p-2.5 rounded-xl border border-slate-850 text-slate-400 text-xs font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>Instructions: {currentExamObj.instructions}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-950/40 border border-red-900/60 text-red-400 text-xs p-4 rounded-2xl font-bold">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-xs p-4 rounded-2xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Marks updated successfully across student records!
            </div>
          )}

          {/* Student Roster Marks Table */}
          {!selectedExamId ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto my-8 space-y-3">
              <BookOpen className="h-10 w-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-extrabold text-white">No Exam Selected</h3>
              <p className="text-slate-400 text-xs font-semibold">
                Please select an Exam Paper or click &quot;Create New Exam&quot; above to start gradebook entry.
              </p>
            </div>
          ) : activeRoster.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto my-8 space-y-3">
              <Users className="h-10 w-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-extrabold text-white">No Active Students Enrolled</h3>
              <p className="text-slate-400 text-xs font-semibold">
                There are no active students in the selected batch. Assign students to this batch first.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Marks Entry Roster ({activeRoster.length} Active Students)
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">
                    Enter score out of {currentExamObj?.maxMarks}. Percentage is calculated automatically.
                  </p>
                </div>

                <button
                  onClick={handleSaveMarks}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save All Marks
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-850">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-slate-955 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4">#</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4 text-center">Marks Obtained</th>
                      <th className="p-4 text-center">Max Marks</th>
                      <th className="p-4 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-200">
                    {activeRoster.map((student, idx) => {
                      const rawMark = marksState[student.id];
                      const valNum = rawMark === '' || rawMark === undefined ? 0 : Number(rawMark);
                      const maxM = currentExamObj?.maxMarks || 100;
                      const pct = Math.round((valNum / maxM) * 100 * 10) / 10;

                      return (
                        <tr key={student.id} className="hover:bg-slate-850/50">
                          <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="p-4 font-black text-white">{student.fullName}</td>
                          <td className="p-4 text-slate-400">{student.phone || '-'}</td>
                          <td className="p-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={maxM}
                              value={rawMark === undefined ? '' : rawMark}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setMarksState((prev) => ({ ...prev, [student.id]: val }));
                              }}
                              className="w-24 bg-slate-955 border border-slate-800 rounded-xl py-1.5 px-3 text-center text-white font-mono font-black focus:outline-none focus:border-indigo-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-4 text-center font-mono text-slate-400">{maxM}</td>
                          <td className="p-4 text-right font-black text-emerald-400">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BATCH MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div className="w-full sm:w-64 space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                Filter Batch Matrix
              </label>
              <select
                value={matrixBatchId}
                onChange={(e) => setMatrixBatchId(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.subject})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3">
              Batch Performance Matrix ({matrixExams.length} Exams Recorded)
            </h3>

            {matrixExams.length === 0 ? (
              <p className="text-slate-400 text-xs font-semibold py-8 text-center">
                No exams recorded for this batch yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-850">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-slate-955 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="p-4">Student</th>
                      {matrixExams.map((ex) => (
                        <th key={ex.id} className="p-4 text-center">
                          <div>{ex.name}</div>
                          <div className="text-[9px] text-slate-500 lowercase">({ex.maxMarks}M)</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-200">
                    {matrixBatchRoster.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-850/50">
                        <td className="p-4 font-black text-white">{st.fullName}</td>
                        {matrixExams.map((ex) => {
                          const resObj = results.find(
                            (r) => r.examId === ex.id && r.studentId === st.id
                          );
                          return (
                            <td key={ex.id} className="p-4 text-center font-mono">
                              {resObj ? (
                                <span className="text-indigo-300 font-bold">
                                  {resObj.marksObtained} ({resObj.percentage}%)
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STUDENT TRANSCRIPTS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-72 space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                Select Student for Transcript Report
              </label>
              <select
                value={reportStudentId}
                onChange={(e) => setReportStudentId(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} ({st.phone})
                  </option>
                ))}
              </select>
            </div>

            {reportStudent && (
              <div className="bg-indigo-950/60 border border-indigo-800 px-4 py-2 rounded-xl text-right">
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block">
                  Overall Avg Performance
                </span>
                <span className="text-lg font-black text-white">{overallAvgPercentage}%</span>
              </div>
            )}
          </div>

          {reportStudent && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{reportStudent.fullName}</h3>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">
                    Individual exam performance record and mark history.
                  </p>
                </div>
              </div>

              {studentResults.length === 0 ? (
                <p className="text-slate-400 text-xs font-semibold text-center py-6">
                  No exam results recorded for this student yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentResults.map((res) => {
                    const ex = exams.find((e) => e.id === res.examId)!;
                    return (
                      <div
                        key={res.id}
                        className="bg-slate-955 border border-slate-850 p-5 rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-white text-sm">
                            {ex.name}
                          </h4>
                          <span className="text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-850 px-2.5 py-0.5 rounded-full">
                            {res.percentage}%
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                          <span>Exam Date: {ex.examDate || '-'}</span>
                          <span className="text-white font-mono font-bold">
                            {res.marksObtained} / {res.maxMarks} Marks
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT EXAM MODAL */}
      {/* ========================================================================= */}
      {examModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl my-8">
            <button
              onClick={() => setExamModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-6">
              {editingExam ? 'Edit Exam Paper & Details' : 'Create New Exam Paper'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveExam} className="space-y-4">
              {/* Exam Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Exam Title / Paper Name *
                </label>
                <input
                  type="text"
                  required
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Mid-Term Physics Paper 1"
                />
              </div>

              {/* Assigned Batch */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Assigned Batch *
                </label>
                <select
                  required
                  value={newExamBatchId}
                  onChange={(e) => setNewExamBatchId(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid: Exam Date & Max Marks */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Grid: Start Time, End Time & Computed Duration */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-indigo-400" /> Start Time
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-400" /> End Time
                    </span>
                    <span className="text-[9px] text-indigo-400 font-bold lowercase">
                      ({durationBadge} mins)
                    </span>
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Chapters / Syllabus List */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                  <BookOpen className="h-3 w-3 text-emerald-400" /> Syllabus / Chapters List
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chapterInput}
                    onChange={(e) => setChapterInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChapter();
                      }
                    }}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Trigonometry, Newton's Laws"
                  />
                  <button
                    type="button"
                    onClick={handleAddChapter}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Add Chapter
                  </button>
                </div>

                {newChapters.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {newChapters.map((ch, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-850 text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold"
                      >
                        {ch}
                        <button
                          type="button"
                          onClick={() => handleRemoveChapter(idx)}
                          className="hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Instructions */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                  <span>Exam Instructions</span>
                  <span className="text-[9px] text-slate-500 font-semibold lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2 px-3 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="e.g. Bring your own geometry box and non-programmable scientific calculator."
                ></textarea>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800 mt-6">
                {editingExam && isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteExam(editingExam.id)}
                    className="bg-red-950/60 hover:bg-red-900 border border-red-900/80 text-red-400 hover:text-white py-3 px-4 rounded-xl text-xs font-extrabold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    title="Delete Exam Paper (Admin Only)"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingExam ? 'Update Exam' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
