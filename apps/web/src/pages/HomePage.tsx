import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CategoryDefinition, VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { formatCount, formatDuration, timeAgo } from '@/lib/format';
import { VideoRail } from '@/components/video/VideoRail';
import { VideoCard, PlaceholderArt } from '@/components/video/VideoCard';
import { VerifiedBadge } from '@/components/video/VerifiedBadge';
import { RayBackdrop } from '@/components/brand/Logo';
import { LinkButton } from '@/components/ui/Button';
import { Avatar, Badge, Skeleton } from '@/components/ui';
import { IconLive, IconShield, IconSparkle } from '@/components/ui/Icons';

interface HomeResponse {
  hero: { video: VideoSummary; title: string | null; subtitle: string | null; curated: boolean } | null;
  continueWatching: Array<VideoSummary & { percentComplete: number; progressSeconds: number }>;
  recommended: VideoSummary[];
  trending: VideoSummary[];
  recent: VideoSummary[];
  liveNow: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    categorySlug: string;
    currentViewers: number;
    startedAt: string | null;
    channel: { id: string; name: string; handle: string; avatarUrl: string | null };
  }>;
  rails: Array<{ category: CategoryDefinition; items: VideoSummary[] }>;
}

export default function HomePage() {
  const { user } = useAuth();
  const { brand } = useConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['home', user?.id ?? 'anon'],
    queryFn: () => api<HomeResponse>('/discover/home'),
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-8">
      {isLoading ? <HeroSkeleton /> : data?.hero ? <Hero hero={data.hero} /> : <WelcomeBanner />}

      {!user ? <ValueStrip /> : null}

      {data?.liveNow?.length ? <LiveStrip streams={data.liveNow} /> : null}

      {user ? (
        <VideoRail
          title="Continue Watching"
          subtitle="Pick up where you left off"
          items={data?.continueWatching ?? []}
          loading={isLoading}
        />
      ) : null}

      <VideoRail
        title={user ? 'Recommended For You' : 'Start Here'}
        subtitle={
          user
            ? 'Chosen from what you watch, follow and search — and only from videos that passed review'
            : 'Teaching, worship and testimony from across the FaithTube community'
        }
        items={data?.recommended ?? []}
        loading={isLoading}
      />

      <VideoRail
        title="Christian Trending"
        subtitle="What the community is watching this week"
        items={data?.trending ?? []}
        seeAllHref="/trending"
        loading={isLoading}
      />

      {data?.rails.map((rail) => (
        <VideoRail
          key={rail.category.slug}
          title={rail.category.name}
          subtitle={rail.category.blurb}
          items={rail.items}
          seeAllHref={`/categories/${rail.category.slug}`}
        />
      ))}

      <VideoRail
        title="Recently Uploaded"
        subtitle="The newest approved videos on FaithTube"
        items={data?.recent ?? []}
        loading={isLoading}
      />

      <section className="rounded-3xl bg-navy px-6 py-10 text-cream sm:px-10 dark:bg-white/[0.04]">
        <div className="mx-auto max-w-2xl text-center">
          <IconShield className="mx-auto h-8 w-8 text-gold" />
          <h2 className="mt-3 font-display text-2xl font-semibold">Every video here has been reviewed</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-cream/75">
            {brand.name} is not a general video site with a Christian section. Every upload passes a content review before
            anyone can watch it, and a person — not only a classifier — has the final say.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <LinkButton to="/content-policy" variant="gold" size="sm">
              Read the Content Policy
            </LinkButton>
            <LinkButton to="/about" variant="outline" size="sm" className="!text-cream !ring-white/25 hover:!bg-white/10">
              How review works
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}

