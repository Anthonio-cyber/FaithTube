import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { VideoSummary } from '@faithtube/shared';
import { VideoCard, VideoCardSkeleton } from './VideoCard';
import { IconChevron } from '@/components/ui/Icons';
import { cx } from '@/lib/format';

/**
 * Horizontal rail. Arrow controls appear on pointer devices; on touch it is a
 * native scroll with snap points, which feels better than emulated paging.
 */
export function VideoRail({
  title,
  subtitle,
  items,
  seeAllHref,
  loading,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  items: Array<VideoSummary & { percentComplete?: number }>;
  seeAllHref?: string;
  loading?: boolean;
  emptyMessage?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.85), behavior: 'smooth' });
  };

  if (!loading && !items.length) {
    if (!emptyMessage) return null;
    return (
      <section className="py-2">
        <RailHeader title={title} subtitle={subtitle} seeAllHref={seeAllHref} />
        <p className="rounded-xl bg-navy/[0.03] px-4 py-6 text-sm ft-muted dark:bg-white/[0.03]">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="group/rail relative py-2" aria-label={title}>
      <RailHeader title={title} subtitle={subtitle} seeAllHref={seeAllHref} />

      <div className="relative">
        <RailArrow direction={-1} onClick={() => scroll(-1)} />
        <div ref={scroller} className="ft-rail ft-no-scrollbar">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="w-[16rem] shrink-0 snap-start sm:w-[19rem]">
                  <VideoCardSkeleton />
                </div>
              ))
            : items.map((video) => (
                <div key={video.id} className="w-[16rem] shrink-0 snap-start sm:w-[19rem]">
                  <VideoCard video={video} />
                </div>
              ))}
        </div>
        <RailArrow direction={1} onClick={() => scroll(1)} />
      </div>
    </section>
  );
}

function RailHeader({ title, subtitle, seeAllHref }: { title: string; subtitle?: string; seeAllHref?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm ft-muted">{subtitle}</p> : null}
      </div>
      {seeAllHref ? (
        <Link
          to={seeAllHref}
          className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-gold-deep transition hover:bg-gold/10 dark:text-gold-soft"
        >
          See all
        </Link>
      ) : null}
    </div>
  );
}

function RailArrow({ direction, onClick }: { direction: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === -1 ? 'Scroll left' : 'Scroll right'}
      className={cx(
        'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lift ring-1 ring-navy/10 transition',
        'opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100 hover:scale-105 md:flex',
        'dark:bg-navy-soft/95 dark:ring-white/10',
        direction === -1 ? '-left-3' : '-right-3',
      )}
    >
      <IconChevron className={cx('h-5 w-5', direction === -1 && 'rotate-180')} />
    </button>
  );
}

export function VideoGrid({
  items,
  loading,
  count = 12,
  className,
}: {
  items: VideoSummary[];
  loading?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
        className,
      )}
    >
      {loading
        ? Array.from({ length: count }).map((_, index) => <VideoCardSkeleton key={index} />)
        : items.map((video) => <VideoCard key={video.id} video={video} />)}
    </div>
  );
}
