import { cx } from '@/lib/format';
import { IconShield } from '@/components/ui/Icons';

/**
 * The Christian-content indicator.
 *
 * It appears only where `verified` is true, which the API sets solely for videos
 * that completed moderation with an APPROVED or RESTRICTED decision. It is never
 * rendered optimistically.
 */
export function VerifiedBadge({
  verified,
  size = 'md',
  showLabel = true,
  className,
}: {
  verified: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full bg-verified/12 font-medium text-verified',
        size === 'sm' ? 'px-2 py-0.5 text-[0.68rem]' : 'px-3 py-1 text-xs',
        className,
      )}
      title="This video passed FaithTube’s Christ-centred content review before it was published."
    >
      <IconShield className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {showLabel ? 'Christian Content Verified' : <span className="sr-only">Christian Content Verified</span>}
    </span>
  );
}

export function AgeRestrictedNotice({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-xl bg-warn/10 p-4 text-sm ring-1 ring-warn/25">
      <p className="font-semibold text-warn">Content notice</p>
      <p className="mt-1 ft-muted">
        This video is Christian content, but it covers subjects that some viewers will find heavy.
      </p>
      {warnings.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {warnings.map((warning) => (
            <li key={warning} className="rounded-full bg-warn/15 px-2.5 py-0.5 text-[0.72rem] font-medium text-warn">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
