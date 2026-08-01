'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { db, app } from '@/lib/firebase/config';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  Eye,
  Check,
  X,
  Upload,
  Loader2,
  AlertCircle,
  Clock,
  CreditCard,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  FileSpreadsheet,
  MessageSquare,
  KeyRound,
  Send,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  FileText,
  TrendingUp,
  Share2
} from 'lucide-react';
import Link from 'next/link';
import { generateBulkIdCardsPDF } from '@/lib/id-card-pdf';
import { generateApplicationFormPDF } from '@/lib/application-form-pdf';
import {
  downloadSampleStudentCSV,
  exportStudentsToCSV,
  parseAndValidateStudentCSV,
  ParsedStudentRow
} from '@/lib/csv-helpers';

interface Student {
  id: string;
  fullName: string;
  fatherName?: string;
  motherName?: string;
  aadharNumber?: string;
  whatsappNumber?: string;
  whatsappCountryCode?: string;
  mobileCountryCode?: string;
  rollNumber?: string;
  email?: string;
  password?: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  address: string;
  photoUrl: string | null;
  pendingPhotoUrl: string | null;
  enrollmentDate: string;
  closingDate?: string | null;
  collectFeeOnMonthStart?: boolean;
  monthlyFee?: number;
  customFeeAmount?: number | null;
  status: 'active' | 'inactive' | 'dropped';
  batchIds: string[];
  previousBatches?: any[];
  createdAt?: any;
}

interface Batch {
  id: string;
  name: string;
  subject: string;
}

