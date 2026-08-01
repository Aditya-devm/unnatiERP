'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import {
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  UserCheck,
  Megaphone,
  Layers,
  GraduationCap,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  User,
  Clock,
  Sparkles,
  Trash2
} from 'lucide-react';

interface Conversation {
  id: string;
  type: 'direct' | 'batch_broadcast' | 'all_staff_broadcast' | 'all_students_broadcast';
  participantIds?: string[];
  batchId?: string | null;
  createdBy: string;
  createdByName?: string;
  targetName?: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  typingUsers?: Record<string, { name: string; role: string; timestamp: number }>;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachmentUrl?: string | null;
  sentAt: string;
}

interface StaffMember {
  id: string;
  fullName: string;
  staffId?: string;
  position?: string;
  email?: string;
  photoUrl?: string | null;
}

interface StudentMember {
  id: string;
  fullName: string;
  rollNo?: string;
  rollNumber?: string;
  phone?: string;
  batchIds?: string[];
  photoUrl?: string | null;
}

interface BatchItem {
  id: string;
  name: string;
  subject?: string;
}

export default function ErpMessagesPage() {
  const { user, instituteId, role } = useAuth();

  // State: Conversation List & Active Conversation
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // State: Filter & Search
  const [inboxFilter, setInboxFilter] = useState<'all' | 'direct' | 'broadcast'>('all');
  const [inboxSearch, setInboxSearch] = useState('');

  // State: New Message Modal (Target Selection & Start)
  const [showNewModal, setShowNewModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<
    'staff_direct' | 'all_staff' | 'student_direct' | 'batch_broadcast' | 'all_students' | null
  >(null);
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');

  // Loaded Options for Modal
  const [staffOptions, setStaffOptions] = useState<StaffMember[]>([]);
  const [studentOptions, setStudentOptions] = useState<StudentMember[]>([]);
  const [batchOptions, setBatchOptions] = useState<BatchItem[]>([]);
  const [creatingConv, setCreatingConv] = useState(false);

  // Compose Message State
  const [inputText, setInputText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll message list to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Presence Heartbeat updater for Admin (Updates lastActiveAt every 45s, sets offline on unmount)
  useEffect(() => {
    if (!user?.uid || !instituteId) return;

    const sendHeartbeat = () => {
      fetch('/api/messages/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, instituteId })
      }).catch(console.error);
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 45000);
    const handleFocus = () => sendHeartbeat();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      fetch('/api/messages/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, instituteId, offline: true }),
        keepalive: true
      }).catch(console.error);
    };
  }, [user, instituteId]);

  // 1. Subscribe to Conversations for the Institute
  useEffect(() => {
    if (!instituteId || !user) return;

    setLoadingConvs(true);
    const convsCol = collection(db, 'institutes', instituteId, 'conversations');
    
    // Subscribe in real-time
    const unsubConvs = onSnapshot(convsCol, (snapshot) => {
      const list: Conversation[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const conv: Conversation = {
          id: docSnap.id,
          type: d.type,
          participantIds: d.participantIds || [],
          batchId: d.batchId || null,
          createdBy: d.createdBy,
          createdByName: d.createdByName || 'Admin',
          targetName: d.targetName || '',
          createdAt: d.createdAt || new Date().toISOString(),
          lastMessageAt: d.lastMessageAt || d.createdAt || new Date().toISOString(),
          lastMessagePreview: d.lastMessagePreview || ''
        };

        // Filter based on admin/staff role access
        if (['owner', 'admin'].includes(role || '')) {
          list.push(conv);
        } else if (Array.isArray(conv.participantIds) && conv.participantIds.includes(user.uid)) {
          list.push(conv);
        } else if (conv.type === 'all_staff_broadcast') {
          list.push(conv);
        }
      });

      // Sort by lastMessageAt descending
      list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setConversations(list);
      setLoadingConvs(false);
    }, (err) => {
      console.error('Error listening to conversations:', err);
      setLoadingConvs(false);
    });

    return () => unsubConvs();
  }, [instituteId, user, role]);

  // 2. Subscribe to Messages in Active Conversation
  useEffect(() => {
    if (!instituteId || !activeConvId) {
      setMessages([]);
      return;
    }

    setLoadingMsgs(true);
    const msgsCol = collection(db, 'institutes', instituteId, 'conversations', activeConvId, 'messages');
    
    const unsubMsgs = onSnapshot(msgsCol, (snapshot) => {
      const list: MessageItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          conversationId: activeConvId,
          senderId: d.senderId,
          senderName: d.senderName || 'User',
          senderRole: d.senderRole || 'student',
          text: d.text || '',
          attachmentUrl: d.attachmentUrl || null,
          sentAt: d.sentAt || new Date().toISOString()
        });
      });

      // Sort by sentAt ascending
      list.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      setMessages(list);
      setLoadingMsgs(false);
    }, (err) => {
      console.error('Error listening to messages:', err);
      setLoadingMsgs(false);
    });

    return () => unsubMsgs();
  }, [instituteId, activeConvId]);

  // 3. Load Options for Target Selection Modal (Staff, Students, Batches)
  useEffect(() => {
    if (!instituteId || !showNewModal) return;

    // Load Staff Members
    const usersCol = collection(db, 'users');
    const qStaff = query(usersCol, where('instituteId', '==', instituteId));
    const unsubStaff = onSnapshot(qStaff, (snap) => {
      const map = new Map<string, StaffMember>();
      snap.forEach((d) => {
        const data = d.data();
        if (['teacher', 'staff', 'admin'].includes((data.role || '').toLowerCase())) {
          const key = (data.email || d.id).toLowerCase().trim();
          if (!map.has(key)) {
            map.set(key, {
              id: d.id,
              fullName: data.fullName || data.name || data.displayName || data.email || 'Staff Member',
              staffId: data.staffId || 'STF',
              position: data.position || 'Faculty',
              email: data.email,
              photoUrl: data.photoUrl || null
            });
          }
        }
      });
      setStaffOptions(Array.from(map.values()));
    });

    // Load Students
    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snap) => {
      const list: StudentMember[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          fullName: data.fullName || 'Student',
          rollNo: data.rollNo || data.rollNumber || 'STU',
          phone: data.phone || '',
          batchIds: data.batchIds || [],
          photoUrl: data.photoUrl || null
        });
      });
      setStudentOptions(list);
    });

    // Load Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snap) => {
      const list: BatchItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || 'Batch',
          subject: data.subject || ''
        });
      });
      setBatchOptions(list);
    });

    return () => {
      unsubStaff();
      unsubStudents();
      unsubBatches();
    };
  }, [instituteId, showNewModal]);

  // Handle Starting / Fetching Conversation via Backend API
  const handleStartConversation = async () => {
    if (!instituteId || !user || !targetCategory) return;

    setCreatingConv(true);
    setErrorMsg('');

    try {
      if (targetCategory === 'staff_direct' || targetCategory === 'student_direct') {
        if (!selectedTargetId) {
          setErrorMsg('Please select a target user.');
          setCreatingConv(false);
          return;
        }

        const res = await fetch('/api/messages/conversations/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            targetUserId: selectedTargetId
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start direct conversation');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
        resetModalState();
      } else if (targetCategory === 'batch_broadcast') {
        if (!selectedTargetId) {
          setErrorMsg('Please select a batch.');
          setCreatingConv(false);
          return;
        }

        const res = await fetch('/api/messages/conversations/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            type: 'batch_broadcast',
            batchId: selectedTargetId
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start batch broadcast');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
        resetModalState();
      } else if (targetCategory === 'all_staff') {
        const res = await fetch('/api/messages/conversations/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            type: 'all_staff_broadcast'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start all-staff broadcast');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
        resetModalState();
      } else if (targetCategory === 'all_students') {
        const res = await fetch('/api/messages/conversations/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            type: 'all_students_broadcast'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start all-students broadcast');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
        resetModalState();
      }
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      setErrorMsg(err.message || 'Error starting conversation');
    } finally {
      setCreatingConv(false);
    }
  };

  // Handle Sending Message via Backend API
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !user || !activeConvId || (!inputText.trim() && !attachmentUrl.trim())) return;

    setSendingMsg(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instituteId,
          userId: user.uid,
          conversationId: activeConvId,
          text: inputText.trim(),
          attachmentUrl: attachmentUrl.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setInputText('');
      setAttachmentUrl('');
      setShowAttachmentInput(false);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const convRef = doc(db, 'institutes', instituteId, 'conversations', activeConvId);
      updateDoc(convRef, { [`typingUsers.${user.uid}`]: deleteField() }).catch(() => {});
    } catch (err: any) {
      console.error('Error sending message:', err);
      setErrorMsg(err.message || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!instituteId || !user || !activeConvId) return;
    if (!confirm('Are you sure you want to delete this message? It will be removed for everyone.')) return;

    setDeletingMsgId(messageId);
    try {
      const res = await fetch(`/api/messages/delete?instituteId=${instituteId}&userId=${user.uid}&conversationId=${activeConvId}&messageId=${messageId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete message');
    } catch (err: any) {
      alert(err.message || 'Error deleting message');
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleDeleteConversation = async () => {
    if (!instituteId || !user || !activeConvId) return;
    if (!confirm('Are you sure you want to delete this ENTIRE conversation thread and all its messages? This action cannot be undone.')) return;

    setDeletingConv(true);
    try {
      const res = await fetch(`/api/messages/delete?instituteId=${instituteId}&userId=${user.uid}&conversationId=${activeConvId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete conversation');

      setActiveConvId(null);
    } catch (err: any) {
      alert(err.message || 'Error deleting conversation');
    } finally {
      setDeletingConv(false);
    }
  };

  const resetModalState = () => {
    setTargetCategory(null);
    setSelectedTargetId('');
    setTargetSearch('');
    setErrorMsg('');
  };

  // Active Conversation Document
  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Helper to format conversation display titles
  const getConvTitle = (c: Conversation) => {
    if (c.type === 'all_staff_broadcast') return 'All Staff Broadcast';
    if (c.type === 'all_students_broadcast') return 'All Students Broadcast';
    if (c.type === 'batch_broadcast') {
      const bObj = batchOptions.find((b) => b.id === c.batchId);
      return bObj ? `Batch: ${bObj.name}` : `Batch Broadcast (${c.batchId || 'All'})`;
    }
    if (c.type === 'direct') {
      if (!user?.uid) return 'Direct 1:1 Chat';
      if (c.createdBy === user.uid) {
        return c.targetName || 'Direct 1:1 Chat';
      } else {
        return c.createdByName || 'Direct 1:1 Chat';
      }
    }
  };

  // Real-Time Typing Indicator Handler for Admin
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!instituteId || !activeConvId || !user?.uid) return;

    const convRef = doc(db, 'institutes', instituteId, 'conversations', activeConvId);

    if (text.trim().length > 0) {
      updateDoc(convRef, {
        [`typingUsers.${user.uid}`]: {
          name: user.displayName || user.email || 'Admin',
          role: role || 'admin',
          timestamp: Date.now()
        }
      }).catch(() => {});

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        updateDoc(convRef, {
          [`typingUsers.${user.uid}`]: deleteField()
        }).catch(() => {});
      }, 3500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      updateDoc(convRef, {
        [`typingUsers.${user.uid}`]: deleteField()
      }).catch(() => {});
    }
  };

  // Resolve sender name (lookup actual student/staff name if generic "USER student" was saved)
  const getProperSenderName = (m: MessageItem) => {
    let rawName = m.senderName || '';
    if (
      !rawName ||
      rawName.toLowerCase().includes('user student') ||
      rawName.toLowerCase() === 'student' ||
      rawName.toLowerCase() === 'staff'
    ) {
      const st = studentOptions.find((s) => s.id === m.senderId);
      if (st && st.fullName) return st.fullName;
      const sf = staffOptions.find((s) => s.id === m.senderId);
      if (sf && sf.fullName) return sf.fullName;
    }
    return rawName || (m.senderRole === 'student' ? 'Student' : 'Staff');
  };

  // Check if another participant is currently typing
  const typingUserNames = React.useMemo(() => {
    if (!activeConv || !(activeConv as any).typingUsers || !user?.uid) return '';
    const now = Date.now();
    const names: string[] = [];
    Object.entries((activeConv as any).typingUsers).forEach(([uId, data]: [string, any]) => {
      if (uId !== user.uid && data && data.timestamp && (now - data.timestamp < 4000)) {
        names.push(data.name || 'User');
      }
    });
    return names.join(', ');
  }, [activeConv, user?.uid]);

  const isOtherTyping = Boolean(typingUserNames);

  // Filtered Conversations List
  const filteredConversations = conversations.filter((c) => {
    if (inboxFilter === 'direct' && c.type !== 'direct') return false;
    if (inboxFilter === 'broadcast' && c.type === 'direct') return false;
    if (inboxSearch) {
      const title = (getConvTitle(c) || '').toLowerCase();
      const preview = (c.lastMessagePreview || '').toLowerCase();
      const q = inboxSearch.toLowerCase();
      return title.includes(q) || preview.includes(q);
    }
    return true;
  });

  return (
    <div className="-mx-6 -my-6 md:-mx-8 md:-my-8 flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight">Admin Messaging Hub</h1>
            <p className="text-[10px] text-slate-400 font-medium">
              Multi-channel direct & broadcast messaging system
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetModalState();
            setShowNewModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>+ New Message</span>
        </button>
      </div>

      {/* Main Grid: Left Inbox / Right Chat Window */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT PANEL: CONVERSATIONS INBOX */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-80 lg:w-96 bg-slate-900/90 border-r border-slate-800 flex-col shrink-0 ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {/* Inbox Search & Filter Tabs */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-955 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setInboxFilter('all')}
                className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all ${
                  inboxFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setInboxFilter('direct')}
                className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all ${
                  inboxFilter === 'direct'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Direct 1:1
              </button>
              <button
                type="button"
                onClick={() => setInboxFilter('broadcast')}
                className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all ${
                  inboxFilter === 'broadcast'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Broadcasts
              </button>
            </div>
          </div>

          {/* Conversations Cards List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-850/60 scrollbar-thin scrollbar-thumb-slate-800">
            {loadingConvs ? (
              <div className="p-8 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-slate-600" />
                <p className="text-xs font-bold text-slate-400">No conversations found</p>
                <p className="text-[11px]">Click "+ New Message" above to start a conversation.</p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === activeConvId;
                const title = getConvTitle(c);
                const isBroadcast = c.type !== 'direct';

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full p-4 text-left flex flex-col gap-1 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 border-l-4 border-indigo-500'
                        : 'hover:bg-slate-850/40'
                    }`}
                  >
                    {/* Bold Name Only - No Avatar circles or Icon spheres */}
                    <div className="flex items-center justify-between w-full">
                      <h4 className="text-xs font-bold text-slate-100 truncate">{title}</h4>
                      <span className="text-[9px] text-slate-500 font-mono shrink-0 ml-2">
                        {c.lastMessageAt
                          ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full mt-0.5">
                      <p className="text-[11px] text-slate-400 truncate max-w-[80%] font-medium">
                        {c.lastMessagePreview || 'No messages yet'}
                      </p>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                        c.type === 'direct'
                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60'
                          : c.type === 'batch_broadcast'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          : c.type === 'all_staff_broadcast'
                          ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                      }`}>
                        {c.type === 'direct' ? '1:1' : 'Broadcast'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Conversation Window */}
        <div className={`flex-1 bg-slate-950 flex-col overflow-hidden ${activeConvId ? 'flex w-full' : 'hidden md:flex'}`}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-extrabold text-white">Select a conversation</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Choose a conversation thread from the list on the left, or click "New Message" to compose a new message.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetModalState();
                  setShowNewModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Start New
              </button>
            </div>
          ) : (
            <>
              {/* Chat Thread Header */}
              <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveConvId(null)}
                    className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Back to Conversations List"
                  >
                    <ChevronLeft className="h-5 w-5 text-indigo-400" />
                  </button>

                  <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
                    {(getConvTitle(activeConv) || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-white">{getConvTitle(activeConv)}</h3>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border bg-indigo-950/80 text-indigo-300 border-indigo-800/60 font-mono">
                        {activeConv.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Created by {activeConv.createdByName || 'Admin'} • {new Date(activeConv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteConversation}
                  disabled={deletingConv}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  title="Delete entire conversation thread"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {loadingMsgs ? (
                  <div className="p-8 text-center text-slate-500 text-xs font-medium flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    Loading message thread...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Sparkles className="h-8 w-8 mx-auto text-indigo-400/50" />
                    <p className="text-xs font-bold text-slate-300">No messages in this conversation yet.</p>
                    <p className="text-[11px] text-slate-400">Type a message below to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.senderId === user?.uid;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 px-1">
                          <span>{getProperSenderName(m)}</span>
                          <span className="text-[8px] font-extrabold uppercase bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                            {m.senderRole}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className={`flex items-center gap-2 max-w-full group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div
                            className={`max-w-md p-3.5 rounded-2xl text-xs font-medium shadow-md leading-relaxed ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.text}</p>

                            {m.attachmentUrl && (
                              <div className="mt-2 pt-2 border-t border-white/20">
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-200 underline hover:text-white"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                  <span>View Attachment</span>
                                </a>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            disabled={deletingMsgId === m.id}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer shrink-0"
                            title="Delete message"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {isOtherTyping && (
                  <div className="flex items-center gap-2 p-2 px-3 bg-slate-900/90 border border-indigo-500/30 rounded-2xl w-fit text-xs text-indigo-300 animate-pulse my-2">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    </div>
                    <span className="text-[11px] font-medium ml-1">{typingUserNames} is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Error Feedback */}
              {errorMsg && (
                <div className="mx-6 mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center justify-between">
                  <span>{errorMsg}</span>
                  <button type="button" onClick={() => setErrorMsg('')} className="hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Message Input Box */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800/80 bg-slate-900/40 space-y-3">
                {showAttachmentInput && (
                  <div className="flex items-center gap-2 bg-slate-955 p-2 rounded-xl border border-slate-800">
                    <Paperclip className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
                    <input
                      type="url"
                      placeholder="Paste attachment URL (e.g. image, PDF)..."
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { setAttachmentUrl(''); setShowAttachmentInput(false); }}
                      className="text-slate-400 hover:text-white text-xs px-2"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                      showAttachmentInput
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                        : 'bg-slate-955 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="Add Attachment URL"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <input
                    type="text"
                    placeholder="Type your message here..."
                    value={inputText}
                    onChange={(e) => handleTyping(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    type="submit"
                    disabled={sendingMsg || (!inputText.trim() && !attachmentUrl.trim())}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0"
                  >
                    {sendingMsg ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TARGET SELECTION MODAL ("+ New Message" - 5 Options) */}
      {/* ========================================================================= */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Start New Conversation</h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Select target audience or individual recipient
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-bold text-center">
                {errorMsg}
              </div>
            )}

            {/* Step 1: Select 1 of 5 Targeting Categories */}
            {!targetCategory ? (
              <div className="space-y-3">
                <p className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  Choose Target Audience:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Specific Staff Member */}
                  <button
                    type="button"
                    onClick={() => setTargetCategory('staff_direct')}
                    className="p-4 rounded-2xl bg-slate-955 border border-slate-800 hover:border-indigo-500 hover:bg-slate-850/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-purple-950 border border-purple-800 text-purple-400">
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xs font-extrabold text-white">Specific Staff Member</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">1:1 direct message with a faculty/staff member</p>
                  </button>

                  {/* Option 2: All Staff (Broadcast) */}
                  <button
                    type="button"
                    onClick={() => setTargetCategory('all_staff')}
                    className="p-4 rounded-2xl bg-slate-955 border border-slate-800 hover:border-purple-500 hover:bg-slate-850/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-purple-950 border border-purple-800 text-purple-400">
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xs font-extrabold text-white">All Staff (Broadcast)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Broadcast message visible to all staff accounts</p>
                  </button>

                  {/* Option 3: Specific Student */}
                  <button
                    type="button"
                    onClick={() => setTargetCategory('student_direct')}
                    className="p-4 rounded-2xl bg-slate-955 border border-slate-800 hover:border-indigo-500 hover:bg-slate-850/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400">
                        <User className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xs font-extrabold text-white">Specific Student</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">1:1 direct message with an individual student</p>
                  </button>

                  {/* Option 4: Specific Batch (Broadcast) */}
                  <button
                    type="button"
                    onClick={() => setTargetCategory('batch_broadcast')}
                    className="p-4 rounded-2xl bg-slate-955 border border-slate-800 hover:border-amber-500 hover:bg-slate-850/60 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
                        <Layers className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xs font-extrabold text-white">Specific Batch (Broadcast)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Broadcast to all students in a specific batch</p>
                  </button>

                  {/* Option 5: All Students (Broadcast) */}
                  <button
                    type="button"
                    onClick={() => setTargetCategory('all_students')}
                    className="p-4 rounded-2xl bg-slate-955 border border-slate-800 hover:border-emerald-500 hover:bg-slate-850/60 transition-all text-left group cursor-pointer sm:col-span-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-xs font-extrabold text-white">All Students (Institute Broadcast)</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Institute-wide announcement visible to all enrolled students</p>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Pick Recipient / Target Detail */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">
                    {targetCategory === 'staff_direct' && 'Select Staff Member'}
                    {targetCategory === 'student_direct' && 'Select Student'}
                    {targetCategory === 'batch_broadcast' && 'Select Batch'}
                    {targetCategory === 'all_staff' && 'Broadcast to All Staff'}
                    {targetCategory === 'all_students' && 'Broadcast to All Students'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setTargetCategory(null)}
                    className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Change Target Type
                  </button>
                </div>

                {/* Sub-selector UI for Specific Staff / Student / Batch */}
                {targetCategory === 'staff_direct' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Search staff by name or ID..."
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
                      {staffOptions
                        .filter((s) => s.fullName.toLowerCase().includes(targetSearch.toLowerCase()) || (s.staffId || '').toLowerCase().includes(targetSearch.toLowerCase()))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedTargetId(s.id)}
                            className={`w-full p-3 text-left flex items-center justify-between hover:bg-slate-850 transition-colors ${
                              selectedTargetId === s.id ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : ''
                            }`}
                          >
                            <div>
                              <h5 className="text-xs font-extrabold text-white">{s.fullName}</h5>
                              <span className="text-[10px] text-slate-400">{s.position || 'Faculty'} • Staff ID: {s.staffId || 'STF'}</span>
                            </div>
                            {selectedTargetId === s.id && <CheckCircle2 className="h-4 w-4 text-indigo-400" />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {targetCategory === 'student_direct' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Search student by name or roll number..."
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
                      {studentOptions
                        .filter((s) => s.fullName.toLowerCase().includes(targetSearch.toLowerCase()) || (s.rollNo || '').toLowerCase().includes(targetSearch.toLowerCase()))
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedTargetId(s.id)}
                            className={`w-full p-3 text-left flex items-center justify-between hover:bg-slate-850 transition-colors ${
                              selectedTargetId === s.id ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : ''
                            }`}
                          >
                            <div>
                              <h5 className="text-xs font-extrabold text-white">{s.fullName}</h5>
                              <span className="text-[10px] text-slate-400">Roll No: {s.rollNo || '101'}</span>
                            </div>
                            {selectedTargetId === s.id && <CheckCircle2 className="h-4 w-4 text-indigo-400" />}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {targetCategory === 'batch_broadcast' && (
                  <div className="space-y-3">
                    <select
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Batch --</option>
                      {batchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.subject ? `(${b.subject})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(targetCategory === 'all_staff' || targetCategory === 'all_students') && (
                  <div className="p-4 bg-slate-955 border border-slate-800 rounded-2xl text-center space-y-2">
                    <Megaphone className="h-8 w-8 text-indigo-400 mx-auto" />
                    <h4 className="text-xs font-extrabold text-white">
                      Ready to broadcast to {targetCategory === 'all_staff' ? 'all institute staff' : 'all institute students'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Click below to open the broadcast conversation thread.
                    </p>
                  </div>
                )}

                {/* Footer Submit Button */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartConversation}
                    disabled={creatingConv}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {creatingConv ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <ChevronRight className="h-4 w-4" />}
                    <span>Open Conversation Thread</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
