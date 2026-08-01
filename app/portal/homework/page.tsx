'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { ArrowLeft, Loader2, X, Send, Plus, Edit2, Trash2, Search, Calendar, BookOpen, Clock } from 'lucide-react';

interface Homework {
  id: string;
  batchId: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  postedBy: string;
  postedByName?: string;
  postedAt: string;
}

interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  status: 'under_observation' | 'accepted' | 'declined' | 'pending' | 'submitted' | 'overdue';
  submissionUrl?: string;
  notes?: string;
  submittedAt: string;
}

interface Student {
  id: string;
  fullName: string;
  batchIds: string[];
}

function formatDueDate(dateStr?: string): string {
  if (!dateStr) return 'Oct 24';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function formatSubmittedDate(isoStr?: string): string {
  if (!isoStr) return 'recently';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'recently';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `on ${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return 'recently';
  }
}

export default function PortalHomework() {
  const { user, role, instituteId, loading: authLoading } = useAuth();
  const isStaff = ['owner', 'admin', 'teacher', 'staff'].includes(role || '');
  const [student, setStudent] = useState<Student | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Pagination States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageLimit, setPageLimit] = useState<number>(5);

  // Submit Modal State
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedHwToSubmit, setSelectedHwToSubmit] = useState<Homework | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Staff Post Homework State
  const [postHwModalOpen, setPostHwModalOpen] = useState(false);
  const [postBatchId, setPostBatchId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postSubject, setPostSubject] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postDueDate, setPostDueDate] = useState(new Date().toISOString().substring(0, 10));
  const [submittingPostHw, setSubmittingPostHw] = useState(false);

  // Staff Admin State
  const [staffUserData, setStaffUserData] = useState<any>(null);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [staffBatchFilter, setStaffBatchFilter] = useState<string>('ALL');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // 1. Fetch Student Profile
  useEffect(() => {
    if (!user || !instituteId) return;

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
  }, [user, instituteId]);

  // 2. Fetch Batches & Listen to Homework items
  useEffect(() => {
    if (!instituteId) return;

    // Batches
    const bRef = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(bRef, (snap) => {
      const bList: any[] = [];
      snap.forEach((d) => bList.push({ id: d.id, ...d.data() }));
      setBatches(bList);
      if (bList.length > 0 && !postBatchId) {
        setPostBatchId(bList[0].id);
        setPostSubject(bList[0].subject || 'General');
      }
    });

    const hwRef = collection(db, 'institutes', instituteId, 'homework');
    const unsubHw = onSnapshot(hwRef, (snap) => {
      const list: Homework[] = [];
      snap.forEach((d) => {
        const data = d.data() as Homework;
        if (!student || student.batchIds.length === 0 || student.batchIds.includes(data.batchId) || isStaff) {
          list.push({ ...data, id: d.id });
        }
      });
      list.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
      setHomeworks(list);
      setLoading(false);
    });

    // Listen to student's own Submissions if student
    let unsubSub = () => {};
    if (student) {
      const subRef = collection(db, 'institutes', instituteId, 'homeworkSubmissions');
      const qSub = query(subRef, where('studentId', '==', student.id));
      unsubSub = onSnapshot(qSub, (snap) => {
        const subList: HomeworkSubmission[] = [];
        snap.forEach((d) => {
          subList.push({ ...d.data(), id: d.id } as HomeworkSubmission);
        });
        setSubmissions(subList);
      });
    }

    return () => {
      unsubBatches();
      unsubHw();
      unsubSub();
    };
  }, [instituteId, student, isStaff]);

  const handlePostHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !postBatchId || !postTitle || !postSubject) return;

    setSubmittingPostHw(true);
    try {
      const payload: any = {
        batchId: postBatchId,
        title: postTitle.trim(),
        subject: postSubject.trim(),
        description: postDescription.trim(),
        dueDate: postDueDate,
        postedBy: user?.uid || 'staff',
        postedByName: staffUserData?.name || staffUserData?.fullName || user?.displayName || 'Faculty Staff',
        updatedAt: new Date().toISOString()
      };

      if (editingHomework) {
        await updateDoc(doc(db, 'institutes', instituteId, 'homework', editingHomework.id), payload);
      } else {
        await addDoc(collection(db, 'institutes', instituteId, 'homework'), {
          ...payload,
          postedAt: new Date().toISOString()
        });
      }
      setPostHwModalOpen(false);
      setEditingHomework(null);
      setPostTitle('');
      setPostDescription('');
    } catch (err) {
      console.error('Error posting homework:', err);
      alert('Failed to post homework.');
    } finally {
      setSubmittingPostHw(false);
    }
  };

  const handleOpenEditHomework = (hw: Homework) => {
    setEditingHomework(hw);
    setPostBatchId(hw.batchId);
    setPostSubject(hw.subject || '');
    setPostTitle(hw.title || '');
    setPostDescription(hw.description || '');
    setPostDueDate(hw.dueDate || new Date().toISOString().substring(0, 10));
    setPostHwModalOpen(true);
  };

  const handleDeleteHomework = async (id: string) => {
    if (!instituteId) return;
    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'homework', id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting homework:', err);
      alert('Failed to delete homework.');
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

  // Staff batches
  const staffBatchIds = staffUserData?.batchIds || [];
  const staffBatches = batches.filter((b: any) => staffBatchIds.includes(b.id));

  // Dynamic Status Computation (Considered Submitted ONLY when Accepted by Admin)
  const getHomeworkStatus = (hw: Homework) => {
    const existingSub = submissions.find((s) => s.homeworkId === hw.id);
    if (existingSub) {
      if (existingSub.status === 'accepted') {
        return { status: 'submitted', sub: existingSub };
      }
      if (existingSub.status === 'declined') {
        return { status: 'declined', sub: existingSub };
      }
      return { status: 'under_observation', sub: existingSub };
    }
    const today = new Date().toISOString().split('T')[0];
    if (hw.dueDate && hw.dueDate < today) {
      return { status: 'overdue', sub: null };
    }
    return { status: 'pending', sub: null };
  };

  // Real Counts Calculation for Header (Done only if accepted by admin)
  let pendingCount = 0;
  let doneCount = 0;

  homeworks.forEach((hw) => {
    const { status } = getHomeworkStatus(hw);
    if (status === 'submitted') {
      doneCount++;
    } else {
      pendingCount++;
    }
  });

  // Filtered Homeworks
  const filteredHomeworks = homeworks.filter((hw) => {
    const { status } = getHomeworkStatus(hw);
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'submitted' && status !== 'submitted') return false;
      if (statusFilter === 'pending' && (status === 'submitted' || status === 'declined')) return false;
      if (statusFilter === 'overdue' && status !== 'overdue') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        hw.title.toLowerCase().includes(q) ||
        hw.subject.toLowerCase().includes(q) ||
        hw.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Paginated Homework List
  const visibleHomeworks = filteredHomeworks.slice(0, pageLimit);

  // Open Submit Modal
  const handleOpenSubmitModal = (hw: Homework) => {
    setSelectedHwToSubmit(hw);
    setSubmissionUrl('');
    setNotes('');
    setSubmitError('');
    setSubmitModalOpen(true);
  };

  // Submit Homework
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !student || !selectedHwToSubmit) return;

    if (!submissionUrl.trim()) {
      setSubmitError('Please provide a submission link (Google Drive, PDF, or document URL).');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const nowIso = new Date().toISOString();
      await addDoc(collection(db, 'institutes', instituteId, 'homeworkSubmissions'), {
        homeworkId: selectedHwToSubmit.id,
        studentId: student.id,
        studentName: student.fullName,
        batchId: selectedHwToSubmit.batchId,
        status: 'under_observation',
        submissionUrl: submissionUrl.trim(),
        notes: notes.trim(),
        submittedAt: nowIso,
      });

      setSubmitModalOpen(false);
    } catch (err: any) {
      console.error('Error submitting homework:', err);
      setSubmitError(err.message || 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-secondary mb-2" />
        <p className="text-slate-400 text-xs font-semibold">Loading Homework Hub...</p>
      </div>
    );
  }

  // ============================
  // STAFF ADMIN INTERFACE
  // ============================
  if (isStaff) {
    const filteredHw = homeworks
      .filter(hw => staffBatchIds.includes(hw.batchId))
      .filter(hw => staffBatchFilter === 'ALL' || hw.batchId === staffBatchFilter)
      .filter(hw => !staffSearchQuery || hw.title.toLowerCase().includes(staffSearchQuery.toLowerCase()) || hw.subject.toLowerCase().includes(staffSearchQuery.toLowerCase()))
      .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));

    const todayStr = new Date().toISOString().split('T')[0];

    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-4 pt-4 md:pt-5 pb-8 md:px-6 font-body-md max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="p-2.5 bg-surface-container border border-white/10 hover:bg-white/5 rounded-2xl text-on-surface-variant hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Homework Management</h1>
              <p className="text-on-surface-variant text-xs">Post, edit, and manage homework assignments for your batches.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingHomework(null);
              setPostBatchId(staffBatches.length > 0 ? staffBatches[0].id : '');
              setPostSubject(staffBatches.length > 0 ? (staffBatches[0] as any).subject : '');
              setPostTitle('');
              setPostDescription('');
              setPostDueDate(new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10));
              setPostHwModalOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Post Homework
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={staffBatchFilter}
            onChange={(e) => setStaffBatchFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs font-bold"
          >
            <option value="ALL">All My Batches</option>
            {staffBatches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name} — {b.subject}</option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search homework..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-xs"
            />
          </div>
        </div>

        {/* Homework Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-400" /> Homework ({filteredHw.length})
            </h2>
          </div>

          {filteredHw.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-bold">
              No homework found. Click &quot;Post Homework&quot; to add one.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredHw.map((hw) => {
                const batch = batches.find((b: any) => b.id === hw.batchId);
                const isOverdue = hw.dueDate && hw.dueDate < todayStr;

                return (
                  <div key={hw.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-extrabold text-white truncate">{hw.title}</h3>
                        <span className="text-[9px] font-extrabold uppercase bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded border border-amber-800/50">
                          {hw.subject}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                          {batch?.name || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{hw.description || 'No description'}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium mt-1">
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                          <Calendar className="h-3 w-3" /> Due: {formatDueDate(hw.dueDate)}
                          {isOverdue && <span className="text-red-400 font-bold">(Overdue)</span>}
                        </span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Posted: {formatDueDate(hw.postedAt?.substring(0, 10))}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => handleOpenEditHomework(hw)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteConfirmId(hw.id)} className="p-1.5 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 hover:text-red-300 cursor-pointer transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post/Edit Homework Modal */}
        {postHwModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#121929] border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">{editingHomework ? 'Edit Homework' : 'Post New Homework'}</h3>
                <button onClick={() => { setPostHwModalOpen(false); setEditingHomework(null); }} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handlePostHomework} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Batch *</label>
                    <select required value={postBatchId} onChange={(e) => { setPostBatchId(e.target.value); const b = staffBatches.find((x: any) => x.id === e.target.value); if (b) setPostSubject((b as any).subject || 'General'); }} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs">
                      <option value="">Select Batch</option>
                      {staffBatches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Subject *</label>
                    <input type="text" required value={postSubject} onChange={(e) => setPostSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="e.g. Physics" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Title *</label>
                  <input type="text" required value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="e.g. Chapter 5 Exercise" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                  <textarea rows={3} value={postDescription} onChange={(e) => setPostDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs resize-none" placeholder="Assignment instructions..." />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Due Date *</label>
                  <input type="date" required value={postDueDate} onChange={(e) => setPostDueDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
                </div>
                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => { setPostHwModalOpen(false); setEditingHomework(null); }} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={submittingPostHw} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                    {submittingPostHw ? 'Saving...' : editingHomework ? 'Update' : 'Post Homework'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#121929] border border-red-900/50 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-black text-white">Delete Homework?</h3>
              <p className="text-slate-400 text-xs">This will permanently remove this homework assignment.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button type="button" onClick={() => handleDeleteHomework(deleteConfirmId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-body-md">
      {/* Top Back Navigation Bar */}
      <div className="max-w-6xl mx-auto px-margin-mobile px-4 pt-6 pb-2">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900/80 border border-white/10 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Portal
        </Link>
      </div>

      {/* Main Ground Truth Container */}
      <div className="max-w-6xl mx-auto pt-2 px-margin-mobile px-4 pb-20">
        {/* Header Section */}
        <section className="mb-lg mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-md gap-4">
            <div>
              <h1 className="font-headline-lg-mobile text-2xl md:text-3xl font-black text-on-background text-white">
                Homework Hub
              </h1>
              <p className="text-on-surface-variant text-slate-400 text-sm mt-xs mt-1">
                Track your academic progress and upcoming deadlines.
              </p>
            </div>

            {/* Real Pending & Done Counters */}
            <div className="flex gap-sm gap-3 items-center">
              <div className="glass-panel bg-slate-900/80 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary bg-amber-400"></span>
                <span className="text-sm font-label-md font-bold text-white">
                  {pendingCount} Pending
                </span>
              </div>
              <div className="glass-panel bg-slate-900/80 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-tertiary bg-emerald-400"></span>
                <span className="text-sm font-label-md font-bold text-white">
                  {doneCount} Done
                </span>
              </div>

              {isStaff && (
                <button
                  type="button"
                  onClick={() => setPostHwModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-955 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95 ml-2"
                >
                  <Plus className="h-4 w-4" /> Post Homework
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Search & Status Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter gap-4 mb-lg mb-8">
          {/* Search Box */}
          <div className="md:col-span-8 glass-panel bg-slate-900/80 border border-white/10 p-4 rounded-xl flex items-center gap-4">
            <span className="material-symbols-outlined text-on-surface-variant text-slate-400">
              search
            </span>
            <input
              className="bg-transparent border-none focus:ring-0 text-on-surface text-white w-full placeholder:text-slate-500 text-sm focus:outline-none"
              placeholder="Search by subject or topic..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="md:col-span-4 glass-panel bg-slate-900/80 border border-white/10 p-4 rounded-xl flex items-center justify-between">
            <span className="text-on-surface-variant text-slate-400 text-xs font-semibold">
              Filter by status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-secondary text-indigo-400 focus:ring-0 cursor-pointer font-label-md text-xs font-bold focus:outline-none"
            >
              <option value="ALL" className="bg-surface-container bg-slate-900 text-white">
                All Statuses
              </option>
              <option value="pending" className="bg-surface-container bg-slate-900 text-white">
                Pending
              </option>
              <option value="submitted" className="bg-surface-container bg-slate-900 text-white">
                Submitted
              </option>
              <option value="overdue" className="bg-surface-container bg-slate-900 text-white">
                Overdue
              </option>
            </select>
          </div>
        </div>

        {/* Homework List Stack */}
        <div className="space-y-gutter space-y-4">
          {visibleHomeworks.length === 0 ? (
            <div className="glass-panel bg-slate-900/40 p-12 rounded-xl text-center text-slate-400 border border-white/10 space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-600">assignment</span>
              <p className="font-bold text-white text-base">No Homework Assignments Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No homework matching your current search or filter criteria was found.
              </p>
            </div>
          ) : (
            visibleHomeworks.map((hw) => {
              const { status, sub } = getHomeworkStatus(hw);

              if (status === 'under_observation') {
                return (
                  <div
                    key={hw.id}
                    className="featured-card bg-slate-900/90 border border-amber-500/40 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-md gap-4 shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          hourglass_top
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Under Observation
                          </span>
                          <span className="text-primary text-indigo-400 text-sm font-label-md font-bold">
                            {hw.subject}
                          </span>
                        </div>
                        <h3 className="font-title-md text-title-md text-on-background text-white font-bold text-lg">
                          {hw.title}
                        </h3>
                        <p className="text-on-surface-variant text-slate-300 text-sm mt-1">
                          {hw.description || 'No instructions provided.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">history</span>
                        <span className="font-label-md">Pending Admin Review</span>
                      </div>
                      {sub?.submissionUrl ? (
                        <a
                          href={sub.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-on-surface-variant text-slate-200 hover:text-white px-6 py-2 rounded-lg font-label-md text-xs font-bold flex items-center gap-2 bg-slate-800 border border-white/10 hover:border-amber-500/40 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span> View Submitted Link
                        </a>
                      ) : (
                        <span className="text-xs text-amber-300 font-semibold px-4 py-2 bg-slate-950 rounded-lg">
                          Awaiting Review
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (status === 'declined') {
                return (
                  <div
                    key={hw.id}
                    className="featured-card bg-slate-900/90 border border-rose-500/50 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-md gap-4 shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          cancel
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold tracking-wider uppercase">
                            Submission Declined
                          </span>
                          <span className="text-primary text-indigo-400 text-sm font-label-md font-bold">
                            {hw.subject}
                          </span>
                        </div>
                        <h3 className="font-title-md text-title-md text-on-background text-white font-bold text-lg">
                          {hw.title}
                        </h3>
                        <p className="text-rose-300/90 text-xs font-semibold mt-1">
                          Your submission was declined by Admin. Please review instructions and submit again.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">event</span>
                        <span className="font-label-md">Due: {formatDueDate(hw.dueDate)}</span>
                      </div>
                      <button
                        onClick={() => handleOpenSubmitModal(hw)}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-lg font-label-md text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-md"
                      >
                        Resubmit Work
                      </button>
                    </div>
                  </div>
                );
              }

              if (status === 'overdue') {
                return (
                  <div
                    key={hw.id}
                    className="featured-card bg-slate-900/90 border border-rose-500/40 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-md gap-4 shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-error-container/20 bg-rose-500/10 border border-error/30 border-rose-500/30 flex items-center justify-center text-error text-rose-400 shrink-0">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          warning
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-error-container bg-rose-500/20 text-on-error-container text-rose-300 text-[10px] font-bold tracking-wider uppercase">
                            Overdue
                          </span>
                          <span className="text-primary text-indigo-400 text-sm font-label-md font-bold">
                            {hw.subject}
                          </span>
                        </div>
                        <h3 className="font-title-md text-title-md text-on-background text-white font-bold text-lg">
                          {hw.title}
                        </h3>
                        <p className="text-on-surface-variant text-slate-300 text-sm mt-1">
                          {hw.description || 'No instructions provided.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-error text-rose-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">event</span>
                        <span className="font-label-md">Missed: {formatDueDate(hw.dueDate)}</span>
                      </div>
                      <button
                        onClick={() => handleOpenSubmitModal(hw)}
                        className="bg-primary bg-indigo-600 hover:bg-indigo-500 text-on-primary text-white px-6 py-2 rounded-lg font-label-md text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-md"
                      >
                        Submit Now
                      </button>
                    </div>
                  </div>
                );
              }

              if (status === 'submitted') {
                return (
                  <div
                    key={hw.id}
                    className="glass-panel opacity-90 bg-slate-900/80 border border-emerald-500/40 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-md gap-4 shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 bg-emerald-500/10 border border-tertiary/30 border-emerald-500/30 flex items-center justify-center text-tertiary text-emerald-400 shrink-0">
                        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-tertiary-container bg-emerald-500/20 text-on-tertiary-container text-emerald-300 text-[10px] font-bold tracking-wider uppercase">
                            Submitted & Accepted
                          </span>
                          <span className="text-primary text-indigo-400 text-sm font-label-md font-bold">
                            {hw.subject}
                          </span>
                        </div>
                        <h3 className="font-title-md text-title-md text-on-surface-variant text-slate-300 line-through font-bold text-lg">
                          {hw.title}
                        </h3>
                        <p className="text-on-surface-variant/60 text-slate-400 text-sm mt-1">
                          {hw.description || 'No instructions provided.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-tertiary text-emerald-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">history</span>
                        <span className="font-label-md">Submitted {formatSubmittedDate(sub?.submittedAt)}</span>
                      </div>
                      {sub?.submissionUrl ? (
                        <a
                          href={sub.submissionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-on-surface-variant text-slate-200 hover:text-white px-6 py-2 rounded-lg font-label-md text-xs font-bold flex items-center gap-2 bg-slate-800 border border-white/10 hover:border-emerald-500/40 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span> View Submission
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold px-4 py-2 bg-slate-950 rounded-lg">
                          Submitted (No URL)
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              // Pending Status Card
              return (
                <div
                  key={hw.id}
                  className="featured-card bg-slate-900/90 border border-amber-500/40 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-md gap-4 shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        schedule
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
                          Pending
                        </span>
                        <span className="text-primary text-indigo-400 text-sm font-label-md font-bold">
                          {hw.subject}
                        </span>
                      </div>
                      <h3 className="font-title-md text-title-md text-on-background text-white font-bold text-lg">
                        {hw.title}
                      </h3>
                      <p className="text-on-surface-variant text-slate-300 text-sm mt-1">
                        {hw.description || 'No instructions provided.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                      <span className="material-symbols-outlined text-sm">event</span>
                      <span className="font-label-md">Due: {formatDueDate(hw.dueDate)}</span>
                    </div>
                    <button
                      onClick={() => handleOpenSubmitModal(hw)}
                      className="bg-primary bg-indigo-600 hover:bg-indigo-500 text-on-primary text-white px-6 py-2 rounded-lg font-label-md text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-md"
                    >
                      Submit Work
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More Assignments Button */}
        {filteredHomeworks.length > pageLimit && (
          <div className="mt-lg mt-8 flex justify-center">
            <button
              onClick={() => setPageLimit((prev) => prev + 5)}
              className="glass-panel bg-slate-900 border border-white/10 hover:border-indigo-500/50 px-8 py-3 rounded-full text-primary text-indigo-400 hover:text-white font-label-md text-xs font-bold transition-colors cursor-pointer shadow-lg"
            >
              Load More Assignments ({filteredHomeworks.length - pageLimit} Remaining)
            </button>
          </div>
        )}
      </div>

      {/* SUBMISSION MODAL */}
      {submitModalOpen && selectedHwToSubmit && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Assignment Submission
                </span>
                <h3 className="font-extrabold text-lg text-white mt-0.5">
                  {selectedHwToSubmit.title}
                </h3>
              </div>
              <button
                onClick={() => setSubmitModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Submission Link (Google Drive / PDF / Document URL) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={submissionUrl}
                  onChange={(e) => setSubmissionUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Optional Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add comments or instructions for your teacher..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirm Submission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Post Homework Modal */}
      {postHwModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setPostHwModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-white">Post New Homework Assignment</h3>

            <form onSubmit={handlePostHomework} className="space-y-3 text-xs font-bold">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Select Allotted Batch *</label>
                <select
                  required
                  value={postBatchId}
                  onChange={(e) => {
                    setPostBatchId(e.target.value);
                    const b = batches.find((x) => x.id === e.target.value);
                    if (b) setPostSubject(b.subject || 'General');
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={postSubject}
                    onChange={(e) => setPostSubject(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                    placeholder="e.g. Mathematics"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={postDueDate}
                    onChange={(e) => setPostDueDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Homework Title / Assignment Name *</label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="e.g. Exercise 4.2 Problems 1-15"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Instructions / Description</label>
                <textarea
                  rows={3}
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="Add submission instructions or guidelines..."
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPostHwModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPostHw}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-955 font-black p-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingPostHw ? 'Posting...' : 'Post Homework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
