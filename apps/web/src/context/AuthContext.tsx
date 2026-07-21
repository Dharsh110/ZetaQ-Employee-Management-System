import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ devResetUrl?: string }>;
  resetPassword: (token: string, password: string) => Promise<void>;
  changePassword: (current: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The backend's User.department is a denormalized string that isn't always
// kept in sync with the linked Employee's real department — fall back to
// the populated employee record (the authoritative source) when it's empty.
function normalizeUser(u: any): User {
  if (!u?.department && u?.employee?.department) {
    const deptName = typeof u.employee.department === 'object' ? u.employee.department.name : u.employee.department;
    if (deptName) return { ...u, department: deptName };
  }
  return u;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('ems_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ems_token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token && !user) {
      authAPI.getMe()
        .then((res) => {
          const u = normalizeUser(res.data.user);
          setUser(u);
          localStorage.setItem('ems_user', JSON.stringify(u));
        })
        .catch(() => {
          setToken(null);
          localStorage.removeItem('ems_token');
        });
    }
  }, [token, user]);

  // localStorage is shared across every tab of this origin, but each tab's React
  // state (and every RTK Query cache built on top of it) is only initialized once
  // on load. Without this, logging in as a different account in one tab silently
  // changes which identity *other already-open tabs* send requests as on their next
  // action — while those tabs still visually show the old user — since the API
  // client reads the token fresh from localStorage on every request. Reloading is
  // the only way to safely rebuild every cached query under the correct identity.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ems_token' || e.key === 'ems_user') window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string, role?: string) => {
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password, role });
      const { token: t, user: rawUser } = res.data;
      const u = normalizeUser(rawUser);
      setToken(t); setUser(u);
      localStorage.setItem('ems_token', t);
      localStorage.setItem('ems_user', JSON.stringify(u));
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
    toast.success('Logged out successfully');
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const res = await authAPI.forgotPassword(email);
    return { devResetUrl: res.data?.devResetUrl };
  }, []);

  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    const res = await authAPI.resetPassword(resetToken, password);
    const { token: t, user: u } = res.data;
    setToken(t);
    setUser(u);
    localStorage.setItem('ems_token', t);
    localStorage.setItem('ems_user', JSON.stringify(u));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authAPI.changePassword(currentPassword, newPassword);
    toast.success('Password changed successfully');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, forgotPassword, resetPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
