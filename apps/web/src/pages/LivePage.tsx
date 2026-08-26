import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { formatCount, formatDate, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { PlaceholderArt } from '@/components/video/VideoCard';
import { Avatar, Badge, EmptyState, Card } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconLive } from '@/components/ui/Icons';

interface StreamSummary {
  id: string;
  title: string;
  description: string;
  categorySlug: string;
  thumbnailUrl: string | null;
  status: string;
  currentViewers: number;
  peakViewers: number;
  scheduledFor: string | null;
  startedAt: string | null;
  playbackUrl: string | null;
  channel: { id: string; name: string; handle: string; avatarUrl: string | null; subscriberCount: number };
}

export function LivePage() {
  const { features } = useConfig();
  const { data, isLoading } = useQuery({
    queryKey: ['live'],
    queryFn: () => api<{ live: StreamSummary[]; upcoming: StreamSummary[] }>('/live'),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Ministry"
        title="Live"
        description="Church services, prayer meetings, Bible studies and conferences, streamed as they happen."
      />

      {!features.liveStreaming ? (
        <Card className="mb-6 !bg-warn/8 ring-warn/20">
          <p className="text-sm">
            <span className="font-semibold">Streaming ingest is not configured on this deployment.</span> Creators can
            still schedule streams and run live chat, but no video can be received until an administrator sets{' '}
            <code className="rounded bg-navy/10 px-1 py-0.5 text-xs dark:bg-white/10">LIVE_INGEST_BASE</code> and{' '}
            <code className="rounded bg-navy/10 px-1 py-0.5 text-xs dark:bg-white/10">LIVE_PLAYBACK_BASE</code>.
          </p>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ft-skeleton aspect-video rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <span className="h-2 w-2 animate-pulse-soft rounded-full bg-danger" />
              Live now
            </h2>
            {data?.live.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.live.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconLive className="h-8 w-8" />}
                title="Nothing live at the moment"
                description="When a church or ministry goes live, it will appear here."
              />
            )}
          </section>

          {data?.upcoming.length ? (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold">Coming up</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.upcoming.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function StreamCard({ stream }: { stream: StreamSummary }) {
  return (
    <Link to={`/live/${stream.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy-soft">
        {stream.thumbnailUrl ? (
          <img src={stream.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <PlaceholderArt title={stream.title} categorySlug={stream.categorySlug} />
        )}
        {stream.status === 'LIVE' ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-danger px-2 py-0.5 text-[0.68rem] font-semibold uppercase text-white">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-white" /> Live
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-md bg-navy-deep/85 px-2 py-0.5 text-[0.68rem] font-medium text-cream">
            {stream.scheduledFor ? formatDate(stream.scheduledFor) : 'Scheduled'}
          </span>
        )}
      </div>
      <h3 className="mt-2.5 ft-line-clamp-2 font-medium leading-snug">{stream.title}</h3>
      <div className="mt-1.5 flex items-center gap-2">
        <Avatar src={stream.channel.avatarUrl} name={stream.channel.name} size={22} />
        <span className="truncate text-sm ft-muted">{stream.channel.name}</span>
      </div>
      {stream.status === 'LIVE' ? (
        <p className="mt-1 text-xs ft-muted">
          {formatCount(stream.currentViewers)} watching · started {timeAgo(stream.startedAt)}
        </p>
      ) : null}
    </Link>
  );
}

export function LiveStreamPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const [message, setMessage] = useState('');
  const since = useRef<string | undefined>(undefined);
  const [messages, setMessages] = useState<Array<{ id: string; body: string; createdAt: string; author: { displayName: string; avatarUrl: string | null } | null }>>([]);
  const chatEnd = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['live-stream', id],
    queryFn: () => api<{ stream: StreamSummary & { chatEnabled: boolean; isOwner: boolean } }>(`/live/${id}`),
    refetchInterval: 30_000,
  });

  const stream = data?.stream;

  // Chat is polled rather than socket-based, which keeps the deployment simple
  // and works behind any proxy. `since` makes each poll incremental.
  const { data: chat } = useQuery({
    queryKey: ['live-chat', id],
    queryFn: () => api<{ items: typeof messages; serverTime: string }>(`/live/${id}/chat`, { query: { since: since.current } }),
    enabled: Boolean(stream?.chatEnabled && stream.status === 'LIVE'),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!chat?.items.length) return;
    setMessages((current) => [...current, ...chat.items].slice(-200));
    since.current = chat.serverTime;
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const send = useMutation({
    mutationFn: (body: string) => api<{ posted: boolean; message?: string }>(`/live/${id}/chat`, { method: 'POST', body: { body } }),
    onSuccess: (result) => {
      setMessage('');
      if (!result.posted) push(result.message ?? 'That message was not posted.', 'warning');
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Message could not be sent.', 'error'),
  });

  if (!stream) return <div className="py-20 text-center text-sm ft-muted">Loading stream…</div>;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {stream.playbackUrl && stream.status === 'LIVE' ? (
            <video src={stream.playbackUrl} controls autoPlay playsInline className="h-full w-full" aria-label={stream.title} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <PlaceholderArt title={stream.title} categorySlug={stream.categorySlug} />
                <p className="absolute inset-0 flex items-center justify-center bg-navy-deep/70 px-6 text-sm text-cream/85">
                  {stream.status === 'SCHEDULED'
                    ? `This stream is scheduled for ${stream.scheduledFor ? formatDate(stream.scheduledFor) : 'later'}.`
                    : stream.status === 'ENDED'
                      ? 'This stream has ended.'
                      : 'No playback source is available for this stream on this deployment.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {stream.status === 'LIVE' ? <Badge tone="danger">Live</Badge> : <Badge tone="neutral">{stream.status}</Badge>}
            <Badge tone="neutral" className="capitalize">
              {stream.categorySlug.replace(/-/g, ' ')}
            </Badge>
          </div>
          <h1 className="mt-2 font-display text-xl font-semibold sm:text-2xl">{stream.title}</h1>
          <div className="mt-3 flex items-center gap-3">
            <Avatar src={stream.channel.avatarUrl} name={stream.channel.name} size={40} />
            <div>
              <Link to={`/channel/${stream.channel.handle}`} className="font-medium hover:underline">
                {stream.channel.name}
              </Link>
              <p className="text-xs ft-muted">
                {formatCount(stream.channel.subscriberCount)} subscribers
                {stream.status === 'LIVE' ? ` · ${formatCount(stream.currentViewers)} watching` : ''}
              </p>
            </div>
          </div>
          {stream.description ? (
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-navy/[0.04] p-4 text-sm leading-relaxed dark:bg-white/[0.04]">
              {stream.description}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="flex h-[36rem] flex-col overflow-hidden rounded-2xl ring-1 ring-navy/10 dark:ring-white/10">
        <h2 className="border-b border-navy/10 px-4 py-3 text-sm font-semibold dark:border-white/10">Live chat</h2>
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {messages.length ? (
            messages.map((entry) => (
              <div key={entry.id} className="flex gap-2 text-sm">
                <Avatar src={entry.author?.avatarUrl} name={entry.author?.displayName ?? '?'} size={22} />
                <p className="min-w-0">
                  <span className="font-medium">{entry.author?.displayName ?? 'Member'}</span>{' '}
                  <span className="ft-muted">{entry.body}</span>
                </p>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm ft-muted">
              {stream.status === 'LIVE' ? 'No messages yet — say hello.' : 'Chat opens when the stream goes live.'}
            </p>
          )}
          <div ref={chatEnd} />
        </div>

        {user && stream.chatEnabled && stream.status === 'LIVE' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (message.trim()) send.mutate(message.trim());
            }}
            className="flex gap-2 border-t border-navy/10 p-3 dark:border-white/10"
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              placeholder="Say something encouraging"
              aria-label="Live chat message"
              className="min-w-0 flex-1 rounded-full bg-navy/[0.05] px-3.5 py-2 text-sm focus:ring-2 focus:ring-gold dark:bg-white/[0.06]"
            />
            <Button type="submit" size="sm" loading={send.isPending}>
              Send
            </Button>
          </form>
        ) : (
          <p className="border-t border-navy/10 px-4 py-3 text-xs ft-muted dark:border-white/10">
            {user ? 'Chat is closed.' : 'Sign in to join the chat.'}
          </p>
        )}
      </aside>
    </div>
  );
}
