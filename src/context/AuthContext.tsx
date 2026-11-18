import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.ts';
import type { AuthSessionPayload, PermissionKey } from '../shared/types.ts';

interface AuthContextValue {
  session: AuthSessionPayload | null;
  loading: boolean;
  refreshSession: () => Promise<AuthSessionPayload | null>;
  logout: () => Promise<void>;
  hasPermission: (perm: PermissionKey) => boolean;
  isOrgAdminOrOwner: boolean;
  isPlatformAdmin: boolean;
  theme: 'light' | 'dark';
  setThemeLocal: (theme: 'light' | 'dark') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = useCallback((nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiFetch<{ authenticated: boolean; session: AuthSessionPayload | null }>(
        '/api/auth/session'
      );
      setSession(res.session);
      if (res.session?.preferences?.theme) {
        applyTheme(res.session.preferences.theme);
      } else {
        applyTheme('light');
      }
      return res.session;
    } catch {
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setSession(null);
    applyTheme('light');
  }, [applyTheme]);

  const hasPermission = useCallback(
    (perm: PermissionKey) => {
      return Boolean(session?.permissions?.includes(perm));
    },
    [session]
  );

  const isOrgAdminOrOwner =
    session?.membership?.roleKey === 'OWNER' || session?.membership?.roleKey === 'ADMIN';
  const isPlatformAdmin = Boolean(session?.user?.isPlatformAdmin);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        refreshSession,
        logout,
        hasPermission,
        isOrgAdminOrOwner,
        isPlatformAdmin,
        theme,
        setThemeLocal: applyTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
