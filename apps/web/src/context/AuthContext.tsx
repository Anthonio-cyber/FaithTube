import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionUser } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  username: string;
  country?: string;
  agreements: { christianContent: true; guidelines: true; privacy: true };
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser | null }>('/auth/session');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: SessionUser }>('/auth/login', { method: 'POST', body: { email, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await api<{ user: SessionUser }>('/auth/register', { method: 'POST', body: input });
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Starts the Google authorization-code flow. The code is exchanged on the
   * server, so the client secret never reaches the browser. When Google sign-in
   * is not configured the API says so and we surface that message rather than
   * failing silently.
   */
  const signInWithGoogle = useCallback(async () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('ft_oauth_state', state);
    try {
      const data = await api<{ url: string }>('/auth/google/url', { query: { state } });
      window.location.href = data.url;
    } catch (err) {
      if (err instanceof ApiError && err.notConfigured) {
        throw new Error(err.howToFix ?? err.message);
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signInWithGoogle, signOut, refresh, setUser }),
    [user, loading, signIn, register, signInWithGoogle, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
