'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';

export default function BellNotificationIcon() {
  const { user, instituteId, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!instituteId || !user) {
      setHasUnread(false);
      setUnreadCount(0);
      return;
    }

    const convsCol = collection(db, 'institutes', instituteId, 'conversations');
    const unsub = onSnapshot(convsCol, (snapshot) => {
      let count = 0;
      const uRole = (role || '').toLowerCase();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const participantIds: string[] = d.participantIds || [];

        // Check if user has access to conversation
        let hasAccess = false;
        if (['owner', 'admin'].includes(uRole)) hasAccess = true;
        else if (uRole === 'student') {
          hasAccess = participantIds.includes(user.uid) || d.type === 'all_students_broadcast' || d.type === 'batch_broadcast';
        } else if (['teacher', 'staff'].includes(uRole)) {
          hasAccess = participantIds.includes(user.uid) || d.type === 'all_staff_broadcast' || (d.type === 'batch_broadcast' && d.createdBy === user.uid);
        }

        if (hasAccess) {
          const lastMsgAt = new Date(d.lastMessageAt || d.createdAt || 0).getTime();
          const lastReadMap = d.lastReadAt || {};
          const userLastReadStr = lastReadMap[user.uid];
          const userLastReadAt = userLastReadStr ? new Date(userLastReadStr).getTime() : 0;

          // If last message is newer than user's last read timestamp
          if (lastMsgAt > userLastReadAt) {
            count++;
          }
        }
      });

      setUnreadCount(count);
      setHasUnread(count > 0);
    });

    return () => unsub();
  }, [instituteId, user, role]);

  const handleClick = () => {
    const isErp = pathname?.startsWith('/erp');
    if (isErp) {
      router.push('/erp/messages');
    } else {
      router.push('/portal/messages');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="p-2 hover:bg-white/5 rounded-full transition-colors relative cursor-pointer group"
      title={hasUnread ? `${unreadCount} unread message(s)` : 'Messages & Notifications'}
    >
      <span className="material-symbols-outlined text-indigo-400 group-hover:text-white transition-colors">
        notifications
      </span>

      {/* Real Unread-Only Red Dot */}
      {hasUnread && (
        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900 animate-pulse shadow-md shadow-red-500/50"></span>
      )}
    </button>
  );
}
