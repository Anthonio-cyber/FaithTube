import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ChannelSummary, VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard';
import { Avatar, Badge, EmptyState, Select } from '@/components/ui';
import { LinkButton } from '@/components/ui/Button';
import { IconBook, IconSearch } from '@/components/ui/Icons';
import { Link } from 'react-router-dom';

interface SearchResponse {
  videos: VideoSummary[];
  channels: ChannelSummary[];
  playlists: Array<{ id: string; title: string; itemCount: number; ownerName: string }>;
  scriptureReferences: string[];
  matchedCategories: string[];
  interpretedAs: string;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';

  const filters = {
    sort: params.get('sort') ?? 'relevance',
    duration: params.get('duration') ?? '',
    uploadedWithin: params.get('uploadedWithin') ?? '',
    categorySlug: params.get('categorySlug') ?? '',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, filters],
    queryFn: () => api<SearchResponse>('/search', { query: { q, ...filters } }),
    enabled: q.trim().length > 0,
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  if (!q.trim()) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <EmptyState
          icon={<IconSearch className="h-8 w-8" />}
          title="Search FaithTube"
          description="Look for a sermon, a channel, a topic, a speaker — or a passage like “Romans 8” or “Psalm 23”."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Search"
        title={`Results for “${q}”`}
        description={data?.interpretedAs !== q ? data?.interpretedAs : undefined}
      />

      {data?.scriptureReferences.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-gold/10 p-4 ring-1 ring-gold/25">
          <IconBook className="h-5 w-5 shrink-0 text-gold-deep dark:text-gold-soft" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">This looks like a Scripture reference.</span>{' '}
            <span className="ft-muted">
              Bible Search will show you the passage itself alongside teaching on it.
            </span>
          </p>
          <LinkButton to={`/bible?q=${encodeURIComponent(q)}`} variant="gold" size="sm">
            Open Bible Search
          </LinkButton>
        </div>
      ) : null}

      <div className="ft-no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        <Select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value)} aria-label="Sort by" className="!h-9 !w-auto !py-0 !text-xs">
          <option value="relevance">Most relevant</option>
          <option value="newest">Newest</option>
          <option value="views">Most watched</option>
          <option value="duration">Longest</option>
        </Select>
        <Select value={filters.duration} onChange={(event) => setFilter('duration', event.target.value)} aria-label="Length" className="!h-9 !w-auto !py-0 !text-xs">
          <option value="">Any length</option>
          <option value="short">Under 4 minutes</option>
          <option value="medium">4–20 minutes</option>
          <option value="long">Over 20 minutes</option>
        </Select>
        <Select value={filters.uploadedWithin} onChange={(event) => setFilter('uploadedWithin', event.target.value)} aria-label="Upload date" className="!h-9 !w-auto !py-0 !text-xs">
          <option value="">Any time</option>
          <option value="day">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </Select>
      </div>

      {data?.channels.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Channels</h2>
          <div className="space-y-2">
            {data.channels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channel/${channel.handle}`}
                className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-navy/[0.04] dark:hover:bg-white/5"
              >
                <Avatar src={channel.avatarUrl} name={channel.name} size={56} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {channel.name}
                    {channel.verifiedChristianCreator ? <Badge tone="verified">Verified</Badge> : null}
                  </p>
                  <p className="text-sm ft-muted">
                    @{channel.handle} · {formatCount(channel.subscriberCount)} subscribers
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        {isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <VideoCardSkeleton key={index} layout="compact" />
            ))}
          </div>
        ) : data?.videos.length ? (
          <div className="space-y-3">
            {data.videos.map((video) => (
              <VideoCard key={video.id} video={video} layout="row" />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing matched that search"
            description="Try a different wording, a Bible passage, or browse the categories to see what is here."
            action={
              <LinkButton to="/categories" variant="outline" size="sm">
                Browse categories
              </LinkButton>
            }
          />
        )}
      </section>

      {data?.playlists.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-semibold">Playlists</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.playlists.map((playlist) => (
              <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="ft-card p-4 transition hover:shadow-lift">
                <p className="font-medium">{playlist.title}</p>
                <p className="mt-1 text-sm ft-muted">
                  {playlist.itemCount} video{playlist.itemCount === 1 ? '' : 's'} · {playlist.ownerName}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
