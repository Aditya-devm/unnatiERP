import { getAdminDb } from '@/lib/firebase/admin';

export interface UserContext {
  userId: string;
  role: 'owner' | 'admin' | 'teacher' | 'staff' | 'student';
  name: string;
  batchIds: string[];
  staffId?: string | null;
}

/**
 * Resolves the authenticated user's role, name, and batchIds from Firestore.
 */
export async function getScopedUserContext(instituteId: string, userId: string): Promise<UserContext> {
  const db = getAdminDb();
  let role: 'owner' | 'admin' | 'teacher' | 'staff' | 'student' = 'student';
  let name = 'User';
  let batchIds: string[] = [];
  let staffId: string | null = null;
  let resolvedUid = userId;

  // A. First check if userId is a student doc ID in institutes/{instituteId}/students/{userId}
  const studentDoc = await db.collection('institutes').doc(instituteId).collection('students').doc(userId).get();
  let studentEmail = '';
  if (studentDoc.exists) {
    const sData = studentDoc.data() || {};
    studentEmail = sData.email || '';
    name = sData.fullName || name;
    if (Array.isArray(sData.batchIds)) {
      batchIds = sData.batchIds;
    }
  }

  // B. If it wasn't a direct doc ID, check if it matches by email or userId in students collection
  if (!studentDoc.exists) {
    const qSt = await db.collection('institutes').doc(instituteId).collection('students').where('email', '==', userId).limit(1).get();
    if (!qSt.empty) {
      const sData = qSt.docs[0].data();
      studentEmail = sData.email || '';
      name = sData.fullName || name;
      if (Array.isArray(sData.batchIds)) {
        batchIds = sData.batchIds;
      }
    }
  }

  // C. Now lookup the user in the main `users` collection to get the real Firebase Auth UID (resolvedUid)
  let userDoc = await db.collection('users').doc(resolvedUid).get();
  if (!userDoc.exists && studentEmail) {
    // Try lookup by student email
    const qByEmail = await db.collection('users').where('email', '==', studentEmail).limit(1).get();
    if (!qByEmail.empty) {
      userDoc = qByEmail.docs[0];
      resolvedUid = qByEmail.docs[0].id;
    }
  }
  if (!userDoc.exists) {
    // Try lookup by raw userId as email
    const qByEmail = await db.collection('users').where('email', '==', userId).limit(1).get();
    if (!qByEmail.empty) {
      userDoc = qByEmail.docs[0];
      resolvedUid = qByEmail.docs[0].id;
    }
  }

  // D. Extract user info from user doc
  if (userDoc.exists) {
    const data = userDoc.data() || {};
    const r = (data.role || 'student').toLowerCase();
    if (['owner', 'admin', 'teacher', 'staff', 'student'].includes(r)) {
      role = r as any;
    }
    name = data.name || data.fullName || data.displayName || name;
    staffId = data.staffId || null;
    if (Array.isArray(data.batchIds) && data.batchIds.length > 0) {
      batchIds = Array.from(new Set([...batchIds, ...data.batchIds]));
    }
  }

  // E. Fallback/Verification for teacher/staff batch assignment
  if (['teacher', 'staff', 'owner', 'admin'].includes(role)) {
    const bSnap = await db.collection('institutes').doc(instituteId).collection('batches').get();
    bSnap.forEach(bDoc => {
      const bData = bDoc.data();
      if (bData.teacherId === resolvedUid || (staffId && bData.teacherId === staffId)) {
        if (!batchIds.includes(bDoc.id)) {
          batchIds.push(bDoc.id);
        }
      }
    });
  }

  return { userId: resolvedUid, role, name, batchIds, staffId };
}

/**
 * Validates permission for starting a Direct 1:1 conversation.
 */
