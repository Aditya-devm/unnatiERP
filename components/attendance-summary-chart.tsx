'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock3, AlertCircle, Sparkles } from 'lucide-react';

interface AttendanceRecord {
  id?: string;
  date: string;
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'late' | 'excused' | string;
  [key: string]: any;
}

interface Props {
  records: AttendanceRecord[];
  title?: string;
}

export default function AttendanceSummaryChart({ records, title = 'Attendance Summary' }: Props) {
  const currentMonthKey = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Remap legacy statuses
  const normalizedRecords = records.map((r) => {
    let s = r.status ? r.status.toLowerCase() : 'present';
    if (s === 'late' || s === 'excused') s = 'leave';
    return { ...r, normalizedStatus: s };
  });

  // Filter records by selected month
  const monthRecords = normalizedRecords.filter(
    (r) => r.date && r.date.startsWith(selectedMonth)
  );

  const totalMarked = monthRecords.length;
  const presentCount = monthRecords.filter((r) => r.normalizedStatus === 'present').length;
  const absentCount = monthRecords.filter((r) => r.normalizedStatus === 'absent').length;
  const leaveCount = monthRecords.filter((r) => r.normalizedStatus === 'leave').length;
  const holidayCount = monthRecords.filter((r) => r.normalizedStatus === 'holiday').length;

  const presentPct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
  const absentPct = totalMarked > 0 ? Math.round((absentCount / totalMarked) * 100) : 0;
  const leavePct = totalMarked > 0 ? Math.round((leaveCount / totalMarked) * 100) : 0;
  const holidayPct = totalMarked > 0 ? Math.round((holidayCount / totalMarked) * 100) : 0;

  // Recent 6 months for dropdown
  const monthOptions = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { key, label };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">{title}</h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
              Monthly breakdown across Present, Absent, Leave & Holiday statuses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-955 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Present */}
        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Present</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{presentCount}</span>
            <span className="text-[10px] font-bold text-emerald-400/80 block mt-0.5">{presentPct}% of total</span>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest">Absent</span>
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{absentCount}</span>
            <span className="text-[10px] font-bold text-red-400/80 block mt-0.5">{absentPct}% of total</span>
          </div>
        </div>

        {/* Leave */}
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">Leave</span>
            <Clock3 className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{leaveCount}</span>
            <span className="text-[10px] font-bold text-amber-400/80 block mt-0.5">{leavePct}% of total</span>
          </div>
        </div>

        {/* Holiday */}
        <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">Holiday</span>
            <AlertCircle className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{holidayCount}</span>
            <span className="text-[10px] font-bold text-blue-400/80 block mt-0.5">{holidayPct}% of total</span>
          </div>
        </div>
      </div>

      {/* Progress Bar Visualization */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-400">
          <span>Monthly Status Share</span>
          <span>{totalMarked} Marked Session{totalMarked === 1 ? '' : 's'}</span>
        </div>
        <div className="h-4 w-full bg-slate-955 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          {totalMarked > 0 ? (
            <>
              {presentCount > 0 && (
                <div
                  style={{ width: `${presentPct}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                  title={`Present: ${presentCount} (${presentPct}%)`}
                />
              )}
              {absentCount > 0 && (
                <div
                  style={{ width: `${absentPct}%` }}
                  className="bg-red-500 h-full transition-all duration-500"
                  title={`Absent: ${absentCount} (${absentPct}%)`}
                />
              )}
              {leaveCount > 0 && (
                <div
                  style={{ width: `${leavePct}%` }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Leave: ${leaveCount} (${leavePct}%)`}
                />
              )}
              {holidayCount > 0 && (
                <div
                  style={{ width: `${holidayPct}%` }}
                  className="bg-blue-500 h-full rounded-r-full transition-all duration-500"
                  title={`Holiday: ${holidayCount} (${holidayPct}%)`}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full bg-slate-800/60 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              No sessions marked for this month
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
