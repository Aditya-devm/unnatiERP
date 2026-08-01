'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, X, Edit2, Trash2, Search, BookOpen, FileText, Video, ExternalLink } from 'lucide-react';

interface Classwork {
  id: string;
  batchId: string;
  subject: string;
  title: string;
  description: string;
  type: 'notes' | 'practice' | 'video' | 'file';
  fileUrl?: string;
  videoUrl?: string;
  sizeInfo?: string;
  postedBy: string;
  postedByName?: string;
  postedAt: string;
}

interface Student {
  id: string;
  fullName: string;
  batchIds: string[];
}

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return 'Recently';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getSubjectIcon(subject: string): string {
  const lower = (subject || '').toLowerCase();
  if (lower.includes('math') || lower.includes('algebra') || lower.includes('calculus')) return 'functions';
  if (lower.includes('physic') || lower.includes('chem') || lower.includes('sci')) return 'science';
  if (lower.includes('code') || lower.includes('program') || lower.includes('comp')) return 'code';
  if (lower.includes('english') || lower.includes('literat')) return 'menu_book';
  return 'book';
}

function getBadgeLabel(type: string): string {
  switch (type) {
    case 'notes':
      return 'Lecture Notes';
    case 'practice':
      return 'Practice Set';
    case 'video':
      return 'Video Lecture';
    case 'file':
      return 'Shared Document';
    default:
      return 'Study Material';
  }
}

