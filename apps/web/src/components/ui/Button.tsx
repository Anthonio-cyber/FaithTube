import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy text-cream hover:bg-navy-soft disabled:bg-navy/40 dark:bg-cream dark:text-navy dark:hover:bg-cream-dim',
  gold: 'bg-gilt text-navy font-semibold hover:brightness-105 shadow-sm disabled:opacity-50',
  secondary: 'bg-navy/[0.06] text-navy hover:bg-navy/[0.1] dark:bg-white/10 dark:text-cream dark:hover:bg-white/[0.16]',
  outline: 'ring-1 ring-inset ring-navy/20 text-navy hover:bg-navy/5 dark:ring-white/20 dark:text-cream dark:hover:bg-white/5',
  ghost: 'text-navy/70 hover:bg-navy/5 hover:text-navy dark:text-cream/70 dark:hover:bg-white/5 dark:hover:text-cream',
  danger: 'bg-danger text-white hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8rem] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      // aria-busy tells assistive tech the control is working, not broken.
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-full font-medium transition-all',
        'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'to' | 'className'>) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-full font-medium transition-all active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
