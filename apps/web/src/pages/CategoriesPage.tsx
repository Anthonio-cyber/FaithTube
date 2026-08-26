import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CategoryDefinition, VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { VideoGrid } from '@/components/video/VideoRail';
import { EmptyState, Tabs } from '@/components/ui';

export function CategoriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Array<CategoryDefinition & { videoCount: number }> }>('/discover/categories'),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Discover"
        title="Browse by category"
        description="Everything on FaithTube is sorted by what it is for — teaching, worship, testimony, evangelism and more."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((category) => (
            <Link
              key={category.slug}
              to={`/categories/${category.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-dawn p-5 text-cream transition hover:shadow-lift"
            >
              <div className="absolute inset-0 bg-ray opacity-70" aria-hidden />
              <div className="relative">
                <h2 className="font-display text-lg font-semibold">{category.name}</h2>
                <p className="mt-1 text-sm text-cream/65">{category.blurb}</p>
                <p className="mt-4 text-xs text-gold-soft">
                  {formatCount(category.videoCount)} video{category.videoCount === 1 ? '' : 's'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') ?? 'trending';

  const { data, isLoading } = useQuery({
    queryKey: ['category', slug, sort],
    queryFn: () => api<{ category: CategoryDefinition; items: VideoSummary[] }>(`/discover/categories/${slug}`, { query: { sort } }),
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="Category"
        title={data?.category.name ?? slug.replace(/-/g, ' ')}
        description={data?.category.description}
      />

      <Tabs
        tabs={[
          { id: 'trending', label: 'Trending' },
          { id: 'newest', label: 'Newest' },
          { id: 'popular', label: 'Most watched' },
        ]}
        active={sort}
        onChange={(id) => setParams({ sort: id }, { replace: true })}
        className="mb-6"
      />

      {!isLoading && !data?.items.length ? (
        <EmptyState
          title="Nothing here yet"
          description="No approved videos in this category so far. Check back, or be the first to upload one."
        />
      ) : (
        <VideoGrid items={data?.items ?? []} loading={isLoading} />
      )}
    </div>
  );
}

export function TrendingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api<{ items: VideoSummary[] }>('/discover/trending', { query: { limit: 48 } }),
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="Discover"
        title="Christian Trending"
        description="Ranked by how quickly a video is being watched and shared right now, not by all-time view count."
      />
      <VideoGrid items={data?.items ?? []} loading={isLoading} />
    </div>
  );
}
