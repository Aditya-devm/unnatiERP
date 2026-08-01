'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { db, auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import BellNotificationIcon from '@/components/BellNotificationIcon';

interface Student {
  id: string;
  fullName: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  enrollmentDate?: string;
  rollNumber?: string;
  rollNo?: string;
  email?: string;
  status?: 'active' | 'inactive' | 'dropped';
  photoUrl?: string | null;
  pendingPhotoUrl?: string | null;
  photoStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'try_again';
  batchIds?: string[];
}

interface Batch {
  id: string;
  name: string;
  subject?: string;
}

interface Exam {
  id: string;
  name: string;
  batchId?: string;
  examDate?: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
}

interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
}

interface AttendanceRecord {
  id: string;
  studentId?: string;
  batchId?: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'late';
}

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function isExamOngoingNow(examDate?: string, startTimeStr?: string, endTimeStr?: string, durationMins?: number): boolean {
  if (!examDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  if (examDate !== todayStr) return false;

  const now = new Date();
  const partsDate = examDate.split('-').map(Number);
  if (partsDate.length < 3 || partsDate.some(isNaN)) return false;
  const [year, month, day] = partsDate;

  let startHours = 10;
  let startMins = 0;

  if (startTimeStr) {
    const trimmed = startTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      startHours = parts[0];
      if (isPM && startHours < 12) startHours += 12;
      if (isAM && startHours === 12) startHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) startMins = parts[1];
    }
  }

  const startDate = new Date(year, month - 1, day, startHours, startMins, 0);

  let endDate: Date;
  if (endTimeStr) {
    let endHours = 11;
    let endMins = 30;
    const trimmed = endTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      endHours = parts[0];
      if (isPM && endHours < 12) endHours += 12;
      if (isAM && endHours === 12) endHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) endMins = parts[1];
    }
    endDate = new Date(year, month - 1, day, endHours, endMins, 0);
  } else {
    const duration = durationMins && durationMins > 0 ? durationMins : 90;
    endDate = new Date(startDate.getTime() + duration * 60000);
  }

  return now >= startDate && now <= endDate;
}

function hasExamEnded(examDate?: string, startTimeStr?: string, endTimeStr?: string, durationMins?: number): boolean {
  if (!examDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  if (examDate < todayStr) return true;
  if (examDate > todayStr) return false;

  const now = new Date();
  const partsDate = examDate.split('-').map(Number);
  if (partsDate.length < 3 || partsDate.some(isNaN)) return false;
  const [year, month, day] = partsDate;

  let startHours = 10;
  let startMins = 0;

  if (startTimeStr) {
    const trimmed = startTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      startHours = parts[0];
      if (isPM && startHours < 12) startHours += 12;
      if (isAM && startHours === 12) startHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) startMins = parts[1];
    }
  }

  const startDate = new Date(year, month - 1, day, startHours, startMins, 0);

  let endDate: Date;
  if (endTimeStr) {
    let endHours = 11;
    let endMins = 30;
    const trimmed = endTimeStr.trim().toLowerCase();
    const isPM = trimmed.includes('pm');
    const isAM = trimmed.includes('am');
    const timeClean = trimmed.replace(/(am|pm)/g, '').trim();
    const parts = timeClean.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) {
      endHours = parts[0];
      if (isPM && endHours < 12) endHours += 12;
      if (isAM && endHours === 12) endHours = 0;
      if (parts.length >= 2 && !isNaN(parts[1])) endMins = parts[1];
    }
    endDate = new Date(year, month - 1, day, endHours, endMins, 0);
  } else {
    const duration = durationMins && durationMins > 0 ? durationMins : 90;
    endDate = new Date(startDate.getTime() + duration * 60000);
  }

  return now > endDate;
}

