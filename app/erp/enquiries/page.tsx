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
  HelpCircle,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Flame,
  Thermometer,
  Snowflake,
  UserX,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  X
} from 'lucide-react';
import Link from 'next/link';

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  interestedBatch: string;
  status: 'hot' | 'warm' | 'cold' | 'dead' | 'converted';
  source: 'walk-in' | 'referral' | 'website';
  assignedTo: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Batch {
  id: string;
  name: string;
  subject: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
}

interface Followup {
  id: string;
  enquiryId: string;
  followupDate: string;
  notes: string;
  nextFollowupDate: string;
  createdBy: string;
}

export default function ErpEnquiries() {
  const { instituteId } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  // Intake Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [interestedBatch, setInterestedBatch] = useState('');
  const [source, setSource] = useState<'walk-in' | 'referral' | 'website'>('walk-in');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState<'hot' | 'warm' | 'cold' | 'dead' | 'converted'>('hot');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch Firestore Collections
  useEffect(() => {
    if (!instituteId) return;

    // 1. Enquiries
    const enquiriesCol = collection(db, 'institutes', instituteId, 'enquiries');
    const unsubEnquiries = onSnapshot(enquiriesCol, (snapshot) => {
      const list: Enquiry[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Enquiry);
      });
      setEnquiries(list);
      setLoading(false);
    });

    // 2. Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, name: d.name, subject: d.subject });
      });
      setBatches(list);
      if (list.length > 0 && !interestedBatch) {
        setInterestedBatch(list[0].id);
      }
    });

    // 3. Staff Users for assignment
    const usersCol = collection(db, 'users');
    const usersQuery = query(usersCol, where('role', 'in', ['owner', 'admin', 'teacher', 'staff']));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const list: StaffUser[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || d.fullName || d.email?.split('@')[0] || 'Staff',
          email: d.email || ''
        });
      });
      setStaffUsers(list);
      if (list.length > 0 && !assignedTo) {
        setAssignedTo(list[0].id);
      }
    });

    // 4. Followups (for calculating overdue follow-up dates)
    const followupsCol = collection(db, 'institutes', instituteId, 'enquiryFollowups');
    const unsubFollowups = onSnapshot(followupsCol, (snapshot) => {
      const list: Followup[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Followup);
      });
      setFollowups(list);
    });

    return () => {
      unsubEnquiries();
      unsubBatches();
      unsubUsers();
      unsubFollowups();
    };
  }, [instituteId]);

  // Open Intake Modal
  const openCreateModal = () => {
    setName('');
    setPhone('');
    setEmail('');
    setSource('walk-in');
    setStatus('hot');
    setError('');
    setModalOpen(true);
  };

  // Submit Intake Form
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (!name || !phone || !interestedBatch || !assignedTo) {
      setError('Please fill in name, phone, interested batch, and assigned staff.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name,
        phone,
        email,
        interestedBatch,
        status,
        source,
        assignedTo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'institutes', instituteId, 'enquiries'), payload);
      setModalOpen(false);
    } catch (err: any) {
      console.error('Error saving enquiry:', err);
      setError(err.message || 'Failed to save enquiry intake.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Enquiry
  const handleDeleteEnquiry = async (enquiryId: string) => {
    if (!instituteId) return;
    if (!confirm('Are you sure you want to delete this lead?')) return;

    try {
      await deleteDoc(doc(db, 'institutes', instituteId, 'enquiries', enquiryId));
    } catch (err) {
      console.error('Error deleting enquiry:', err);
      alert('Failed to delete enquiry.');
    }
  };

  // Helper: Find latest nextFollowupDate for an enquiry
  const getLatestNextFollowupDate = (enquiryId: string) => {
    const leadFollowups = followups.filter((f) => f.enquiryId === enquiryId);
    if (leadFollowups.length === 0) return null;
    // Sort by followupDate descending
    leadFollowups.sort(
      (a, b) => new Date(b.followupDate).getTime() - new Date(a.followupDate).getTime()
    );
    return leadFollowups[0].nextFollowupDate || null;
  };

  const todayStr = new Date().toISOString().substring(0, 10);

  // Overdue Enquiries Widget (nextFollowupDate < today, status not converted/dead)
  const overdueEnquiries = enquiries.filter((enquiry) => {
    if (enquiry.status === 'converted' || enquiry.status === 'dead') return false;
    const nextDate = getLatestNextFollowupDate(enquiry.id);
    return nextDate && nextDate < todayStr;
  });

  // Filtered Enquiries
  const filteredEnquiries = enquiries.filter((enquiry) => {
    const matchesSearch =
      enquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enquiry.phone.includes(searchQuery);
    const matchesStatus = statusFilter === '' || enquiry.status === statusFilter;
    const matchesAssigned = assignedFilter === '' || enquiry.assignedTo === assignedFilter;
    return matchesSearch && matchesStatus && matchesAssigned;
  });

  // Counts by status
  const hotCount = enquiries.filter((e) => e.status === 'hot').length;
  const warmCount = enquiries.filter((e) => e.status === 'warm').length;
  const coldCount = enquiries.filter((e) => e.status === 'cold').length;
  const deadCount = enquiries.filter((e) => e.status === 'dead').length;
  const convertedCount = enquiries.filter((e) => e.status === 'converted').length;

  const getStaffName = (sId: string) => {
    const staff = staffUsers.find((u) => u.id === sId);
    return staff ? staff.name : 'Staff';
  };

  const getBatchName = (bId: string) => {
    const batch = batches.find((b) => b.id === bId);
    return batch ? `${batch.name} (${batch.subject})` : 'Batch';
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Lead & Enquiry Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Enquiry & Lead Management</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Track admission leads, schedule phone follow-ups, and convert prospect queries to batch signups.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          New Enquiry Intake
        </button>
      </div>

      {/* Status Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Hot Leads</span>
            <span className="text-xl font-black text-white">{hotCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
            <Thermometer className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Warm Leads</span>
            <span className="text-xl font-black text-white">{warmCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <Snowflake className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Cold Leads</span>
            <span className="text-xl font-black text-white">{coldCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Dead Leads</span>
            <span className="text-xl font-black text-white">{deadCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Converted</span>
            <span className="text-xl font-black text-emerald-400">{convertedCount}</span>
          </div>
        </div>
      </div>

      {/* Overdue Follow-ups Widget */}
      {overdueEnquiries.length > 0 && (
        <div className="bg-amber-955/30 border border-amber-900/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <span>Overdue Follow-ups Action Alert ({overdueEnquiries.length} leads)</span>
          </div>
          <p className="text-xs text-slate-350 font-semibold">
            The following prospective leads have follow-up dates that are past due. Please review and log updates.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {overdueEnquiries.map((lead) => {
              const nextDate = getLatestNextFollowupDate(lead.id);
              return (
                <div
                  key={lead.id}
                  className="bg-slate-900 border border-amber-900/40 p-3.5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{lead.name}</span>
                    <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                      Next Followup Was: {nextDate}
                    </span>
                  </div>
                  <Link
                    href={`/erp/enquiries/${lead.id}`}
                    className="p-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    Log Update <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-bold text-xs"
            placeholder="Search leads by name or phone..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="dead">Dead</option>
            <option value="converted">Converted</option>
          </select>

          {/* Assigned Staff Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Assigned Staff</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enquiries Table */}
      {filteredEnquiries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <HelpCircle className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-extrabold text-white">No Enquiries Found</h3>
          <p className="text-slate-400 text-xs mt-2 font-medium">
            Try adjusting your filters or create a new enquiry intake.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                  <th className="p-4">Lead Name</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Interested Batch</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                {filteredEnquiries.map((enquiry) => {
                  const statusBadges: any = {
                    hot: 'bg-amber-950/40 text-amber-400 border-amber-900/40',
                    warm: 'bg-orange-950/40 text-orange-400 border-orange-900/40',
                    cold: 'bg-blue-950/40 text-blue-400 border-blue-900/40',
                    dead: 'bg-slate-850 text-slate-400 border-slate-800',
                    converted: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                  };

                  return (
                    <tr key={enquiry.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-4">
                        <Link
                          href={`/erp/enquiries/${enquiry.id}`}
                          className="font-bold text-white hover:text-indigo-400 hover:underline transition-colors text-sm"
                        >
                          {enquiry.name}
                        </Link>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-slate-300">{enquiry.phone}</span>
                          {enquiry.email && <span className="text-[10px] text-slate-500 font-mono">{enquiry.email}</span>}
                        </div>
                      </td>

                      <td className="p-4 text-slate-300">{getBatchName(enquiry.interestedBatch)}</td>

                      <td className="p-4 text-slate-400 capitalize">{enquiry.source || 'Walk-in'}</td>

                      <td className="p-4 text-slate-300">{getStaffName(enquiry.assignedTo)}</td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[9px] font-extrabold border rounded uppercase tracking-wider ${
                            statusBadges[enquiry.status] || statusBadges.warm
                          }`}
                        >
                          {enquiry.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/erp/enquiries/${enquiry.id}`}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="View & Log Follow-up"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteEnquiry(enquiry.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Intake Modal */}
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
              New Enquiry Lead Intake
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitIntake} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Prospect Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Vijay Kumar"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Interested Batch *
                  </label>
                  <select
                    required
                    value={interestedBatch}
                    onChange={(e) => setInterestedBatch(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Lead Source
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="walk-in">Walk-in</option>
                    <option value="referral">Referral</option>
                    <option value="website">Website</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Assigned Staff *
                  </label>
                  <select
                    required
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Lead Temperature
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
