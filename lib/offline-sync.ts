import { db } from '@/lib/firebase/config';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';

export interface OfflineAction {
  id: string;
  type: 'attendance' | 'student';
  collectionPath: string;
  docId?: string;
  payload: any;
  timestamp: string;
}

const getQueueKey = (instituteId: string) => `unnati_offline_queue_${instituteId}`;

export const getPendingOfflineQueue = (instituteId: string): OfflineAction[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getQueueKey(instituteId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading offline queue:', err);
    return [];
  }
};

export const enqueueOfflineAction = (
  instituteId: string,
  actionData: Omit<OfflineAction, 'id' | 'timestamp'>
): OfflineAction => {
  const currentQueue = getPendingOfflineQueue(instituteId);
  const newAction: OfflineAction = {
    ...actionData,
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  const updatedQueue = [...currentQueue, newAction];
  localStorage.setItem(getQueueKey(instituteId), JSON.stringify(updatedQueue));
  
  // Dispatch custom window event for instant UI count updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('unnati_offline_queue_updated'));
  }

  return newAction;
};

export const clearOfflineQueue = (instituteId: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getQueueKey(instituteId));
  window.dispatchEvent(new Event('unnati_offline_queue_updated'));
};

export const flushOfflineQueue = async (
  instituteId: string
): Promise<{ syncedCount: number; errors: any[] }> => {
  const queue = getPendingOfflineQueue(instituteId);
  if (queue.length === 0) return { syncedCount: 0, errors: [] };

  let syncedCount = 0;
  const errors: any[] = [];
  const remainingQueue: OfflineAction[] = [];

  for (const action of queue) {
    try {
      const colRef = collection(db, action.collectionPath);
      if (action.docId) {
        await setDoc(doc(colRef, action.docId), action.payload, { merge: true });
      } else {
        await addDoc(colRef, action.payload);
      }
      syncedCount++;
    } catch (err: any) {
      console.error(`Error syncing offline action ${action.id}:`, err);
      errors.push({ actionId: action.id, message: err.message });
      remainingQueue.push(action);
    }
  }

  if (remainingQueue.length > 0) {
    localStorage.setItem(getQueueKey(instituteId), JSON.stringify(remainingQueue));
  } else {
    clearOfflineQueue(instituteId);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('unnati_offline_queue_updated'));
  }

  return { syncedCount, errors };
};
