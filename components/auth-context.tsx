'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { RolePermissions, DEFAULT_PERMISSIONS } from '@/lib/permissions';

const STUDENT_SESSION_KEY = 'unnati_student_login_ts';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours

interface AuthContextType {
  user: User | null;
  role: string | null;
  instituteId: string | null;
  loading: boolean;
  permissions: RolePermissions;
  hasPermission: (permissionKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  instituteId: null,
  loading: true,
  permissions: DEFAULT_PERMISSIONS,
  hasPermission: () => true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

  // 1. Auth & User Profile Listener (with 2-day student/parent auto-logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userRole = data.role || 'student';

            // 2-day session expiry enforcement for student & parent roles
            if (userRole === 'student' || userRole === 'parent') {
              const loginTs = localStorage.getItem(STUDENT_SESSION_KEY);

              if (!loginTs) {
                // First time seeing this session — record login timestamp
                localStorage.setItem(STUDENT_SESSION_KEY, Date.now().toString());
              } else {
                const elapsed = Date.now() - parseInt(loginTs, 10);
                if (elapsed >= TWO_DAYS_MS) {
                  // Session expired — force logout
                  console.log('Student session expired (2-day limit). Logging out.');
                  localStorage.removeItem(STUDENT_SESSION_KEY);
                  await signOut(auth);
                  setUser(null);
                  setRole(null);
                  setInstituteId(null);
                  setLoading(false);
                  return;
                }
              }
            }

            setUser(currentUser);
            setRole(userRole);
            setInstituteId(data.instituteId || null);
          } else {
            setUser(currentUser);
            setRole('student');
            setInstituteId(null);
          }
        } catch (error) {
          console.error('Error fetching user roles from Firestore:', error);
          setUser(currentUser);
          setRole('student');
          setInstituteId(null);
        }
      } else {
        // User signed out — clear student session timestamp
        localStorage.removeItem(STUDENT_SESSION_KEY);
        setUser(null);
        setRole(null);
        setInstituteId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-Time Permissions Config Listener
  useEffect(() => {
    if (!instituteId) {
      setPermissions(DEFAULT_PERMISSIONS);
      return;
    }

    const permDocRef = doc(db, 'institutes', instituteId, 'permissions', 'config');
    const unsubPerms = onSnapshot(
      permDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<RolePermissions>;
          setPermissions({
            teacher: { ...DEFAULT_PERMISSIONS.teacher, ...(data.teacher || {}) },
            staff: { ...DEFAULT_PERMISSIONS.staff, ...(data.staff || {}) },
            student: { ...DEFAULT_PERMISSIONS.student, ...(data.student || {}) },
          });
        } else {
          // Pre-populate with Sensible Defaults if doc missing
          setPermissions(DEFAULT_PERMISSIONS);
        }
      },
      (err) => {
        console.error('Error listening to permissions config:', err);
        setPermissions(DEFAULT_PERMISSIONS);
      }
    );

    return () => unsubPerms();
  }, [instituteId]);

  // 3. Permission Check Helper Function
  const hasPermission = (permissionKey: string): boolean => {
    // Owner and Admin always have full access to everything
    if (role === 'owner' || role === 'admin') return true;

    if (!role) return false;
    const normalizedRole = role === 'parent' ? 'student' : (role.toLowerCase() as keyof RolePermissions);

    const rolePerms = permissions[normalizedRole as keyof RolePermissions];
    if (!rolePerms) return true;

    const val = (rolePerms as any)[permissionKey];
    return val !== undefined ? Boolean(val) : true;
  };

  return (
    <AuthContext.Provider value={{ user, role, instituteId, loading, permissions, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
