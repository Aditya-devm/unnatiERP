'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { Menu, X, BookOpen, AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';

export default function Navbar() {
    const { user, role } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    if (
        pathname === '/' ||
        pathname?.startsWith('/erp') ||
        pathname?.startsWith('/portal') ||
        pathname?.startsWith('/dashboard') ||
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/teacher') ||
        pathname === '/login' ||
        pathname === '/register'
    ) return null;

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleNavAction = (e: React.MouseEvent) => {
        e.preventDefault();
        if (user) {
            const erpRoles = ['owner', 'admin', 'teacher', 'staff'];
            if (role && erpRoles.includes(role)) {
                router.push('/erp');
            } else {
                router.push('/portal');
            }
        } else {
            router.push('/login');
        }
    };

    return (
        <header className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full transition-all duration-300">
            <div className="glass rounded-[20px] px-4 sm:px-6 shadow-lg border border-white/60">
                <div className="flex justify-between h-16 sm:h-20 items-center">
                    <div className="flex">
                        <Link href="/" className="flex-shrink-0 flex items-center group">
                            <div className="p-2.5 bg-indigo-600/10 rounded-xl group-hover:bg-indigo-600/20 transition-all duration-300 group-hover:scale-105">
                                <BookOpen className="h-5 w-5 text-indigo-600" />
                            </div>
                            <span className="ml-3 text-lg font-extrabold tracking-tight text-slate-800 group-hover:text-indigo-600 transition-colors">Unnati Powerprep</span>
                        </Link>
                    </div>
                    
                    {/* Desktop Menu */}
                    <div className="hidden md:flex md:items-center md:space-x-2">
                        <Link
                            href="/"
                            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all duration-300"
                        >
                            Home
                        </Link>
                        <button
                            onClick={handleNavAction}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/10 hover:shadow-md active:scale-95 transition-all duration-300 cursor-pointer"
                        >
                            {user ? 'Open Portal' : 'Ready to Help You'}
                        </button>
                        {user && (
                            <button
                                onClick={() => setShowLogoutModal(true)}
                                className="text-slate-500 hover:text-red-600 hover:bg-red-50/50 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer"
                            >
                                Logout
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="-mr-1 flex md:hidden items-center">
                        <button
                            onClick={toggleMenu}
                            type="button"
                            className="inline-flex items-center justify-center p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-50 focus:outline-none transition-all duration-200"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? <X className="block h-5 w-5" /> : <Menu className="block h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden mt-2 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="glass rounded-2xl overflow-hidden p-2.5 space-y-1.5 shadow-xl border-white/60">
                        {[
                            { name: 'Home', href: '/' },
                            { name: 'Ready to Help You', href: '/dashboard' },
                        ].map((item) => {
                            const isDashboard = item.href === '/dashboard';
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                                        isDashboard 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'text-slate-700 hover:text-indigo-600 hover:bg-white/40'
                                    }`}
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                        {user && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setShowLogoutModal(true);
                                }}
                                className="text-slate-600 hover:text-red-600 hover:bg-red-50/40 block w-full text-left px-4 py-3 rounded-xl text-base font-bold transition-all"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* LOGOUT WARNING DIALOG MODAL */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative text-white">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">Confirm Logout</h3>
                            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                Are you sure you want to log out from your account?
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
                                }}
                                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                            >
                                Yes, Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

