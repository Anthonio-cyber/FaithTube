import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCount, formatDuration } from '@/lib/format';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Select } from '@/components/ui';
import { BarList, LineChart, RetentionCurve, StatTile, type Point } from '@/components/ui/Charts';

interface Analytics {
  channel: { name: string; subscriberCount: number; videoCount: number; totalViews: number };
  windowDays: number;
  totals: {
    views: number;
    watchHours: number;
    likes: number;
    comments: number;
    newSubscribers: number;
    completionRate: number;
    averageVideoLengthSeconds: number;
    pendingReview: number;
    rejected: number;
  };
  series: { views: Point[]; watchMinutes: Point[]; likes: Point[]; subscribers: Point[]; comments: Point[] };
  topVideos: Array<{ id: string; slug: string; title: string; viewCount: number; likeCount: number; watchHours: number }>;
  trafficSources: Array<{ source: string; views: number }>;
  audienceRetention: Array<{ percent: number; retention: number }>;
}

export default function StudioAnalyticsPage() {
  const [days, setDays] = useState(28);

  const { data, isLoading } = useQuery({
    queryKey: ['studio-analytics', days],
    queryFn: () => api<Analytics>('/studio/analytics', { query: { days } }),
  });

  if (isLoading || !data) return <div className="py-20 text-center text-sm ft-muted">Loading analytics…</div>;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Creator Studio"
        title="Analytics"
        description={`How ${data.channel.name} is being watched over the last ${data.windowDays} days.`}
        action={
          <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} aria-label="Time range" className="!h-9 !w-auto !py-0 !text-sm">
            <option value="7">Last 7 days</option>
            <option value="28">Last 28 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </Select>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Views" value={formatCount(data.totals.views)} />
        <StatTile label="Watch time" value={`${formatCount(data.totals.watchHours)} hrs`} />
        <StatTile label="New subscribers" value={formatCount(data.totals.newSubscribers)} hint={`${formatCount(data.channel.subscriberCount)} total`} />
        <StatTile
          label="Completion rate"
          value={`${data.totals.completionRate}%`}
          hint="Sessions that reached the end"
          tone={data.totals.completionRate > 50 ? 'good' : 'neutral'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">Views per day</h2>
          <LineChart data={data.series.views} label="Views per day" colorIndex={0} />
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">Watch time per day</h2>
          <LineChart
            data={data.series.watchMinutes}
            label="Watch minutes per day"
            colorIndex={1}
            formatValue={(value) => `${formatCount(value)} min`}
          />
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">New subscribers</h2>
          <LineChart data={data.series.subscribers} label="New subscribers per day" colorIndex={2} />
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-base font-semibold">Where views come from</h2>
          <BarList items={data.trafficSources.map((source) => ({ label: source.source, value: source.views }))} formatValue={formatCount} />
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-display text-base font-semibold">Audience retention</h2>
          <p className="mb-3 text-sm ft-muted">
            The share of viewers still watching at each point through a video, averaged across your channel.
          </p>
          <RetentionCurve data={data.audienceRetention} />
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold">Your most-watched videos</h2>
          {data.topVideos.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/10 text-left text-xs uppercase tracking-wide ft-muted dark:border-white/10">
                    <th scope="col" className="pb-2 pr-4 font-medium">Video</th>
                    <th scope="col" className="pb-2 pr-4 text-right font-medium">Views</th>
                    <th scope="col" className="pb-2 pr-4 text-right font-medium">Likes</th>
                    <th scope="col" className="pb-2 text-right font-medium">Watch hours</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topVideos.map((video) => (
                    <tr key={video.id} className="border-b border-navy/5 last:border-0 dark:border-white/5">
                      <td className="py-2.5 pr-4">
                        <Link to={`/watch/${video.slug}`} className="hover:underline">
                          {video.title}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{formatCount(video.viewCount)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{formatCount(video.likeCount)}</td>
                      <td className="py-2.5 text-right tabular-nums">{formatCount(video.watchHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm ft-muted">No published videos yet.</p>
          )}
        </Card>
      </div>

      <Card className="mt-5 !bg-gold/[0.07] ring-gold/25">
        <h2 className="text-sm font-semibold">A note on these numbers</h2>
        <p className="mt-1.5 text-sm leading-relaxed ft-muted">
          Average video length across your channel is {formatDuration(data.totals.averageVideoLengthSeconds)}. FaithTube
          does not pay creators by view or subscriber count, so none of these figures unlock a payment. They are here to
          help you understand who you are reaching and what is actually being watched to the end.
        </p>
      </Card>
    </div>
  );
}
