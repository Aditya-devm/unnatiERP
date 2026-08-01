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
  getDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  BookOpen,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Users,
  Loader2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Video,
  FileCode,
  Paperclip,
  Eye,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface Batch {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
}

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

interface Student {
  id: string;
  fullName: string;
  rollNumber?: string;
  batchIds: string[];
}

interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName?: string;
  status: 'under_observation' | 'accepted' | 'declined' | 'pending' | 'submitted' | 'overdue';
  submissionUrl?: string;
  notes?: string;
  submittedAt: string;
}

export default function ErpClassworkHomework() {
  const { user, role, instituteId, loading: authLoading } = useAuth();
  const isAdmin = role === 'owner' || role === 'admin';

  const [activeTab, setActiveTab] = useState<'classwork' | 'homework'>('classwork');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classworks, setClassworks] = useState<Classwork[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [classworkModalOpen, setClassworkModalOpen] = useState(false);
  const [homeworkModalOpen, setHomeworkModalOpen] = useState(false);
  const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);

  // Editing / Action Item States
  const [editingClasswork, setEditingClasswork] = useState<Classwork | null>(null);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'classwork' | 'homework' } | null>(null);
  const [selectedHomeworkForSubmissions, setSelectedHomeworkForSubmissions] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Classwork Form State
  const [cwBatchId, setCwBatchId] = useState('');
  const [cwSubject, setCwSubject] = useState('');
  const [cwTitle, setCwTitle] = useState('');
  const [cwDescription, setCwDescription] = useState('');
  const [cwType, setCwType] = useState<'notes' | 'practice' | 'video' | 'file'>('notes');
  const [cwFileUrl, setCwFileUrl] = useState('');
  const [cwVideoUrl, setCwVideoUrl] = useState('');
  const [cwSizeInfo, setCwSizeInfo] = useState('');

  // Homework Form State
  const [hwBatchId, setHwBatchId] = useState('');
  const [hwSubject, setHwSubject] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDescription, setHwDescription] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Batches, Classworks, Homeworks, Students
  useEffect(() => {
    if (!instituteId) return;

    // Listen to Batches
    const batchesRef = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesRef, (snap) => {
      const bList: Batch[] = [];
      snap.forEach((docSnap) => {
        bList.push({ id: docSnap.id, ...docSnap.data() } as Batch);
      });
      setBatches(bList);
    });

    // Listen to Classwork
    const cwRef = collection(db, 'institutes', instituteId, 'classwork');
    const unsubCw = onSnapshot(cwRef, (snap) => {
      const cwList: Classwork[] = [];
      snap.forEach((docSnap) => {
        cwList.push({ id: docSnap.id, ...docSnap.data() } as Classwork);
      });
      cwList.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
      setClassworks(cwList);
      setLoading(false);
    });

    // Listen to Homework
    const hwRef = collection(db, 'institutes', instituteId, 'homework');
    const unsubHw = onSnapshot(hwRef, (snap) => {
      const hwList: Homework[] = [];
      snap.forEach((docSnap) => {
        hwList.push({ id: docSnap.id, ...docSnap.data() } as Homework);
      });
      hwList.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
      setHomeworks(hwList);
    });

    // Listen to Students
    const stRef = collection(db, 'institutes', instituteId, 'students');
    const unsubSt = onSnapshot(stRef, (snap) => {
      const stList: Student[] = [];
      snap.forEach((docSnap) => {
        stList.push({ id: docSnap.id, ...docSnap.data() } as Student);
      });
      setStudents(stList);
    });

    return () => {
      unsubBatches();
      unsubCw();
      unsubHw();
      unsubSt();
    };
  }, [instituteId]);

  // Available batches for the current user (Owner/Admin sees all, Teacher/Staff sees assigned only)
  const userBatches = batches.filter((b) => {
    if (isAdmin) return true;
    return b.teacherId === user?.uid;
  });

  // Server-side Authorization check helper on write
  const verifyWritePermission = async (targetBatchId: string): Promise<boolean> => {
    if (!instituteId || !user) return false;
    if (isAdmin) return true;

    // Teacher/Staff CANNOT post to "ALL_BATCHES"
    if (targetBatchId === 'ALL_BATCHES') return false;

    // Check specific batch assignment directly in Firestore
    try {
      const batchRef = doc(db, 'institutes', instituteId, 'batches', targetBatchId);
      const batchSnap = await getDoc(batchRef);
      if (!batchSnap.exists()) return false;
      const bData = batchSnap.data();
      return bData.teacherId === user.uid;
    } catch (e) {
      console.error('Error verifying write permission:', e);
      return false;
    }
  };

  // Open Classwork Modal (New or Edit)
  const handleOpenClassworkModal = (item?: Classwork) => {
    setFormError('');
    if (item) {
      setEditingClasswork(item);
      setCwBatchId(item.batchId);
      setCwSubject(item.subject || '');
      setCwTitle(item.title || '');
      setCwDescription(item.description || '');
      setCwType(item.type || 'notes');
      setCwFileUrl(item.fileUrl || '');
      setCwVideoUrl(item.videoUrl || '');
      setCwSizeInfo(item.sizeInfo || '');
    } else {
      setEditingClasswork(null);
      setCwBatchId(userBatches.length > 0 ? userBatches[0].id : '');
      setCwSubject('');
      setCwTitle('');
      setCwDescription('');
      setCwType('notes');
      setCwFileUrl('');
      setCwVideoUrl('');
      setCwSizeInfo('');
    }
    setClassworkModalOpen(true);
  };

  // Open Homework Modal (New or Edit)
  const handleOpenHomeworkModal = (item?: Homework) => {
    setFormError('');
    if (item) {
      setEditingHomework(item);
      setHwBatchId(item.batchId);
      setHwSubject(item.subject || '');
      setHwTitle(item.title || '');
      setHwDescription(item.description || '');
      setHwDueDate(item.dueDate || '');
    } else {
      setEditingHomework(null);
      setHwBatchId(userBatches.length > 0 ? userBatches[0].id : '');
      setHwSubject('');
      setHwTitle('');
      setHwDescription('');
      setHwDueDate('');
    }
    setHomeworkModalOpen(true);
  };

  // Submit Classwork Form
  const handleSubmitClasswork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !user) return;
    if (!cwBatchId) {
      setFormError('Please select a target batch.');
      return;
    }
    if (!cwTitle.trim()) {
      setFormError('Title is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      // 1. Server-Side Security Enforcement Check
      if (cwBatchId !== 'ALL_BATCHES') {
        const hasPerm = await verifyWritePermission(cwBatchId);
        if (!hasPerm) {
          setFormError('Access Denied: You are not authorized to post to this batch.');
          setSubmitting(false);
          return;
        }
      } else if (!isAdmin) {
        setFormError('Access Denied: Only Admins can post to all batches.');
        setSubmitting(false);
        return;
      }

      const nowIso = new Date().toISOString();
      const posterName = user.displayName || user.email || 'Staff';

      if (editingClasswork) {
        // Update existing Classwork
        const docRef = doc(db, 'institutes', instituteId, 'classwork', editingClasswork.id);
        await updateDoc(docRef, {
          batchId: cwBatchId,
          subject: cwSubject,
          title: cwTitle,
          description: cwDescription,
          type: cwType,
          fileUrl: cwFileUrl,
          videoUrl: cwVideoUrl,
          sizeInfo: cwSizeInfo,
        });
      } else {
        // Create new Classwork
        if (cwBatchId === 'ALL_BATCHES' && isAdmin) {
          // Post to ALL institute batches explicitly (one doc per batch)
          const allBatchIds = batches.map((b) => b.id);
          for (const bId of allBatchIds) {
            const selectedB = batches.find((b) => b.id === bId);
            await addDoc(collection(db, 'institutes', instituteId, 'classwork'), {
              batchId: bId,
              subject: cwSubject || selectedB?.subject || 'General',
              title: cwTitle,
              description: cwDescription,
              type: cwType,
              fileUrl: cwFileUrl,
              videoUrl: cwVideoUrl,
              sizeInfo: cwSizeInfo,
              postedBy: user.uid,
              postedByName: posterName,
              postedAt: nowIso,
            });
          }
        } else {
          // Post to single batch
          const selectedB = batches.find((b) => b.id === cwBatchId);
          await addDoc(collection(db, 'institutes', instituteId, 'classwork'), {
            batchId: cwBatchId,
            subject: cwSubject || selectedB?.subject || 'General',
            title: cwTitle,
            description: cwDescription,
            type: cwType,
            fileUrl: cwFileUrl,
            videoUrl: cwVideoUrl,
            sizeInfo: cwSizeInfo,
            postedBy: user.uid,
            postedByName: posterName,
            postedAt: nowIso,
          });
        }
      }

      setClassworkModalOpen(false);
    } catch (err: any) {
      console.error('Error saving classwork:', err);
      setFormError(err.message || 'Failed to save classwork.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Homework Form
  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !user) return;
    if (!hwBatchId) {
      setFormError('Please select a target batch.');
      return;
    }
    if (!hwTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!hwDueDate) {
      setFormError('Due date is required.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      // 1. Server-Side Security Enforcement Check
      if (hwBatchId !== 'ALL_BATCHES') {
        const hasPerm = await verifyWritePermission(hwBatchId);
        if (!hasPerm) {
          setFormError('Access Denied: You are not authorized to post to this batch.');
          setSubmitting(false);
          return;
        }
      } else if (!isAdmin) {
        setFormError('Access Denied: Only Admins can post to all batches.');
        setSubmitting(false);
        return;
      }

      const nowIso = new Date().toISOString();
      const posterName = user.displayName || user.email || 'Staff';

      if (editingHomework) {
        // Update existing Homework
        const docRef = doc(db, 'institutes', instituteId, 'homework', editingHomework.id);
        await updateDoc(docRef, {
          batchId: hwBatchId,
          subject: hwSubject,
          title: hwTitle,
          description: hwDescription,
          dueDate: hwDueDate,
        });
      } else {
        // Create new Homework
        if (hwBatchId === 'ALL_BATCHES' && isAdmin) {
          // Post to ALL institute batches explicitly (one doc per batch)
          const allBatchIds = batches.map((b) => b.id);
          for (const bId of allBatchIds) {
            const selectedB = batches.find((b) => b.id === bId);
            await addDoc(collection(db, 'institutes', instituteId, 'homework'), {
              batchId: bId,
              subject: hwSubject || selectedB?.subject || 'General',
              title: hwTitle,
              description: hwDescription,
              dueDate: hwDueDate,
              postedBy: user.uid,
              postedByName: posterName,
              postedAt: nowIso,
            });
          }
        } else {
          // Post to single batch
          const selectedB = batches.find((b) => b.id === hwBatchId);
          await addDoc(collection(db, 'institutes', instituteId, 'homework'), {
            batchId: hwBatchId,
            subject: hwSubject || selectedB?.subject || 'General',
            title: hwTitle,
            description: hwDescription,
            dueDate: hwDueDate,
            postedBy: user.uid,
            postedByName: posterName,
            postedAt: nowIso,
          });
        }
      }

      setHomeworkModalOpen(false);
    } catch (err: any) {
      console.error('Error saving homework:', err);
      setFormError(err.message || 'Failed to save homework.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteItem = async () => {
    if (!itemToDelete || !instituteId) return;

    try {
      if (itemToDelete.type === 'classwork') {
        const docRef = doc(db, 'institutes', instituteId, 'classwork', itemToDelete.id);
        await deleteDoc(docRef);
      } else {
        const docRef = doc(db, 'institutes', instituteId, 'homework', itemToDelete.id);
        await deleteDoc(docRef);
      }
      setDeleteConfirmModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // Open Submissions Viewer Modal for a Homework
  const handleOpenSubmissionsModal = async (hw: Homework) => {
    setSelectedHomeworkForSubmissions(hw);
    setSubmissionsModalOpen(true);
    setLoadingSubmissions(true);

    if (!instituteId) return;

    try {
      const qSub = query(
        collection(db, 'institutes', instituteId, 'homeworkSubmissions'),
        where('homeworkId', '==', hw.id)
      );
      const snap = await getDocs(qSub);
      const list: HomeworkSubmission[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as HomeworkSubmission);
      });
      setSubmissions(list);
    } catch (err) {
      console.error('Error fetching homework submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Accept a student submission
  const handleAcceptSubmission = async (subId: string) => {
    if (!instituteId) return;
    try {
      const docRef = doc(db, 'institutes', instituteId, 'homeworkSubmissions', subId);
      await updateDoc(docRef, {
        status: 'accepted',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || 'Admin',
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: 'accepted' } : s))
      );
    } catch (err) {
      console.error('Error accepting submission:', err);
    }
  };

  // Decline a student submission
  const handleDeclineSubmission = async (subId: string) => {
    if (!instituteId) return;
    try {
      const docRef = doc(db, 'institutes', instituteId, 'homeworkSubmissions', subId);
      await updateDoc(docRef, {
        status: 'declined',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.uid || 'Admin',
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, status: 'declined' } : s))
      );
    } catch (err) {
      console.error('Error declining submission:', err);
    }
  };

  // Filtered Classworks & Homeworks
  const filteredClassworks = classworks.filter((cw) => {
    // Role filter: if teacher/staff, show items belonging to user's assigned batches or posted by them
    if (!isAdmin) {
      const isAssignedBatch = userBatches.some((b) => b.id === cw.batchId);
      const isOwnerPost = cw.postedBy === user?.uid;
      if (!isAssignedBatch && !isOwnerPost) return false;
    }

    if (selectedBatchFilter !== 'ALL' && cw.batchId !== selectedBatchFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = cw.title.toLowerCase().includes(q);
      const matchSub = cw.subject.toLowerCase().includes(q);
      const matchDesc = cw.description.toLowerCase().includes(q);
      return matchTitle || matchSub || matchDesc;
    }
    return true;
  });

  const filteredHomeworks = homeworks.filter((hw) => {
    if (!isAdmin) {
      const isAssignedBatch = userBatches.some((b) => b.id === hw.batchId);
      const isOwnerPost = hw.postedBy === user?.uid;
      if (!isAssignedBatch && !isOwnerPost) return false;
    }

    if (selectedBatchFilter !== 'ALL' && hw.batchId !== selectedBatchFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = hw.title.toLowerCase().includes(q);
      const matchSub = hw.subject.toLowerCase().includes(q);
      const matchDesc = hw.description.toLowerCase().includes(q);
      return matchTitle || matchSub || matchDesc;
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
        <p className="text-slate-400 text-xs font-semibold">Loading Classwork & Homework Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Classwork & Homework</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Post class notes, assignments, and track student homework submissions.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenClassworkModal()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Post Classwork
          </button>
          <button
            onClick={() => handleOpenHomeworkModal()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Post Homework
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('classwork')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'classwork'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Classwork ({filteredClassworks.length})
          </button>
          <button
            onClick={() => setActiveTab('homework')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'homework'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" /> Homework ({filteredHomeworks.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Batch Selector Filter */}
          <div className="relative min-w-[180px]">
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="ALL">All Accessible Batches</option>
              {userBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.subject})
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: CLASSWORK CONTENT */}
      {activeTab === 'classwork' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClassworks.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <BookOpen className="h-10 w-10 text-slate-600 mx-auto" />
              <p className="font-bold text-white text-base">No Classwork Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No class notes or study materials have been posted for the selected filter yet.
              </p>
            </div>
          ) : (
            filteredClassworks.map((cw) => {
              const batch = batches.find((b) => b.id === cw.batchId);
              const batchName = batch?.name || 'All Batches';

              return (
                <div
                  key={cw.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 shadow-lg hover:shadow-blue-500/10 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold text-[10px] uppercase tracking-wider rounded-lg">
                        {cw.type}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                        {batchName}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-blue-400 font-bold uppercase tracking-wide">{cw.subject}</p>
                      <h3 className="text-lg font-extrabold text-white mt-0.5 group-hover:text-blue-300 transition-colors">
                        {cw.title}
                      </h3>
                      <p className="text-xs text-slate-300 font-medium line-clamp-3 mt-1.5 leading-relaxed">
                        {cw.description}
                      </p>
                    </div>
                  </div>

                  {/* Material Link Attachment */}
                  {cw.fileUrl && (
                    <a
                      href={cw.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 hover:border-blue-500/40 rounded-xl text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">View Attached File</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  )}

                  {cw.videoUrl && (
                    <a
                      href={cw.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/40 rounded-xl text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Video className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">Watch Video Lesson</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  )}

                  {/* Footer Meta & Actions */}
                  <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span>Posted by </span>
                      <span className="font-bold text-slate-200">{cw.postedByName || 'Staff'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenClassworkModal(cw)}
                        className="p-1.5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                        title="Edit Classwork"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete({ id: cw.id, type: 'classwork' });
                          setDeleteConfirmModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Delete Classwork"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: HOMEWORK CONTENT */}
      {activeTab === 'homework' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHomeworks.length === 0 ? (
            <div className="col-span-full bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <FileText className="h-10 w-10 text-slate-600 mx-auto" />
              <p className="font-bold text-white text-base">No Homework Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No homework assignments have been created for the selected filter yet.
              </p>
            </div>
          ) : (
            filteredHomeworks.map((hw) => {
              const batch = batches.find((b) => b.id === hw.batchId);
              const batchName = batch?.name || 'All Batches';
              const isOverdue = new Date(hw.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

              return (
                <div
                  key={hw.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 shadow-lg hover:shadow-indigo-500/10 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Assignment
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                        {batchName}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-indigo-400 font-bold uppercase tracking-wide">{hw.subject}</p>
                      <h3 className="text-lg font-extrabold text-white mt-0.5 group-hover:text-indigo-300 transition-colors">
                        {hw.title}
                      </h3>
                      <p className="text-xs text-slate-300 font-medium line-clamp-3 mt-1.5 leading-relaxed">
                        {hw.description}
                      </p>
                    </div>
                  </div>

                  {/* Due Date Indicator */}
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className={`h-4 w-4 ${isOverdue ? 'text-rose-400' : 'text-indigo-400'}`} />
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Due Date</span>
                        <span className={`font-bold ${isOverdue ? 'text-rose-400' : 'text-slate-200'}`}>
                          {hw.dueDate}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenSubmissionsModal(hw)}
                      className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> Submissions
                    </button>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span>Posted by </span>
                      <span className="font-bold text-slate-200">{hw.postedByName || 'Staff'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenHomeworkModal(hw)}
                        className="p-1.5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                        title="Edit Homework"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete({ id: hw.id, type: 'homework' });
                          setDeleteConfirmModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Delete Homework"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL 1: POST / EDIT CLASSWORK */}
      {classworkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-blue-400" />
                <h3 className="font-extrabold text-lg text-white">
                  {editingClasswork ? 'Edit Classwork' : 'Post New Classwork'}
                </h3>
              </div>
              <button
                onClick={() => setClassworkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitClasswork} className="space-y-4">
              {/* Batch Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Target Batch <span className="text-rose-400">*</span>
                </label>
                <select
                  value={cwBatchId}
                  onChange={(e) => setCwBatchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500 transition-colors"
                  required
                >
                  {isAdmin && <option value="ALL_BATCHES">★ Post to all batches (Bulk Create)</option>}
                  {userBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
                {!isAdmin && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Showing only batches assigned to you.
                  </p>
                )}
              </div>

              {/* Subject & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={cwSubject}
                    onChange={(e) => setCwSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Material Type</label>
                  <select
                    value={cwType}
                    onChange={(e) => setCwType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="notes">Notes / Slides</option>
                    <option value="practice">Practice Sheet</option>
                    <option value="video">Video Lesson</option>
                    <option value="file">Document / PDF</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 4 - Quadratic Equations Notes"
                  value={cwTitle}
                  onChange={(e) => setCwTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Enter summary or instructions for students..."
                  value={cwDescription}
                  onChange={(e) => setCwDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* File & Video URLs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Document / PDF Link</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={cwFileUrl}
                    onChange={(e) => setCwFileUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Video Lesson Link</label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/..."
                    value={cwVideoUrl}
                    onChange={(e) => setCwVideoUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setClassworkModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingClasswork ? 'Save Changes' : 'Post Classwork'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: POST / EDIT HOMEWORK */}
      {homeworkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h3 className="font-extrabold text-lg text-white">
                  {editingHomework ? 'Edit Homework' : 'Post New Homework'}
                </h3>
              </div>
              <button
                onClick={() => setHomeworkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitHomework} className="space-y-4">
              {/* Batch Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Target Batch <span className="text-rose-400">*</span>
                </label>
                <select
                  value={hwBatchId}
                  onChange={(e) => setHwBatchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                >
                  {isAdmin && <option value="ALL_BATCHES">★ Post to all batches (Bulk Create)</option>}
                  {userBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject & Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Physics"
                    value={hwSubject}
                    onChange={(e) => setHwSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Due Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={hwDueDate}
                    onChange={(e) => setHwDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assignment 3 - Laws of Motion Problems"
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Homework Instructions</label>
                <textarea
                  rows={4}
                  placeholder="Detail the questions to solve or submission instructions..."
                  value={hwDescription}
                  onChange={(e) => setHwDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setHomeworkModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingHomework ? 'Save Changes' : 'Post Homework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW HOMEWORK SUBMISSIONS */}
      {submissionsModalOpen && selectedHomeworkForSubmissions && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Submission Tracker
                </span>
                <h3 className="font-extrabold text-lg text-white mt-0.5">
                  {selectedHomeworkForSubmissions.title}
                </h3>
              </div>
              <button
                onClick={() => setSubmissionsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingSubmissions ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400 mb-2" />
                <p className="text-xs">Fetching student submissions...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Students roster for this batch */}
                {(() => {
                  const batchStudents = students.filter(
                    (s) => s.batchIds && s.batchIds.includes(selectedHomeworkForSubmissions.batchId)
                  );

                  if (batchStudents.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 text-center py-6">
                        No enrolled students found in this batch.
                      </p>
                    );
                  }

                  const isOverdueGlobal =
                    new Date(selectedHomeworkForSubmissions.dueDate).getTime() <
                    new Date().setHours(0, 0, 0, 0);

                  return (
                    <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {batchStudents.map((st) => {
                        const sub = submissions.find((s) => s.studentId === st.id);
                        const subStatus = sub?.status || (isOverdueGlobal ? 'overdue' : 'pending');

                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0">
                                {st.fullName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">{st.fullName}</p>
                                <p className="text-[10px] text-slate-400">Roll: {st.rollNumber || 'N/A'}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {sub ? (
                                <div className="flex items-center gap-2">
                                  {sub.submissionUrl && (
                                    <a
                                      href={sub.submissionUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                      title="View Submission"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" /> View
                                    </a>
                                  )}

                                  {subStatus === 'accepted' && (
                                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-[10px] uppercase rounded-full flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> Accepted
                                    </span>
                                  )}

                                  {subStatus === 'declined' && (
                                    <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase rounded-full">
                                      Declined
                                    </span>
                                  )}

                                  {(subStatus === 'under_observation' || subStatus === 'submitted') && (
                                    <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] uppercase rounded-full">
                                      Under Review
                                    </span>
                                  )}

                                  {/* Accept & Decline Action Buttons */}
                                  <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                    {subStatus !== 'accepted' && (
                                      <button
                                        onClick={() => handleAcceptSubmission(sub.id)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                                        title="Accept Submission"
                                      >
                                        Accept
                                      </button>
                                    )}
                                    {subStatus !== 'declined' && (
                                      <button
                                        onClick={() => handleDeclineSubmission(sub.id)}
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
                                        title="Decline Submission"
                                      >
                                        Decline
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : isOverdueGlobal ? (
                                <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase rounded-full">
                                  Overdue
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-[10px] uppercase rounded-full">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Delete Item?</h3>
              <p className="text-slate-400 text-xs mt-1">
                Are you sure you want to permanently delete this {itemToDelete?.type}? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
