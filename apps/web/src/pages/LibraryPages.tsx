import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoSummary } from '@faithtube/shared';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { VideoCard } from '@/components/video/VideoCard';
import { VideoGrid } from '@/components/video/VideoRail';
import { Avatar, Card, EmptyState, Field, Input, Modal, Select, Tabs, Textarea } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import { IconDownload, IconLibrary, IconSave, IconTrash } from '@/components/ui/Icons';

function SignInPrompt({ what }: { what: string }) {
  return (
    <div className="py-16">
      <EmptyState
        title="Sign in to continue"
        description={`Your ${what} is tied to your account. Sign in to see it here.`}
        action={
          <LinkButton to="/signin" variant="gold">
            Sign in
          </LinkButton>
        }
      />
    </div>
  );
}

export function LibraryPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'continue';

  const { data: continueWatching, isLoading: loadingContinue } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => api<{ items: Array<VideoSummary & { percentComplete: number }> }>('/library/continue-watching'),
    enabled: Boolean(user) && tab === 'continue',
  });

  const { data: saved, isLoading: loadingSaved } = useQuery({
    queryKey: ['saved'],
    queryFn: () => api<{ items: VideoSummary[] }>('/library/saved'),
    enabled: Boolean(user) && tab === 'saved',
  });

  const { data: liked, isLoading: loadingLiked } = useQuery({
    queryKey: ['liked'],
    queryFn: () => api<{ items: VideoSummary[] }>('/users/me/liked'),
    enabled: Boolean(user) && tab === 'liked',
  });

  if (!user) return <SignInPrompt what="library" />;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader eyebrow="Library" title="Your library" description="Everything you have kept, liked or started watching." />

      <Tabs
        tabs={[
          { id: 'continue', label: 'Continue watching' },
          { id: 'saved', label: 'Saved' },
          { id: 'liked', label: 'Liked' },
          { id: 'downloads', label: 'Downloads' },
        ]}
        active={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        className="mb-6"
      />

      {tab === 'continue' ? (
        continueWatching?.items.length || loadingContinue ? (
          <VideoGrid items={continueWatching?.items ?? []} loading={loadingContinue} />
        ) : (
          <EmptyState title="Nothing in progress" description="Videos you start but do not finish will wait for you here." />
        )
      ) : null}

      {tab === 'saved' ? (
        saved?.items.length || loadingSaved ? (
          <VideoGrid items={saved?.items ?? []} loading={loadingSaved} />
        ) : (
          <EmptyState
            icon={<IconSave className="h-8 w-8" />}
            title="Nothing saved yet"
            description="Tap Save on any video to keep it here for later."
          />
        )
      ) : null}

      {tab === 'liked' ? (
        liked?.items.length || loadingLiked ? (
          <VideoGrid items={liked?.items ?? []} loading={loadingLiked} />
        ) : (
          <EmptyState title="No liked videos" description="Videos you like will collect here." />
        )
      ) : null}

      {tab === 'downloads' ? (
        <EmptyState
          icon={<IconDownload className="h-8 w-8" />}
          title="Downloads live on your device"
          description="Offline viewing is a Premium feature of the FaithTube mobile app. Downloaded videos are stored on your phone or tablet, so they do not appear in the web library."
          action={
            <LinkButton to="/premium" variant="gold" size="sm">
              About Premium
            </LinkButton>
          }
        />
      ) : null}
    </div>
  );
}