export default function PortalClasswork() {
  const { user, role, instituteId, loading: authLoading } = useAuth();
  const isStaff = ['owner', 'admin', 'teacher', 'staff'].includes(role || '');
  const [student, setStudent] = useState<Student | null>(null);
  const [classworks, setClassworks] = useState<Classwork[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');

  // Staff Post Classwork Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postBatchId, setPostBatchId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postSubject, setPostSubject] = useState('');
  const [postType, setPostType] = useState<'notes' | 'practice' | 'video' | 'file'>('notes');
  const [postDescription, setPostDescription] = useState('');
  const [postFileUrl, setPostFileUrl] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Staff Admin State
  const [staffUserData, setStaffUserData] = useState<any>(null);
  const [editingClasswork, setEditingClasswork] = useState<Classwork | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [staffBatchFilter, setStaffBatchFilter] = useState<string>('ALL');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [postVideoUrl, setPostVideoUrl] = useState('');
  const [postSizeInfo, setPostSizeInfo] = useState('');

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

  // 2. Fetch Batches & Listen to Classwork
  useEffect(() => {
    if (!instituteId) return;

    // Batches
    const bRef = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(bRef, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setBatches(list);
      if (list.length > 0 && !postBatchId) {
        setPostBatchId(list[0].id);
        setPostSubject(list[0].subject || 'General');
      }
    });

    // Classwork
    const cwRef = collection(db, 'institutes', instituteId, 'classwork');
    const unsubCw = onSnapshot(cwRef, (snap) => {
      const list: Classwork[] = [];
      snap.forEach((d) => {
        const data = d.data() as Classwork;
        if (!student || student.batchIds.length === 0 || student.batchIds.includes(data.batchId) || isStaff) {
          list.push({ ...data, id: d.id });
        }
      });
      setClassworks(list);
      setLoading(false);
    });

    return () => {
      unsubBatches();
      unsubCw();
    };
  }, [instituteId, student, isStaff]);

  const handlePostClasswork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !postBatchId || !postTitle || !postSubject) return;

    setSubmittingPost(true);
    try {
      const payload: any = {
        batchId: postBatchId,
        title: postTitle.trim(),
        subject: postSubject.trim(),
        type: postType,
        description: postDescription.trim(),
        fileUrl: postFileUrl.trim() || null,
        videoUrl: postVideoUrl.trim() || null,
        sizeInfo: postSizeInfo.trim() || null,
        postedBy: user?.uid || 'staff',
        postedByName: staffUserData?.name || staffUserData?.fullName || user?.displayName || 'Faculty Staff',
        updatedAt: new Date().toISOString()
      };

      if (editingClasswork) {
        await updateDoc(doc(db, 'institutes', instituteId, 'classwork', editingClasswork.id), payload);
      } else {
        await addDoc(collection(db, 'institutes', instituteId, 'classwork'), {
          ...payload,
          postedAt: new Date().toISOString()
        });
      }
      setIsPostModalOpen(false);
      setEditingClasswork(null);
      setPostTitle('');
      setPostDescription('');
      setPostFileUrl('');
      setPostVideoUrl('');
      setPostSizeInfo('');
    } catch (err) {
      console.error('Error posting classwork:', err);
      alert('Failed to post classwork.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleOpenEditClasswork = (cw: Classwork) => {
    setEditingClasswork(cw);
    setPostBatchId(cw.batchId);
    setPostSubject(cw.subject || '');
    setPostTitle(cw.title || '');
    setPostDescription(cw.description || '');
    setPostType(cw.type || 'notes');
    setPostFileUrl(cw.fileUrl || '');
    setPostVideoUrl(cw.videoUrl || '');
    setPostSizeInfo(cw.sizeInfo || '');
    setIsPostModalOpen(true);
  };

  const handleDeleteClasswork = async (id: string) => {
    if (!instituteId) return;
    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'classwork', id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting classwork:', err);
      alert('Failed to delete classwork.');
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

  // Unique Subjects List
  const subjectsList = Array.from(new Set(classworks.map((cw) => cw.subject || 'General'))).sort();

  // Filter & Sort
  const processedClassworks = classworks
    .filter((cw) => {
      if (selectedSubject !== 'ALL' && (cw.subject || 'General') !== selectedSubject) return false;
      return true;
    })
    .sort((a, b) => {
      const tA = new Date(a.postedAt || 0).getTime();
      const tB = new Date(b.postedAt || 0).getTime();
      return sortBy === 'latest' ? tB - tA : tA - tB;
    });

  // Group items by subject
  const groupedBySubject: { [subject: string]: Classwork[] } = {};
  processedClassworks.forEach((cw) => {
    const subKey = cw.subject || 'General';
    if (!groupedBySubject[subKey]) groupedBySubject[subKey] = [];
    groupedBySubject[subKey].push(cw);
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-6 flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-secondary mb-2" />
        <p className="text-slate-400 text-xs font-semibold">Loading Study Materials...</p>
      </div>
    );
  }

  // ============================
  // STAFF ADMIN INTERFACE
  // ============================
  if (isStaff) {
    const filteredCw = classworks
      .filter(cw => staffBatchIds.includes(cw.batchId))
      .filter(cw => staffBatchFilter === 'ALL' || cw.batchId === staffBatchFilter)
      .filter(cw => !staffSearchQuery || cw.title.toLowerCase().includes(staffSearchQuery.toLowerCase()) || cw.subject.toLowerCase().includes(staffSearchQuery.toLowerCase()))
      .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));

    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] px-4 pt-4 md:pt-5 pb-8 md:px-6 font-body-md max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="p-2.5 bg-surface-container border border-white/10 hover:bg-white/5 rounded-2xl text-on-surface-variant hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Classwork Management</h1>
              <p className="text-on-surface-variant text-xs">Post, edit, and manage study materials for your batches.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingClasswork(null);
              setPostBatchId(staffBatches.length > 0 ? staffBatches[0].id : '');
              setPostSubject(staffBatches.length > 0 ? staffBatches[0].subject : '');
              setPostTitle('');
              setPostDescription('');
              setPostType('notes');
              setPostFileUrl('');
              setPostVideoUrl('');
              setPostSizeInfo('');
              setIsPostModalOpen(true);
            }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Post Classwork
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
              placeholder="Search classwork..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-xs"
            />
          </div>
        </div>

        {/* Classwork Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" /> Study Materials ({filteredCw.length})
            </h2>
          </div>

          {filteredCw.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs font-bold">
              No classwork found. Click &quot;Post Classwork&quot; to add one.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filteredCw.map((cw) => {
                const batch = batches.find((b: any) => b.id === cw.batchId);
                const typeColors: Record<string, string> = {
                  notes: 'bg-blue-950/60 text-blue-400 border-blue-800/50',
                  practice: 'bg-purple-950/60 text-purple-400 border-purple-800/50',
                  video: 'bg-red-950/60 text-red-400 border-red-800/50',
                  file: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
                };

                return (
                  <div key={cw.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-extrabold text-white truncate">{cw.title}</h3>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${typeColors[cw.type] || typeColors.notes}`}>
                          {getBadgeLabel(cw.type)}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                          {batch?.name || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{cw.description || 'No description'}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium mt-1">
                        <span>{cw.subject}</span>
                        <span>• {getTimeAgo(cw.postedAt)}</span>
                        {cw.fileUrl && <a href={cw.fileUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /> File</a>}
                        {cw.videoUrl && <a href={cw.videoUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 flex items-center gap-0.5"><Video className="h-3 w-3" /> Video</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => handleOpenEditClasswork(cw)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteConfirmId(cw.id)} className="p-1.5 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 hover:text-red-300 cursor-pointer transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Post/Edit Classwork Modal */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#121929] border border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">{editingClasswork ? 'Edit Classwork' : 'Post New Classwork'}</h3>
                <button onClick={() => { setIsPostModalOpen(false); setEditingClasswork(null); }} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handlePostClasswork} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Batch *</label>
                    <select required value={postBatchId} onChange={(e) => { setPostBatchId(e.target.value); const b = staffBatches.find((x: any) => x.id === e.target.value); if (b) setPostSubject((b as any).subject || 'General'); }} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs">
                      <option value="">Select Batch</option>
                      {staffBatches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Type *</label>
                    <select value={postType} onChange={(e) => setPostType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs">
                      <option value="notes">Lecture Notes</option>
                      <option value="practice">Practice Set</option>
                      <option value="video">Video Lecture</option>
                      <option value="file">Document File</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Subject *</label>
                    <input type="text" required value={postSubject} onChange={(e) => setPostSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="e.g. Physics" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Title *</label>
                    <input type="text" required value={postTitle} onChange={(e) => setPostTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="e.g. Chapter 4 Notes" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                  <textarea rows={3} value={postDescription} onChange={(e) => setPostDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs resize-none" placeholder="Details, instructions, or notes..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">File URL</label>
                    <input type="url" value={postFileUrl} onChange={(e) => setPostFileUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="https://drive.google.com/..." />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Video URL</label>
                    <input type="url" value={postVideoUrl} onChange={(e) => setPostVideoUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white text-xs" placeholder="https://youtube.com/..." />
                  </div>
                </div>
                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => { setIsPostModalOpen(false); setEditingClasswork(null); }} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                  <button type="submit" disabled={submittingPost} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
                    {submittingPost ? 'Saving...' : editingClasswork ? 'Update' : 'Post Material'}
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
              <h3 className="text-lg font-black text-white">Delete Classwork?</h3>
              <p className="text-slate-400 text-xs">This will permanently remove this study material.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button type="button" onClick={() => handleDeleteClasswork(deleteConfirmId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-body-md">
      {/* Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop pt-6 pb-2">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900/80 border border-white/10 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition-colors text-xs font-bold mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Portal
        </Link>
      </div>

      {/* Ground Truth Reference Container */}
      <div className="px-4 md:px-margin-desktop max-w-7xl mx-auto pb-16">
        {/* Top Header Section */}
        <section className="mb-lg">
          <h3 className="font-headline-lg-mobile text-on-surface text-2xl md:text-3xl font-black">
            Study Materials
          </h3>
          <p className="text-on-surface-variant mt-2 text-sm text-slate-400">
            Access your notes, lectures, and shared documents.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {/* Filter by Subject Dropdown Button */}
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-surface-container-high bg-slate-900 border border-white/10 px-4 py-2 rounded-full text-label-md text-xs font-bold text-slate-200 focus:outline-none cursor-pointer appearance-none pr-8"
              >
                <option value="ALL">All Subjects</option>
                {subjectsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[18px] absolute right-2.5 top-2 pointer-events-none text-slate-400">
                filter_list
              </span>
            </div>

            {/* Sort Toggle Button */}
            <button
              onClick={() => setSortBy(sortBy === 'latest' ? 'oldest' : 'latest')}
              className="bg-surface-container-high bg-slate-900 border border-white/10 px-4 py-2 rounded-full text-label-md text-xs font-bold text-slate-200 flex items-center gap-2 cursor-pointer hover:border-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">sort</span>
              {sortBy === 'latest' ? 'Latest First' : 'Oldest First'}
            </button>

            {isStaff && (
              <button
                type="button"
                onClick={() => setIsPostModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95 ml-auto"
              >
                <Plus className="h-4 w-4" /> Post Classwork
              </button>
            )}
          </div>
        </section>

        {/* Grouped Subjects & Classwork Cards Grid */}
        <div className="flex flex-col gap-8 mb-xl">
          {Object.keys(groupedBySubject).length === 0 ? (
            <div className="glass-card p-12 rounded-2xl text-center text-on-surface-variant text-slate-400 space-y-3 border border-white/10">
              <span className="material-symbols-outlined text-4xl text-slate-600">book</span>
              <p className="font-bold text-white text-base">No Study Materials Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No classwork materials have been posted for your enrolled batch yet.
              </p>
            </div>
          ) : (
            Object.entries(groupedBySubject).map(([subName, items]) => (
              <div key={subName} className="space-y-4">
                {/* Subject Group Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 border border-secondary/30 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">{getSubjectIcon(subName)}</span>
                    </div>
                    <h4 className="font-title-md text-on-surface text-xl font-bold text-white">{subName}</h4>
                  </div>
                  <span className="text-secondary text-xs font-extrabold uppercase tracking-wider">
                    {items.length} Item{items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((cw) => {
                    const timeAgo = getTimeAgo(cw.postedAt);
                    const badge = getBadgeLabel(cw.type);
                    const targetUrl = cw.fileUrl || cw.videoUrl;

                    return (
                      <div
                        key={cw.id}
                        className="glass-card featured-glow-cyan p-5 rounded-xl group cursor-pointer hover:border-secondary/50 transition-all duration-300 relative overflow-hidden bg-slate-900/80 border border-white/10"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="bg-secondary/10 border border-secondary/30 text-secondary text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded">
                            {badge}
                          </div>
                          {targetUrl ? (
                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-on-surface-variant hover:text-secondary group-hover:text-secondary transition-colors p-1"
                              title={cw.videoUrl ? 'Watch Video' : 'Download Document'}
                            >
                              <span className="material-symbols-outlined">
                                {cw.videoUrl ? 'play_circle' : 'download'}
                              </span>
                            </a>
                          ) : (
                            <span className="material-symbols-outlined text-slate-600 text-sm">
                              article
                            </span>
                          )}
                        </div>

                        <h5 className="font-title-md text-[18px] font-bold text-on-surface text-white mb-1 group-hover:text-secondary transition-colors">
                          {cw.title}
                        </h5>
                        <p className="text-sm text-on-surface-variant text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                          {cw.description || 'No description provided.'}
                        </p>

                        <div className="flex items-center justify-between text-xs text-on-surface-variant text-slate-400 pt-3 border-t border-white/5 font-semibold">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>{' '}
                            {timeAgo}
                          </span>
                          {cw.sizeInfo && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">description</span>{' '}
                              {cw.sizeInfo}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Staff Post Classwork Modal */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsPostModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black text-white">Post New Classwork / Study Material</h3>

            <form onSubmit={handlePostClasswork} className="space-y-3 text-xs font-bold">
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
                    placeholder="e.g. Physics"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Type *</label>
                  <select
                    value={postType}
                    onChange={(e) => setPostType(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white cursor-pointer"
                  >
                    <option value="notes">Lecture Notes</option>
                    <option value="practice">Practice Set</option>
                    <option value="video">Video Lecture</option>
                    <option value="file">Document File</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Title / Topic *</label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="e.g. Chapter 4 Newton's Laws Notes"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white"
                  placeholder="Add details, instructions, or notes..."
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Resource Link / File URL (Optional)</label>
                <input
                  type="url"
                  value={postFileUrl}
                  onChange={(e) => setPostFileUrl(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-[11px]"
                  placeholder="https://drive.google.com/... or link"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-400 p-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingPost ? 'Posting...' : 'Post Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
