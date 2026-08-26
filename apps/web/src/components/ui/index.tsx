import {
  forwardRef,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/lib/format';

// ------------------------------------------------------------------- inputs

const FIELD_BASE =
  'w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-navy ring-1 ring-navy/15 transition ' +
  'placeholder:text-navy/35 focus:ring-2 focus:ring-gold ' +
  'dark:bg-navy-soft dark:text-cream dark:ring-white/15 dark:placeholder:text-cream/35';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  id: string;
}

export function Field({ label, hint, error, required, children, id }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {/* Errors are wired to the control with aria-describedby by each caller. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs ft-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(FIELD_BASE, invalid && 'ring-danger focus:ring-danger', className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx(FIELD_BASE, 'min-h-[7rem] resize-y leading-relaxed', invalid && 'ring-danger', className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx(FIELD_BASE, 'appearance-none pr-9', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  description,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: string; id: string }) {
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-navy/30 text-gold accent-gold focus:ring-gold dark:border-white/30"
        {...rest}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        {label}
        {description ? <span className="mt-0.5 block text-xs ft-muted">{description}</span> : null}
      </label>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs ft-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-gold' : 'bg-navy/20 dark:bg-white/20',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ surfaces

export function Card({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cx('ft-card p-5', className)}>{children}</Tag>;
}

export function SectionHeading({
  title,
  subtitle,
  action,
  level = 2,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Tag = (`h${level}` as const);
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Tag className={cx('font-display font-semibold tracking-tight', level === 1 ? 'text-2xl sm:text-3xl' : 'text-xl')}>
          {title}
        </Tag>
        {subtitle ? <p className="mt-0.5 text-sm ft-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'verified' | 'warn' | 'danger' | 'plum';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-navy/[0.07] text-navy/75 dark:bg-white/10 dark:text-cream/75',
    gold: 'bg-gold/15 text-gold-deep dark:text-gold-soft',
    verified: 'bg-verified/15 text-verified',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    plum: 'bg-plum/15 text-plum dark:text-purple-200',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 px-6 py-14 text-center dark:border-white/15">
      {icon ? <div className="mb-4 text-gold">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm ft-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('ft-skeleton', className)} aria-hidden />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('border-navy/10 dark:border-white/10', className)} />;
}

// --------------------------------------------------------------------- modal

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the dialog so keyboard users are not
  // left behind on the page underneath.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-deep/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full animate-fade-up rounded-t-3xl bg-white shadow-lift sm:rounded-2xl dark:bg-navy-soft',
          widths[size],
          'max-h-[92vh] overflow-hidden',
        )}
      >
        <div className="flex items-center justify-between border-b border-navy/10 px-5 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-navy/50 transition hover:bg-navy/5 hover:text-navy dark:text-cream/50 dark:hover:bg-white/10 dark:hover:text-cream"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-navy/10 px-5 py-3.5 dark:border-white/10">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- tabs

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx('ft-no-scrollbar flex gap-1 overflow-x-auto border-b border-navy/10 dark:border-white/10', className)}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cx(
              'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition',
              selected ? 'text-navy dark:text-cream' : 'text-navy/55 hover:text-navy dark:text-cream/55 dark:hover:text-cream',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span className="ml-1.5 rounded-full bg-navy/10 px-1.5 py-0.5 text-[0.65rem] dark:bg-white/10">{tab.count}</span>
            ) : null}
            {selected ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={cx('shrink-0 rounded-full object-cover ring-1 ring-navy/10 dark:ring-white/10', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-navy text-cream ring-1 ring-navy/10 dark:bg-white/15',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {letters || '·'}
    </span>
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-navy/10 dark:bg-white/10', className)}
    >
      <div className="h-full rounded-full bg-gilt transition-[width] duration-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}
