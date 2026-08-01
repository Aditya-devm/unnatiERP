'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  ShieldCheck,
  Building,
  UserCheck,
  Users,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Building2,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
  X,
  AlertCircle
} from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signInWithCustomToken } from 'firebase/auth';

type RoleType = 'admin' | 'staff' | 'student';

const ALLOWED_ADMIN_EMAILS = [
  'samxlnc56@gmail.com',
  'unnaticlasseskalol@gmail.com'
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected Role & View Mode
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [viewMode, setViewMode] = useState<'select_role' | 'credentials' | 'create_admin' | 'forgot_password'>('select_role');

  // Student Login Mode Selector ('email' or 'code')
  const [studentLoginMode, setStudentLoginMode] = useState<'email' | 'code'>('email');

  // Admin 4-Digit OTP State
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminOtpStep, setAdminOtpStep] = useState<'email' | 'otp'>('email');
  const [adminOtpCode, setAdminOtpCode] = useState('');

  // Credentials Form State
  const [instituteCode, setInstituteCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Create Admin Account State
  const [instituteName, setInstituteName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotRollNo, setForgotRollNo] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Action status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const qEmail = searchParams.get('email');
    if (qEmail) {
      setIdentifier(qEmail);
      setAdminEmailInput(qEmail);
    }
  }, [searchParams]);

  // Handle Role Selection
  const handleSelectRole = (role: RoleType) => {
    setSelectedRole(role);
    setViewMode('credentials');
    setError('');
    setAdminOtpStep('email');
    setAdminOtpCode('');
    setStudentLoginMode('email');
  };

  // Handle Admin 4-Digit OTP Request
  const handleSendAdminOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim()) return;

    const cleanEmail = adminEmailInput.trim().toLowerCase();

    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
      setError('Access denied: Only authorized admin emails (samxlnc56@gmail.com, unnaticlasseskalol@gmail.com) are permitted for Admin login.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-admin-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send admin OTP code.');

      setAdminOtpStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin 4-Digit OTP Verification
  const handleVerifyAdminOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim() || !adminOtpCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-admin-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmailInput.trim().toLowerCase(),
          otp: adminOtpCode.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '4-digit OTP verification failed.');

      // Sign in using custom token
      await signInWithCustomToken(auth, data.customToken);

      // Redirect to ERP
      router.replace(data.redirectUrl || '/erp');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the 4-digit code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Staff/Student Credentials Login
  const handleInstituteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !password) return;
    if (selectedRole === 'staff' && !identifier.trim()) return;
    if (selectedRole === 'student' && studentLoginMode === 'email' && !identifier.trim()) return;
    if (selectedRole === 'student' && studentLoginMode === 'code' && !instituteCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const reqBody: any = {
        selectedRole,
        password
      };

      if (selectedRole === 'staff' || (selectedRole === 'student' && studentLoginMode === 'email')) {
        reqBody.identifier = identifier.trim();
      }
      if (selectedRole === 'student' && studentLoginMode === 'code') {
        reqBody.instituteCode = instituteCode.trim();
      }

      const res = await fetch('/api/auth/institute-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      // Sign in using custom token
      await signInWithCustomToken(auth, data.customToken);

      // Redirect to appropriate module
      router.replace(data.redirectUrl || (selectedRole === 'student' ? '/portal' : '/erp'));
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle New Admin + Institute Registration
  const handleCreateAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register-institute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instituteName: instituteName.trim(),
          adminName: adminName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
          phone: adminPhone.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      // Show created code
      setCreatedCode(data.instituteCode);

      // Sign in via custom token
      await signInWithCustomToken(auth, data.customToken);

      // Redirect after 3.5 seconds
      setTimeout(() => {
        router.replace('/erp');
      }, 3500);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotRollNo.trim()) {
      setError('Please enter both your Registered Email and Roll Number.');
      return;
    }

    setLoading(true);
    setError('');
    setForgotMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          rollNumber: forgotRollNo.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send password to email.');

      setForgotMessage(data.message || 'Password sent to your registered email address.');
    } catch (err: any) {
      setError(err.message || 'Failed to request password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4 relative bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Dynamic Background Effects */}
      <div className="absolute top-[15%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[15%] right-[-10%] w-[45%] h-[45%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header Brand */}
      <div className="text-center mb-8 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Unnati <span className="bg-gradient-to-r from-indigo-400 to-blue-500 bg-clip-text text-transparent">Powerprep</span>
          </h1>
        </div>
        <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">
          ERP & Student Portal Gateway
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl backdrop-blur-xl">

        {/* STEP 1: ROLE SELECTION VIEW */}
        {viewMode === 'select_role' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-black text-white tracking-tight">Select Your Login Role</h2>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Choose your account role to access your dedicated dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Option 1: Admin */}
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                className="group relative p-5 bg-slate-955 hover:bg-slate-850 border border-slate-850 hover:border-indigo-500/50 rounded-2xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-950 border border-indigo-850 group-hover:bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    <Building2 className="h-6 w-6 text-indigo-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                      Login as Admin <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-all group-hover:translate-x-1" />
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Email + 4-Digit OTP Login (Authorized Admin Emails)
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Staff */}
              <button
                type="button"
                onClick={() => handleSelectRole('staff')}
                className="group relative p-5 bg-slate-955 hover:bg-slate-850 border border-slate-850 hover:border-blue-500/50 rounded-2xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-950 border border-blue-850 group-hover:bg-blue-600 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    <UserCheck className="h-6 w-6 text-blue-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors flex items-center justify-between">
                      Login as Staff <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Teachers, Instructors & Administrative Staff
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 3: Student */}
              <button
                type="button"
                onClick={() => handleSelectRole('student')}
                className="group relative p-5 bg-slate-955 hover:bg-slate-850 border border-slate-850 hover:border-emerald-500/50 rounded-2xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-950 border border-emerald-850 group-hover:bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                    <Users className="h-6 w-6 text-emerald-400 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                      Login as Student <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition-all group-hover:translate-x-1" />
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Email + Password OR Institute Code Options
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CREDENTIALS VIEW */}
        {viewMode === 'credentials' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => { setViewMode('select_role'); setError(''); }}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Change Role
              </button>

              <span className="text-[10px] font-extrabold px-3 py-1 bg-indigo-950 text-indigo-300 border border-indigo-850 rounded-full uppercase tracking-wider">
                {selectedRole === 'admin' ? '👑 Admin OTP Login' : selectedRole === 'staff' ? '👨‍🏫 Staff Login' : '🎓 Student Portal'}
              </span>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/60 text-red-400 text-xs p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            {/* ADMIN LOGIN: EMAIL + 4-DIGIT OTP FLOW */}
            {selectedRole === 'admin' ? (
              adminOtpStep === 'email' ? (
                <form onSubmit={handleSendAdminOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Admin Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={adminEmailInput}
                        onChange={(e) => setAdminEmailInput(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="Enter authorized admin email..."
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold pl-1 mt-1">
                      Admin login is restricted to authorized admin emails. A 4-digit code will be sent.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !adminEmailInput}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {loading ? 'Sending Code...' : 'Send 4-Digit OTP Code'} <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="pt-4 border-t border-slate-800 text-center">
                    <p className="text-xs text-slate-400 font-bold mb-2">New Institute Owner?</p>
                    <button
                      type="button"
                      onClick={() => { setViewMode('create_admin'); setError(''); }}
                      className="w-full bg-slate-955 hover:bg-slate-850 border border-slate-800 text-indigo-400 font-extrabold py-3 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Building2 className="h-4 w-4" /> Create Admin Account & Institute
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyAdminOtp} className="space-y-4">
                  <div className="space-y-1.5 text-center">
                    <p className="text-xs text-slate-300 font-bold">
                      Enter the 4-digit OTP code sent to <strong className="text-indigo-400">{adminEmailInput}</strong>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center block">
                      4-Digit Verification Code (OTP)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={adminOtpCode}
                      onChange={(e) => setAdminOtpCode(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-4 text-center tracking-[12px] text-2xl font-black text-indigo-400 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
                      placeholder="----"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || adminOtpCode.length < 4}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {loading ? 'Verifying...' : 'Verify & Login as Admin'} <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAdminOtpStep('email'); setError(''); }}
                    className="w-full text-center text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer pt-2 block"
                  >
                    Back to Admin Email Selection
                  </button>
                </form>
              )
            ) : (
              /* STAFF & STUDENT CREDENTIALS FORM */
              <form onSubmit={handleInstituteLogin} className="space-y-4">

                {/* STUDENT LOGIN METHOD TOGGLE */}
                {selectedRole === 'student' && (
                  <div className="flex bg-slate-955 p-1 rounded-2xl border border-slate-800 mb-2">
                    <button
                      type="button"
                      onClick={() => { setStudentLoginMode('email'); setError(''); }}
                      className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                        studentLoginMode === 'email'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ✉️ Email & Password
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStudentLoginMode('code'); setError(''); }}
                      className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                        studentLoginMode === 'code'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🏢 Institute Code & Password
                    </button>
                  </div>
                )}

                {/* STAFF LOGIN FIELDS (Staff ID + Password) */}
                {selectedRole === 'staff' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Staff ID *
                    </label>
                    <div className="relative">
                      <UserCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-indigo-400" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="e.g. STF-001"
                      />
                    </div>
                  </div>
                )}

                {/* STUDENT LOGIN FIELDS */}
                {selectedRole === 'student' && studentLoginMode === 'code' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                        Institute Code *
                      </label>
                      <span className="text-[10px] text-indigo-400 font-bold">6-Character Unique Code</span>
                    </div>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={instituteCode}
                        onChange={(e) => setInstituteCode(e.target.value.toUpperCase())}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white uppercase tracking-widest font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="e.g. UP-8X4K"
                      />
                    </div>
                  </div>
                )}

                {selectedRole === 'student' && studentLoginMode === 'email' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Registered Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="student@example.com"
                      />
                    </div>
                  </div>
                )}

                {/* Password Field for Staff & Student */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Password *
                    </label>
                    {selectedRole === 'student' && (
                      <button
                        type="button"
                        onClick={() => { setViewMode('forgot_password'); setError(''); setForgotMessage(''); }}
                        className="text-[10px] font-bold text-indigo-400 hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                      placeholder="Enter your password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !password ||
                    (selectedRole === 'staff' && !identifier.trim()) ||
                    (selectedRole === 'student' && studentLoginMode === 'email' && !identifier) ||
                    (selectedRole === 'student' && studentLoginMode === 'code' && !instituteCode)
                  }
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer text-sm"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Portal'} <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 3: CREATE ADMIN ACCOUNT VIEW */}
        {viewMode === 'create_admin' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => { setViewMode('credentials'); setError(''); }}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </button>
              <span className="text-[10px] font-extrabold px-3 py-1 bg-indigo-950 text-indigo-300 border border-indigo-850 rounded-full uppercase tracking-wider">
                👑 Create Institute
              </span>
            </div>

            {createdCode ? (
              <div className="bg-emerald-950/50 border border-emerald-800 p-6 rounded-2xl text-center space-y-3 animate-in fade-in duration-300">
                <div className="w-12 h-12 bg-emerald-900 border border-emerald-700 rounded-full flex items-center justify-center mx-auto text-emerald-300">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-black text-white">Institute Successfully Registered!</h3>
                <p className="text-xs text-emerald-300 font-semibold">
                  Your official 6-character Institute Code is:
                </p>
                <div className="bg-slate-955 border border-slate-800 py-3 px-6 rounded-2xl text-2xl font-black font-mono text-emerald-400 tracking-widest inline-block shadow-inner">
                  {createdCode}
                </div>
                <p className="text-[11px] text-slate-400 font-bold">
                  Share this code with your staff and students to let them log in. Redirecting to ERP...
                </p>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-black text-white tracking-tight">Register New Institute</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Create an admin account to generate your short Institute Code.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-950/40 border border-red-900/60 text-red-400 text-xs p-3.5 rounded-2xl text-center font-bold">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreateAdminAccount} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Institute / Coaching Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                      placeholder="e.g. Unnati Classes Kalol"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                      placeholder="e.g. Aditya Tiwari"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="admin@example.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                        Mobile Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                      Account Password *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {loading ? 'Creating Institute...' : 'Register & Generate Code'} <Sparkles className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {/* STEP 4: FORGOT PASSWORD VIEW */}
        {viewMode === 'forgot_password' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                type="button"
                onClick={() => { setViewMode('credentials'); setError(''); setForgotMessage(''); }}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </button>
              <span className="text-[10px] font-extrabold px-3 py-1 bg-amber-950 text-amber-300 border border-amber-850 rounded-full uppercase tracking-wider">
                Reset Password
              </span>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-black text-white tracking-tight">Student Password Recovery</h2>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Enter your registered Email address and Roll Number. If both match your student record, your password will be sent to your email (Limit: 5 chances total).
              </p>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-900/60 text-red-400 text-xs p-3.5 rounded-2xl text-center font-bold">
                {error}
              </div>
            )}

            {forgotMessage && (
              <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs p-3.5 rounded-2xl text-center font-bold">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Registered Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">
                  Roll Number *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={forgotRollNo}
                    onChange={(e) => setForgotRollNo(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    placeholder="Enter your Roll No. (e.g. 101)"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !forgotEmail || !forgotRollNo}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 cursor-pointer text-sm"
              >
                {loading ? 'Verifying & Sending...' : 'Send Password to Registered Email'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest z-10">
        <ShieldCheck className="h-4 w-4 text-slate-400" />
        Secured Firebase Authentication & Role Enforcement
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen bg-slate-950 text-white">
        <div className="w-8 h-8 bg-indigo-950 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-850">
          <GraduationCap className="h-5 w-5 animate-pulse" />
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
