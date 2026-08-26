import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { api, setToken } from '@/lib/api';
import { darkPalette, lightPalette, type Palette } from '@/theme';

export interface SessionUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  isPremium: boolean;
  onboardingComplete: boolean;
  interests: string[];
  channelId: string | null;
  channelHandle: string | null;
}

interface AppValue {
  user: SessionUser | null;
  loading: boolean;
  palette: Palette;
  isDark: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
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
    const data = await api<{ user: SessionUser; token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await setToken(data.token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    await setToken(null);
    setUser(null);
  }, []);

  const isDark = scheme === 'dark';

  const value = useMemo(
    () => ({
      user,
      loading,
      isDark,
      palette: isDark ? darkPalette : lightPalette,
      signIn,
      signOut,
      refresh,
    }),
    [user, loading, isDark, signIn, signOut, refresh],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
