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
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  Eye,
  X,
  Loader2,
  Shield,
  Briefcase,
  Award,
  DollarSign,
  Calendar,
  AlertTriangle,
  UserX,
  UserPlus,
  Check,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';

interface StaffUser {
  id: string;
  staffId?: string | null;
  password?: string | null;
  batchIds?: string[];
  name?: string;
  fullName?: string;
  email: string;
  role: 'owner' | 'admin' | 'teacher' | 'staff' | 'parent' | 'student';
  instituteId?: string | null;
  position?: string | null;
  qualification?: string | null;
  salary?: number | null;
  startDate?: string | null;
  isDeactivated?: boolean;
  status?: string;
  phone?: string | null;
  createdAt?: string;
}

export default function ErpStaff() {
  const { instituteId } = useAuth();
  const [usersList, setUsersList] = useState<StaffUser[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal State for Role Promotion & Editing
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  // Form State
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [staffBatchIds, setStaffBatchIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'teacher' | 'staff' | 'parent' | 'student'>('teacher');
  const [position, setPosition] = useState('');
  const [qualification, setQualification] = useState('');
  const [salary, setSalary] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [phone, setPhone] = useState('');
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch all users & batches matching institute
  useEffect(() => {
    if (!instituteId) return;

    // 1. Fetch Staff Users (strictly Owner, Admin, Teacher, Staff with deduplication by email/staffId)
    const usersCol = collection(db, 'users');
    const unsubUsers = onSnapshot(usersCol, (snapshot) => {
      const rawList: StaffUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userRole = (data.role || '').toLowerCase();
        const userEmail = (data.email || '').toLowerCase();
        // Strictly only include staff-level roles (owner, admin, teacher, staff)
        const isStaffRole = ['owner', 'admin', 'teacher', 'staff'].includes(userRole) || userEmail === 'aditiwari13705@gmail.com';

        if (isStaffRole && (!data.instituteId || data.instituteId === instituteId || data.instCode)) {
          rawList.push({ id: docSnap.id, ...data } as StaffUser);
        }
      });

      // Deduplicate by lowercased email or staffId to resolve duplicate entries (e.g. raj@1213 appearing twice)
      const deduplicatedMap = new Map<string, StaffUser>();

      rawList.forEach((userItem) => {
        const normEmail = (userItem.email || '').toLowerCase().trim();
        const normStaffId = (userItem.staffId || '').toLowerCase().trim();
        const key = normEmail || normStaffId || userItem.id;

        if (!deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, userItem);
        } else {
          // Merge fields into existing entry to keep most complete profile data
          const existing = deduplicatedMap.get(key)!;
          deduplicatedMap.set(key, {
            ...userItem,
            ...existing,
            staffId: existing.staffId || userItem.staffId,
            password: existing.password || userItem.password,
            batchIds: (existing.batchIds && existing.batchIds.length > 0) ? existing.batchIds : userItem.batchIds,
            position: existing.position || userItem.position,
            qualification: existing.qualification || userItem.qualification,
            salary: existing.salary || userItem.salary,
            startDate: existing.startDate || userItem.startDate,
            phone: existing.phone || userItem.phone,
            name: existing.name || existing.fullName || userItem.name || userItem.fullName
          });
        }
      });

      setUsersList(Array.from(deduplicatedMap.values()));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching staff users:', err);
      setLoading(false);
    });

    // 2. Fetch Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const bList: any[] = [];
      snapshot.forEach((d) => bList.push({ id: d.id, ...d.data() }));
      setBatchesList(bList);
    });

    return () => {
      unsubUsers();
      unsubBatches();
    };
  }, [instituteId]);

  const handleToggleBatchSelect = (batchId: string) => {
    setStaffBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    );
  };

  const openCreateModal = () => {
    setEditingUser(null);
    const nextNum = usersList.length + 1;
    setStaffId(`STF-${String(nextNum).padStart(3, '0')}`);
    setPassword(`Staff${Math.floor(100 + Math.random() * 900)}#`);
    setStaffBatchIds([]);
    setName('');
    setEmail('');
    setRole('teacher');
    setPosition('Faculty Teacher');
    setQualification('');
    setSalary(25000);
    setStartDate(new Date().toISOString().substring(0, 10));
    setPhone('');
    setIsDeactivated(false);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (userItem: StaffUser) => {
    setEditingUser(userItem);
    setStaffId(userItem.staffId || '');
    setPassword(userItem.password || '');
    setStaffBatchIds(userItem.batchIds || []);
    setName(userItem.name || userItem.fullName || '');
    setEmail(userItem.email || '');
    setRole(userItem.role || 'teacher');
    setPosition(userItem.position || '');
    setQualification(userItem.qualification || '');
    setSalary(userItem.salary || 0);
    setStartDate(userItem.startDate || '');
    setPhone(userItem.phone || '');
    setIsDeactivated(!!userItem.isDeactivated);
    setError('');
    setModalOpen(true);
  };

  // Submit User Role & Profile Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;

    if (!email) {
      setError('Email address is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        staffId: staffId.trim() || null,
        password: password.trim() || null,
        batchIds: staffBatchIds,
        name,
        fullName: name,
        email: email.toLowerCase().trim(),
        role,
        instituteId, // Assigned to this institute
        position,
        qualification,
        salary: Number(salary),
        startDate,
        phone,
        isDeactivated,
        status: isDeactivated ? 'inactive' : 'active',
        updatedAt: new Date().toISOString()
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.id), payload);
      } else {
        // Invite/Create user document in Firestore
        await addDoc(collection(db, 'users'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Error updating staff role:', err);
      setError(err.message || 'Failed to update staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Deactivate / Delete Action (Check history before deleting)
  const handleToggleDeactivate = async (userItem: StaffUser) => {
    if (!instituteId) return;

    const newDeactivatedState = !userItem.isDeactivated;
    const actionLabel = newDeactivatedState ? 'deactivate' : 'reactivate';

    if (!confirm(`Are you sure you want to ${actionLabel} account for ${userItem.email}?`)) return;

    try {
      await updateDoc(doc(db, 'users', userItem.id), {
        isDeactivated: newDeactivatedState,
        status: newDeactivatedState ? 'inactive' : 'active',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error toggling staff status:', err);
      alert('Failed to update staff status.');
    }
  };

  const handleDeleteStaffWithHistoryCheck = async (userItem: StaffUser) => {
    if (!instituteId) return;

    try {
      // 1. Check if user has attendance or payment history tied to them
      const staffAttendQuery = query(
        collection(db, 'institutes', instituteId, 'staffAttendance'),
        where('userId', '==', userItem.id)
      );
      const staffSnap = await getDocs(staffAttendQuery);

      const batchesQuery = query(
        collection(db, 'institutes', instituteId, 'batches'),
        where('teacherId', '==', userItem.id)
      );
      const batchSnap = await getDocs(batchesQuery);

      const hasHistory = !staffSnap.empty || !batchSnap.empty;

      if (hasHistory) {
        alert(
          `Cannot hard-delete ${userItem.name || userItem.email} because they have historical attendance records or taught batches linked to them. The account will be deactivated instead.`
        );
        await updateDoc(doc(db, 'users', userItem.id), {
          isDeactivated: true,
          status: 'inactive',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      if (!confirm(`Are you sure you want to delete user profile ${userItem.email}?`)) return;
      await deleteDoc(doc(db, 'users', userItem.id));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user.');
    }
  };

  // Filter users list (strictly Admin, Owner, Teacher, and Staff)
  const filteredUsers = usersList.filter((u) => {
    const userRole = (u.role || '').toLowerCase();
    const userEmail = (u.email || '').toLowerCase();
    const isStaffRole = ['owner', 'admin', 'teacher', 'staff'].includes(userRole) || userEmail === 'aditiwari13705@gmail.com';
    if (!isStaffRole) return false;

    const displayName = u.name || u.fullName || u.email;
    const matchesSearch =
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.staffId || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === '' || userRole === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Staff Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Staff Management</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Manage staff members, promote roles, assign institute permissions, and update profiles.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
        >
          <UserPlus className="h-5 w-5" />
          Add / Invite Staff
        </button>
      </div>

      {/* Search & Role Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-bold text-xs"
            placeholder="Search by name, email, or Staff ID..."
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Staff Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>

      {/* Staff Directory Table */}
      {filteredUsers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <UserCheck className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-extrabold text-white">No Accounts Found</h3>
          <p className="text-slate-400 text-xs mt-2 font-medium">
            Try adjusting your search criteria or invite a new staff member.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Staff ID</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Portal Password</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Position</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                {filteredUsers.map((userItem) => {
                  const isDeactivated = !!userItem.isDeactivated;

                  const roleBadgeStyles: any = {
                    owner: 'bg-amber-950/40 text-amber-400 border-amber-900/40',
                    admin: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/40',
                    teacher: 'bg-blue-950/40 text-blue-400 border-blue-900/40',
                    staff: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
                    student: 'bg-slate-850 text-slate-400 border-slate-800'
                  };

                  return (
                    <tr
                      key={userItem.id}
                      className={`hover:bg-slate-850/40 transition-colors ${
                        isDeactivated ? 'opacity-50 bg-slate-955/50' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-black text-indigo-400">
                            {(userItem.name || userItem.fullName || userItem.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/erp/staff/${userItem.id}`}
                              className="font-bold text-white hover:text-indigo-400 hover:underline transition-colors block"
                            >
                              {userItem.name || userItem.fullName || 'User Profile'}
                            </Link>
                            {userItem.qualification && (
                              <span className="text-[10px] text-slate-500">{userItem.qualification}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-indigo-400 font-mono font-bold">
                        {userItem.staffId || 'N/A'}
                      </td>

                      <td className="p-4 text-slate-300 font-mono">{userItem.email}</td>

                      <td className="p-4 font-mono text-emerald-400">
                        {userItem.password ? userItem.password : '••••••••'}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[9px] font-extrabold border rounded uppercase tracking-wider ${
                            roleBadgeStyles[userItem.role] || roleBadgeStyles.student
                          }`}
                        >
                          {userItem.role}
                        </span>
                      </td>

                      <td className="p-4 text-slate-400">{userItem.position || 'N/A'}</td>

                      <td className="p-4">
                        {isDeactivated ? (
                          <span className="px-2 py-0.5 text-[9px] font-extrabold bg-red-950/40 text-red-400 border border-red-900/40 rounded uppercase">
                            Deactivated
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded uppercase">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/erp/staff/${userItem.id}`}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => openEditModal(userItem)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="Edit Role / Info"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleDeactivate(userItem)}
                            className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-950/20 rounded-xl transition-colors cursor-pointer"
                            title={isDeactivated ? 'Reactivate User' : 'Deactivate User'}
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStaffWithHistoryCheck(userItem)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                            title="Delete User"
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

      {/* CRUD / Role Promotion Modal */}
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
              {editingUser ? 'Edit Staff Profile & Role' : 'Add / Promote Staff Member'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Staff ID & Password Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-955/40 border border-indigo-900/40 p-4 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest pl-1">
                    Staff ID (Portal Login ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="STF-101"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest pl-1">
                    Staff Portal Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-4 pr-10 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                      placeholder="Enter password..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Dr. Ramesh Kumar"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {/* Allotted Batches Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Allotted Batches (For Classwork, Homework, Exams)
                </label>
                <div className="bg-slate-955 border border-slate-800 p-3 rounded-2xl max-h-32 overflow-y-auto space-y-1.5">
                  {batchesList.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic p-2">No batches created in institute yet.</div>
                  ) : (
                    batchesList.map((b) => {
                      const isAssigned = staffBatchIds.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleToggleBatchSelect(b.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                            isAssigned ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>{b.name} ({b.subject})</span>
                          {isAssigned && <Check className="h-4 w-4 text-indigo-400" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Role Promotion Selector */}
              <div className="space-y-1.5 bg-slate-955 border border-slate-800 p-4 rounded-2xl">
                <label className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Assigned System Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="owner">Owner (Full Admin Access)</option>
                  <option value="admin">Admin (Full Access to Staff & Fees)</option>
                  <option value="teacher">Teacher (Restricted to Assigned Batches)</option>
                  <option value="staff">Staff (Operational Access)</option>
                  <option value="student">Student (Portal Access Only)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Job Title / Position
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Senior Physics Faculty"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. M.Sc Physics, B.Ed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Salary (Monthly)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Deactivation Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="deactivate-checkbox"
                  type="checkbox"
                  checked={isDeactivated}
                  onChange={(e) => setIsDeactivated(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-955 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <label htmlFor="deactivate-checkbox" className="text-xs font-bold text-slate-400 cursor-pointer">
                  Deactivate this staff member's account access
                </label>
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
                  {submitting ? 'Saving...' : 'Save Staff Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
