'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import Link from 'next/link';
import BellNotificationIcon from '@/components/BellNotificationIcon';
import {
  LayoutDashboard,
  Users,
  Layers,
  IndianRupee,
  Calendar,
  UserCheck,
  HelpCircle,
  Award,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Sparkles
} from 'lucide-react';

const sidebarItems = [
  { name: 'Dashboard', href: '/erp', icon: LayoutDashboard },
  { name: 'Unnati Powerprep', href: '/erp/powerprep', icon: Sparkles },
  { name: 'Messages', href: '/erp/messages', icon: MessageSquare },
  { name: 'Students', href: '/erp/students', icon: Users },
  { name: 'Batches', href: '/erp/batches', icon: Layers },
  { name: 'Classwork & Homework', href: '/erp/classwork-homework', icon: BookOpen },
  { name: 'Fees', href: '/erp/fees', icon: IndianRupee },
  { name: 'Attendance', href: '/erp/attendance', icon: Calendar },
  { name: 'Leave Requests', href: '/erp/leave-requests', icon: CalendarDays },
  { name: 'Staff', href: '/erp/staff', icon: UserCheck },
  { name: 'Enquiries', href: '/erp/enquiries', icon: HelpCircle },
  { name: 'Exams', href: '/erp/exams', icon: Award },
  { name: 'Reports', href: '/erp/reports', icon: BarChart2 },
  { name: 'Settings', href: '/erp/settings', icon: Settings },
];

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  const { user, role, instituteId, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (role === 'student' || role === 'parent') {
        console.warn('Student role detected on /erp. Redirecting to /portal...', { role });
        router.replace('/portal');
        return;
      }

      const allowedRoles = ['owner', 'admin', 'teacher', 'staff'];
      if (!user || !role || !allowedRoles.includes(role) || !instituteId) {
        console.warn('Access denied to ERP. Redirecting to /login...', { role, instituteId });
        router.replace('/login');
        return;
      }

      // Role-specific route guards: Only owner and admin can access Students directory, Batches directory, Staff, Fees, Leave Requests, and Settings
      const isAdminRole = ['owner', 'admin'].includes(role);
      const isRestrictedRoute =
        pathname?.startsWith('/erp/staff') ||
        pathname?.startsWith('/erp/fees') ||
        pathname?.startsWith('/erp/leave-requests') ||
        pathname?.startsWith('/erp/settings') ||
        pathname?.startsWith('/erp/students') ||
        pathname?.startsWith('/erp/batches');

      if (!isAdminRole && isRestrictedRoute) {
        console.warn('Access denied to restricted ERP module for staff. Redirecting to ERP Dashboard...', { role, pathname });
        router.replace('/erp');
      }
    }
  }, [user, role, instituteId, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 font-bold tracking-wider">Securing ERP Portal...</p>
      </div>
    );
  }

  // Double check authorization to prevent flash of content
  const allowedRoles = ['owner', 'admin', 'teacher', 'staff'];
  if (!user || !role || !allowedRoles.includes(role) || !instituteId) {
    return (
      <div className="min-h-screen bg-slate-900" />
    );
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-indigo-400 to-blue-500 bg-clip-text text-transparent">
            Unnati ERP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BellNotificationIcon />
          <button
            onClick={toggleSidebar}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar - Desktop and Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:relative md:translate-x-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
          <Link href="/erp" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-[15px] tracking-tight leading-none text-slate-100">
                Unnati ERP
              </div>
              <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">
                Management
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-slate-450 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {sidebarItems
            .filter((item) => {
              const isAdminRole = ['owner', 'admin'].includes(role || '');
              if (!isAdminRole && (
                item.href === '/erp/staff' || 
                item.href === '/erp/fees' || 
                item.href === '/erp/leave-requests' || 
                item.href === '/erp/settings' ||
                item.href === '/erp/students' ||
                item.href === '/erp/batches'
              )) {
                return false;
              }
              return true;
            })
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/15 border-l-4 border-indigo-500 text-indigo-400 font-extrabold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-450'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
        </nav>

        {/* User profile & logout footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3 p-2 bg-slate-950/60 border border-slate-850 rounded-xl">
            <div className="h-8 w-8 rounded-lg bg-indigo-950 border border-indigo-850 flex items-center justify-center shrink-0 text-indigo-400 font-black">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-bold text-slate-200">
                {user?.email}
              </div>
              <div className="text-[9px] font-extrabold text-indigo-450 uppercase tracking-wider">
                {role}
              </div>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden pt-16 md:pt-0">
        {/* Background glow elements */}
        <div className="absolute top-[10%] right-[10%] w-[35%] h-[35%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[10%] w-[35%] h-[35%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 z-10">
          {children}
        </main>
      </div>

      {/* LOGOUT CONFIRMATION DIALOG MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Confirm Logout</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Are you sure you want to log out from <span className="text-white font-bold">Unnati ERP</span>?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutModal(false);
                  await signOut(auth);
                  router.push('/');
                }}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