export default function StudentPortalPage() {
  const { user, role, instituteId, loading: authLoading } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [seenResultIds, setSeenResultIds] = useState<string[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (student?.id) {
      try {
        const stored = localStorage.getItem(`seen_results_${student.id}`);
        if (stored) setSeenResultIds(JSON.parse(stored));
      } catch (e) {
        console.error('Error reading seen_results:', e);
      }
    }
  }, [student?.id]);

  const markResultSeen = (resultId: string) => {
    if (seenResultIds.includes(resultId)) return;
    const updated = [...seenResultIds, resultId];
    setSeenResultIds(updated);
    if (student?.id) {
      try {
        localStorage.setItem(`seen_results_${student.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error writing seen_results:', e);
      }
    }
  };

  // Calendar & 3D Flip Card State
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isFlipped, setIsFlipped] = useState(false);
  const flipTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleToggleFlip = () => {
    if (flipTimerRef.current) {
      clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }

    if (!isFlipped) {
      setIsFlipped(true);
      // Auto flip back after 10 seconds (10,000 ms)
      flipTimerRef.current = setTimeout(() => {
        setIsFlipped(false);
      }, 10000);
    } else {
      setIsFlipped(false);
    }
  };

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  // Profile Photo Upload State & Handlers
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');

  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleAvatarClick = () => {
    if (!student) return;

    if (student.photoStatus === 'approved') {
      alert('Your profile photo is verified & approved by Admin. Photo changes are now locked.');
      return;
    }

    if (student.photoStatus === 'pending') {
      alert('Your profile photo request has been submitted and is currently pending Admin approval.');
      return;
    }

    if (student.photoStatus === 'rejected') {
      alert('Your previous profile photo request was rejected by Admin. Please contact Admin if you need retry permission.');
      return;
    }

    // Allowed if photoStatus is 'none' or 'try_again'
    setSelectedPhotoBase64(null);
    setPhotoMessage('');
    setPhotoModalOpen(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('Please select an image file under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSelectedPhotoBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPhotoRequest = async () => {
    if (!instituteId || !student || !selectedPhotoBase64) return;
    setUploadingPhoto(true);
    setPhotoMessage('');

    try {
      await updateDoc(doc(db, 'institutes', instituteId, 'students', student.id), {
        pendingPhotoUrl: selectedPhotoBase64,
        photoStatus: 'pending',
        updatedAt: new Date().toISOString()
      });

      setPhotoMessage('Profile photo request submitted! Pending Admin approval.');
      setTimeout(() => {
        setPhotoModalOpen(false);
        setSelectedPhotoBase64(null);
        setPhotoMessage('');
      }, 1500);
    } catch (err: any) {
      console.error('Error submitting photo request:', err);
      setPhotoMessage('Failed to submit photo request. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const isStaffPortal = role === 'teacher' || role === 'staff';
  const [staffUserData, setStaffUserData] = useState<any>(null);
  const [staffAttendanceRecords, setStaffAttendanceRecords] = useState<any[]>([]);
  const [permissionsConfig, setPermissionsConfig] = useState<any>(null);

  // Subscribe to Institute Role Permissions Config in real-time
  useEffect(() => {
    if (!instituteId) return;
    const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
    const unsubPerms = onSnapshot(permDocRef, (snap) => {
      if (snap.exists()) setPermissionsConfig(snap.data());
      else setPermissionsConfig(null);
    });
    return () => unsubPerms();
  }, [instituteId]);

  // Guard unauthenticated & Admin redirect
  useEffect(() => {
    if (!authLoading) {
      if (role && ['owner', 'admin'].includes(role)) {
        router.replace('/erp');
        return;
      }
      if (!user) {
        router.replace('/login');
        return;
      }
    }
  }, [user, role, authLoading, router]);

  // Fetch Staff Profile
  useEffect(() => {
    if (!instituteId || !user || !isStaffPortal) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) setStaffUserData(snap.data());
    });
    return () => unsubUser();
  }, [instituteId, user, isStaffPortal]);

  // Staff Attendance Subscription (re-subscribes when staffUserData loads with staffOriginalDocId/staffId)
  useEffect(() => {
    if (!instituteId || !user || !isStaffPortal) return;
    const staffAttCol = collection(db, 'institutes', instituteId, 'staffAttendance');
    const unsubStaffAtt = onSnapshot(staffAttCol, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Match by Firebase UID, original staff doc ID, firebaseUid field, or staffId string
        const isMatch =
          data.userId === user.uid ||
          data.firebaseUid === user.uid ||
          data.staffId === user.uid ||
          (staffUserData?.staffOriginalDocId && data.userId === staffUserData.staffOriginalDocId) ||
          (staffUserData?.staffId && data.staffId === staffUserData.staffId);
        if (isMatch) {
          list.push({ id: d.id, ...data });
        }
      });
      setStaffAttendanceRecords(list);
    });
    return () => unsubStaffAtt();
  }, [instituteId, user, isStaffPortal, staffUserData?.staffOriginalDocId, staffUserData?.staffId]);

  // Firestore Subscriptions (students, batches, exams, results, attendance)
  useEffect(() => {
    if (!instituteId || !user) return;

    const studentsCol = collection(db, 'institutes', instituteId, 'students');
    const unsubStudents = onSnapshot(studentsCol, (snapshot) => {
      let matchedStudent: Student | null = null;
      snapshot.forEach((d) => {
        const data = d.data();
        if (
          d.id === user.uid ||
          (user.email && data.email?.toLowerCase() === user.email.toLowerCase()) ||
          (user.phoneNumber && data.phone && user.phoneNumber.includes(data.phone.replace(/\D/g, '')))
        ) {
          matchedStudent = { id: d.id, ...data } as Student;
        }
      });

      setStudent(matchedStudent);
    });

    // 2. Fetch Batches
    const batchesCol = collection(db, 'institutes', instituteId, 'batches');
    const unsubBatches = onSnapshot(batchesCol, (snapshot) => {
      const list: Batch[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Batch));
      setBatches(list);
    });

    // 3. Fetch Exams
    const examsCol = collection(db, 'institutes', instituteId, 'exams');
    const unsubExams = onSnapshot(examsCol, (snapshot) => {
      const list: Exam[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Exam));
      setExams(list);
    });

    // 4. Fetch Exam Results
    const resultsCol = collection(db, 'institutes', instituteId, 'examResults');
    const unsubResults = onSnapshot(resultsCol, (snapshot) => {
      const list: ExamResult[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as ExamResult));
      setExamResults(list);
    });

    // 5. Fetch Attendance
    const attendanceCol = collection(db, 'institutes', instituteId, 'attendanceRecords');
    const unsubAttendance = onSnapshot(attendanceCol, (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as AttendanceRecord));
      setAttendanceRecords(list);
      setLoadingData(false);
    });

    return () => {
      unsubStudents();
      unsubBatches();
      unsubExams();
      unsubResults();
      unsubAttendance();
    };
  }, [instituteId, user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Derive Enrolled Batches & Class Name
  const studentBatches = batches.filter(
    (b) => student?.batchIds && student.batchIds.includes(b.id)
  );
  const classNameDisplay = studentBatches.length > 0
    ? studentBatches.map((b) => b.name).join(', ')
    : 'Class 9 ICSE';

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Unseen Published Test Results for Student
  const studentResults = examResults.filter(
    (r) => student && (r.studentId === student.id || r.studentId === user?.uid)
  );

  const unseenResults = studentResults.filter(
    (r) => !seenResultIds.includes(r.id)
  );

  // 2. Strictly Upcoming/Ongoing Exams (Exams whose end time hasn't passed)
  const studentBatchIds = student?.batchIds || [];
  const strictlyUpcomingExams = exams.filter((e) => {
    const isStudentBatch = studentBatchIds.length === 0 || (e.batchId && studentBatchIds.includes(e.batchId));
    if (!isStudentBatch) return false;
    if (hasExamEnded(e.examDate, e.startTime, e.endTime, e.durationMinutes)) return false;
    return true;
  });

  // Calendar Calculation
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Adjust so Mon=0, Tue=1, ..., Sun=6
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  // Attendance map & counts for displayed month (Filtered strictly for logged-in student)
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const studentAttendanceMap: { [dayNum: number]: 'present' | 'absent' | 'holiday' | 'leave' } = {};

  let presentCount = 0;
  let absentCount = 0;
  let holidayCount = 0;
  let leaveCount = 0;

  if (isStaffPortal) {
    staffAttendanceRecords.forEach((rec) => {
      if (rec.date && rec.date.startsWith(currentMonthPrefix)) {
        const day = parseInt(rec.date.split('-')[2], 10);
        const st = rec.status;
        if (st === 'checked_in' || st === 'checked_out' || st === 'present') {
          studentAttendanceMap[day] = 'present';
          presentCount++;
        } else if (st === 'absent') {
          studentAttendanceMap[day] = 'absent';
          absentCount++;
        } else if (st === 'leave') {
          studentAttendanceMap[day] = 'leave';
          leaveCount++;
        } else if (st === 'holiday') {
          studentAttendanceMap[day] = 'holiday';
          holidayCount++;
        }
      }
    });
  } else {
    attendanceRecords.forEach((rec) => {
      // Strictly verify attendance record belongs to the logged-in student
      const isStudentMatch = Boolean(
        (student && rec.studentId === student.id) ||
        (user && rec.studentId === user.uid) ||
        ((student as any)?.userId && rec.studentId === (student as any).userId) ||
        (student?.email && rec.studentId?.toLowerCase() === student.email.toLowerCase()) ||
        (user?.email && rec.studentId?.toLowerCase() === user.email.toLowerCase()) ||
        (student?.phone && rec.studentId === student.phone)
      );

      if (isStudentMatch && rec.date && rec.date.startsWith(currentMonthPrefix)) {
        const day = parseInt(rec.date.split('-')[2], 10);
        const st = rec.status;
        if (st === 'present') {
          studentAttendanceMap[day] = 'present';
          presentCount++;
        } else if (st === 'absent') {
          studentAttendanceMap[day] = 'absent';
          absentCount++;
        } else if (st === 'holiday') {
          studentAttendanceMap[day] = 'holiday';
          holidayCount++;
        } else if (st === 'leave') {
          studentAttendanceMap[day] = 'leave';
          leaveCount++;
        }
      }
    });
  }

  // Attendance Percentage Calculation for 3D Flip Analytics
  const totalMarkedDays = presentCount + absentCount + holidayCount + leaveCount;
  const attendancePercentage = totalMarkedDays > 0
    ? Math.min(100, Math.round(((presentCount + holidayCount + leaveCount) / totalMarkedDays) * 100))
    : 0;

  // Feature Flag & Student Active Status check for Unnati Powerprep & Worksheets
  const isStudentActive = !student?.status || student.status === 'active';
  let isPowerprepPermitted = true;
  let isWorksheetsPermitted = true;
  if (permissionsConfig) {
    if (isStaffPortal) {
      const roleKey = role === 'teacher' ? 'teacher' : 'staff';
      if (permissionsConfig[roleKey]) {
        if (permissionsConfig[roleKey].canAccessPowerprep === false) isPowerprepPermitted = false;
        if (permissionsConfig[roleKey].canAccessWorksheets === false) isWorksheetsPermitted = false;
      }
    } else {
      if (permissionsConfig.student) {
        if (permissionsConfig.student.canAccessPowerprep === false) isPowerprepPermitted = false;
        if (permissionsConfig.student.canAccessWorksheets === false) isWorksheetsPermitted = false;
      }
    }
  }

  const showPowerprepTile = isStaffPortal ? isPowerprepPermitted : (isStudentActive && isPowerprepPermitted);
  const showWorksheetsTile = isStaffPortal ? isWorksheetsPermitted : (isStudentActive && isWorksheetsPermitted);
  const showPowerprepAndWorksheets = showPowerprepTile || showWorksheetsTile;

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex flex-col items-center justify-center text-[#dae2fd]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-label-md text-on-surface-variant">Loading Student Portal...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0b1326] text-[#dae2fd] min-h-screen font-body-md text-body-md">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0b1326]/80 backdrop-blur-md flex justify-between items-center w-full px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div
            onClick={isStaffPortal ? undefined : handleAvatarClick}
            className={`w-10 h-10 rounded-full border-2 border-primary bg-surface-container-high flex items-center justify-center shrink-0 relative transition-all ${
              isStaffPortal
                ? 'cursor-default ring-2 ring-indigo-500/50'
                : student?.photoStatus === 'approved'
                ? 'cursor-default ring-2 ring-emerald-500/50'
                : 'cursor-pointer hover:scale-105 active:scale-95'
            }`}
            title={
              isStaffPortal
                ? 'Staff Profile'
                : student?.photoStatus === 'approved'
                ? 'Profile photo verified & approved by Admin (Locked)'
                : 'Tap to update profile photo'
            }
          >
            {isStaffPortal ? (
              staffUserData?.photoUrl ? (
                <img
                  className="w-full h-full object-cover rounded-full"
                  src={staffUserData.photoUrl}
                  alt={staffUserData?.name || 'Staff'}
                />
              ) : (
                <span className="font-title-md text-primary text-sm font-bold">
                  {(staffUserData?.name || staffUserData?.fullName || user?.displayName || 'S').charAt(0).toUpperCase()}
                </span>
              )
            ) : student?.photoUrl ? (
              <img
                className="w-full h-full object-cover rounded-full"
                src={student.photoUrl}
                alt={student.fullName || 'Student'}
              />
            ) : student?.pendingPhotoUrl ? (
              <img
                className="w-full h-full object-cover rounded-full opacity-70"
                src={student.pendingPhotoUrl}
                alt="Pending approval"
              />
            ) : (
              <span className="font-title-md text-primary text-sm font-bold">
                {student?.fullName ? student.fullName.charAt(0) : 'P'}
              </span>
            )}

            {!isStaffPortal && student?.photoStatus === 'approved' && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border border-[#0b1326] rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                ✓
              </span>
            )}
            {!isStaffPortal && student?.photoStatus === 'pending' && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-500 border border-[#0b1326] rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse">
                •
              </span>
            )}
          </div>
          <div className="pt-2">
            <h1 className="font-title-md font-extrabold text-on-surface text-base sm:text-lg">
              {isStaffPortal
                ? (staffUserData?.name || staffUserData?.fullName || user?.displayName || 'Faculty Member')
                : (student ? student.fullName : 'Student')}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-on-surface-variant font-semibold">
                {isStaffPortal ? (staffUserData?.position || 'Faculty Teacher') : classNameDisplay}
              </span>
              <span className="inline-flex items-center px-1.5 py-[1px] rounded-md bg-primary/10 border border-primary/30 text-primary text-[9px] font-bold font-mono -translate-y-0.5">
                {isStaffPortal
                  ? `Staff ID: ${staffUserData?.staffId || 'STF'}`
                  : `Roll No: ${student?.rollNumber || student?.rollNo || '101'}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BellNotificationIcon />
          <button
            onClick={() => setShowLogoutModal(true)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
            title="Log Out"
          >
            <span className="material-symbols-outlined text-error">logout</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="px-4 pt-8 space-y-8 pb-12">

        {/* 1. QUICK ACTION GRID (8 TILES WITH ICON COLOR GLOW & VIBRANT BACKGROUND FILLS) */}
        <section className="grid grid-cols-4 gap-3">
          {/* Tile 1: Fees (Only shown for Students, hidden for Staff) */}
          {!isStaffPortal && (
            <Link href="/portal/fees" className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40 shadow-[0_0_18px_rgba(52,211,153,0.3)] group-hover:shadow-[0_0_24px_rgba(52,211,153,0.5)] group-active:scale-95 transition-all">
                <span className="material-symbols-outlined text-emerald-400 text-2xl drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  payments
                </span>
              </div>
              <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Fees</span>
            </Link>
          )}

          {/* Tile 2: Exams */}
          <Link href="/portal/exams" className="flex flex-col items-center gap-1.5 group">
            <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/40 shadow-[0_0_18px_rgba(129,140,248,0.3)] group-hover:shadow-[0_0_24px_rgba(129,140,248,0.5)] group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-indigo-400 text-2xl drop-shadow-[0_0_8px_rgba(129,140,248,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                assignment
              </span>
            </div>
            <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Exams</span>
          </Link>

          {/* Tile 3: Classwork */}
          <Link href="/portal/classwork" className="flex flex-col items-center gap-1.5 group">
            <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40 shadow-[0_0_18px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.5)] group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-cyan-400 text-2xl drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                school
              </span>
            </div>
            <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Classwork</span>
          </Link>

          {/* Tile 4: Homework */}
          <Link href="/portal/homework" className="flex flex-col items-center gap-1.5 group">
            <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-amber-500/20 border border-amber-500/40 shadow-[0_0_18px_rgba(251,191,36,0.3)] group-hover:shadow-[0_0_24px_rgba(251,191,36,0.5)] group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-amber-400 text-2xl drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                edit_document
              </span>
            </div>
            <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Homework</span>
          </Link>

          {/* Tile 5: Live Class */}
          <Link href="/portal/live-class" className="flex flex-col items-center gap-1.5 group">
            <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-rose-500/20 border border-rose-500/40 shadow-[0_0_18px_rgba(251,113,133,0.3)] group-hover:shadow-[0_0_24px_rgba(251,113,133,0.5)] group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-rose-400 text-2xl drop-shadow-[0_0_8px_rgba(251,113,133,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                videocam
              </span>
            </div>
            <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Live Class</span>
          </Link>

          {/* Tile 6: Leave */}
          <Link href="/portal/leave" className="flex flex-col items-center gap-1.5 group">
            <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-purple-500/20 border border-purple-500/40 shadow-[0_0_18px_rgba(192,132,252,0.3)] group-hover:shadow-[0_0_24px_rgba(192,132,252,0.5)] group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-purple-400 text-2xl drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                logout
              </span>
            </div>
            <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Leave</span>
          </Link>

          {/* Tile 7 & 8: Unnati Powerprep & Worksheets (Appears ONLY when Admin Settings allow, and for ACTIVE students) */}
          {showPowerprepTile && (
            <Link href="/dashboard/chat" className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-sky-500/20 border border-sky-500/40 shadow-[0_0_18px_rgba(56,189,248,0.35)] group-hover:shadow-[0_0_24px_rgba(56,189,248,0.6)] group-active:scale-95 transition-all animate-shine-wave p-1">
                <img
                  src="/logo.png"
                  alt="Unnati Classes Logo"
                  className="w-11 h-11 object-contain drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]"
                />
              </div>
              <span className="font-label-md text-[12px] text-on-surface-variant font-bold text-center">Unnati Powerprep</span>
            </Link>
          )}

          {showWorksheetsTile && (
            <Link href="/portal/worksheets" className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center bg-teal-500/20 border border-teal-500/40 shadow-[0_0_18px_rgba(45,212,191,0.35)] group-hover:shadow-[0_0_24px_rgba(45,212,191,0.6)] group-active:scale-95 transition-all animate-shine-wave">
                <span className="material-symbols-outlined text-teal-400 text-2xl drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  layers
                </span>
              </div>
              <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Worksheets</span>
            </Link>
          )}
        </section>

        {/* 2. UPCOMING & RECENT RESULTS SECTION */}
        {(unseenResults.length > 0 || strictlyUpcomingExams.length > 0) && (
          <section className="space-y-3">
            <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest px-1">
              Upcoming & Recent Results
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {/* Completed Exam Results (Removed when clicked) */}
              {unseenResults.map((res) => {
                const examObj = exams.find((e) => e.id === res.examId);
                const gradeLabel = res.percentage >= 90 ? 'Grade A' : res.percentage >= 80 ? 'Grade B' : res.percentage >= 70 ? 'Grade C' : 'Grade D';

                return (
                  <div
                    key={`res-${res.id}`}
                    onClick={() => {
                      markResultSeen(res.id);
                      router.push(`/portal/exams?highlightExamId=${res.examId}`);
                    }}
                    className="min-w-[260px] glass-panel rounded-xl p-5 border-l-4 border-emerald-400 relative overflow-hidden group active:scale-95 transition-transform cursor-pointer shadow-lg hover:border-emerald-300"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider block">
                          Test Result Published
                        </span>
                        <h4 className="font-title-md font-bold text-on-surface text-base mt-1">
                          {examObj?.name || 'Assessment Result'}
                        </h4>
                      </div>
                      <span className="material-symbols-outlined text-emerald-400 text-2xl">emoji_events</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">{res.marksObtained} / {res.maxMarks} Marks ({res.percentage}%)</p>
                        <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mt-0.5">{gradeLabel}</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">arrow_forward_ios</span>
                    </div>
                  </div>
                );
              })}

              {/* Upcoming / Ongoing Exams Cards (Ongoing tests sorted first & made non-clickable) */}
              {[...strictlyUpcomingExams]
                .sort((a, b) => {
                  const aOngoing = isExamOngoingNow(a.examDate, a.startTime, a.endTime, a.durationMinutes);
                  const bOngoing = isExamOngoingNow(b.examDate, b.startTime, b.endTime, b.durationMinutes);
                  if (aOngoing && !bOngoing) return -1;
                  if (!aOngoing && bOngoing) return 1;
                  return 0;
                })
                .map((e) => {
                  const isOngoing = isExamOngoingNow(e.examDate, e.startTime, e.endTime, e.durationMinutes);

                  if (isOngoing) {
                    return (
                      <div
                        key={`ongoing-${e.id}`}
                        className="min-w-[260px] glass-panel rounded-xl p-5 border-l-4 border-emerald-400 bg-emerald-950/20 relative overflow-hidden cursor-default shadow-lg select-none"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                              Ongoing Test
                            </span>
                            <h4 className="font-title-md font-bold text-on-surface text-base mt-1">{e.name}</h4>
                          </div>
                          <span className="material-symbols-outlined text-emerald-400 text-2xl">sensors</span>
                        </div>
                        <div className="mt-5 flex items-center justify-between">
                          <p className="text-[12px] text-slate-300 font-medium">
                            {e.examDate || 'Scheduled'} {e.time ? `• ${e.time}` : ''}
                          </p>
                          <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-wider bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            In Progress
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={`upcoming-${e.id}`}
                      href={`/portal/exams/${e.id}`}
                      className="min-w-[260px] glass-panel rounded-xl p-5 border-l-4 border-secondary relative overflow-hidden group active:scale-95 transition-transform cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs sm:text-sm font-black text-secondary uppercase tracking-wider block">
                            Upcoming Test
                          </span>
                          <h4 className="font-title-md font-bold text-on-surface text-base mt-1">{e.name}</h4>
                        </div>
                        <span className="material-symbols-outlined text-secondary">event_note</span>
                      </div>
                      <div className="mt-5 flex items-center justify-between">
                        <p className="text-[12px] text-on-surface-variant">
                          {e.examDate || 'Scheduled'} {e.time ? `• ${e.time}` : ''}
                        </p>
                        <span className="material-symbols-outlined text-secondary text-[18px]">
                          arrow_forward_ios
                        </span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </section>
        )}

        {/* 3. ATTENDANCE SUMMARY SECTION (WITH 3D FLIP ANIMATION & ATTENDANCE PERCENTAGE GAUGE) */}
        <div className="perspective-1000">
          <div
            className={`relative transform-style-3d transition-transform duration-700 ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
          >
            {/* FRONT SIDE: CALENDAR */}
            <section
              onClick={handleToggleFlip}
              className="glass-panel rounded-xl p-5 backface-hidden cursor-pointer hover:border-primary/40 transition-colors group relative"
            >
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="font-title-md text-title-md-mobile font-extrabold text-white">Attendance Summary</h3>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={handlePrevMonth}
                    className="hover:text-primary transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_left</span>
                  </button>
                  <span className="font-label-md text-label-md">
                    {MONTH_SHORT_NAMES[month]}-{year}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="hover:text-primary transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>

              {/* Calendar Day Labels */}
              <div className="grid grid-cols-7 gap-y-3 text-center mb-2">
                <span className="text-[10px] text-on-surface-variant font-bold">M</span>
                <span className="text-[10px] text-on-surface-variant font-bold">T</span>
                <span className="text-[10px] text-on-surface-variant font-bold">W</span>
                <span className="text-[10px] text-on-surface-variant font-bold">T</span>
                <span className="text-[10px] text-on-surface-variant font-bold">F</span>
                <span className="text-[10px] text-on-surface-variant font-bold">S</span>
                <span className="text-[10px] text-on-surface-variant font-bold">S</span>
              </div>

              {/* Calendar Grid Days */}
              <div className="grid grid-cols-7 gap-y-5 gap-x-2 text-center">
                {/* Prev month padded days */}
                {Array.from({ length: startingDayOfWeek }).map((_, idx) => {
                  const prevDayNum = daysInPrevMonth - startingDayOfWeek + idx + 1;
                  return (
                    <div key={`prev-${idx}`} className="text-[12px] text-on-surface-variant/30 py-2">
                      {prevDayNum}
                    </div>
                  );
                })}

                {/* Current month days */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const formattedDayStr = String(dayNum).padStart(2, '0');
                  const status = studentAttendanceMap[dayNum];

                  if (status === 'present') {
                    return (
                      <div
                        key={`curr-${dayNum}`}
                        className={`w-8 h-8 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-bold text-[12px] mx-auto ${
                          dayNum <= 5 ? 'shadow-lg shadow-tertiary/20' : ''
                        }`}
                      >
                        {formattedDayStr}
                      </div>
                    );
                  }

                  if (status === 'leave') {
                    return (
                      <div
                        key={`curr-${dayNum}`}
                        className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[12px] mx-auto"
                      >
                        {formattedDayStr}
                      </div>
                    );
                  }

                  if (status === 'absent') {
                    return (
                      <div
                        key={`curr-${dayNum}`}
                        className="w-8 h-8 rounded-full bg-error-container text-on-error-container flex items-center justify-center font-bold text-[12px] mx-auto neo-glow-primary"
                      >
                        {formattedDayStr}
                      </div>
                    );
                  }

                  if (status === 'holiday') {
                    return (
                      <div
                        key={`curr-${dayNum}`}
                        className="w-8 h-8 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/50 flex items-center justify-center font-bold text-[12px] mx-auto"
                      >
                        {formattedDayStr}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`curr-${dayNum}`}
                      className="text-[12px] text-on-surface-variant py-2 flex items-center justify-center"
                    >
                      {formattedDayStr}
                    </div>
                  );
                })}
              </div>

              {/* Stats Bar */}
              <div className="mt-8 grid grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-tertiary/10 rounded-xl p-2.5 sm:p-3 text-center border border-tertiary/20 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] text-tertiary font-bold">Present</p>
                  <span className="font-stats-number text-[16px] sm:text-[18px]">{String(presentCount).padStart(2, '0')}</span>
                </div>
                <div className="bg-error/10 rounded-xl p-2.5 sm:p-3 text-center border border-error/20 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] text-error font-bold">Absent</p>
                  <span className="font-stats-number text-[16px] sm:text-[18px]">{String(absentCount).padStart(2, '0')}</span>
                </div>
                <div className="bg-purple-500/10 rounded-xl p-2.5 sm:p-3 text-center border border-purple-500/20 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] text-purple-400 font-bold">Holiday</p>
                  <span className="font-stats-number text-[16px] sm:text-[18px]">{String(holidayCount).padStart(2, '0')}</span>
                </div>
                <div className="bg-secondary/10 rounded-xl p-2.5 sm:p-3 text-center border border-secondary/20 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] text-secondary font-bold">Leave</p>
                  <span className="font-stats-number text-[16px] sm:text-[18px]">{String(leaveCount).padStart(2, '0')}</span>
                </div>
              </div>
            </section>

            {/* BACK SIDE: ATTENDANCE PERCENTAGE GAUGE */}
            <section
              onClick={handleToggleFlip}
              className="glass-panel rounded-xl p-6 backface-hidden rotate-y-180 absolute inset-0 w-full h-full flex flex-col justify-between cursor-pointer border-2 border-primary/50 shadow-[0_0_25px_rgba(76,215,246,0.25)]"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                  <h3 className="font-title-md text-base font-extrabold text-white">Attendance Analytics</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">schedule</span> Auto-closing in 10s
                </span>
              </div>

              {/* Circular Gauge & Percentage Display */}
              <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
                {/* Circular Progress Gauge */}
                <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-slate-800"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="text-emerald-400 transition-all duration-1000 ease-out"
                      strokeWidth="10"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * attendancePercentage) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-white tracking-tight">{attendancePercentage}%</span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Rate</span>
                  </div>
                </div>

                {/* Stat Breakdown Grid */}
                <div className="grid grid-cols-2 gap-3 w-full sm:w-auto flex-1">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Present Days</span>
                    <span className="text-lg font-black text-emerald-400">{presentCount} Days</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Absent Days</span>
                    <span className="text-lg font-black text-rose-400">{absentCount} Days</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Leave / Exempt</span>
                    <span className="text-lg font-black text-cyan-400">{leaveCount} Days</span>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Holidays</span>
                    <span className="text-lg font-black text-purple-400">{holidayCount} Days</span>
                  </div>
                </div>
              </div>

              {/* Bottom Flip Note */}
              <div className="flex justify-between items-center border-t border-white/10 pt-3">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {attendancePercentage >= 85 ? 'Excellent Standing!' : attendancePercentage >= 75 ? 'Good Standing' : 'Needs Attention'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Tap card to return to Calendar</span>
              </div>
            </section>
          </div>
        </div>

      </main>

      {/* UPLOAD PROFILE PHOTO MODAL */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1326] border border-white/20 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Update Profile Picture</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Submit a photo for Admin review (Max 2MB). Once approved, it will be locked.
                </p>
              </div>
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Hidden Input Elements for Camera & Gallery */}
            <input
              type="file"
              accept="image/*"
              capture="user"
              ref={cameraInputRef}
              onChange={handlePhotoFileChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              ref={galleryInputRef}
              onChange={handlePhotoFileChange}
              className="hidden"
            />

            {/* 2 Big Option Buttons: Camera & Gallery */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 flex flex-col items-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-3xl">photo_camera</span>
                <span className="text-xs font-bold">Take Photo (Camera)</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 flex flex-col items-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-3xl">photo_library</span>
                <span className="text-xs font-bold">Choose Gallery</span>
              </button>
            </div>

            {/* Selected Photo Preview */}
            {selectedPhotoBase64 && (
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-400 shadow-lg">
                  <img src={selectedPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <span className="text-[11px] text-emerald-400 font-bold">Photo Selected & Ready!</span>
              </div>
            )}

            {photoMessage && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center text-xs font-bold text-emerald-300">
                {photoMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setPhotoModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitPhotoRequest}
                disabled={!selectedPhotoBase64 || uploadingPhoto}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                {uploadingPhoto ? 'Submitting...' : 'Send Request to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT WARNING DIALOG MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#121929] border border-red-500/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Confirm Logout</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Are you sure you want to log out from <span className="text-white font-bold">{isStaffPortal ? 'Staff' : 'Student'} Portal</span>? You will need your credentials to log back in.
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
                onClick={() => {
                  setShowLogoutModal(false);
                  handleSignOut();
                }}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
