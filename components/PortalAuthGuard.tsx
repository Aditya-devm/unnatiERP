'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db, auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

export default function PortalAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, instituteId, loading } = useAuth();
  const router = useRouter();
  const [checkingStudentStatus, setCheckingStudentStatus] = useState(true);

  useEffect(() => {
    if (loading) return;

    // If not authenticated, redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // If owner, admin, teacher, or staff, redirect to /erp (Staff & Admin belong in /erp only!)
    if (role && ['owner', 'admin', 'teacher', 'staff'].includes(role)) {
      console.warn('Non-student role detected on /portal. Redirecting to /erp...', { role });
      router.replace('/erp');
      return;
    }

    // For Students: Listen in real time to the student directory
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    const studentsCol = collection(db, 'institutes', targetInstId, 'students');

    const unsubStudents = onSnapshot(
      studentsCol,
      async (snapshot) => {
        let isStudentActive = false;

        snapshot.forEach((d) => {
          const data = d.data();
          const isUidMatch = d.id === user.uid;
          const isEmailMatch = user.email && data.email?.toLowerCase() === user.email.toLowerCase();
          const isPhoneMatch =
            user.phoneNumber &&
            data.phone &&
            user.phoneNumber.includes(data.phone.replace(/\D/g, ''));

          if (isUidMatch || isEmailMatch || isPhoneMatch) {
            isStudentActive = true;
          }
        });

        // If the student doc no longer exists in the directory (deleted by admin)
        if (!isStudentActive && !snapshot.empty) {
          console.warn('Student record has been deleted from Student Directory. Forcing logout...');
          try {
            await signOut(auth);
          } catch (e) {
            console.error('Sign out error:', e);
          }
          alert('Your student account has been removed by the institute. You have been logged out.');
          router.replace('/login?error=account_deleted');
        } else {
          setCheckingStudentStatus(false);
        }
      },
      (error) => {
        console.error('Error monitoring student directory status:', error);
        setCheckingStudentStatus(false);
      }
    );

    return () => unsubStudents();
  }, [user, role, instituteId, loading, router]);

  if (loading || checkingStudentStatus) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b1326] text-[#dae2fd]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400">Verifying Student Portal Access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
