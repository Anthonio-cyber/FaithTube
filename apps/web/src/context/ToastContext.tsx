import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  detail?: string;
}

interface ToastValue {
  push: (message: string, tone?: ToastTone, detail?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info', detail?: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone, detail }]);
    // Errors stay longer, because they usually need reading.
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === 'error' ? 8000 : 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Announced politely so a screen reader hears confirmations without losing focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto w-full max-w-md animate-fade-up rounded-xl px-4 py-3 text-sm shadow-lift ring-1',
              toast.tone === 'success' && 'bg-verified text-white ring-white/20',
              toast.tone === 'error' && 'bg-danger text-white ring-white/20',
              toast.tone === 'warning' && 'bg-warn text-white ring-white/20',
              toast.tone === 'info' && 'bg-navy text-cream ring-white/10',
            )}
          >
            <p className="font-medium">{toast.message}</p>
            {toast.detail ? <p className="mt-1 text-xs opacity-85">{toast.detail}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
