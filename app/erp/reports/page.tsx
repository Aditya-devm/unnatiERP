'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import {
  BarChart2,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  MessageSquare,
  Mail,
  Smartphone,
  Loader2,
  AlertTriangle,
  Send,
  Zap
} from 'lucide-react';
import { sendNotification } from '@/lib/notifications';

interface NotificationLog {
  id: string;
  recipientId?: string | null;
  recipientStudentId?: string | null;
  channel: 'sms' | 'email' | 'push';
  message: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: string;
}

interface Student {
  id: string;
  fullName: string;
  phone: string;
}

export default function ErpReports() {
  const { instituteId } = useAuth();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [testingFailure, setTestingFailure] = useState(false);

  useEffect(() => {
    if (!instituteId) return;

    // 1. Notifications Log
    const notificationsCol = collection(db, 'institutes', instituteId, 'notifications');
    const unsubLogs = onSnapshot(notificationsCol, (snapshot) => {
      const list: NotificationLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as NotificationLog);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setLogs(list);
      setLoading(false);
    });

    // 2. Students for name lookup
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({ id: docSnap.id, fullName: d.fullName || 'Student', phone: d.phone || '' });
      });
      setStudents(list);
    });

    return () => {
      unsubLogs();
      unsubStudents();
    };
  }, [instituteId]);

  // Simulate API Failure Test Action
  const handleSimulateFailure = async () => {
    if (!instituteId) return;
    setTestingFailure(true);
    try {
      await sendNotification({
        instituteId,
        recipientStudentId: 'test-student-id',
        channel: 'sms',
        message: 'TEST DISPATCH: Simulating SMS gateway failure for error logging verification.',
        simulateFailure: true
      });
    } catch (err: any) {
      alert(`Expected Failure Verified! Error thrown: "${err.message}". Log record updated to status=failed.`);
    } finally {
      setTestingFailure(false);
    }
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    const matchesChannel = channelFilter === '' || log.channel === channelFilter;
    const matchesStatus = statusFilter === '' || log.status === statusFilter;
    const matchesSearch =
      searchQuery === '' || log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesStatus && matchesSearch;
  });

  const totalSent = logs.filter((l) => l.status === 'sent').length;
  const totalFailed = logs.filter((l) => l.status === 'failed').length;
  const totalSms = logs.filter((l) => l.channel === 'sms').length;
  const totalEmail = logs.filter((l) => l.channel === 'email').length;

  const getStudentName = (sId?: string | null) => {
    if (!sId) return 'N/A';
    const s = students.find((st) => st.id === sId);
    return s ? `${s.fullName} (${s.phone})` : sId;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Notification Audit Logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Notification Audit Logs & Reports</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Track SMS, Email, and Push notification dispatches, gateway responses, and failure audits.
          </p>
        </div>

        {/* Action: Simulate API Failure Test */}
        <button
          onClick={handleSimulateFailure}
          disabled={testingFailure}
          className="flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          {testingFailure ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Simulate API Failure Test
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Sent Successfully</span>
            <span className="text-xl font-black text-emerald-400">{totalSent}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Failed Attempts</span>
            <span className="text-xl font-black text-red-400">{totalFailed}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">SMS Messages</span>
            <span className="text-xl font-black text-white">{totalSms}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Emails Sent</span>
            <span className="text-xl font-black text-white">{totalEmail}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-955 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-bold text-xs"
            placeholder="Search by message content..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="push">Push</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <Bell className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-extrabold text-white">No Notification Logs</h3>
          <p className="text-slate-400 text-xs mt-2 font-medium">
            No notification records match your filter criteria. Trigger a fee reminder or absence alert.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-955 text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                  <th className="p-4">Sent Date & Time</th>
                  <th className="p-4">Recipient Student</th>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Message Content</th>
                  <th className="p-4">Gateway Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-bold">
                {filteredLogs.map((log) => {
                  const channelBadges: any = {
                    sms: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/40',
                    email: 'bg-blue-950/40 text-blue-400 border-blue-900/40',
                    push: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                  };

                  const statusBadges: any = {
                    sent: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
                    failed: 'bg-red-950/40 text-red-400 border-red-900/40',
                    pending: 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-4 text-slate-300 font-mono text-[11px]">
                        {new Date(log.sentAt).toLocaleString()}
                      </td>

                      <td className="p-4 text-white">
                        {getStudentName(log.recipientStudentId || log.recipientId)}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[9px] font-extrabold border rounded uppercase tracking-wider ${
                            channelBadges[log.channel] || channelBadges.sms
                          }`}
                        >
                          {log.channel}
                        </span>
                      </td>

                      <td className="p-4 text-slate-300 font-medium max-w-xs truncate">
                        {log.message}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[9px] font-extrabold border rounded uppercase tracking-wider ${
                            statusBadges[log.status] || statusBadges.sent
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
