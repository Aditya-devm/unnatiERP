'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Plus, MessageSquare, LogOut, ChevronLeft, Menu, MoreVertical, Trash2, Download } from 'lucide-react';
import Link from 'next/link';

interface ChatSession {
    id: string;
    title: string;
    updatedAt: any;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if(!confirm('Are you sure you want to delete this chat?')) return;
        
        if (user) {
            await deleteDoc(doc(db, 'users', user.uid, 'chatSessions', sessionId));
            if (pathname === `/dashboard/c/${sessionId}`) {
                router.push('/dashboard');
            }
        }
    };

    const handleExport = async (e: React.MouseEvent, sessionId: string, title: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!user) return;
        const qMsgs = query(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(qMsgs);
        const msgs = snapshot.docs.map(d => ({ role: d.data().role, content: d.data().content }));
        
        if (msgs.length === 0) return alert('No messages to export');
        
        import('@/utils/pdf-export').then(({ generatePDF }) => {
            generatePDF(msgs as any, msgs.map((_, i) => i), `chat-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().getTime()}.pdf`);
        });
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) router.push('/login');
            else {
                setUser(currentUser);
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    
                    if (data.fullName) {
                        setUserName(data.fullName);
                    } else {
                        setUserName(currentUser.email || 'Student');
                    }
                } else {
                    if (currentUser.email === 'samxlnc56@gmail.com') {
                        await setDoc(userDocRef, {
                            name: 'Administrator',
                            email: currentUser.email,
                            role: 'admin',
                            createdAt: new Date().toISOString()
                        });
                        setUserName('Administrator');
                    } else {
                        setUserName(currentUser.email || 'Student');
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [router, pathname]);

    useEffect(() => {
        if (!user) return;
        
        const q = query(collection(db, 'users', user.uid, 'chatSessions'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const data: ChatSession[] = [];
                snapshot.forEach(doc => {
                    data.push({ id: doc.id, title: doc.data().title || 'Chat', updatedAt: doc.data().updatedAt });
                });
                setSessions(data);
            },
            (err) => {
                console.error("Firestore snapshot error (chatSessions):", err);
            }
        );

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
        window.addEventListener('toggleSidebar', handleToggleSidebar);
        return () => window.removeEventListener('toggleSidebar', handleToggleSidebar);
    }, []);

    const isFullScreen = false;

    if (!user) return <div className="h-screen bg-slate-100"></div>;

    return (
        <div className={`flex h-screen w-full relative selection:bg-indigo-100 overflow-hidden text-slate-900 font-sans ${isFullScreen ? 'bg-[#f8fafc]' : 'bg-slate-50/40'}`}>
            
            {/* Mobile Sidebar overlay */}
            {!isFullScreen && sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/10 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {!isFullScreen && (
                <aside className={`fixed z-50 md:relative w-[280px] h-full flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
                    
                    <div className="p-5 flex items-center justify-between border-b border-slate-100/50">
                        <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 group cursor-pointer w-full">
                            <img src="/logo.png" alt="Logo" className="h-8.5 w-8.5 object-contain bg-white rounded-xl p-1.5 border border-slate-200/60 shadow-sm group-hover:scale-105 transition-transform" />
                            <span className="font-extrabold text-slate-800 tracking-tight text-[16px] sm:text-[17px]">Unnati Powerprep</span>
                        </Link>
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    </div>
                    
                    <div className="p-4">
                        <Link href="/dashboard/chat" className="flex items-center justify-center gap-2.5 w-full bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white px-4 py-3.5 rounded-2xl font-bold shadow-md shadow-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer border-b-4 border-indigo-850">
                            <Plus className="h-5 w-5" />
                            New Chat
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scroll-smooth">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 px-3">Recent Conversations</div>
                        {sessions.map((session) => {
                            const isActive = pathname === `/dashboard/c/${session.id}`;
                            return (
                                <div 
                                    key={session.id} 
                                    className={`group relative flex items-center justify-between px-2.5 py-1 w-full rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50/70 border border-blue-150/40 shadow-sm' : 'hover:bg-slate-50/65 hover:translate-x-0.5'}`}
                                >
                                    <Link 
                                        href={`/dashboard/c/${session.id}`}
                                        onClick={() => setSidebarOpen(false)}
                                        className="flex items-center gap-3 flex-1 overflow-hidden py-2"
                                    >
                                        <MessageSquare className={`h-4.5 w-4.5 shrink-0 px-0.5 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-650'}`} />
                                        <span className={`truncate text-sm font-bold tracking-wide ${isActive ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-900'}`}>{session.title}</span>
                                    </Link>

                                    <div className="relative shrink-0 ml-1">
                                        <button 
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveDropdown(activeDropdown === session.id ? null : session.id); }}
                                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${activeDropdown === session.id ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100'}`}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </button>

                                        {activeDropdown === session.id && (
                                            <>
                                                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveDropdown(null)} />
                                                <div className="absolute right-0 top-full mt-1.5 z-50 w-40 bg-white rounded-2xl shadow-xl border border-slate-200/60 py-1.5 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                                    <button onClick={(e) => { setActiveDropdown(null); handleExport(e, session.id, session.title); }} className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-blue-50/70 hover:text-blue-600 font-bold transition-colors w-full text-left cursor-pointer">
                                                        <Download className="h-4 w-4" /> Export PDF
                                                    </button>
                                                    <button onClick={(e) => { setActiveDropdown(null); handleDelete(e, session.id); }} className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-red-650 hover:bg-red-50/60 hover:text-red-700 font-bold transition-colors w-full text-left cursor-pointer">
                                                        <Trash2 className="h-4 w-4" /> Delete Chat
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {sessions.length === 0 && (
                            <div className="text-slate-400 text-sm px-3 italic font-semibold">No previous chats.</div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100/50 bg-slate-50/30">
                        <div className="flex items-center gap-3 text-sm text-slate-600 font-bold px-2 py-2 glass rounded-2xl border border-white/60 shadow-sm">
                            <div className="h-8.5 w-8.5 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200/50 flex items-center justify-center shrink-0 text-indigo-600 font-black">
                                {userName?.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate flex-1 text-slate-700 tracking-wide font-bold">{userName}</span>
                            <button 
                                onClick={async () => {
                                    await signOut(auth);
                                    router.push('/');
                                }}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 shrink-0 flex items-center justify-center cursor-pointer active:scale-90"
                                title="Logout"
                            >
                                <LogOut className="h-4.5 w-4.5" />
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden bg-slate-50/50">
                {children}
            </main>
        </div>
    );
}
