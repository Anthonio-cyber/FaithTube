import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { formatCount, formatDate, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { VideoGrid } from '@/components/video/VideoRail';
import { VideoCard } from '@/components/video/VideoCard';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { Avatar, Badge, Card, EmptyState, Tabs } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconFlag } from '@/components/ui/Icons';

interface ChannelResponse {
  channel: {
    id: string;
    handle: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    subscriberCount: number;
    videoCount: number;
    totalViews: number;
    verifiedChristianCreator: boolean;
    location: string | null;
    websiteUrl: string | null;
    ministryAffiliation: string | null;
    createdAt: string;
    owner: { displayName: string; username: string };
    isOwner: boolean;
  };
  featuredVideo: VideoSummary | null;
  subscribed: boolean;
}

export default function ChannelPage() {
  const { handle = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'videos';
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['channel', handle],
    queryFn: () => api<ChannelResponse>(`/channels/${handle}`),
  });

  const { data: videos } = useQuery({
    queryKey: ['channel-videos', handle, tab],
    queryFn: () => api<{ items: VideoSummary[] }>(`/channels/${handle}/videos`, { query: { tab } }),
    enabled: ['videos', 'clips', 'live'].includes(tab),
  });

  const { data: playlists } = useQuery({
    queryKey: ['channel-playlists', handle],
    queryFn: () => api<{ items: Array<{ id: string; title: string; itemCount: number; description: string }> }>(`/channels/${handle}/playlists`),
    enabled: tab === 'playlists',
  });

  const { data: community } = useQuery({
    queryKey: ['channel-community', handle],
    queryFn: () =>
      api<{ items: Array<{ id: string; type: string; body: string; scriptureRef: string | null; likeCount: number; createdAt: string; poll: { options: Array<{ id: string; label: string; votes: number; percent: number }>; totalVotes: number; myVote: string | null } | null }> }>(
        `/community/${handle}`,
      ),
    enabled: tab === 'community',
  });

  const subscribe = useMutation({
    mutationFn: () => api<{ subscribed: boolean }>(`/channels/${data!.channel.id}/subscribe`, { method: 'POST' }),
    onSuccess: (result) => {
      push(result.subscribed ? 'Subscribed.' : 'Unsubscribed.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['channel', handle] });
    },
    onError: () => push('Sign in to subscribe.', 'warning'),
  });

  const vote = useMutation({
    mutationFn: ({ postId, optionId }: { postId: string; optionId: string }) =>
      api(`/community/${postId}/vote`, { method: 'POST', body: { optionId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channel-community', handle] }),
    onError: () => push('Sign in to vote.', 'warning'),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1600px]">
        <div className="ft-skeleton h-40 w-full rounded-2xl sm:h-56" />
        <div className="mt-4 flex gap-4">
          <div className="ft-skeleton h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3 pt-3">
            <div className="ft-skeleton h-6 w-56" />
            <div className="ft-skeleton h-4 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Channel not found</h1>
        <p className="mt-2 text-sm ft-muted">This channel may have been removed or suspended.</p>
      </div>
    );
  }

  const { channel, featuredVideo, subscribed } = data;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="relative h-32 overflow-hidden rounded-2xl bg-dawn sm:h-48 lg:h-56">
        {channel.bannerUrl ? (
          <img src={channel.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-ray" aria-hidden />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <Avatar src={channel.avatarUrl} name={channel.name} size={96} className="ring-4 ring-cream dark:ring-navy-deep" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            {channel.name}
            {channel.verifiedChristianCreator ? <Badge tone="verified">Verified Christian creator</Badge> : null}
          </h1>
          <p className="mt-1 text-sm ft-muted">
            @{channel.handle} · {formatCount(channel.subscriberCount)} subscribers · {formatCount(channel.videoCount)} videos
          </p>
          {channel.description ? <p className="mt-1.5 ft-line-clamp-2 max-w-2xl text-sm ft-muted">{channel.description}</p> : null}
        </div>

        <div className="flex shrink-0 gap-2">
          {channel.isOwner ? (
            <Button variant="secondary" onClick={() => (window.location.href = '/studio')}>
              Manage channel
            </Button>
          ) : (
            <Button variant={subscribed ? 'secondary' : 'primary'} loading={subscribe.isPending} onClick={() => subscribe.mutate()}>
              {subscribed ? 'Subscribed' : 'Subscribe'}
            </Button>
          )}
          <Button
            variant="ghost"
            aria-label="Report this channel"
            onClick={() => (user ? setReportOpen(true) : push('Sign in to report.', 'warning'))}
          >
            <IconFlag className="h-[1.1rem] w-[1.1rem]" />
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'videos', label: 'Videos' },
          { id: 'clips', label: 'Faith Clips' },
          { id: 'playlists', label: 'Playlists' },
          { id: 'community', label: 'Community' },
          { id: 'about', label: 'About' },
        ]}
        active={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        className="mt-6"
      />

      <div className="py-6">
        {tab === 'videos' ? (
          <>
            {featuredVideo ? (
              <section className="mb-8">
                <h2 className="mb-3 font-display text-lg font-semibold">Featured</h2>
                <VideoCard video={featuredVideo} layout="row" showChannel={false} />
              </section>
            ) : null}
            {videos?.items.length ? (
              <VideoGrid items={videos.items} />
            ) : (
              <EmptyState title="No videos yet" description="This channel has not published anything that has passed review." />
            )}
          </>
        ) : null}

        {tab === 'clips' ? (
          videos?.items.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {videos.items.map((clip) => (
                <Link key={clip.id} to={`/watch/${clip.slug}`} className="group">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-navy-soft">
                    {clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <p className="mt-2 ft-line-clamp-2 text-sm">{clip.title}</p>
                  <p className="text-xs ft-muted">{formatCount(clip.viewCount)} views</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No clips yet" description="Short vertical videos from this channel will appear here." />
          )
        ) : null}

        {tab === 'playlists' ? (
          playlists?.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.items.map((playlist) => (
                <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="ft-card p-5 transition hover:shadow-lift">
                  <h3 className="font-medium">{playlist.title}</h3>
                  <p className="mt-1 text-sm ft-muted">{playlist.itemCount} videos</p>
                  {playlist.description ? <p className="mt-2 ft-line-clamp-2 text-sm ft-muted">{playlist.description}</p> : null}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No public playlists" description="This creator has not shared any playlists yet." />
          )
        ) : null}

        {tab === 'community' ? (
          community?.items.length ? (
            <div className="mx-auto max-w-2xl space-y-4">
              {community.items.map((post) => (
                <Card key={post.id}>
                  <div className="flex items-center gap-2.5">
                    <Avatar src={channel.avatarUrl} name={channel.name} size={34} />
                    <div>
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className="text-xs ft-muted">{timeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                  {post.scriptureRef ? (
                    <p className="mt-3 text-sm font-medium text-gold-deep dark:text-gold-soft">{post.scriptureRef}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>

                  {post.poll ? (
                    <div className="mt-4 space-y-2">
                      {post.poll.options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => vote.mutate({ postId: post.id, optionId: option.id })}
                          className="relative w-full overflow-hidden rounded-xl bg-navy/[0.05] px-3.5 py-2.5 text-left text-sm transition hover:bg-navy/[0.1] dark:bg-white/[0.06]"
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-gold/25 transition-[width]"
                            style={{ width: `${option.percent}%` }}
                            aria-hidden
                          />
                          <span className="relative flex justify-between">
                            <span className={post.poll?.myVote === option.id ? 'font-semibold' : ''}>{option.label}</span>
                            <span className="tabular-nums ft-muted">{option.percent}%</span>
                          </span>
                        </button>
                      ))}
                      <p className="text-xs ft-muted">{post.poll.totalVotes} votes</p>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No community posts" description="Updates, questions and verses from this creator will appear here." />
          )
        ) : null}

        {tab === 'about' ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Card>
              <h2 className="font-display text-lg font-semibold">About this channel</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {channel.description || 'This creator has not written a description yet.'}
              </p>
            </Card>
            <Card>
              <dl className="space-y-3 text-sm">
                <Row label="Joined" value={formatDate(channel.createdAt)} />
                <Row label="Total views" value={formatCount(channel.totalViews)} />
                <Row label="Subscribers" value={formatCount(channel.subscriberCount)} />
                {channel.location ? <Row label="Location" value={channel.location} /> : null}
                {channel.ministryAffiliation ? <Row label="Ministry" value={channel.ministryAffiliation} /> : null}
                {channel.websiteUrl ? (
                  <Row
                    label="Website"
                    value={
                      <a href={channel.websiteUrl} rel="noreferrer noopener nofollow" target="_blank" className="text-gold-deep underline dark:text-gold-soft">
                        {channel.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    }
                  />
                ) : null}
              </dl>
            </Card>
          </div>
        ) : null}
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="CHANNEL" targetId={channel.id} targetLabel={channel.name} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="ft-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
