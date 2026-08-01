import { db } from '@/lib/firebase/config';
import { collection, addDoc } from 'firebase/firestore';

export interface SendNotificationOptions {
  instituteId: string;
  recipientId?: string | null;
  recipientStudentId?: string | null;
  channel: 'sms' | 'email' | 'push';
  message: string;
  sandboxApiKey?: string;
  simulateFailure?: boolean;
}

export const sendNotification = async (options: SendNotificationOptions) => {
  const {
    instituteId,
    recipientId = null,
    recipientStudentId = null,
    channel,
    message,
    sandboxApiKey = process.env.NEXT_PUBLIC_NOTIFICATION_SANDBOX_KEY || 'sandbox-unnati-key',
    simulateFailure = false
  } = options;

  const nowIso = new Date().toISOString();
  const notificationsCol = collection(db, 'institutes', instituteId, 'notifications');

  // Check for sandbox failure conditions
  const isInvalidKey = sandboxApiKey === 'INVALID_KEY' || sandboxApiKey === 'EXPIRED_KEY';
  const isFailed = simulateFailure || isInvalidKey;

  const status: 'sent' | 'failed' | 'pending' = isFailed ? 'failed' : 'sent';

  const notificationPayload = {
    recipientId,
    recipientStudentId,
    channel,
    message,
    status,
    sentAt: nowIso,
    createdAt: nowIso
  };

  // Always write attempt log to Firestore
  const docRef = await addDoc(notificationsCol, notificationPayload);

  if (isFailed) {
    throw new Error(
      `Notification Dispatch Failed (${channel.toUpperCase()}): Sandbox API returned failure status [Invalid API key or Gateway Timeout]. Logged as failed ID #${docRef.id.substring(0, 6)}.`
    );
  }

  return {
    success: true,
    notificationId: docRef.id,
    status: 'sent'
  };
};