export function validateDirectConversationPermission(
  sender: UserContext,
  target: UserContext
): { allowed: boolean; reason?: string } {
  // BUG 1 FIX: Students cannot initiate conversations at all (server-side enforcement)
  if (sender.role === 'student') {
    return { allowed: false, reason: 'Students are not allowed to initiate new conversations. You can only reply to existing threads started by staff or admin.' };
  }

  // Staff/Teacher can message students enrolled in their assigned batches
  if (['teacher', 'staff'].includes(sender.role) && target.role === 'student') {
    const commonBatches = sender.batchIds.filter(bId => target.batchIds.includes(bId));
    if (commonBatches.length > 0) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Teachers can only message students enrolled in their assigned batches.' };
  }

  // Staff/Teacher can message other staff/teachers and admin/owner
  if (['teacher', 'staff'].includes(sender.role) && ['teacher', 'staff', 'owner', 'admin'].includes(target.role)) {
    return { allowed: true };
  }

  // Owner/Admin can message any staff or student individually
  if (['owner', 'admin'].includes(sender.role)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Conversation not permitted between these roles.' };
}

/**
 * Validates permission for deleting a message or conversation thread (Admin Only).
 */
export function validateDeletePermission(sender: UserContext): { allowed: boolean; reason?: string } {
  if (['owner', 'admin'].includes(sender.role)) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'Forbidden: Only Owner or Admin can delete messages or conversations.' };
}

/**
 * Validates permission for creating a Broadcast conversation.
 */
export function validateBroadcastCreatePermission(
  sender: UserContext,
  type: 'batch_broadcast' | 'all_staff_broadcast' | 'all_students_broadcast',
  batchId?: string
): { allowed: boolean; reason?: string } {
  if (type === 'all_staff_broadcast' || type === 'all_students_broadcast') {
    if (['owner', 'admin'].includes(sender.role)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Admin can create institute-wide broadcasts.' };
  }

  if (type === 'batch_broadcast') {
    if (!batchId) {
      return { allowed: false, reason: 'Batch ID is required for batch broadcast.' };
    }
    if (['owner', 'admin'].includes(sender.role)) {
      return { allowed: true };
    }
    if (['teacher', 'staff'].includes(sender.role)) {
      if (sender.batchIds.includes(batchId)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Teachers can only send broadcast to their assigned batches.' };
    }
    if (sender.role === 'student') {
      return { allowed: false, reason: 'Students cannot create broadcast conversations.' };
    }
  }

  return { allowed: false, reason: 'Broadcast type not allowed for your role.' };
}

/**
 * Validates permission for posting a message into an existing conversation.
 */
export function validatePostMessagePermission(
  sender: UserContext,
  conversation: any
): { allowed: boolean; reason?: string } {
  const type = conversation.type;

  if (type === 'direct') {
    if (Array.isArray(conversation.participantIds) && conversation.participantIds.includes(sender.userId)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'You are not a participant in this direct conversation.' };
  }

  if (type === 'batch_broadcast') {
    if (['owner', 'admin'].includes(sender.role)) {
      return { allowed: true };
    }
    if (['teacher', 'staff'].includes(sender.role)) {
      if (sender.batchIds.includes(conversation.batchId) || conversation.createdBy === sender.userId) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Teachers can only post broadcast messages to their assigned batches.' };
    }
    if (sender.role === 'student') {
      return { allowed: false, reason: 'Students cannot post to broadcast conversations.' };
    }
  }

  if (type === 'all_staff_broadcast') {
    if (['owner', 'admin', 'teacher', 'staff'].includes(sender.role)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Staff and Admin can post to all staff broadcast.' };
  }

  if (type === 'all_students_broadcast') {
    if (['owner', 'admin'].includes(sender.role)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Admin can post to institute-wide broadcasts.' };
  }

  return { allowed: false, reason: 'Not authorized to post to this conversation.' };
}

/**
 * Validates whether a user is allowed to read/list a conversation.
 */
export function validateReadConversationPermission(
  sender: UserContext,
  conversation: any
): boolean {
  const type = conversation.type;

  if (type === 'direct') {
    return Array.isArray(conversation.participantIds) && conversation.participantIds.includes(sender.userId);
  }

  if (type === 'all_staff_broadcast') {
    return ['owner', 'admin', 'teacher', 'staff'].includes(sender.role);
  }

  if (type === 'all_students_broadcast') {
    return ['owner', 'admin', 'student'].includes(sender.role);
  }

  if (type === 'batch_broadcast') {
    if (['owner', 'admin'].includes(sender.role)) return true;
    if (['teacher', 'staff'].includes(sender.role)) {
      return sender.batchIds.includes(conversation.batchId) || conversation.createdBy === sender.userId;
    }
    if (sender.role === 'student') {
      return sender.batchIds.includes(conversation.batchId);
    }
  }

  return false;
}