function Hero({ hero }: { hero: NonNullable<HomeResponse['hero']> }) {
  const { video, title, subtitle } = hero;
  return (
    <section className="relative overflow-hidden rounded-3xl bg-dawn text-cream" aria-label="Featured video">
      <RayBackdrop className="text-gold" />
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:p-10">
        <div className="order-2 lg:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">{title ?? 'Featured'}</Badge>
            <Badge tone="neutral" className="!bg-white/10 !text-cream/80">
              {video.categorySlug.replace(/-/g, ' ')}
            </Badge>
            <VerifiedBadge verified={video.christianContentVerified} size="sm" />
          </div>

          <h1 className="mt-3.5 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-[2.4rem]">
            {video.title}
          </h1>

          <p className="mt-3 ft-line-clamp-3 max-w-xl text-sm leading-relaxed text-cream/75">
            {subtitle ?? video.description}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Avatar src={video.channel.avatarUrl} name={video.channel.name} size={38} />
            <div className="min-w-0">
              <Link to={`/channel/${video.channel.handle}`} className="block truncate text-sm font-medium hover:underline">
                {video.channel.name}
              </Link>
              <p className="text-xs text-cream/55">
                {formatCount(video.channel.subscriberCount)} subscribers · {formatDuration(video.durationSeconds)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton to={`/watch/${video.slug}`} variant="gold" size="lg">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M7 4.5 19.5 12 7 19.5Z" />
              </svg>
              Watch now
            </LinkButton>
            <LinkButton
              to={`/channel/${video.channel.handle}`}
              variant="outline"
              size="lg"
              className="!text-cream !ring-white/25 hover:!bg-white/10"
            >
              Visit channel
            </LinkButton>
          </div>
        </div>

        <Link to={`/watch/${video.slug}`} className="group order-1 block lg:order-2">
          <div className="relative aspect-video overflow-hidden rounded-2xl shadow-lift ring-1 ring-white/10">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <PlaceholderArt title={video.title} categorySlug={video.categorySlug} />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-navy-deep/20 transition group-hover:bg-navy-deep/10">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gilt shadow-glow transition group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 text-navy" fill="currentColor" aria-hidden>
                  <path d="M7 4.5 19.5 12 7 19.5Z" />
                </svg>
              </span>
            </div>
            <span className="absolute bottom-3 right-3 rounded-md bg-navy-deep/85 px-2 py-0.5 text-xs font-medium tabular-nums">
              {formatDuration(video.durationSeconds)}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

function WelcomeBanner() {
  const { brand } = useConfig();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-dawn px-6 py-14 text-center text-cream sm:px-10">
      <RayBackdrop className="text-gold" />
      <div className="relative mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{brand.motto}</h1>
        <p className="mt-3 text-sm leading-relaxed text-cream/75">{brand.description}</p>
        <p className="mt-5 text-sm text-cream/60">
          There are no approved videos to show yet. Once creators upload and their videos pass review, they will appear here.
        </p>
        <LinkButton to="/upload" variant="gold" size="lg" className="mt-6">
          Upload the first video
        </LinkButton>
      </div>
    </section>
  );
}

function ValueStrip() {
  const items = [
    {
      icon: <IconShield className="h-5 w-5" />,
      title: 'Reviewed before it airs',
      body: 'No upload reaches a feed until it has passed a Christ-centred content review.',
    },
    {
      icon: <IconSparkle className="h-5 w-5" />,
      title: 'Built for teaching',
      body: 'Chapters, transcripts and Scripture references on every sermon and study.',
    },
    {
      icon: <IconLive className="h-5 w-5" />,
      title: 'Your church, live',
      body: 'Stream services, prayer meetings and conferences to your congregation.',
    },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="ft-card flex gap-3.5 p-4">
          <span className="mt-0.5 shrink-0 text-gold">{item.icon}</span>
          <div>
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <p className="mt-1 text-xs leading-relaxed ft-muted">{item.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function LiveStrip({ streams }: { streams: HomeResponse['liveNow'] }) {
  return (
    <section aria-label="Live now">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-2 w-2 animate-pulse-soft rounded-full bg-danger" />
        <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Live now</h2>
        <Link to="/live" className="ml-auto text-sm font-medium text-gold-deep hover:underline dark:text-gold-soft">
          All live
        </Link>
      </div>
      <div className="ft-rail ft-no-scrollbar">
        {streams.map((stream) => (
          <Link
            key={stream.id}
            to={`/live/${stream.id}`}
            className="group w-[16rem] shrink-0 snap-start sm:w-[19rem]"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-navy-soft">
              {stream.thumbnailUrl ? (
                <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <PlaceholderArt title={stream.title} categorySlug={stream.categorySlug} />
              )}
              <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-white">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" />
                Live
              </span>
              <span className="absolute bottom-2 right-2 rounded-md bg-navy-deep/85 px-1.5 py-0.5 text-[0.7rem] text-cream">
                {formatCount(stream.currentViewers)} watching
              </span>
            </div>
            <h3 className="mt-2 ft-line-clamp-2 text-sm font-medium leading-snug">{stream.title}</h3>
            <p className="mt-0.5 truncate text-xs ft-muted">
              {stream.channel.name} · started {timeAgo(stream.startedAt)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroSkeleton() {
  return (
    <div className="grid gap-6 rounded-3xl bg-navy/[0.03] p-6 lg:grid-cols-[1.1fr_1fr] lg:p-10 dark:bg-white/[0.03]">
      <div className="space-y-3">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
      <Skeleton className="aspect-video w-full rounded-2xl" />
    </div>
  );
}

export { VideoCard };
