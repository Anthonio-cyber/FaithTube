import { Link } from 'react-router-dom';
import type { VideoSummary } from '@faithtube/shared';
import { cx, describeDuration, formatCount, formatDuration, timeAgo } from '@/lib/format';
import { Avatar, ProgressBar } from '@/components/ui';
import { VerifiedBadge } from './VerifiedBadge';
import { IconPremium } from '@/components/ui/Icons';

export interface VideoCardProps {
  video: VideoSummary & { progressSeconds?: number; percentComplete?: number };
  layout?: 'grid' | 'row' | 'compact';
  showChannel?: boolean;
  className?: string;
}

export function VideoCard({ video, layout = 'grid', showChannel = true, className }: VideoCardProps) {
  const href = `/watch/${video.slug}`;
  const meta = `${formatCount(video.viewCount)} view${video.viewCount === 1 ? '' : 's'} · ${timeAgo(video.publishedAt)}`;

  if (layout === 'compact') {
    return (
      <Link
        to={href}
        className={cx('group flex gap-3 rounded-xl p-1.5 transition hover:bg-navy/[0.04] dark:hover:bg-white/5', className)}
      >
        <Thumb video={video} className="w-[9.5rem] shrink-0" />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="ft-line-clamp-2 text-[0.82rem] font-medium leading-snug">{video.title}</h3>
          {showChannel ? <p className="mt-1 truncate text-xs ft-muted">{video.channel.name}</p> : null}
          <p className="mt-0.5 truncate text-xs ft-muted">{meta}</p>
        </div>
      </Link>
    );
  }

  if (layout === 'row') {
    return (
      <Link
        to={href}
        className={cx('group flex flex-col gap-4 rounded-2xl p-2 transition hover:bg-navy/[0.04] sm:flex-row dark:hover:bg-white/5', className)}
      >
        <Thumb video={video} className="sm:w-[22rem] sm:shrink-0" />
        <div className="min-w-0 flex-1 py-1">
          <h3 className="ft-line-clamp-2 font-display text-lg font-semibold leading-snug">{video.title}</h3>
          <p className="mt-1 text-sm ft-muted">{meta}</p>
          {showChannel ? (
            <div className="mt-2.5 flex items-center gap-2">
              <Avatar src={video.channel.avatarUrl} name={video.channel.name} size={26} />
              <span className="truncate text-sm ft-muted">{video.channel.name}</span>
            </div>
          ) : null}
          <p className="mt-2 ft-line-clamp-2 text-sm ft-muted">{video.description}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <VerifiedBadge verified={video.christianContentVerified} size="sm" />
            {video.premiumOnly ? <PremiumPill /> : null}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <article className={cx('group', className)}>
      <Link to={href} className="block">
        <Thumb video={video} />
      </Link>
      <div className="mt-2.5 flex gap-3">
        {showChannel ? (
          <Link to={`/channel/${video.channel.handle}`} className="shrink-0 pt-0.5" aria-label={video.channel.name}>
            <Avatar src={video.channel.avatarUrl} name={video.channel.name} size={34} />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <Link to={href}>
            <h3 className="ft-line-clamp-2 text-[0.93rem] font-semibold leading-snug transition group-hover:text-gold-deep dark:group-hover:text-gold-soft">
              {video.title}
            </h3>
          </Link>
          {showChannel ? (
            <Link to={`/channel/${video.channel.handle}`} className="mt-1 block truncate text-[0.82rem] ft-muted hover:text-navy dark:hover:text-cream">
              {video.channel.name}
              {video.channel.verifiedChristianCreator ? <VerifiedTick /> : null}
            </Link>
          ) : null}
          <p className="mt-0.5 truncate text-[0.82rem] ft-muted">{meta}</p>
        </div>
      </div>
    </article>
  );
}

function Thumb({ video, className }: { video: VideoCardProps['video']; className?: string }) {
  return (
    <div
      className={cx(
        'relative aspect-video w-full overflow-hidden rounded-xl bg-navy-soft ring-1 ring-navy/5 dark:ring-white/5',
        className,
      )}
    >
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <PlaceholderArt title={video.title} categorySlug={video.categorySlug} />
      )}

      {video.isLive ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
          Live
        </span>
      ) : (
        <span className="absolute bottom-2 right-2 rounded-md bg-navy-deep/85 px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-cream">
          <span className="sr-only">Duration: {describeDuration(video.durationSeconds)}</span>
          <span aria-hidden>{formatDuration(video.durationSeconds)}</span>
        </span>
      )}

      {video.ageRestricted ? (
        <span className="absolute left-2 top-2 rounded-md bg-warn/90 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
          18+
        </span>
      ) : null}

      {typeof video.percentComplete === 'number' && video.percentComplete > 0 ? (
        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar value={video.percentComplete} className="h-1 rounded-none bg-navy-deep/50" label="Watch progress" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Placeholder art for videos with no thumbnail — deterministic per title, so a
 * given video always looks the same rather than flickering between renders.
 */
export function PlaceholderArt({ title, categorySlug }: { title: string; categorySlug: string }) {
  const hash = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palettes = [
    ['#152444', '#0B1730'],
    ['#3A2A5C', '#151033'],
    ['#123A3A', '#08201F'],
    ['#402B18', '#1B1109'],
    ['#1B2E4A', '#0A1526'],
  ];
  const [from, to] = palettes[hash % palettes.length];
  const rotation = (hash % 40) - 20;

  return (
    <div className="relative flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 320 180" aria-hidden>
        <g transform={`rotate(${rotation} 160 90)`}>
          <path d="M160 -40 60 220h30l70-210 70 210h30L160 -40Z" fill="#F0CE8E" />
          <path d="M160 -40 120 220h20l40-200 40 200h20L160 -40Z" fill="#F0CE8E" opacity="0.6" />
        </g>
      </svg>
      <div className="relative flex flex-col items-center px-4 text-center">
        <svg viewBox="0 0 64 64" className="h-9 w-9 text-gold/80" fill="none" stroke="currentColor" strokeWidth="3.4" aria-hidden>
          <path d="M32 8v10M27 13h10" strokeLinecap="round" />
          <path d="M16 54V34a16 16 0 0 1 32 0v20Z" strokeLinejoin="round" />
        </svg>
        <span className="mt-2 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-cream/55">
          {categorySlug.replace(/-/g, ' ')}
        </span>
      </div>
    </div>
  );
}

function PremiumPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.68rem] font-medium text-gold-deep dark:text-gold-soft">
      <IconPremium className="h-3.5 w-3.5" />
      Premium
    </span>
  );
}

function VerifiedTick() {
  return (
    <svg viewBox="0 0 20 20" className="ml-1 inline-block h-3.5 w-3.5 text-verified" fill="currentColor" aria-label="Verified Christian creator">
      <path d="M10 1.5 12 3l2.4-.3 1 2.2 2.2 1-.3 2.4L18.5 10l-1.2 1.7.3 2.4-2.2 1-1 2.2-2.4-.3L10 18.5 8.3 17.3l-2.4.3-1-2.2-2.2-1 .3-2.4L1.5 10l1.5-1.7-.3-2.4 2.2-1 1-2.2L8.3 3 10 1.5Zm-.7 11.3 4.6-4.6-1.2-1.2-3.4 3.4-1.6-1.6-1.2 1.2 2.8 2.8Z" />
    </svg>
  );
}

export function VideoCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'compact' }) {
  if (layout === 'compact') {
    return (
      <div className="flex gap-3 p-1.5">
        <div className="ft-skeleton aspect-video w-[9.5rem] shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="ft-skeleton h-3 w-full" />
          <div className="ft-skeleton h-3 w-2/3" />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="ft-skeleton aspect-video w-full" />
      <div className="mt-2.5 flex gap-3">
        <div className="ft-skeleton h-[34px] w-[34px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="ft-skeleton h-3 w-full" />
          <div className="ft-skeleton h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}
