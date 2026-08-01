import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

export const SUBCOLLECTIONS = [
  'students',
  'batches',
  'feeStructures',
  'feePayments',
  'attendanceRecords',
  'staffAttendance',
  'enquiries',
  'enquiryFollowups',
  'exams',
  'examResults',
  'notifications',
  'expenses'
] as const;

export interface BackupPayload {
  version: string;
  instituteId: string;
  exportedAt: string;
  collections: Record<string, any[]>;
}

export const exportInstituteBackupJSON = async (instituteId: string) => {
  const collectionsData: Record<string, any[]> = {};

  for (const subcol of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, 'institutes', instituteId, subcol));
    const items: any[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() });
    });
    collectionsData[subcol] = items;
  }

  const backupPayload: BackupPayload = {
    version: '1.0',
    instituteId,
    exportedAt: new Date().toISOString(),
    collections: collectionsData
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Unnati_Backup_${instituteId.substring(0, 8)}_${new Date().toISOString().substring(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return backupPayload;
};

export const validateAndPreviewBackupJSON = (
  jsonText: string
): {
  valid: boolean;
  summary: Record<string, number>;
  totalRecords: number;
  error?: string;
  parsedData?: BackupPayload;
} => {
  try {
    const data: BackupPayload = JSON.parse(jsonText);

    if (!data || !data.collections || typeof data.collections !== 'object') {
      return {
        valid: false,
        summary: {},
        totalRecords: 0,
        error: 'Invalid backup file structure. Missing "collections" payload.'
      };
    }

    const summary: Record<string, number> = {};
    let totalRecords = 0;

    for (const subcol of SUBCOLLECTIONS) {
      const records = data.collections[subcol] || [];
      summary[subcol] = Array.isArray(records) ? records.length : 0;
      totalRecords += summary[subcol];
    }

    return {
      valid: true,
      summary,
      totalRecords,
      parsedData: data
    };
  } catch (err: any) {
    return {
      valid: false,
      summary: {},
      totalRecords: 0,
      error: `JSON Syntax Error: ${err.message}`
    };
  }
};

export const restoreInstituteBackupJSON = async (
  targetInstituteId: string,
  backupData: BackupPayload
): Promise<{ success: boolean; restoredCounts: Record<string, number> }> => {
  const restoredCounts: Record<string, number> = {};

  for (const subcol of SUBCOLLECTIONS) {
    const items = backupData.collections[subcol] || [];
    if (!Array.isArray(items) || items.length === 0) {
      restoredCounts[subcol] = 0;
      continue;
    }

    let batch = writeBatch(db);
    let countInBatch = 0;
    let totalSubcolCount = 0;

    for (const item of items) {
      const { id, ...dataPayload } = item;
      const docRef = id
        ? doc(db, 'institutes', targetInstituteId, subcol, id)
        : doc(collection(db, 'institutes', targetInstituteId, subcol));

      batch.set(docRef, dataPayload, { merge: true });
      countInBatch++;
      totalSubcolCount++;

      // Commit in chunks of 450 (Firestore limit is 500)
      if (countInBatch >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        countInBatch = 0;
      }
    }

    if (countInBatch > 0) {
      await batch.commit();
    }

    restoredCounts[subcol] = totalSubcolCount;
  }

  return {
    success: true,
    restoredCounts
  };
};
