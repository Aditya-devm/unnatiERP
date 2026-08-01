'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db, auth } from '@/lib/firebase/config';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

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
}

interface Batch {
  id: string;
  name: string;
  subject?: string;
}

interface Student {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  batchIds?: string[];
}

function formatFullDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Not Scheduled';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
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

function formatDurationInHours(durationMinutes?: number): string {
  const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 90;
  const hours = mins / 60;
  if (hours % 1 === 0) {
    return `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
  }
  const formatted = Math.round(hours * 10) / 10;
  return `${formatted} Hours`;
}

export default function TestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const examId = resolvedParams.id;
  const router = useRouter();

  const { user, instituteId, loading: authLoading } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderSet, setReminderSet] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!instituteId || !user || !examId) return;

    // 1. Fetch Student Profile
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
      if (!matched && !snapshot.empty) {
        matched = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Student;
      }
      setStudent(matched);
    });

    // 2. Fetch Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Batch));
      setBatches(list);
    });

    // 3. Fetch Exam Document
    const examDocRef = doc(db, 'institutes', instituteId, 'exams', examId);
    getDoc(examDocRef).then((snap) => {
      if (snap.exists()) {
        const examData = { id: snap.id, ...snap.data() } as Exam;
        setExam(examData);

        if (examData.batchId) {
          const batchDocRef = doc(db, 'institutes', instituteId, 'batches', examData.batchId);
          getDoc(batchDocRef).then((batchSnap) => {
            if (batchSnap.exists()) {
              setBatch({ id: batchSnap.id, ...batchSnap.data() } as Batch);
            }
            setLoading(false);
          }).catch(() => setLoading(false));
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    return () => {
      unsubStudents();
      unsubBatches();
    };
  }, [instituteId, user, examId]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleSetReminder = () => {
    const nextState = !reminderSet;
    setReminderSet(nextState);
    if (nextState) {
      setToastMsg('Reminder set! (Visual confirmation state enabled)');
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1326] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400 mb-2" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 flex items-center justify-center font-body-md">
        <div className="bg-[#121929] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-black text-white">Exam Not Found</h2>
          <p className="text-on-surface-variant text-xs">
            The exam details you are looking for do not exist or may have been removed.
          </p>
          <Link
            href="/portal/exams"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs"
          >
            Back to Exams
          </Link>
        </div>
      </div>
    );
  }

  // Calculate status (Upcoming vs Completed)
  const todayStr = new Date().toISOString().split('T')[0];
  const isUpcoming = exam.examDate ? exam.examDate >= todayStr : true;

  const subjectName = batch?.subject || batch?.name || 'Mathematics';
  const formattedDate = formatFullDateDisplay(exam.examDate);
  const timeRange = formatExamTimeRange(exam.startTime, exam.endTime);
  const durationText = formatDurationInHours(exam.durationMinutes);
  const marksText = `${exam.maxMarks || 50} Marks`;

  const studentBatches = batches.filter(
    (b) => student?.batchIds && student.batchIds.includes(b.id)
  );
  const classNameDisplay = studentBatches.length > 0
    ? studentBatches.map((b) => b.name).join(', ')
    : 'Class 9 ICSE';

  const chaptersList = exam.chapters || [];
  const hasChapters = chaptersList.length > 0;
  const hasInstructions = !!(exam.instructions && exam.instructions.trim().length > 0);

  return (
    <div className="min-h-screen bg-[#0b1326] text-white font-body-md">
      {/* PREVIOUS TOP HEADER BAR */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/exams"
              className="p-2.5 bg-surface-container border border-white/10 hover:bg-white/5 rounded-2xl text-on-surface-variant hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Test Details</h1>
              <p className="text-on-surface-variant text-xs">Comprehensive exam syllabus, schedule, and guidelines.</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-32 space-y-6">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="bg-purple-600 text-white text-xs font-bold p-3.5 rounded-xl shadow-lg border border-purple-400 animate-fade-in">
            {toastMsg}
          </div>
        )}

        {/* 2. TITLE & STATUS BADGE SECTION (TITLE LEFT, BADGE RIGHT) */}
        <section className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-black text-purple-300 tracking-tight leading-snug">
            {exam.name}
          </h2>
          <div
            className={`px-3 py-1 rounded-full border ${
              isUpcoming
                ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                : 'border-slate-600 bg-slate-800/40 text-slate-400'
            } flex items-center gap-1.5 shrink-0`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isUpcoming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`}
            ></span>
            <span className="text-[11px] font-extrabold tracking-widest uppercase">
              {isUpcoming ? 'UPCOMING' : 'COMPLETED'}
            </span>
          </div>
        </section>

        {/* 3. KEY METRICS CARD (CONTAINER WITH PURPLE NEON BORDER GLOW & VERTICAL LIST) */}
        <section className="bg-[#121929] border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(168,85,247,0.12)] flex flex-col gap-6">
          {/* Item 1: DATE */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                calendar_today
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">DATE</p>
              <p className="text-white text-base sm:text-lg font-bold mt-0.5">{formattedDate}</p>
            </div>
          </div>

          {/* Item 2: TIME */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                schedule
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">TIME</p>
              <p className="text-white text-base sm:text-lg font-bold mt-0.5">{timeRange}</p>
            </div>
          </div>

          {/* Item 3: DURATION */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-950/50 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                timer
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">DURATION</p>
              <p className="text-white text-base sm:text-lg font-bold mt-0.5">{durationText}</p>
            </div>
          </div>

          {/* Item 4: TOTAL MARKS */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                grade
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">TOTAL MARKS</p>
              <p className="text-white text-base sm:text-lg font-bold mt-0.5">{marksText}</p>
            </div>
          </div>
        </section>

        {/* 4. SYLLABUS / CHAPTERS CARD */}
        <section className="bg-[#121929] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-cyan-400 text-2xl">menu_book</span>
            <h3 className="font-bold text-xl text-white">Syllabus / Chapters</h3>
          </div>

          {hasChapters ? (
            <div className="space-y-3 pt-1">
              {chaptersList.map((chapter, idx) => (
                <div key={idx} className="bg-[#1a233a] border border-white/5 p-4 rounded-xl flex items-center gap-3.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] shrink-0"></span>
                  <span className="font-semibold text-slate-100 text-base">{chapter}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic py-2">No syllabus details added for this assessment.</p>
          )}
        </section>

        {/* 5. INSTRUCTIONS CARD (ONLY RENDERED IF INSTRUCTIONS ARE FILLED) */}
        {hasInstructions && (
          <section className="bg-[#121929] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-400 text-2xl">info</span>
              <h3 className="font-bold text-xl text-white">Instructions</h3>
            </div>
            <div className="bg-[#231d2b] border-l-4 border-rose-400/80 p-5 rounded-xl">
              <p className="text-slate-200 text-sm leading-relaxed font-medium">
                {exam.instructions}
              </p>
            </div>
          </section>
        )}
      </main>

      {/* 6. FIXED BOTTOM SET REMINDER BUTTON MATCHING IMAGE */}
      <div className="fixed bottom-0 left-0 w-full px-4 py-4 bg-gradient-to-t from-[#0b1326] via-[#0b1326]/90 to-transparent z-50">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSetReminder}
            className={`w-full h-14 ${
              reminderSet ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#8b5cf6] hover:bg-[#7c3aed]'
            } text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-[0_6px_25px_rgba(139,92,246,0.45)] transition-all cursor-pointer active:scale-95`}
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {reminderSet ? 'check_circle' : 'add_alert'}
            </span>
            <span>{reminderSet ? 'Reminder Set' : 'Set Reminder'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
