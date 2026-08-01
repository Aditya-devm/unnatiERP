'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

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
  lastReadAt?: Record<string, string>;
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

interface AllowedTarget {
  id: string;
  name: string;
  roleOrType: string;
  badge: string;
  subtext?: string;
  targetType: 'staff_direct' | 'student_direct' | 'batch_broadcast' | 'all_staff' | 'all_students';
}

export default function ChatInterface({ portalTitle = 'Chat Hub', chatId }: { portalTitle?: string; chatId?: string | null }) {
  const { user, instituteId, role } = useAuth();
  const router = useRouter();

  // Role Checks
  const isStudent = role === 'student';
  const isAdmin = ['owner', 'admin'].includes((role || '').toLowerCase());
  const isStaff = ['teacher', 'staff'].includes((role || '').toLowerCase());

  // Conversations & Active Selection
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(chatId || null);
  const activeConvIdRef = useRef<string | null>(chatId || null);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  const [userBatchIds, setUserBatchIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Presence State (Recipient's lastActiveAt)
  const [recipientLastActive, setRecipientLastActive] = useState<string | null>(null);

  // New Conversation Picker Modal State (For Staff/Admin ONLY)
  const [showNewModal, setShowNewModal] = useState(false);
  const [allowedTargets, setAllowedTargets] = useState<AllowedTarget[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);

  // Message Inputs & Feedback
  const [inputText, setInputText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll message container
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------
  // ITEM 5: HEARTBEAT PRESENCE UPDATER (Updates lastActiveAt every 45s)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user?.uid || !instituteId) return;

    const sendHeartbeat = () => {
      fetch('/api/messages/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, instituteId })
      }).catch(console.error);
    };

    // Send immediately on load
    sendHeartbeat();

    // Interval every 45 seconds while tab is focused
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

  // Load batches list for looking up batch names
  useEffect(() => {
    if (!instituteId) return;
    const unsubBatches = onSnapshot(collection(db, 'institutes', instituteId, 'batches'), (snap) => {
      const list: { id: string; name: string }[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, name: d.data().name || 'Batch' });
      });
      setBatches(list);
    });
    return () => unsubBatches();
  }, [instituteId]);

  // Load user batchIds dynamically (either from users doc or student subcollection doc)
  useEffect(() => {
    if (!user?.uid || !instituteId) return;

    let unsubUsers = () => {};
    let unsubStudents = () => {};

    // 1. Listen to users/{uid}
    unsubUsers = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        const bIds = d.batchIds || [];
        const nameVal = d.fullName || d.name || d.displayName || '';
        const sId = d.staffId || '';
        if (nameVal) setUserName(nameVal);
        setUserBatchIds((prev) => {
          const combined = Array.from(new Set([...prev, ...bIds]));
          return combined;
        });

        // Resolve staff batch assignments by checking teacherId in batches collection
        const batchesCol = collection(db, 'institutes', instituteId, 'batches');
        getDocs(batchesCol).then((bSnap) => {
          const assignedBatchIds: string[] = [];
          bSnap.forEach((bDoc) => {
            const bData = bDoc.data();
            if (bData.teacherId === user.uid || (sId && bData.teacherId === sId)) {
              assignedBatchIds.push(bDoc.id);
            }
          });
          setUserBatchIds((prev) => {
            const combined = Array.from(new Set([...prev, ...assignedBatchIds]));
            return combined;
          });
        }).catch(console.error);
      }
    });

    // 2. Also try listening to institutes/{instId}/students/{uid} or query by email
    const studentDocRef = doc(db, 'institutes', instituteId, 'students', user.uid);
    unsubStudents = onSnapshot(studentDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data() || {};
        const bIds = d.batchIds || [];
        const nameVal = d.fullName || '';
        if (nameVal) setUserName(nameVal);
        setUserBatchIds(bIds);
      } else if (user.email) {
        // Fallback search by email in students collection
        const q = query(collection(db, 'institutes', instituteId, 'students'), where('email', '==', user.email));
        getDocs(q).then((qSnap) => {
          qSnap.forEach((sDoc) => {
            const d = sDoc.data() || {};
            const bIds = d.batchIds || [];
            const nameVal = d.fullName || '';
            if (nameVal) setUserName(nameVal);
            setUserBatchIds(bIds);
          });
        }).catch(console.error);
      }
    });

    return () => {
      unsubUsers();
      unsubStudents();
    };
  }, [user, instituteId]);

  // -------------------------------------------------------------
  // 1. Subscribe to real-time conversations for the logged-in user
  // -------------------------------------------------------------
  useEffect(() => {
    if (!instituteId || !user) return;

    setLoadingConvs(true);
    const convsCol = collection(db, 'institutes', instituteId, 'conversations');

    const unsub = onSnapshot(convsCol, (snapshot) => {
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
          lastMessagePreview: d.lastMessagePreview || '',
          lastReadAt: d.lastReadAt || {}
        };

        const uRole = (role || '').toLowerCase();
        const isParticipant = Array.isArray(conv.participantIds) && conv.participantIds.includes(user.uid);

        // Enforce visibility per Part K0 + userBatchIds alignment
        if (['owner', 'admin'].includes(uRole)) {
          list.push(conv);
        } else if (uRole === 'student') {
          if (isParticipant || conv.type === 'all_students_broadcast' || (conv.type === 'batch_broadcast' && userBatchIds.includes(conv.batchId || ''))) {
            list.push(conv);
          }
        } else if (['teacher', 'staff'].includes(uRole)) {
          if (isParticipant || conv.type === 'all_staff_broadcast' || (conv.type === 'batch_broadcast' && (conv.createdBy === user.uid || userBatchIds.includes(conv.batchId || '')))) {
            list.push(conv);
          }
        }
      });

      // Sort by lastMessageAt descending
      list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setConversations(list);

      // Auto-select first conversation if none selected
      if (list.length > 0 && !activeConvIdRef.current) {
        setActiveConvId(list[0].id);
      }
      setLoadingConvs(false);
    }, (err) => {
      console.error('Error loading conversations:', err);
      setLoadingConvs(false);
    });

    return () => unsub();
  }, [instituteId, user, role, userBatchIds]);

  // -------------------------------------------------------------
  // 2. ITEM 6: MARK CONVERSATION AS READ WHEN ACTIVATED
  // -------------------------------------------------------------
  useEffect(() => {
    if (!instituteId || !user || !activeConvId) return;

    fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instituteId, userId: user.uid, conversationId: activeConvId })
    }).catch(console.error);
  }, [instituteId, user, activeConvId]);

  // -------------------------------------------------------------
  // 3. Subscribe to real-time messages & recipient presence for active conversation
  // -------------------------------------------------------------
  useEffect(() => {
    if (!instituteId || !activeConvId) {
      setMessages([]);
      setRecipientLastActive(null);
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

      list.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      setMessages(list);
      setLoadingMsgs(false);
    }, (err) => {
      console.error('Error loading messages:', err);
      setLoadingMsgs(false);
    });

    // Check Recipient's Presence (For 1:1 Direct Chats)
    const activeConv = conversations.find(c => c.id === activeConvId);
    if (activeConv && activeConv.type === 'direct' && Array.isArray(activeConv.participantIds) && user) {
      const recipientId = activeConv.participantIds.find(id => id !== user.uid);
      if (recipientId) {
        const userDocRef = doc(db, 'users', recipientId);
        const unsubPresence = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setRecipientLastActive(snap.data().lastActiveAt || null);
          }
        });
        return () => {
          unsubMsgs();
          unsubPresence();
        };
      }
    }

    return () => unsubMsgs();
  }, [instituteId, activeConvId, conversations, user]);

  // -------------------------------------------------------------
  // Load Allowed Targets for "+" Sphere (Staff/Admin ONLY)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!instituteId || !user || !showNewModal || isStudent) return;

    const uRole = (role || '').toLowerCase();
    const targets: AllowedTarget[] = [];

    const loadTargets = async () => {
      if (['owner', 'admin'].includes(uRole)) {
        targets.push({
          id: 'all_staff_b',
          name: 'All Staff (Broadcast)',
          roleOrType: 'all_staff',
          badge: 'Broadcast',
          subtext: 'Broadcast to all institute staff',
          targetType: 'all_staff'
        });
        targets.push({
          id: 'all_students_b',
          name: 'All Students (Broadcast)',
          roleOrType: 'all_students',
          badge: 'Broadcast',
          subtext: 'Institute-wide broadcast to all students',
          targetType: 'all_students'
        });

        const qStaffUsers = query(collection(db, 'users'), where('instituteId', '==', instituteId));
        const usersSnap = await getDocs(qStaffUsers);
        usersSnap.forEach((dSnap) => {
          const d = dSnap.data();
          if (['teacher', 'staff'].includes((d.role || '').toLowerCase()) && dSnap.id !== user.uid) {
            targets.push({
              id: dSnap.id,
              name: d.fullName || d.name || d.displayName || 'Staff Member',
              roleOrType: d.role || 'staff',
              badge: 'Faculty',
              subtext: `Position: ${d.position || 'Staff'}`,
              targetType: 'staff_direct'
            });
          }
        });

        const stSnap = await getDocs(collection(db, 'institutes', instituteId, 'students'));
        stSnap.forEach((sDoc) => {
          const d = sDoc.data();
          targets.push({
            id: sDoc.id,
            name: d.fullName || 'Student',
            roleOrType: 'student',
            badge: 'Student',
            subtext: `Roll No: ${d.rollNo || d.rollNumber || '101'}`,
            targetType: 'student_direct'
          });
        });

        const bSnap = await getDocs(collection(db, 'institutes', instituteId, 'batches'));
        bSnap.forEach((bDoc) => {
          const d = bDoc.data();
          targets.push({
            id: bDoc.id,
            name: `Batch: ${d.name}`,
            roleOrType: 'batch_broadcast',
            badge: 'Batch Broadcast',
            subtext: d.subject ? `Subject: ${d.subject}` : 'Batch Students',
            targetType: 'batch_broadcast'
          });
        });
      } else if (['teacher', 'staff'].includes(uRole)) {
        const userDocSnap = await getDoc(doc(db, 'users', user.uid));
        const userDocData = userDocSnap.data() || {};
        let staffBatchIds: string[] = Array.from(new Set([...(userDocData.batchIds || []), ...userBatchIds]));

        const bSnap = await getDocs(collection(db, 'institutes', instituteId, 'batches'));
        bSnap.forEach((bDoc) => {
          const bData = bDoc.data();
          const isAssigned =
            bData.teacherId === user.uid ||
            (userDocData.staffId && bData.teacherId === userDocData.staffId) ||
            (userDocData.batchIds && Array.isArray(userDocData.batchIds) && userDocData.batchIds.includes(bDoc.id)) ||
            userBatchIds.includes(bDoc.id);

          if (isAssigned) {
            if (!staffBatchIds.includes(bDoc.id)) staffBatchIds.push(bDoc.id);

            targets.push({
              id: bDoc.id,
              name: `Broadcast to ${bData.name}`,
              roleOrType: 'batch_broadcast',
              badge: 'Batch Broadcast',
              subtext: `Broadcast to all students in ${bData.name}`,
              targetType: 'batch_broadcast'
            });
          }
        });

        if (staffBatchIds.length > 0) {
          const stSnap = await getDocs(collection(db, 'institutes', instituteId, 'students'));
          stSnap.forEach((sDoc) => {
            const d = sDoc.data();
            const sBatchIds: string[] = d.batchIds || [];
            const hasCommon = sBatchIds.some(bId => staffBatchIds.includes(bId));
            if (hasCommon) {
              targets.push({
                id: sDoc.id,
                name: d.fullName || 'Student',
                roleOrType: 'student',
                badge: 'Student',
                subtext: `Roll No: ${d.rollNo || d.rollNumber || '101'}`,
                targetType: 'student_direct'
              });
            }
          });
        }

        // Load other staff, faculty, admins, and owners as direct 1:1 message targets (excluding self)
        const qStaffUsers = query(collection(db, 'users'), where('instituteId', '==', instituteId));
        const usersSnap = await getDocs(qStaffUsers);
        usersSnap.forEach((dSnap) => {
          const d = dSnap.data();
          const r = (d.role || '').toLowerCase();
          const isSelf =
            dSnap.id === user.uid ||
            (d.email && user.email && d.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
            (userDocData.staffId && d.staffId && d.staffId === userDocData.staffId);

          if (['teacher', 'staff', 'admin', 'owner'].includes(r) && !isSelf) {
            targets.push({
              id: dSnap.id,
              name: d.fullName || d.name || d.displayName || 'Staff Member',
              roleOrType: d.role || 'staff',
              badge: ['admin', 'owner'].includes(r) ? 'Admin' : 'Faculty',
              subtext: `Role: ${d.role || 'Staff'}`,
              targetType: 'staff_direct'
            });
          }
        });
      }

      const uniqueMap = new Map<string, AllowedTarget>();
      targets.forEach(t => uniqueMap.set(`${t.targetType}_${t.id}`, t));
      setAllowedTargets(Array.from(uniqueMap.values()));
    };

    loadTargets().catch(console.error);
  }, [instituteId, user, role, showNewModal, isStudent, userBatchIds]);

  // Handle Target Selection (Staff/Admin)
  const handleSelectTarget = async (target: AllowedTarget) => {
    if (!instituteId || !user || isStudent) return;
    setCreatingConv(true);
    setErrorMsg('');

    try {
      if (target.targetType === 'staff_direct' || target.targetType === 'student_direct') {
        const res = await fetch('/api/messages/conversations/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            targetUserId: target.id
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start conversation');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
      } else {
        const typeParam = target.targetType === 'all_staff'
          ? 'all_staff_broadcast'
          : target.targetType === 'all_students'
          ? 'all_students_broadcast'
          : 'batch_broadcast';

        const res = await fetch('/api/messages/conversations/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId,
            userId: user.uid,
            type: typeParam,
            batchId: target.targetType === 'batch_broadcast' ? target.id : null
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start broadcast conversation');

        setActiveConvId(data.conversation.id);
        setShowNewModal(false);
      }
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      setErrorMsg(err.message || 'Permission denied');
    } finally {
      setCreatingConv(false);
    }
  };

  // Handle Send Message
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

  // Real-Time Typing Indicator Handler for Portal
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!instituteId || !activeConvId || !user?.uid) return;

    const convRef = doc(db, 'institutes', instituteId, 'conversations', activeConvId);

    if (text.trim().length > 0) {
      updateDoc(convRef, {
        [`typingUsers.${user.uid}`]: {
          name: userName || user.displayName || user.email || 'User',
          role: role || 'user',
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



  const activeConv = conversations.find(c => c.id === activeConvId);

  const getConvTitle = (c: Conversation) => {
    if (c.type === 'all_staff_broadcast') return 'All Staff Broadcast';
    if (c.type === 'all_students_broadcast') return 'All Students Broadcast';
    if (c.type === 'batch_broadcast') {
      const b = batches.find((x) => x.id === c.batchId);
      return b ? `Batch: ${b.name}` : `Batch Broadcast`;
    }
    if (c.type === 'direct') {
      if (!user?.uid) return 'Direct Chat';
      if (c.createdBy === user.uid) {
        return c.targetName || 'Direct Chat';
      } else {
        return c.createdByName || 'Direct Chat';
      }
    }
    return 'Conversation';
  };

  const activeTitle = activeConv ? getConvTitle(activeConv) : 'Chat';
  const activeBadge = activeConv
    ? activeConv.type === 'direct'
      ? '1:1 Direct'
      : activeConv.type === 'batch_broadcast'
      ? 'Batch'
      : activeConv.type === 'all_staff_broadcast'
      ? 'Staff Broadcast'
      : 'Students Broadcast'
    : '';

  // Check if another participant is currently typing
  const typingUserNames = React.useMemo(() => {
    if (!activeConv || !activeConv.typingUsers || !user?.uid) return '';
    const now = Date.now();
    const names: string[] = [];
    Object.entries(activeConv.typingUsers).forEach(([uId, data]: [string, any]) => {
      if (uId !== user.uid && data && data.timestamp && (now - data.timestamp < 4000)) {
        names.push(data.name || 'User');
      }
    });
    return names.join(', ');
  }, [activeConv, user?.uid]);

  const isOtherTyping = Boolean(typingUserNames);

  // ITEM 5: PRESENCE COMPUTATION (Online if active within last 2 mins)
  const isRecipientOnline = Boolean(
    recipientLastActive && (Date.now() - new Date(recipientLastActive).getTime() <= 120000)
  );

  return (
    // ITEM 6: ANIMATED ENTRANCE CONTAINER
    <div className="bg-[#0b1326] text-[#dae2fd] font-body-md min-h-screen flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* HEADER (BUG 4 FIX: REMOVED PLACEHOLDER TITLE TEXT ENTIRELY, ADJUSTED SPACING) */}
      <header className="bg-[#0b1326]/90 border-b border-white/10 flex justify-between items-center w-full px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-extrabold text-slate-400 uppercase tracking-wider">
            {(userName || user?.email || 'USER').toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-white/5 cursor-pointer transition-colors"
            title="Back"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
        </div>
      </header>

      {/* HORIZONTAL AVATAR "SPHERES" NAV */}
      <nav className="bg-slate-900/60 border-b border-white/10 py-3 px-4 overflow-x-auto no-scrollbar flex items-center gap-4 z-30 shrink-0">
        {/* BUG 1 FIX: "+" New Conversation Sphere ONLY visible to Staff & Admin (HIDDEN for Students) */}
        {!isStudent && (
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-600/20 flex items-center justify-center border-2 border-indigo-500/50 group-hover:scale-105 transition-transform shadow-lg shadow-indigo-600/10">
              <span className="material-symbols-outlined text-indigo-400 text-2xl">add</span>
            </div>
            <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider">New</span>
          </button>
        )}

        {/* Real Conversation Spheres from K0 */}
        {loadingConvs ? (
          <div className="text-xs text-slate-500 font-bold px-4">Loading threads...</div>
        ) : (
          conversations.map((c) => {
            const isSelected = c.id === activeConvId;
            const title = getConvTitle(c);

            // Check for unread marker
            const lastMsgAt = new Date(c.lastMessageAt || c.createdAt || 0).getTime();
            const lastReadMap = c.lastReadAt || {};
            const userLastReadAt = user ? new Date(lastReadMap[user.uid] || 0).getTime() : 0;
            const isUnread = lastMsgAt > userLastReadAt;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveConvId(c.id)}
                className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer relative"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-105 relative ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-950/80 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-300'
                  }`}
                >
                  {c.type === 'all_staff_broadcast' ? (
                    <span className="material-symbols-outlined text-purple-400 text-xl">record_voice_over</span>
                  ) : c.type === 'all_students_broadcast' ? (
                    <span className="material-symbols-outlined text-emerald-400 text-xl">campaign</span>
                  ) : c.type === 'batch_broadcast' ? (
                    <span className="material-symbols-outlined text-amber-400 text-xl">groups</span>
                  ) : (
                    <span className="font-black text-sm text-indigo-400">
                      {title.charAt(0).toUpperCase()}
                    </span>
                  )}

                  {/* Unread dot */}
                  {isUnread && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-[#0b1326] rounded-full animate-pulse"></span>
                  )}
                </div>

                <span className={`text-[10px] font-extrabold uppercase tracking-wider truncate max-w-[4.5rem] ${
                  isSelected ? 'text-indigo-400' : 'text-slate-400'
                }`}>
                  {title}
                </span>
              </button>
            );
          })
        )}
      </nav>

      {/* MAIN THREAD AREA */}
      <main className="flex-grow flex flex-col overflow-hidden relative">
        <section className="flex-grow flex flex-col relative z-10 bg-[#0b1326]">
          {!activeConvId || !activeConv ? (
            /* BUG 1 FIX: Clean Empty State for Students/Users with zero conversations */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <span className="material-symbols-outlined text-indigo-400/20 text-5xl">forum</span>
              <h3 className="text-sm font-extrabold text-slate-350">No Conversations Yet</h3>
              <p className="text-xs text-slate-555 max-w-xs leading-relaxed">
                {isStudent
                  ? 'When your teachers or institute admin send you a message or announcement, your threads will appear in the list above.'
                  : 'Select an active conversation above, or click "+ New" to start one.'}
              </p>
            </div>
          ) : (
            <>
              {/* Active Conversation Header Bar */}
              <div className="p-3 border-b border-white/10 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border border-indigo-500/50 flex items-center justify-center bg-indigo-950 font-black text-indigo-400 text-sm">
                      {activeTitle.charAt(0).toUpperCase()}
                    </div>
                    {/* Presence Dot */}
                    {activeConv.type === 'direct' && (
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#0b1326] rounded-full ${
                          isRecipientOnline ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={isRecipientOnline ? 'Online' : 'Offline'}
                      />
                    )}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-white text-sm leading-tight">{activeTitle}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/60 font-mono">
                        {activeBadge}
                      </span>
                      {activeConv.type === 'direct' && (
                        <span className={`text-[10px] font-bold ${isRecipientOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {isRecipientOnline ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4" id="messages-container">
                {loadingMsgs ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-bold">Loading message history...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 font-bold space-y-1">
                    <p className="text-slate-300">No messages in this conversation yet.</p>
                    <p className="text-[10px] text-slate-500">Send your first message below.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = Boolean(user && m.senderId === user.uid);
                    const timeStr = new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return isMe ? (
                      /* Outgoing Message Bubble (Current User) */
                      <div key={m.id} className="flex flex-col items-end self-end max-w-[85%] ml-auto group relative">
                        <div className="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-tr-none shadow-lg shadow-indigo-600/20 relative">
                          <p className="text-xs font-medium whitespace-pre-wrap">{m.text}</p>
                          {m.attachmentUrl && (
                            <div className="mt-2 pt-2 border-t border-white/20">
                              <a
                                href={m.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-indigo-200 underline hover:text-white flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">attachment</span>
                                View Attachment
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 mr-1">
                          <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                          <span className="material-symbols-outlined text-[12px] text-indigo-400">done_all</span>
                        </div>
                      </div>
                    ) : (
                      /* Incoming Message Bubble (Other User) */
                      <div key={m.id} className="flex flex-col items-start max-w-[85%] group">
                        <span className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">
                          {m.senderName} ({m.senderRole})
                        </span>
                        <div className="bg-slate-900 text-slate-100 p-3.5 rounded-2xl rounded-tl-none border border-white/5 backdrop-blur-md">
                          <p className="text-xs font-medium whitespace-pre-wrap">{m.text}</p>
                          {m.attachmentUrl && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <a
                                href={m.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-bold text-indigo-400 underline hover:text-indigo-300 flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">attachment</span>
                                View Attachment
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 ml-1">
                          <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                {isOtherTyping && (
                  <div className="flex items-center gap-2 p-2 px-3 bg-slate-900/90 border border-indigo-500/30 rounded-2xl w-fit text-xs text-indigo-300 animate-in fade-in slide-in-from-bottom-2 duration-200 my-2">
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

              {/* Error feedback */}
              {errorMsg && (
                <div className="px-4 py-2 bg-red-955/60 text-red-400 text-xs font-bold text-center border-t border-red-900/50">
                  {errorMsg}
                </div>
              )}

              {/* Input Bar */}
              <div className="p-4 bg-slate-900/60 border-t border-white/10">
                {showAttachmentInput && (
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="Paste attachment URL (drive link, document, image)..."
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="flex-1 bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAttachmentInput(false)}
                      className="text-slate-400 hover:text-white text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                  <div className="flex-grow bg-slate-900 border border-white/10 rounded-2xl p-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                      className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-400 cursor-pointer"
                      title="Add Attachment"
                    >
                      <span className="material-symbols-outlined">add_circle</span>
                    </button>
                    <textarea
                      className="flex-grow bg-transparent border-none focus:ring-0 text-xs text-white p-2.5 resize-none max-h-32 placeholder-slate-500 focus:outline-none"
                      placeholder="Type a message..."
                      rows={1}
                      value={inputText}
                      onChange={(e) => handleTyping(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sendingMsg || (!inputText.trim() && !attachmentUrl.trim())}
                    className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      send
                    </span>
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </main>

      {/* ALLOWED TARGET PICKER MODAL */}
      {!isStudent && showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">Start New Message Thread</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              Select an allowed recipient to start a conversation thread:
            </p>

            <input
              type="text"
              placeholder="Search recipient..."
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
              className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-2xl scrollbar-thin">
              {allowedTargets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">Loading allowed recipients...</div>
              ) : (
                allowedTargets
                  .filter((t) => t.name.toLowerCase().includes(targetSearch.toLowerCase()))
                  .map((target) => (
                    <button
                      key={`${target.targetType}_${target.id}`}
                      type="button"
                      onClick={() => handleSelectTarget(target)}
                      disabled={creatingConv}
                      className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-850 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div>
                        <h4 className="text-xs font-extrabold text-white">{target.name}</h4>
                        {target.subtext && <p className="text-[10px] text-slate-400 mt-0.5">{target.subtext}</p>}
                      </div>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border bg-indigo-955 text-indigo-300 border-indigo-800/60 font-mono">
                        {target.badge}
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
