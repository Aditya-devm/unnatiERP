'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, doc } from 'firebase/firestore';

export default function PortalWorksheetsPage() {
  const { instituteId, user, role } = useAuth();
  const isStaff = role === 'teacher' || role === 'staff';

  const [student, setStudent] = useState<any>(null);
  const [permissionsConfig, setPermissionsConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instituteId || !user) {
      setLoading(false);
      return;
    }

    // 1. Subscribe to permissions config
    const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
    const unsubPerms = onSnapshot(permDocRef, (snap) => {
      if (snap.exists()) setPermissionsConfig(snap.data());
      else setPermissionsConfig(null);
    });

    // 2. Subscribe to student record
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      let matched: any = null;
      snapshot.forEach((d) => {
        const data = d.data();
        if (
          d.id === user.uid ||
          (user.email && data.email?.toLowerCase() === user.email.toLowerCase()) ||
          (user.phoneNumber && data.phone && user.phoneNumber.includes(data.phone.replace(/\D/g, '')))
        ) {
          matched = { id: d.id, ...data };
        }
      });
      setStudent(matched);
      setLoading(false);
    });

    return () => {
      unsubPerms();
      unsubStudents();
    };
  }, [instituteId, user]);

  const isStudentActive = !student?.status || student.status === 'active';
  let isWorksheetPermitted = true;
  if (permissionsConfig) {
    if (isStaff) {
      const roleKey = role === 'teacher' ? 'teacher' : 'staff';
      if (permissionsConfig[roleKey] && (permissionsConfig[roleKey].canAccessWorksheets === false || permissionsConfig[roleKey].canAccessPowerprep === false)) {
        isWorksheetPermitted = false;
      }
    } else {
      if (permissionsConfig.student && (permissionsConfig.student.canAccessWorksheets === false || permissionsConfig.student.canAccessPowerprep === false)) {
        isWorksheetPermitted = false;
      }
    }
  }

  const isAccessAllowed = isStaff ? isWorksheetPermitted : (isStudentActive && isWorksheetPermitted);

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-4">
      <header className="sticky top-0 z-50 bg-[#0b1326]/80 backdrop-blur-md flex justify-between items-center w-full py-4 border-b border-white/10 mb-6">
        <Link href="/portal" className="flex items-center gap-2 text-indigo-400 hover:text-white transition-colors text-sm font-bold">
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back to Portal</span>
        </Link>
        <h1 className="font-bold text-white text-base">Worksheets</h1>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {!isAccessAllowed ? (
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <span className="material-symbols-outlined text-2xl">lock</span>
            </div>
            <h2 className="text-lg font-black text-white">Worksheets Access Restricted</h2>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed">
              {!isStudentActive
                ? 'Worksheets and Unnati Powerprep feature options are only accessible for active student accounts. Please contact Admin.'
                : 'Access to Unnati Powerprep & Worksheets has been toggled OFF in Admin Settings.'}
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-6 text-center space-y-3 border border-white/10">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-teal-500/20 border border-teal-500/40 mx-auto">
              <span className="material-symbols-outlined text-teal-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                layers
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-white">Worksheets & Practice Papers</h2>
            <p className="text-slate-400 text-xs font-medium">
              No active worksheets assigned for your batch yet. Check back soon for downloadable practice material and revision sheets.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