export default function ErpStudents() {
  const { instituteId, role } = useAuth();
  const isAdmin = role === 'owner' || role === 'admin';
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  // Selection & Bulk Menu State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [studentsMenuOpen, setStudentsMenuOpen] = useState(false);

  // Bulk Message Modal State
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Share Credentials Modal State
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [sendingResets, setSendingResets] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // CSV Import Modal & Preview State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    rows: ParsedStudentRow[];
    totalValid: number;
    totalInvalid: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Student CRUD Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form Fields (Comprehensive Original Set)
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [whatsappCountryCode, setWhatsappCountryCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [mobileCountryCode, setMobileCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('male');
  const [address, setAddress] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [collectFeeOnMonthStart, setCollectFeeOnMonthStart] = useState<boolean>(true);
  const [monthlyFee, setMonthlyFee] = useState<number | ''>(2000);
  const [customFeeAmount, setCustomFeeAmount] = useState<number | ''>('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'dropped'>('active');
  const [studentBatchIds, setStudentBatchIds] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [simulateStudentUpload, setSimulateStudentUpload] = useState(false);

  // Promote Student Modal State
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promotingStudent, setPromotingStudent] = useState<Student | null>(null);
  const [promoteNewBatchId, setPromoteNewBatchId] = useState<string>('');
  const [promoteNewMonthlyFee, setPromoteNewMonthlyFee] = useState<number | ''>(2000);
  const [promoteNewStartDate, setPromoteNewStartDate] = useState<string>('');
  const [promotePrevClosingDate, setPromotePrevClosingDate] = useState<string>('');
  const [submittingPromote, setSubmittingPromote] = useState(false);
  const [promoteError, setPromoteError] = useState('');

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [feePayments, setFeePayments] = useState<any[]>([]);

  // Fetch data
  useEffect(() => {
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';

    // 1. Fetch Students
    const studentsCol = collection(db, 'institutes', targetInstId, 'students');
    const unsubscribeStudents = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Student);
      });
      setStudents(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching students:', err);
      setLoading(false);
    });

    // 2. Fetch Batches
    const batchesCol = collection(db, 'institutes', targetInstId, 'batches');
    const unsubscribeBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Batch);
      });
      setBatches(list);
    });

    // 3. Fetch Fee Payments for monthly collection stat
    const paymentsCol = collection(db, 'institutes', targetInstId, 'feePayments');
    const unsubscribePayments = onSnapshot(paymentsCol, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setFeePayments(list);
    });

    // 4. Fetch Real Institute Document Info
    const instDocRef = doc(db, 'institutes', targetInstId);
    const unsubscribeInst = onSnapshot(instDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setInstituteInfo(docSnap.data() as any);
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeBatches();
      unsubscribePayments();
      unsubscribeInst();
    };
  }, [instituteId]);

  const [instituteInfo, setInstituteInfo] = useState<{ name?: string; address?: string; phone?: string; email?: string } | null>(null);

  // Checkbox Select All / Toggle
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone.includes(searchQuery) ||
      (student.rollNumber && student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (student.email && student.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = !statusFilter || student.status === statusFilter;
    const matchesBatch = !batchFilter || (student.batchIds && student.batchIds.includes(batchFilter));

    return matchesSearch && matchesStatus && matchesBatch;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleToggleBatchSelect = (batchId: string) => {
    if (studentBatchIds.includes(batchId)) {
      setStudentBatchIds(studentBatchIds.filter((id) => id !== batchId));
    } else {
      setStudentBatchIds([...studentBatchIds, batchId]);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Bulk Action 1: Generate ID Cards for Selected Students
  const handleBulkGenerateIDCards = async () => {
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;
    await generateBulkIdCardsPDF(selected, batches);
    setStudentsMenuOpen(false);
  };

  // Bulk Action 2: Export Selected Students Data (CSV)
  const handleBulkExportCSV = () => {
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;
    exportStudentsToCSV(selected, `selected_students_${selected.length}_records.csv`);
    setStudentsMenuOpen(false);
  };

  // Bulk Action 3: Message Selected Students
  const handleOpenBulkMessageModal = () => {
    setMsgTitle('');
    setMsgBody('');
    setMessageModalOpen(true);
    setStudentsMenuOpen(false);
  };

  const handleExecuteBulkMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0 || !msgTitle.trim() || !msgBody.trim()) return;

    setSendingMsg(true);
    try {
      await addDoc(collection(db, 'institutes', targetInstId, 'notifications'), {
        title: msgTitle.trim(),
        message: msgBody.trim(),
        targetType: 'selected_students',
        targetIds: selectedIds,
        recipientCount: selected.length,
        createdAt: new Date().toISOString()
      });

      alert(`Broadcast message sent successfully to ${selected.length} selected students!`);
      setMessageModalOpen(false);
    } catch (err) {
      console.error('Error sending bulk message:', err);
      alert('Failed to send bulk message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Bulk Action 4: Share Login ID & Password via Formal HTML Email to Registered Email
  const handleOpenCredentialsModal = () => {
    setResetSuccessMsg('');
    setCredentialsModalOpen(true);
    setStudentsMenuOpen(false);
  };

  const handleSendCredentialsEmail = async () => {
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;

    setSendingResets(true);
    setResetSuccessMsg('');

    try {
      let sentCount = 0;
      let skippedCount = 0;

      for (const s of selected) {
        const regEmail = (s.email || '').trim();
        if (!regEmail || !regEmail.includes('@')) {
          skippedCount++;
          continue;
        }

        const res = await fetch('/api/auth/send-login-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId: targetInstId,
            studentId: s.id,
            studentEmail: regEmail,
            studentName: s.fullName,
            password: s.password || s.phone || '123456',
            rollNo: s.rollNumber || 'N/A',
            instituteName: 'UNNATI CLASSES'
          })
        });

        if (res.ok) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }

      let msg = `Successfully sent formal Login ID & Password email(s) to ${sentCount} student registered email(s)!`;
      if (skippedCount > 0) {
        msg += ` (${skippedCount} student(s) skipped due to missing registered email address in Student Directory).`;
      }
      setResetSuccessMsg(msg);
    } catch (err: any) {
      console.error('Error sending login credentials emails:', err);
      alert('Failed to send login credentials email.');
    } finally {
      setSendingResets(false);
    }
  };

  // Bulk Action 6: Download Application Form PDF (Admin Only)
  const handleDownloadApplicationForm = async () => {
    if (!isAdmin) {
      alert('Application Form PDF download is restricted to Admin accounts.');
      return;
    }
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;

    try {
      for (const s of selected) {
        await generateApplicationFormPDF({
          instituteInfo,
          student: s,
          batches
        });
      }
      setStudentsMenuOpen(false);
    } catch (err: any) {
      console.error('Error generating Application Form PDF:', err);
      alert('Failed to generate Application Form PDF.');
    }
  };

  // Bulk Action 7: Send Application Form PDF via WhatsApp API (Admin Only)
  const handleSendApplicationFormWhatsAppAPI = async () => {
    if (!isAdmin) {
      alert('WhatsApp API document dispatch is restricted to Admin accounts.');
      return;
    }
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;

    setStudentsMenuOpen(false);

    let sentCount = 0;
    let notConfigured = false;
    let errorMsg = '';

    for (const s of selected) {
      try {
        const { filename, dataUri } = await generateApplicationFormPDF(
          {
            instituteInfo,
            student: s,
            batches
          },
          false
        );

        const res = await fetch('/api/whatsapp/send-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instituteId: instituteId || 'ZA7wk0M2oXtrl3rd5FY3',
            studentId: s.id,
            studentPhone: s.whatsappNumber || s.parentPhone || s.phone,
            studentName: s.fullName,
            documentDataUri: dataUri,
            filename
          })
        });

        const data = await res.json();

        if (!res.ok || !data.configured) {
          if (data.configured === false) {
            notConfigured = true;
            errorMsg = data.error || 'WhatsApp API credentials are not configured yet.';
          } else {
            errorMsg = data.error || 'WhatsApp API request failed.';
          }
          break;
        }

        sentCount++;
      } catch (err: any) {
        console.error('Error sending WhatsApp document API:', err);
        errorMsg = err.message || 'WhatsApp API send error.';
        break;
      }
    }

    if (notConfigured) {
      alert(
        `⚠️ WhatsApp API Configuration Required:\n\n${errorMsg}\n\nAttempt logged in Notifications collection as [pending_config]. Please configure Meta WhatsApp Cloud API credentials in Institute Settings.`
      );
    } else if (sentCount > 0) {
      alert(`✅ Success: Successfully sent Application Form PDF via WhatsApp API to ${sentCount} student(s)!`);
    } else if (errorMsg) {
      alert(`❌ WhatsApp API Error: ${errorMsg}`);
    }
  };

  // Bulk Action 8: Open WhatsApp Chat Fallback (Admin Only)
  const handleShareApplicationFormWhatsApp = async () => {
    if (!isAdmin) {
      alert('WhatsApp sharing of Application Form is restricted to Admin accounts.');
      return;
    }
    const selected = students.filter((s) => selectedIds.includes(s.id));
    if (selected.length === 0) return;

    // Generate PDFs first for selected students
    for (const s of selected) {
      await generateApplicationFormPDF({
        instituteInfo,
        student: s,
        batches
      });
    }

    // Open WhatsApp chats for selected students
    selected.forEach((s) => {
      const rawPhone = s.whatsappNumber || s.parentPhone || s.phone || '';
      const cleanDigits = rawPhone.replace(/\D/g, '');
      const msg = `Hello ${s.fullName}! Please find your official UNNATI CLASSES Application Form PDF attached.`;

      if (cleanDigits.length >= 10) {
        const fullNumber = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
        window.open(`https://wa.me/${fullNumber}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    });

    setStudentsMenuOpen(false);
    alert(
      "WhatsApp chat opened in a new tab!\n\nNote: WhatsApp deep-links open the chat with pre-filled text. Please attach the downloaded Application Form PDF manually inside the WhatsApp chat."
    );
  };

  // Bulk Action 5: Import Students from CSV File
  const handleFileChangeCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);
      setImportSuccessMsg('');

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const result = parseAndValidateStudentCSV(text);
        setImportPreview(result);
      };
      reader.readAsText(file);
    }
  };

  const handleExecuteImport = async () => {
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    if (!importPreview || importPreview.rows.length === 0) return;

    const validRows = importPreview.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid student rows found to import.');
      return;
    }

    setImporting(true);
    setImportSuccessMsg('');

    try {
      const batchOp = writeBatch(db);

      validRows.forEach((row) => {
        const studentRef = doc(collection(db, 'institutes', targetInstId, 'students'));
        batchOp.set(studentRef, {
          rollNumber: row.rollNumber,
          fullName: row.fullName,
          fatherName: row.fatherName,
          motherName: row.motherName,
          parentName: row.parentName || row.fatherName,
          aadharNumber: row.aadharNumber,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          phone: row.phone,
          whatsappNumber: row.whatsappNumber,
          parentPhone: row.parentPhone || row.whatsappNumber || row.phone,
          email: row.email,
          password: row.password || row.phone || '123456',
          address: row.address,
          enrollmentDate: row.enrollmentDate || new Date().toISOString().substring(0, 10),
          currentBatchEnrollmentDate: row.enrollmentDate || new Date().toISOString().substring(0, 10),
          monthlyFee: row.monthlyFee,
          customFeeAmount: row.monthlyFee,
          collectFeeOnMonthStart: true,
          status: row.status || 'active',
          batchIds: [],
          photoUrl: null,
          pendingPhotoUrl: null,
          createdAt: new Date().toISOString()
        });
      });

      await batchOp.commit();

      setImportSuccessMsg(`Import Complete! Successfully created ${validRows.length} comprehensive student profiles.`);
      setTimeout(() => {
        setImportModalOpen(false);
        setImportFile(null);
        setImportPreview(null);
        setImportSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      console.error('Error importing students:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Open Create/Edit Student Modal (Fully Restored Fields)
  const openCreateModal = () => {
    setEditingStudent(null);
    setFullName('');
    setFatherName('');
    setMotherName('');
    setAadharNumber('');
    setWhatsappCountryCode('+91');
    setWhatsappNumber('');
    setMobileCountryCode('+91');
    setPhone('');
    setParentName('');
    setParentPhone('');
    setRollNumber('');
    setEmail('');
    setPassword('');
    setDateOfBirth('');
    setGender('male');
    setAddress('');
    setEnrollmentDate(new Date().toISOString().substring(0, 10));
    setClosingDate('');
    setCollectFeeOnMonthStart(true);
    setMonthlyFee(2000);
    setCustomFeeAmount('');
    setStatus('active');
    setStudentBatchIds([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSimulateStudentUpload(false);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFullName(student.fullName);
    setFatherName(student.fatherName || student.parentName || '');
    setMotherName(student.motherName || '');
    setAadharNumber(student.aadharNumber || '');
    setWhatsappCountryCode(student.whatsappCountryCode || '+91');
    setWhatsappNumber(student.whatsappNumber ? student.whatsappNumber.replace(/^\+\d+\s*/, '') : '');
    setMobileCountryCode(student.mobileCountryCode || '+91');
    setPhone(student.phone ? student.phone.replace(/^\+\d+\s*/, '') : '');
    setParentName(student.parentName || student.fatherName || '');
    setParentPhone(student.parentPhone || student.whatsappNumber || '');
    setRollNumber(student.rollNumber || '');
    setEmail(student.email || '');
    setPassword(student.password || '');
    setDateOfBirth(student.dateOfBirth || '');
    setGender(student.gender || 'male');
    setAddress(student.address || '');
    setEnrollmentDate(student.enrollmentDate || '');
    setClosingDate(student.closingDate || '');
    setCollectFeeOnMonthStart(student.collectFeeOnMonthStart !== false);
    setMonthlyFee(student.monthlyFee !== undefined ? Number(student.monthlyFee) : 2000);
    setCustomFeeAmount(student.customFeeAmount !== undefined && student.customFeeAmount !== null ? student.customFeeAmount : '');
    setStatus(student.status || 'active');
    setStudentBatchIds(student.batchIds || []);
    setPhotoFile(null);
    setPhotoPreview(student.photoUrl || null);
    setSimulateStudentUpload(false);
    setError('');
    setModalOpen(true);
  };

  const openPromoteModal = (st: Student) => {
    setPromotingStudent(st);
    setPromoteNewBatchId(batches.length > 0 ? batches[0].id : '');
    setPromoteNewMonthlyFee(st.monthlyFee !== undefined ? Number(st.monthlyFee) : 2000);
    const today = new Date().toISOString().substring(0, 10);
    setPromoteNewStartDate(today);
    setPromotePrevClosingDate(today);
    setPromoteError('');
    setPromoteModalOpen(true);
  };

  const handleExecutePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingStudent || !promoteNewBatchId || !promoteNewStartDate) {
      setPromoteError('Please select a target new batch and effective start date.');
      return;
    }

    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    setSubmittingPromote(true);
    setPromoteError('');

    try {
      const oldBatches = promotingStudent.batchIds || [];
      const oldBatchId = oldBatches[0] || '';
      const oldBatchObj = batches.find((b) => b.id === oldBatchId);
      const oldBatchName = oldBatchObj?.name || 'Previous Batch';

      const shiftDate = new Date().toISOString();
      const historyEntry = {
        batchId: oldBatchId,
        batchIds: oldBatches,
        batchName: oldBatchName,
        shiftedAt: shiftDate,
        leftDate: promotePrevClosingDate || shiftDate.substring(0, 10),
        joinedDate: (promotingStudent as any).currentBatchEnrollmentDate || promotingStudent.enrollmentDate || '',
        enrollmentDate: (promotingStudent as any).currentBatchEnrollmentDate || promotingStudent.enrollmentDate || '',
        monthlyFee: Number(promotingStudent.monthlyFee || promotingStudent.customFeeAmount || 2000),
        promotedAt: shiftDate
      };

      const existingPrevHistory = promotingStudent.previousBatches || [];
      const existingBatchHistory = (promotingStudent as any).batchHistory || [];

      await updateDoc(doc(db, 'institutes', targetInstId, 'students', promotingStudent.id), {
        batchIds: [promoteNewBatchId], // Replaces old batch ID with new batch ID!
        currentBatchEnrollmentDate: promoteNewStartDate, // Resets fee cycle starting from new batch start date!
        monthlyFee: Number(promoteNewMonthlyFee),
        customFeeAmount: Number(promoteNewMonthlyFee),
        closingDate: null, // Clears closing date so active fee cycle continues for new batch
        status: 'active',
        previousBatches: [...existingPrevHistory, historyEntry],
        batchHistory: [...existingBatchHistory, historyEntry],
        updatedAt: shiftDate
      });

      setPromoteModalOpen(false);
      setPromotingStudent(null);
      alert(`Student ${promotingStudent.fullName} successfully promoted to new batch!`);
    } catch (err: any) {
      console.error('Error promoting student:', err);
      setPromoteError(err.message || 'Failed to promote student.');
    } finally {
      setSubmittingPromote(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';

    if (
      !fullName.trim() ||
      !fatherName.trim() ||
      !motherName.trim() ||
      !dateOfBirth ||
      !whatsappNumber.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !enrollmentDate ||
      !email.trim() ||
      !password.trim() ||
      monthlyFee === '' ||
      Number(monthlyFee) < 0
    ) {
      setError('Please fill in all required fields (marked with *), including Portal Password and a valid Monthly Fee.');
      return;
    }

    const fullWhatsapp = whatsappNumber.startsWith('+')
      ? whatsappNumber.trim()
      : `${whatsappCountryCode} ${whatsappNumber.trim()}`;
    const fullMobile = phone.startsWith('+')
      ? phone.trim()
      : `${mobileCountryCode} ${phone.trim()}`;

    setSubmitting(true);
    setError('');

    try {
      let finalPhotoUrl = editingStudent ? editingStudent.photoUrl : null;
      let finalPendingPhotoUrl = editingStudent ? editingStudent.pendingPhotoUrl : null;

      const tempId = editingStudent ? editingStudent.id : doc(collection(db, 'institutes', targetInstId, 'students')).id;

      if (photoFile) {
        const storage = getStorage(app);
        const storageRef = ref(storage, `institutes/${targetInstId}/students/${tempId}/${Date.now()}_${photoFile.name}`);
        const uploadResult = await uploadBytes(storageRef, photoFile);
        const downloadUrl = await getDownloadURL(uploadResult.ref);

        if (simulateStudentUpload) {
          finalPendingPhotoUrl = downloadUrl;
        } else {
          finalPhotoUrl = downloadUrl;
          finalPendingPhotoUrl = null;
        }
      }

      const primaryBatchChanged = editingStudent && (editingStudent.batchIds?.[0] !== studentBatchIds[0]);
      const resolvedBatchEnrollmentDate = editingStudent
        ? (primaryBatchChanged ? new Date().toISOString().substring(0, 10) : ((editingStudent as any).currentBatchEnrollmentDate || enrollmentDate))
        : enrollmentDate;

      const studentPayload = {
        fullName: fullName.trim(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        aadharNumber: aadharNumber.trim(),
        whatsappNumber: fullWhatsapp,
        whatsappCountryCode,
        mobileCountryCode,
        rollNumber: rollNumber.trim(),
        email: email.toLowerCase().trim(),
        password: password || '',
        dateOfBirth,
        gender,
        phone: fullMobile,
        parentName: fatherName.trim() || parentName.trim(),
        parentPhone: fullWhatsapp,
        address: address.trim(),
        photoUrl: finalPhotoUrl,
        pendingPhotoUrl: finalPendingPhotoUrl,
        enrollmentDate,
        currentBatchEnrollmentDate: resolvedBatchEnrollmentDate,
        closingDate: closingDate.trim() || null,
        collectFeeOnMonthStart,
        monthlyFee: Number(monthlyFee),
        customFeeAmount: Number(monthlyFee),
        status: closingDate && closingDate.trim() !== '' ? 'inactive' : status,
        batchIds: studentBatchIds,
        updatedAt: new Date().toISOString()
      };

      if (editingStudent) {
        await updateDoc(doc(db, 'institutes', targetInstId, 'students', editingStudent.id), studentPayload);
      } else {
        await setDoc(doc(db, 'institutes', targetInstId, 'students', tempId), {
          ...studentPayload,
          createdAt: new Date().toISOString()
        });
      }

      setModalOpen(false);
    } catch (err: any) {
      console.error('Error saving student:', err);
      setError(err.message || 'Failed to save student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    const targetInstId = instituteId || 'ZA7wk0M2oXtrl3rd5FY3';
    if (!confirm('Are you sure you want to delete this student record? This action will permanently remove their credentials and revoke access.')) return;

    try {
      await deleteDoc(doc(db, 'institutes', targetInstId, 'students', studentId));
      setSelectedIds(selectedIds.filter((id) => id !== studentId));

      await fetch('/api/auth/delete-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instituteId: targetInstId, studentId })
      });
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('Failed to delete student.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="font-bold">Loading Student Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Student Directory</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Manage student enrollments, batch assignments, bulk ID cards, CSV data import, and portal access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* IMPORT STUDENTS BUTTON */}
          <button
            onClick={() => { setImportFile(null); setImportPreview(null); setImportModalOpen(true); }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 text-indigo-400 border border-indigo-500/30 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Upload className="h-4 w-4" /> Import Students (CSV)
          </button>

          {/* ADD STUDENT BUTTON */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add New Student
          </button>
        </div>
      </div>

      {/* FILTER & BULK ACTIONS BAR WITH TOP RIGHT STATS */}
      {(() => {
        const totalStudentsCount = students.length;
        const totalInactiveCount = students.filter(
          (s) => s.status === 'inactive' || s.status === 'dropped' || Boolean(s.closingDate)
        ).length;

        // Total monthly fee rate sum for current batch of active students on the page
        const monthlyFeeCurrentBatches = students
          .filter((s) => s.status === 'active')
          .reduce((sum, s) => {
            const fee = s.monthlyFee !== undefined && s.monthlyFee !== null
              ? Number(s.monthlyFee)
              : (s.customFeeAmount !== undefined && s.customFeeAmount !== null ? Number(s.customFeeAmount) : 2000);
            return sum + fee;
          }, 0);

        return (
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3.5 shadow-xl">
            {/* TOP HEADER OF SEARCH CONTAINER WITH TOP RIGHT STATS BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-indigo-400" /> Student Search & Filter Controls
              </span>

              {/* TOP RIGHT STATS BAR */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 bg-slate-955 border border-slate-850 px-3.5 py-1.5 rounded-2xl text-xs shadow-inner">
                {/* Total Students */}
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Total Students:</span>
                  <span className="text-white font-extrabold font-mono text-xs sm:text-sm">{totalStudentsCount}</span>
                </div>

                <div className="h-3 w-px bg-slate-800"></div>

                {/* Inactive Students */}
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Inactive:</span>
                  <span className="text-amber-400 font-extrabold font-mono text-xs sm:text-sm">{totalInactiveCount}</span>
                </div>

                <div className="h-3 w-px bg-slate-800"></div>

                {/* Monthly Fee Collection */}
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wider">Monthly Fee:</span>
                  <span className="text-emerald-400 font-extrabold font-mono text-xs sm:text-sm">
                    ₹{monthlyFeeCurrentBatches.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* SEARCH INPUT, FILTERS & BULK ACTIONS MENU */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search & Filters */}
              <div className="flex flex-1 flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, phone, email, or roll no..."
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-2 pl-10 pr-4 text-slate-200 text-xs font-bold placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-955 border border-slate-800 rounded-2xl py-2 px-3 text-slate-300 text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="dropped">Dropped Only</option>
                </select>

                <select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  className="bg-slate-955 border border-slate-800 rounded-2xl py-2 px-3 text-slate-300 text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* BULK ACTION MENU BUTTON ("Students Menu") */}
              {selectedIds.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setStudentsMenuOpen(!studentsMenuOpen)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-2xl text-xs font-extrabold shadow-lg transition-all cursor-pointer"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Students Menu ({selectedIds.length} Selected)</span>
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {/* BULK DROPDOWN */}
                  {studentsMenuOpen && (
                    <div className="absolute right-0 top-11 z-40 w-64 bg-slate-955 border border-slate-800 rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={handleBulkGenerateIDCards}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <CreditCard className="h-4 w-4 text-indigo-400" /> Generate ID Cards in Bulk
                      </button>

                      <button
                        onClick={handleBulkExportCSV}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <Download className="h-4 w-4 text-emerald-400" /> Export Selected Data (CSV)
                      </button>

                      <button
                        onClick={handleOpenBulkMessageModal}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <MessageSquare className="h-4 w-4 text-blue-400" /> Message Selected Students
                      </button>

                      <button
                        onClick={handleOpenCredentialsModal}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4 text-amber-400" /> Share Login ID & Password
                      </button>

                      {/* Admin-Only Options: Application Form PDF & WhatsApp Share */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={handleDownloadApplicationForm}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <FileText className="h-4 w-4 text-purple-400" /> Download Application Form
                          </button>

                          <button
                            onClick={handleSendApplicationFormWhatsAppAPI}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-950/40 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Send className="h-4 w-4 text-emerald-400" /> Send Application Form via WhatsApp API
                          </button>

                          <button
                            onClick={handleShareApplicationFormWhatsApp}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-xl transition-colors text-left cursor-pointer"
                          >
                            <Share2 className="h-4 w-4 text-slate-400" /> Open WhatsApp Chat (Fallback)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* STUDENTS TABLE */}
      {filteredStudents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-md mx-auto my-8">
          <Users className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-white">No Students Found</h3>
          <p className="text-slate-400 text-xs mt-1 font-medium">Try adjusting your search query or status filter.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className="bg-slate-955 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="p-4 w-10 text-center">
                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-white cursor-pointer">
                      {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">Student</th>
                  <th className="p-4">Parent Details</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Batches</th>
                  <th className="p-4">Monthly Fee</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredStudents.map((s) => {
                  const selected = selectedIds.includes(s.id);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-850/50 transition-colors ${selected ? 'bg-indigo-950/20' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <button onClick={() => handleToggleSelect(s.id)} className="text-slate-400 hover:text-white cursor-pointer">
                          {selected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-indigo-400 overflow-hidden shrink-0">
                            {s.photoUrl ? (
                              <img src={s.photoUrl} alt={s.fullName} className="w-full h-full object-cover" />
                            ) : (
                              s.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <Link href={`/erp/students/${s.id}`} className="font-extrabold text-white hover:text-indigo-400 transition-colors text-sm block">
                              {s.fullName}
                            </Link>
                            <span className="text-[10px] text-slate-500 font-mono">Roll: {s.rollNumber || 'N/A'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div>
                          <span className="font-bold text-slate-300 block">{s.parentName || s.fatherName}</span>
                          <span className="text-[10px] text-slate-500 font-medium">Mother: {s.motherName || '-'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div>
                          <span className="text-slate-300 font-mono block">{s.phone}</span>
                          <span className="text-[10px] text-slate-500 font-medium block truncate max-w-[140px]">{s.email || '-'}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {s.batchIds && s.batchIds.length > 0 ? (
                            s.batchIds.map((bId) => {
                              const bObj = batches.find((b) => b.id === bId);
                              return (
                                <span key={bId} className="px-2 py-0.5 bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 rounded text-[9px] font-extrabold">
                                  {bObj ? bObj.name : bId}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-slate-500 text-[10px]">Unassigned</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-mono font-extrabold text-emerald-400">
                        ₹{(s.monthlyFee !== undefined ? s.monthlyFee : 2000).toLocaleString()}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 text-[9px] font-extrabold border rounded uppercase tracking-wider ${
                            s.status === 'active'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40'
                              : s.status === 'inactive'
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900/40'
                              : 'bg-red-950/40 text-red-400 border-red-900/40'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/erp/students/${s.id}`}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => openPromoteModal(s)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Promote Student to New Batch"
                          >
                            <TrendingUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Delete Student"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: BULK MESSAGE MODAL */}
      {messageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl space-y-5">
            <button
              onClick={() => setMessageModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Broadcast Message</h2>
                <p className="text-slate-400 text-xs font-semibold">Sending to {selectedIds.length} selected students.</p>
              </div>
            </div>

            <form onSubmit={handleExecuteBulkMessage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Message Title *
                </label>
                <input
                  type="text"
                  required
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Test Schedule Announcement"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Message Body *
                </label>
                <textarea
                  rows={4}
                  required
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl p-4 text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Write your announcement message here..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sendingMsg || !msgTitle || !msgBody}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer text-sm"
              >
                {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send Broadcast Message</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SHARE CREDENTIALS / PASSWORD RESET MODAL */}
      {credentialsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl space-y-5">
            <button
              onClick={() => setCredentialsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Share Portal Login ID & Password</h2>
                <p className="text-slate-400 text-xs font-semibold">Send credentials via cool formal HTML email.</p>
              </div>
            </div>

            {resetSuccessMsg && (
              <div className="bg-emerald-955/60 border border-emerald-900/60 text-emerald-400 text-xs p-3.5 rounded-2xl font-bold text-center">
                {resetSuccessMsg}
              </div>
            )}

            <div className="bg-slate-955 border border-slate-850 p-4 rounded-2xl space-y-2 text-xs font-bold text-slate-300">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Selected Recipients ({selectedIds.length})</span>
              <p className="text-slate-300 text-[11px] font-medium leading-relaxed mt-1">
                Click below to dispatch an official, cool & formal HTML email containing each student's <strong>Login ID & Password</strong> directly to their Registered Email Address.
              </p>
            </div>

            <button
              onClick={handleSendCredentialsEmail}
              disabled={sendingResets}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer text-sm"
            >
              {sendingResets ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Login ID & Password Email'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPORT STUDENTS FROM COMPREHENSIVE CSV MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl space-y-5">
            <button
              onClick={() => setImportModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Import Students from CSV File</h2>
                  <p className="text-slate-400 text-xs font-semibold">Bulk import student records with pre-commit validation.</p>
                </div>
              </div>

              {/* SAMPLE TEMPLATE BUTTON */}
              <button
                onClick={downloadSampleStudentCSV}
                className="flex items-center gap-1.5 bg-slate-955 hover:bg-slate-850 text-indigo-400 border border-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <Download className="h-4 w-4" /> Download Sample CSV Template
              </button>
            </div>

            {importSuccessMsg && (
              <div className="bg-emerald-955/60 border border-emerald-900/60 text-emerald-400 text-xs p-4 rounded-2xl font-bold text-center">
                {importSuccessMsg}
              </div>
            )}

            {/* Dropzone */}
            <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-750 hover:border-indigo-500/50 bg-slate-955 p-6 rounded-2xl cursor-pointer transition-colors text-center group">
              <FileSpreadsheet className="h-8 w-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
              <span className="text-xs font-bold text-slate-300">Choose CSV File to Upload</span>
              <span className="text-[10px] text-slate-500 font-semibold mt-1">.csv format only</span>
              <input type="file" accept=".csv" onChange={handleFileChangeCSV} className="hidden" />
            </label>

            {/* Validation Summary & Row-by-Row Table */}
            {importPreview && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold bg-slate-955 p-4 rounded-2xl border border-slate-850">
                  <span className="text-slate-300">Total Rows Detected: {importPreview.rows.length}</span>
                  <span className="text-emerald-400 font-black">✓ Valid: {importPreview.totalValid}</span>
                  <span className="text-red-400 font-black">❌ Invalid: {importPreview.totalInvalid}</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-850 max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-slate-955 border-b border-slate-850 text-[10px] text-slate-400 uppercase tracking-widest sticky top-0">
                      <tr>
                        <th className="p-3">Row</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-200">
                      {importPreview.rows.map((row) => (
                        <tr key={row.rowIndex} className={row.isValid ? 'bg-slate-900' : 'bg-red-955/20'}>
                          <td className="p-3 font-mono text-slate-500">#{row.rowIndex}</td>
                          <td className="p-3 font-extrabold text-white">{row.fullName || '-'}</td>
                          <td className="p-3 text-slate-300">{row.email || '-'}</td>
                          <td className="p-3 text-slate-300">{row.phone || '-'}</td>
                          <td className="p-3">
                            {row.isValid ? (
                              <span className="text-emerald-400 font-black text-[10px]">✓ VALID</span>
                            ) : (
                              <span className="text-red-400 text-[10px] font-bold">{row.errors.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={importing || importPreview.totalValid === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer text-sm"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Execute Import (${importPreview.totalValid} Valid Records)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: PROMOTE STUDENT TO NEW BATCH MODAL */}
      {promoteModalOpen && promotingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl space-y-5">
            <button
              onClick={() => setPromoteModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Promote Student to New Batch</h2>
                <p className="text-slate-400 text-xs font-semibold">
                  Promoting <span className="text-white font-bold">{promotingStudent.fullName}</span>
                </p>
              </div>
            </div>

            {promoteError && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3 rounded-xl font-bold">
                {promoteError}
              </div>
            )}

            <form onSubmit={handleExecutePromote} className="space-y-4">
              {/* Select Target Batch */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Target New Batch *
                </label>
                <select
                  required
                  value={promoteNewBatchId}
                  onChange={(e) => setPromoteNewBatchId(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid: New Monthly Fee & Start Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    New Monthly Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={promoteNewMonthlyFee}
                    onChange={(e) => setPromoteNewMonthlyFee(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Fee amount"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    New Fee Cycle Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={promoteNewStartDate}
                    onChange={(e) => setPromoteNewStartDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Previous Batch Closing Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Previous Batch Exit / Closing Date
                </label>
                <input
                  type="date"
                  value={promotePrevClosingDate}
                  onChange={(e) => setPromotePrevClosingDate(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-indigo-955/60 border border-indigo-900/40 p-3 rounded-2xl text-[11px] font-bold text-indigo-300">
                Promoting will automatically update student portal batch access and reset monthly fee cycle starting from {promoteNewStartDate}.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPromoteModalOpen(false)}
                  className="flex-1 bg-slate-955 text-slate-300 border border-slate-800 font-bold py-3 rounded-2xl transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPromote}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                >
                  {submittingPromote ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Promote Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT STUDENT MODAL (FULL ORIGINAL FIELDS RESTORED) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-black text-white tracking-tight mb-6">
              {editingStudent ? 'Edit Student Record' : 'Add New Student Profile'}
            </h2>

            {error && (
              <div className="mb-5 bg-red-950/30 border border-red-900/50 text-red-400 text-xs sm:text-sm p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload Section */}
              <div className="flex items-center gap-4 bg-slate-955 p-4 rounded-2xl border border-slate-850">
                <div className="w-16 h-16 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-center font-black text-indigo-400 text-xl overflow-hidden shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="h-7 w-7 text-slate-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-white block">Student Photo</label>
                  <label className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer">
                    <Upload className="h-3.5 w-3.5" /> Upload Photo
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Full Name & Father Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Aarav Sharma"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Father Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Rajesh Sharma"
                  />
                </div>
              </div>

              {/* Mother Name & Aadhar Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Mother Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Sunita Sharma"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Aadhar Number (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={aadharNumber}
                    onChange={(e) => setAadharNumber(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="12-digit Aadhar No."
                  />
                </div>
              </div>

              {/* DOB & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Gender *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3.5 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Student Mobile & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Student Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="9876543210"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {/* Email & Initial Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="student@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Portal Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Set Initial Password"
                  />
                </div>
              </div>

              {/* Roll Number & Monthly Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="UP-101"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Monthly Fee (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value))}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="2000"
                  />
                </div>
              </div>

              {/* Enrollment & Closing Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Enrollment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={enrollmentDate}
                    onChange={(e) => setEnrollmentDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                    <span>Closing Date (End of Study)</span>
                    <span className="text-[9px] text-slate-400 font-semibold lowercase">Optional</span>
                  </label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => {
                      setClosingDate(e.target.value);
                      if (e.target.value) setStatus('inactive');
                    }}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] font-bold text-amber-400/90 pl-1 leading-tight mt-1">
                    📌 Note: Entering a Closing Date marks the student as Inactive and stops their monthly fee cycle from the closing date onwards.
                  </p>
                </div>
              </div>

              {/* Fee Collection Timing Toggle */}
              <div className="bg-slate-955 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-white">
                      Collect Fees on Month Start
                    </label>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider ${
                      collectFeeOnMonthStart ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60' : 'bg-amber-950/60 text-amber-400 border border-amber-900/60'
                    }`}>
                      {collectFeeOnMonthStart ? 'Month Start (Advance)' : 'After Month Completion'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    {collectFeeOnMonthStart
                      ? 'Fees charged at the beginning of each billing month (starting on enrollment date)'
                      : 'Fees charged after completion of each billing month (1 month after enrollment date)'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCollectFeeOnMonthStart(!collectFeeOnMonthStart)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    collectFeeOnMonthStart
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30'
                      : 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30'
                  }`}
                >
                  {collectFeeOnMonthStart ? 'TOGGLE OFF (After Completion)' : 'TOGGLE ON (Month Start)'}
                </button>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Permanent Address *
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-2xl p-3 text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Full residence address..."
                ></textarea>
              </div>

              {/* Status & Batches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3.5 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                    Batch Assignments
                  </label>
                  <div className="bg-slate-955 border border-slate-800 p-3 rounded-2xl max-h-32 overflow-y-auto space-y-1.5">
                    {batches.map((b) => {
                      const isAssigned = studentBatchIds.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleToggleBatchSelect(b.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                            isAssigned ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>{b.name}</span>
                          {isAssigned && <Check className="h-4 w-4 text-indigo-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800/80 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-955 hover:bg-slate-850 text-slate-300 border border-slate-800 font-bold py-3.5 rounded-2xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Student Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
