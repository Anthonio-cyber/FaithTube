import { cx } from '@/lib/format';

/**
 * The FaithTube mark: a chapel arch with a cross at its apex and a play form set
 * inside it. Drawn inline so it inherits colour and stays crisp at every size.
 */
export function LogoMark({ className, title = 'FaithTube' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx('h-8 w-8', className)} role="img" aria-label={title}>
      <path d="M32 6v11M26.5 11.5h11" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path
        d="M14 54V33.5a18 18 0 0 1 36 0V54a2.5 2.5 0 0 1-2.5 2.5h-31A2.5 2.5 0 0 1 14 54Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinejoin="round"
      />
      <path d="M27 31 42 40l-15 9Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className, showMotto = false }: { className?: string; showMotto?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-9 w-9 text-gold" />
      <span className="flex flex-col leading-none">
        <span className="text-[1.35rem] tracking-tight">
          <span className="font-display font-semibold">Faith</span>
          <span className="font-sans font-light">Tube</span>
        </span>
        {showMotto ? (
          <span className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-gold">
            Every Video. Christ-Centered.
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** The light-ray motif used behind hero sections and empty states. */
export function RayBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute inset-x-0 top-0 h-full bg-ray" />
      <svg className="absolute left-1/2 top-0 h-[140%] w-[120%] -translate-x-1/2 opacity-[0.07]" viewBox="0 0 800 600" fill="none">
        <path d="M400 0 120 600h80L400 60l200 540h80L400 0Z" fill="currentColor" />
        <path d="M400 0 300 600h40L400 120l60 480h40L400 0Z" fill="currentColor" />
      </svg>
    </div>
  );
}