export function HistoryPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () =>
      api<{ items: Array<VideoSummary & { lastWatchedAt: string; percentComplete?: number }> }>('/library/history', {
        query: { limit: 60 },
      }),
    enabled: Boolean(user),
  });

  const removeOne = useMutation({
    mutationFn: (videoId: string) => api(`/library/history/${videoId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] }),
  });

  const clearAll = useMutation({
    mutationFn: () => api<{ removed: number }>('/library/history', { method: 'DELETE' }),
    onSuccess: (result) => {
      push(`Cleared ${result.removed} entries from your history.`, 'success');
      setConfirmClear(false);
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });

  if (!user) return <SignInPrompt what="watch history" />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Watch"
        title="Watch history"
        description="Your history shapes what FaithTube recommends. You can remove any of it at any time."
        action={
          data?.items.length ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
              Clear all history
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="space-y-2">
          {data.items.map((item) => (
            <div key={item.id} className="group relative">
              <VideoCard video={item} layout="compact" />
              <button
                type="button"
                onClick={() => removeOne.mutate(item.id)}
                aria-label={`Remove "${item.title}" from history`}
                className="absolute right-2 top-2 rounded-full p-2 text-navy/40 opacity-0 transition hover:bg-navy/10 hover:text-navy group-hover:opacity-100 focus:opacity-100 dark:text-cream/40 dark:hover:bg-white/10"
              >
                <IconTrash className="h-4 w-4" />
              </button>
              <p className="pl-[10.5rem] text-xs ft-muted">Watched {timeAgo(item.lastWatchedAt)}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Your history is empty" description="Videos you watch will be listed here." />
      )}

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear your watch history?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={clearAll.isPending} onClick={() => clearAll.mutate()}>
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm ft-muted">
          This removes every entry permanently. Your recommendations will reset, and Continue Watching will be empty.
        </p>
      </Modal>
    </div>
  );
}

export function PlaylistsPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE');

  const { data, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () =>
      api<{ items: Array<{ id: string; title: string; description: string; visibility: string; itemCount: number; systemKey: string | null }> }>(
        '/library/playlists',
      ),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: () => api('/library/playlists', { method: 'POST', body: { title, description, visibility } }),
    onSuccess: () => {
      push('Playlist created.', 'success');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });

  if (!user) return <SignInPrompt what="playlists" />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Library"
        title="Playlists"
        description="Group teaching into collections — a devotional series, a Bible study plan, or a Sunday sermon archive."
        action={
          <Button variant="gold" onClick={() => setCreateOpen(true)}>
            New playlist
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((playlist) => (
            <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="ft-card p-5 transition hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium">{playlist.title}</h2>
                <span className="shrink-0 rounded-full bg-navy/[0.06] px-2 py-0.5 text-[0.65rem] uppercase tracking-wide ft-muted dark:bg-white/10">
                  {playlist.visibility.toLowerCase()}
                </span>
              </div>
              <p className="mt-1 text-sm ft-muted">{playlist.itemCount} videos</p>
              {playlist.description ? <p className="mt-2 ft-line-clamp-2 text-sm ft-muted">{playlist.description}</p> : null}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<IconLibrary className="h-8 w-8" />}
          title="No playlists yet"
          description="Build a collection — Morning Devotion, Sunday Sermons, Bible Study — and add videos as you find them."
          action={
            <Button variant="gold" size="sm" onClick={() => setCreateOpen(true)}>
              Create your first playlist
            </Button>
          }
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New playlist"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" loading={create.isPending} disabled={title.trim().length < 1} onClick={() => create.mutate()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" id="pl-title" required>
            <Input id="pl-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Morning Devotion" maxLength={100} />
          </Field>
          <Field label="Description" id="pl-desc" hint="Optional — helps others understand the collection if you share it.">
            <Textarea id="pl-desc" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} />
          </Field>
          <Field label="Who can see this?" id="pl-vis">
            <Select id="pl-vis" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="PRIVATE">Private — only you</option>
              <option value="UNLISTED">Unlisted — anyone with the link</option>
              <option value="PUBLIC">Public — listed on your profile</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export function PlaylistDetailPage() {
  const { id = '' } = useParams();
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () =>
      api<{
        playlist: { id: string; title: string; description: string; visibility: string; itemCount: number; owner: { displayName: string }; isOwner: boolean };
        items: VideoSummary[];
      }>(`/library/playlists/${id}`),
  });

  const removeVideo = useMutation({
    mutationFn: (videoId: string) => api(`/library/playlists/${id}/videos/${videoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      push('Removed from playlist.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });

  if (isLoading) return <div className="py-20 text-center text-sm ft-muted">Loading playlist…</div>;
  if (!data) return <EmptyState title="Playlist not found" description="It may be private, or it may have been deleted." />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={`Playlist · ${data.playlist.visibility.toLowerCase()}`}
        title={data.playlist.title}
        description={data.playlist.description || `${data.playlist.itemCount} videos · by ${data.playlist.owner.displayName}`}
      />

      {data.items.length ? (
        <ol className="space-y-2">
          {data.items.map((video, index) => (
            <li key={video.id} className="group relative flex items-start gap-3">
              <span className="w-6 shrink-0 pt-6 text-center text-sm tabular-nums ft-muted">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <VideoCard video={video} layout="compact" />
              </div>
              {data.playlist.isOwner ? (
                <button
                  type="button"
                  onClick={() => removeVideo.mutate(video.id)}
                  aria-label={`Remove "${video.title}" from this playlist`}
                  className="mt-6 rounded-full p-2 text-navy/40 opacity-0 transition hover:bg-navy/10 group-hover:opacity-100 focus:opacity-100 dark:text-cream/40"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="This playlist is empty" description="Add videos using the Playlist button on any watch page." />
      )}
    </div>
  );
}

export function SubscriptionsPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions-feed'],
    queryFn: () =>
      api<{ items: VideoSummary[]; channels: Array<{ id: string; name: string; handle: string; avatarUrl: string | null }> }>(
        '/discover/subscriptions-feed',
      ),
    enabled: Boolean(user),
  });

  if (!user) return <SignInPrompt what="subscriptions" />;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader eyebrow="Connect" title="Subscriptions" description="The latest from every channel you follow." />

      {data?.channels.length ? (
        <div className="ft-rail ft-no-scrollbar mb-7">
          {data.channels.map((channel) => (
            <Link key={channel.id} to={`/channel/${channel.handle}`} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
              <Avatar src={channel.avatarUrl} name={channel.name} size={56} />
              <span className="line-clamp-2 text-[0.7rem] leading-tight ft-muted">{channel.name}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {data?.items.length || isLoading ? (
        <VideoGrid items={data?.items ?? []} loading={isLoading} />
      ) : (
        <EmptyState
          title="You are not following anyone yet"
          description="Subscribe to a channel and its new videos will land here."
          action={
            <LinkButton to="/categories" variant="gold" size="sm">
              Find channels
            </LinkButton>
          }
        />
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api<{
        items: Array<{ id: string; type: string; title: string; body: string; linkUrl: string | null; read: boolean; createdAt: string }>;
        unreadCount: number;
      }>('/notifications', { query: { limit: 50 } }),
    enabled: Boolean(user),
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api('/notifications/read', { method: 'POST', body: { ids } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-badge'] });
    },
  });

  if (!user) return <SignInPrompt what="notifications" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Connect"
        title="Notifications"
        description={data?.unreadCount ? `${data.unreadCount} unread` : 'You are all caught up.'}
        action={
          data?.unreadCount ? (
            <Button variant="outline" size="sm" onClick={() => markRead.mutate(undefined)}>
              Mark all as read
            </Button>
          ) : (
            <LinkButton to="/settings/notifications" variant="ghost" size="sm">
              Preferences
            </LinkButton>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <ul className="space-y-2">
          {data.items.map((notification) => {
            const Body = (
              <div className={`flex gap-3 rounded-xl p-4 transition ${notification.read ? '' : 'bg-gold/[0.07] ring-1 ring-gold/20'}`}>
                <span className="mt-1 shrink-0">
                  <NotificationGlyph type={notification.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{notification.title}</p>
                  {notification.body ? <p className="mt-0.5 text-sm ft-muted">{notification.body}</p> : null}
                  <p className="mt-1 text-xs ft-muted">{timeAgo(notification.createdAt)}</p>
                </div>
                {!notification.read ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" aria-label="Unread" /> : null}
              </div>
            );
            return (
              <li key={notification.id}>
                {notification.linkUrl ? (
                  <Link to={notification.linkUrl} onClick={() => !notification.read && markRead.mutate([notification.id])} className="block hover:opacity-90">
                    {Body}
                  </Link>
                ) : (
                  Body
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No notifications" description="Uploads from channels you follow, replies and review updates appear here." />
      )}
    </div>
  );
}

function NotificationGlyph({ type }: { type: string }) {
  const colours: Record<string, string> = {
    MODERATION: 'bg-verified/15 text-verified',
    PREMIUM: 'bg-gold/15 text-gold-deep',
    NEW_UPLOAD: 'bg-navy/10 text-navy dark:bg-white/10 dark:text-cream',
    LIVE: 'bg-danger/15 text-danger',
  };
  const labels: Record<string, string> = {
    MODERATION: '✓',
    PREMIUM: '★',
    NEW_UPLOAD: '▸',
    NEW_SUBSCRIBER: '+',
    COMMENT: '💬',
    REPLY: '↩',
    LIVE: '●',
    ANNOUNCEMENT: 'i',
  };
  return (
    <span
      aria-hidden
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${colours[type] ?? 'bg-navy/10 text-navy dark:bg-white/10 dark:text-cream'}`}
    >
      {labels[type] ?? '•'}
    </span>
  );
}

export { formatCount, Card };
