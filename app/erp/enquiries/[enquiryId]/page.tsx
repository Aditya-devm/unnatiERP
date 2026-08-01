'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Phone,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  X,
  UserCheck,
  Flame,
  Thermometer,
  Snowflake,
  UserX,
  Sparkles,
  FileText,
  Send
} from 'lucide-react';
import Link from 'next/link';

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  interestedBatch: string;
  status: 'hot' | 'warm' | 'cold' | 'dead' | 'converted';
  source: string;
  assignedTo: string;
  createdAt?: string;
}

interface Followup {
  id: string;
  enquiryId: string;
  followupDate: string;
  notes: string;
  nextFollowupDate: string;
  createdBy: string;
  createdAt?: string;
}

interface Batch {
  id: string;
  name: string;
  subject: string;
}

interface StaffUser {
  id: string;
  name: string;
}

export default function EnquiryDetail() {
  const { user, instituteId } = useAuth();
  const { enquiryId } = useParams() as { enquiryId: string };
  const router = useRouter();

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Followup Form State
  const [followupDate, setFollowupDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [notes, setNotes] = useState<string>('');
  const [nextFollowupDate, setNextFollowupDate] = useState<string>('');
  const [updatedStatus, setUpdatedStatus] = useState<'hot' | 'warm' | 'cold' | 'dead' | 'converted'>('hot');

  // Convert to Student Modal State
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [studentFullName, setStudentFullName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentParentName, setStudentParentName] = useState('');
  const [studentParentPhone, setStudentParentPhone] = useState('');
  const [studentEnrollmentDate, setStudentEnrollmentDate] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!instituteId || !enquiryId) return;

    // 1. Fetch Enquiry Detail
    const enquiryDocRef = doc(db, 'institutes', instituteId, 'enquiries', enquiryId);
    const unsubEnquiry = onSnapshot(enquiryDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEnquiry({ ...data, id: docSnap.id } as Enquiry);
        setUpdatedStatus(data.status || 'hot');
      } else {
        setEnquiry(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching enquiry:', err);
      setLoading(false);
    });

    // 2. Fetch Followups for this Enquiry
    const followupsCol = collection(db, 'institutes', instituteId, 'enquiryFollowups');
    const followupsQuery = query(followupsCol, where('enquiryId', '==', enquiryId));
    const unsubFollowups = onSnapshot(followupsQuery, (snapshot) => {
      const list: Followup[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Followup);
      });
      // Sort chronologically (oldest to newest or newest to oldest)
      list.sort((a, b) => new Date(b.followupDate).getTime() - new Date(a.followupDate).getTime());
      setFollowups(list);
    });

    // 3. Fetch Batches
    getDocs(collection(db, 'institutes', instituteId, 'batches')).then((snap) => {
      const list: Batch[] = [];
      snap.forEach((d) => list.push({ id: d.id, name: d.data().name, subject: d.data().subject }));
      setBatches(list);
    });

    // 4. Fetch Staff
    getDocs(query(collection(db, 'users'), where('role', 'in', ['owner', 'admin', 'teacher', 'staff']))).then((snap) => {
      const list: StaffUser[] = [];
      snap.forEach((d) => list.push({ id: d.id, name: d.data().name || d.data().email?.split('@')[0] || 'Staff' }));
      setStaffUsers(list);
    });

    return () => {
      unsubEnquiry();
      unsubFollowups();
    };
  }, [instituteId, enquiryId]);

  // Log Follow-up
  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !enquiry) return;

    if (!notes || !followupDate) {
      setError('Please provide notes and follow-up date.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const createdBy = user?.email || user?.uid || 'Staff';

      // 1. Add follow-up record to enquiryFollowups
      await addDoc(collection(db, 'institutes', instituteId, 'enquiryFollowups'), {
        enquiryId: enquiry.id,
        followupDate,
        notes,
        nextFollowupDate: nextFollowupDate || null,
        createdBy,
        createdAt: new Date().toISOString()
      });

      // 2. Update status & timestamp on enquiry
      await updateDoc(doc(db, 'institutes', instituteId, 'enquiries', enquiry.id), {
        status: updatedStatus,
        updatedAt: new Date().toISOString()
      });

      setNotes('');
      setNextFollowupDate('');
    } catch (err: any) {
      console.error('Error logging follow-up:', err);
      setError(err.message || 'Failed to log follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open "Convert to Student" Modal
  const openConvertModal = () => {
    if (!enquiry) return;
    setStudentFullName(enquiry.name);
    setStudentPhone(enquiry.phone);
    setStudentParentName('');
    setStudentParentPhone(enquiry.phone);
    setStudentEnrollmentDate(new Date().toISOString().substring(0, 10));
    setSelectedBatchIds(enquiry.interestedBatch ? [enquiry.interestedBatch] : []);
    setError('');
    setConvertModalOpen(true);
  };

  // Convert Enquiry -> Create Student Document
  const handleConvertStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !enquiry) return;

    if (!studentFullName || !studentPhone || !studentEnrollmentDate) {
      setError('Please fill in required student fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. Create Student Document in institutes/{instituteId}/students
      await addDoc(collection(db, 'institutes', instituteId, 'students'), {
        fullName: studentFullName,
        dateOfBirth: '',
        gender: 'male',
        phone: studentPhone,
        parentName: studentParentName || 'Parent',
        parentPhone: studentParentPhone || studentPhone,
        address: '',
        photoUrl: null,
        pendingPhotoUrl: null,
        enrollmentDate: studentEnrollmentDate,
        status: 'active',
        batchIds: selectedBatchIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 2. Update Enquiry Status to 'converted'
      await updateDoc(doc(db, 'institutes', instituteId, 'enquiries', enquiry.id), {
        status: 'converted',
        updatedAt: new Date().toISOString()
      });

      setConvertModalOpen(false);
      alert(`Success! Lead converted to active student profile.`);
    } catch (err: any) {
      console.error('Error converting lead to student:', err);
      setError(err.message || 'Failed to convert lead to student.');
    } finally {
      setSubmitting(false);
    }
  };

  const getBatchName = (bId: string) => {
    const batch = batches.find((b) => b.id === bId);
    return batch ? `${batch.name} (${batch.subject})` : 'Batch';
  };

  const getStaffName = (sId: string) => {
    const staff = staffUsers.find((s) => s.id === sId);
    return staff ? staff.name : 'Staff';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Lead Details...</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto mt-10">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-extrabold text-white">Lead Not Found</h3>
        <p className="text-slate-400 text-xs mt-2 font-medium">
          The requested enquiry record does not exist or has been removed.
        </p>
        <Link
          href="/erp/enquiries"
          className="mt-5 inline-flex items-center gap-2 bg-slate-850 border border-slate-750 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Enquiries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Back Button */}
      <div>
        <Link
          href="/erp/enquiries"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Enquiries
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative overflow-hidden">
        <div>
          <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest block mb-1">
            Enquiry Record #{enquiry.id.substring(0, 8).toUpperCase()}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{enquiry.name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-xs font-semibold text-slate-350">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-indigo-400" /> {enquiry.phone}
            </span>
            {enquiry.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-indigo-400" /> {enquiry.email}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-indigo-400" /> Assigned: {getStaffName(enquiry.assignedTo)}
            </span>
          </div>
        </div>

        {/* Action Button: Convert to Student */}
        <div className="flex flex-col items-end gap-3">
          <span className="px-3 py-1 text-[10px] font-black border rounded-md uppercase tracking-wider bg-amber-950/40 text-amber-400 border-amber-900/40">
            Status: {enquiry.status}
          </span>
          {enquiry.status !== 'converted' && (
            <button
              onClick={openConvertModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> Convert to Student
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Log Follow-up & Historical Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Log Follow-up Form */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Send className="h-4.5 w-4.5 text-indigo-400" /> Log Phone / Meeting Follow-up
            </h3>

            {error && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleAddFollowup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Follow-up Date *
                </label>
                <input
                  type="date"
                  required
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Discussion Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Record summary of call, parent requirements, or next steps..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Next Follow-up Date (Optional)
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Update Lead Temperature Status
                </label>
                <select
                  value={updatedStatus}
                  onChange={(e) => setUpdatedStatus(e.target.value as any)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="hot">Hot (High Intent)</option>
                  <option value="warm">Warm (Considering)</option>
                  <option value="cold">Cold (Low Response)</option>
                  <option value="dead">Dead (Not Interested)</option>
                  <option value="converted">Converted</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log Follow-up Record'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Follow-up Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-extrabold text-white tracking-tight border-b border-slate-800 pb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" /> Follow-up Activity Timeline ({followups.length})
            </h3>

            {followups.length === 0 ? (
              <div className="bg-slate-955 border border-slate-850 rounded-2xl p-8 text-center text-slate-500 italic text-xs font-bold">
                No follow-up logs recorded for this lead yet. Use the form to log your first call.
              </div>
            ) : (
              <div className="space-y-4">
                {followups.map((item) => (
                  <div key={item.id} className="bg-slate-955 border border-slate-850 p-5 rounded-2xl space-y-2 relative">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Date: {item.followupDate}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Logged by: {item.createdBy}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium leading-relaxed pt-1">
                      {item.notes}
                    </p>

                    {item.nextFollowupDate && (
                      <div className="pt-2 text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Scheduled Next Follow-up: {item.nextFollowupDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Convert to Student Handoff Modal */}
      {convertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setConvertModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-2">
              Convert Lead to Student
            </h2>
            <p className="text-xs text-slate-400 font-semibold mb-6">
              Confirm pre-filled student information below to generate active student profile.
            </p>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleConvertStudent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentFullName}
                  onChange={(e) => setStudentFullName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Student Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Enrollment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={studentEnrollmentDate}
                    onChange={(e) => setStudentEnrollmentDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Parent Name
                  </label>
                  <input
                    type="text"
                    value={studentParentName}
                    onChange={(e) => setStudentParentName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Guardian Name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Parent Phone
                  </label>
                  <input
                    type="text"
                    value={studentParentPhone}
                    onChange={(e) => setStudentParentPhone(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setConvertModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Converting...' : 'Create Student Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
