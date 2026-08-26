import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** localStorage throws in some privacy modes, so every read is guarded. */
function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => read('ft_theme', 'system') as Theme);
  const [highContrast, setHighContrastState] = useState(() => read('ft_contrast', 'off') === 'on');
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('ft-high-contrast', highContrast);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#060D1D' : '#FBF7EF');
  }, [resolved, highContrast]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem('ft_theme', next);
    } catch {
      // Private browsing can refuse storage; the choice simply will not persist.
    }
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    setHighContrastState(value);
    try {
      localStorage.setItem('ft_contrast', value ? 'on' : 'off');
    } catch {
      // As above.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, highContrast, setHighContrast }),
    [theme, resolved, setTheme, highContrast, setHighContrast],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
