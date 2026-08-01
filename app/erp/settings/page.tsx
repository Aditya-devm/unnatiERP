'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  Settings,
  Download,
  Upload,
  Database,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Loader2,
  X,
  Lock,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  Users,
  GraduationCap,
  Sparkles,
  Bot
} from 'lucide-react';
import {
  exportInstituteBackupJSON,
  validateAndPreviewBackupJSON,
  restoreInstituteBackupJSON,
  BackupPayload
} from '@/lib/backup-restore';
import {
  RolePermissions,
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS
} from '@/lib/permissions';

export default function ErpSettings() {
  const { instituteId, role } = useAuth();
  const isAdmin = role === 'owner' || role === 'admin';

  // Active Settings Tab
  const [activeTab, setActiveTab] = useState<'access_control' | 'backup_restore'>('access_control');

  // Permissions Config State
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permSuccess, setPermSuccess] = useState(false);

  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Restore State & Modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{
    valid: boolean;
    summary: Record<string, number>;
    totalRecords: number;
    error?: string;
    parsedData?: BackupPayload;
  } | null>(null);

  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [confirmTextInput, setConfirmTextInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  // 1. Subscribe to Real-Time Permissions Config
  useEffect(() => {
    if (!instituteId) return;

    const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
    const unsub = onSnapshot(permDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<RolePermissions>;
        setPermissions({
          teacher: { ...DEFAULT_PERMISSIONS.teacher, ...(data.teacher || {}) },
          staff: { ...DEFAULT_PERMISSIONS.staff, ...(data.staff || {}) },
          student: { ...DEFAULT_PERMISSIONS.student, ...(data.student || {}) },
        });
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
    });

    return () => unsub();
  }, [instituteId]);

  // Handle Toggle Permission
  const handleTogglePermission = async (
    roleKey: keyof RolePermissions,
    capabilityKey: string
  ) => {
    if (!instituteId || !isAdmin) return;

    const currentVal = (permissions[roleKey] as any)[capabilityKey];
    const updatedRolePerms = {
      ...permissions[roleKey],
      [capabilityKey]: !currentVal
    };

    const updatedPermissions: RolePermissions = {
      ...permissions,
      [roleKey]: updatedRolePerms
    };

    setPermissions(updatedPermissions);
    setSavingPerms(true);

    try {
      const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
      await setDoc(permDocRef, {
        ...updatedPermissions,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setPermSuccess(true);
      setTimeout(() => setPermSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      alert('Failed to update permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  // Reset to Sensible Defaults
  const handleResetDefaults = async () => {
    if (!instituteId || !isAdmin) return;
    if (!confirm('Are you sure you want to reset all role permissions to Sensible Defaults?')) return;

    setSavingPerms(true);
    try {
      const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
      await setDoc(permDocRef, {
        ...DEFAULT_PERMISSIONS,
        updatedAt: new Date().toISOString()
      });
      setPermissions(DEFAULT_PERMISSIONS);
      setPermSuccess(true);
      setTimeout(() => setPermSuccess(false), 3000);
    } catch (err) {
      console.error('Error resetting permissions:', err);
      alert('Failed to reset permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  // Handle Export Backup JSON
  const handleExportBackup = async () => {
    if (!instituteId) return;
    setExporting(true);
    setExportSuccess(false);

    try {
      await exportInstituteBackupJSON(instituteId);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error exporting backup:', err);
      alert(`Export Failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Handle File Drop / Select for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setRestoreError('');
      setConfirmCheckbox(false);
      setConfirmTextInput('');

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const result = validateAndPreviewBackupJSON(text);
        setPreviewData(result);
        setRestoreModalOpen(true);
      };
      reader.readAsText(file);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!instituteId || !previewData || !previewData.parsedData) return;

    if (!confirmCheckbox || confirmTextInput.trim() !== 'CONFIRM RESTORE') {
      setRestoreError('Please check the confirmation box and type "CONFIRM RESTORE" exactly to proceed.');
      return;
    }

    setRestoring(true);
    setRestoreError('');

    try {
      const result = await restoreInstituteBackupJSON(instituteId, previewData.parsedData);

      if (result.success) {
        setRestoreSuccess(true);
        setRestoreModalOpen(false);
        setSelectedFile(null);
        setPreviewData(null);
        setTimeout(() => setRestoreSuccess(false), 5000);
      }
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      setRestoreError(err.message || 'Failed to restore institute backup.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Institute Settings & Access Control</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Manage granular role capability permissions, Unnati Powerprep access, and full data backups.
          </p>
        </div>
        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
          <Settings className="h-5 w-5" />
        </div>
      </div>

      {!isAdmin ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 space-y-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mx-auto text-amber-400">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">Admin Privileges Required</h3>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-2">
              Granular role permissions and institute backup tools are restricted to **Owner** and **Admin** accounts.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <button
              onClick={() => setActiveTab('access_control')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'access_control'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ShieldCheck className="h-4 w-4" /> Access Control & Role Permissions
            </button>
            <button
              onClick={() => setActiveTab('backup_restore')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'backup_restore'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Database className="h-4 w-4" /> Institute Backup & Disaster Recovery
            </button>
          </div>

          {/* TAB 1: ACCESS CONTROL & ROLE PERMISSIONS */}
          {activeTab === 'access_control' && (
            <div className="space-y-6">
              {permSuccess && (
                <div className="bg-emerald-955/60 border border-emerald-900/60 text-emerald-400 text-xs p-4 rounded-2xl font-bold flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Role permissions updated in real-time across active user sessions!</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                <div>
                  <h2 className="text-lg font-black text-white">Granular Role Capabilities Grid</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Control exactly what Teachers, Staff, and Students can see and do across all ERP modules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  disabled={savingPerms}
                  className="flex items-center gap-1.5 bg-slate-955 hover:bg-slate-850 text-slate-300 border border-slate-800 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reset to Sensible Defaults
                </button>
              </div>

              {/* DEDICATED WORKSHEET OPTION TOGGLES */}
              <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-955/40 border border-teal-500/30 rounded-3xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-teal-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl border border-teal-500/20">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">📑 Worksheets & Materials Feature Option</h3>
                      <p className="text-xs text-slate-400 font-semibold">Enable or disable downloadable worksheets across Student and Staff portals.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Student Worksheets Toggle */}
                  <div
                    onClick={() => handleTogglePermission('student', 'canAccessWorksheets')}
                    className="flex items-center justify-between p-4 bg-slate-955 hover:bg-slate-850 border border-slate-800 rounded-2xl cursor-pointer transition-all"
                  >
                    <div>
                      <div className="text-xs font-black text-white">Student Portal Worksheets</div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5 font-medium">Allow active students to view & download worksheets</div>
                    </div>
                    {permissions.student.canAccessWorksheets ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                        <span>ENABLED</span>
                        <ToggleRight className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                        <span>DISABLED</span>
                        <ToggleLeft className="h-6 w-6 text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* Staff Worksheets Toggle */}
                  <div
                    onClick={() => {
                      handleTogglePermission('teacher', 'canAccessWorksheets');
                      handleTogglePermission('staff', 'canAccessWorksheets');
                    }}
                    className="flex items-center justify-between p-4 bg-slate-955 hover:bg-slate-850 border border-slate-800 rounded-2xl cursor-pointer transition-all"
                  >
                    <div>
                      <div className="text-xs font-black text-white">Staff Portal Worksheets</div>
                      <div className="text-[11px] text-slate-400 font-semibold mt-0.5 font-medium">Allow teachers & staff to manage & assign worksheets</div>
                    </div>
                    {permissions.teacher.canAccessWorksheets ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                        <span>ENABLED</span>
                        <ToggleRight className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                        <span>DISABLED</span>
                        <ToggleLeft className="h-6 w-6 text-slate-600" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* GRID 1: TEACHER ROLE PERMISSIONS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">👨‍🏫 Teacher Role Capabilities</h3>
                    <p className="text-xs text-slate-400 font-semibold">Toggles apply to all users assigned as Teachers.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(permissions.teacher).map(([capKey, val]) => (
                    <div
                      key={capKey}
                      onClick={() => handleTogglePermission('teacher', capKey)}
                      className="flex items-center justify-between p-4 bg-slate-955 hover:bg-slate-850 border border-slate-850 rounded-2xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {capKey === 'canAccessPowerprep' && <Bot className="h-4 w-4 text-indigo-400 shrink-0" />}
                        <span className="text-xs font-bold text-slate-200">
                          {PERMISSION_LABELS[capKey] || capKey}
                        </span>
                      </div>
                      {val ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                          <span>ENABLED</span>
                          <ToggleRight className="h-6 w-6" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                          <span>DISABLED</span>
                          <ToggleLeft className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>



              {/* GRID 3: STUDENT (PORTAL) PERMISSIONS */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">🎓 Student & Parent Portal Capabilities</h3>
                    <p className="text-xs text-slate-400 font-semibold">Control what students & parents can access in the portal.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(permissions.student).map(([capKey, val]) => (
                    <div
                      key={capKey}
                      onClick={() => handleTogglePermission('student', capKey)}
                      className="flex items-center justify-between p-4 bg-slate-955 hover:bg-slate-850 border border-slate-850 rounded-2xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {capKey === 'canAccessPowerprep' && <Bot className="h-4 w-4 text-indigo-400 shrink-0" />}
                        <span className="text-xs font-bold text-slate-200">
                          {PERMISSION_LABELS[capKey] || capKey}
                        </span>
                      </div>
                      {val ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
                          <span>ENABLED</span>
                          <ToggleRight className="h-6 w-6" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                          <span>DISABLED</span>
                          <ToggleLeft className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BACKUP & RESTORE */}
          {activeTab === 'backup_restore' && (
            <div className="space-y-6">
              {/* Action Success Alerts */}
              {exportSuccess && (
                <div className="bg-emerald-955/60 border border-emerald-900/60 text-emerald-400 text-xs p-4 rounded-2xl font-bold flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Institute backup JSON exported successfully! Your download has started.</span>
                </div>
              )}

              {restoreSuccess && (
                <div className="bg-emerald-955/60 border border-emerald-900/60 text-emerald-400 text-xs p-4 rounded-2xl font-bold flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Institute backup data restored cleanly into your target institute!</span>
                </div>
              )}

              {/* Grid Layout: Export & Restore */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Box 1: Export Backup */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 w-max">
                      <Download className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-extrabold text-white">Export Full Institute Backup</h3>
                    <p className="text-slate-400 text-xs font-medium leading-relaxed">
                      Generates a full structured JSON file containing all subcollections: Students, Batches, Fees, Attendance, Enquiries, Exams, Notifications, and Expenses.
                    </p>
                  </div>

                  <button
                    onClick={handleExportBackup}
                    disabled={exporting}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 mt-4"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Exporting Collections...
                      </>
                    ) : (
                      <>
                        <FileJson className="h-4 w-4" /> Download JSON Backup
                      </>
                    )}
                  </button>
                </div>

                {/* Box 2: Restore Backup */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 w-max">
                      <Upload className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-extrabold text-white">Restore Institute Backup</h3>
                    <p className="text-slate-400 text-xs font-medium leading-relaxed">
                      Import a previously exported JSON backup file into an institute. Features pre-import schema validation, record diff preview, and overwrite safeguards.
                    </p>
                  </div>

                  <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-750 hover:border-slate-600 bg-slate-955 p-6 rounded-2xl cursor-pointer transition-colors text-center group mt-4">
                    <FileJson className="h-8 w-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                    <span className="text-xs font-bold text-slate-300">Choose JSON Backup File</span>
                    <span className="text-[10px] text-slate-500 font-semibold mt-1">.json format</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-Restore Validation & Diff Summary Modal */}
      {restoreModalOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <button
              onClick={() => setRestoreModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Pre-Restore Validation & Diff Preview</h2>
                <p className="text-slate-400 text-xs font-medium">Verify backup payload structure before importing.</p>
              </div>
            </div>

            {restoreError && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 text-xs p-3.5 rounded-xl font-bold text-center">
                {restoreError}
              </div>
            )}

            {!previewData.valid ? (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-4 rounded-2xl text-xs font-bold space-y-2">
                <p className="flex items-center gap-2 text-sm font-black">
                  <AlertTriangle className="h-5 w-5" /> Invalid Backup File
                </p>
                <p>{previewData.error}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Summary Record Counts Grid */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                    Backup Summary ({previewData.totalRecords} total records found)
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold bg-slate-955 p-4 rounded-2xl border border-slate-850">
                    {Object.entries(previewData.summary).map(([subcol, count]) => (
                      <div key={subcol} className="flex justify-between items-center p-2 bg-slate-900 rounded-xl">
                        <span className="text-slate-400 capitalize">{subcol}:</span>
                        <span className="text-indigo-400 font-extrabold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning Safeguard Alert */}
                <div className="bg-amber-955/40 border border-amber-900/50 p-4 rounded-2xl text-amber-300 text-xs font-semibold space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> Overwrite Confirmation Safeguard
                  </div>
                  <p>
                    Restoring will import all records into institute ID <strong className="text-white font-mono">{instituteId}</strong>.
                  </p>
                </div>

                {/* Confirmation Checkbox & Text Input */}
                <div className="space-y-3 bg-slate-955 border border-slate-850 p-4 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <input
                      id="confirm-restore-checkbox"
                      type="checkbox"
                      checked={confirmCheckbox}
                      onChange={(e) => setConfirmCheckbox(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="confirm-restore-checkbox" className="text-xs font-bold text-slate-300 cursor-pointer">
                      I understand this will restore/merge backup data into this institute.
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Type "CONFIRM RESTORE" to unlock:
                    </label>
                    <input
                      type="text"
                      value={confirmTextInput}
                      onChange={(e) => setConfirmTextInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-white font-mono text-xs font-bold focus:outline-none focus:border-indigo-500"
                      placeholder="CONFIRM RESTORE"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setRestoreModalOpen(false)}
                    className="flex-1 bg-slate-955 text-slate-400 py-3 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={restoring || !confirmCheckbox || confirmTextInput.trim() !== 'CONFIRM RESTORE'}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    {restoring ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Restoring Batches...
                      </>
                    ) : (
                      'Execute Restore'
                    )}
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
