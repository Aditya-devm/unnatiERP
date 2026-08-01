export interface TeacherPermissions {
  canMarkAttendance: boolean;
  canViewFees: boolean;
  canManageExams: boolean;
  canViewStudentContacts: boolean;
  canSendCommunications: boolean;
  canAccessPowerprep: boolean;
  canAccessWorksheets: boolean;
}

export interface StaffPermissions {
  canMarkAttendance: boolean;
  canViewFees: boolean;
  canManageExams: boolean;
  canViewStudentContacts: boolean;
  canSendCommunications: boolean;
  canAccessPowerprep: boolean;
  canAccessWorksheets: boolean;
}

export interface StudentPermissions {
  canViewFees: boolean;
  canViewAttendance: boolean;
  canViewExamResults: boolean;
  canViewClasswork: boolean;
  canMessageStaff: boolean;
  canAccessPowerprep: boolean;
  canAccessWorksheets: boolean;
}

export interface RolePermissions {
  teacher: TeacherPermissions;
  staff: StaffPermissions;
  student: StudentPermissions;
}

export const DEFAULT_PERMISSIONS: RolePermissions = {
  teacher: {
    canMarkAttendance: true,
    canViewFees: true,
    canManageExams: true,
    canViewStudentContacts: true,
    canSendCommunications: true,
    canAccessPowerprep: true,
    canAccessWorksheets: true,
  },
  staff: {
    canMarkAttendance: true,
    canViewFees: true,
    canManageExams: true,
    canViewStudentContacts: true,
    canSendCommunications: true,
    canAccessPowerprep: true,
    canAccessWorksheets: true,
  },
  student: {
    canViewFees: true,
    canViewAttendance: true,
    canViewExamResults: true,
    canViewClasswork: true,
    canMessageStaff: true,
    canAccessPowerprep: true,
    canAccessWorksheets: true,
  },
};

export const PERMISSION_LABELS: Record<string, string> = {
  canMarkAttendance: 'Mark & Track Batch Attendance',
  canViewFees: 'View Student Fee Status (Read-Only)',
  canManageExams: 'View & Enter Exam Marks',
  canViewStudentContacts: 'View Student & Parent Contact Info',
  canSendCommunications: 'Send Announcements & Notifications',
  canViewAttendance: 'View Personal Attendance Log',
  canViewExamResults: 'View Personal Exam Results & Report Cards',
  canViewClasswork: 'View Classwork & Study Materials',
  canMessageStaff: 'Send Direct Messages to Teachers & Staff',
  canAccessPowerprep: 'Access Unnati Powerprep AI Assistant',
  canAccessWorksheets: 'Worksheets & Practice Papers Feature Option',
};
