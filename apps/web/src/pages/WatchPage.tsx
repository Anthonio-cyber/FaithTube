import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoDetail, VideoSummary } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { cx, formatCount, formatDate, formatDuration, timeAgo } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { VideoCard } from '@/components/video/VideoCard';
import { AgeRestrictedNotice, VerifiedBadge } from '@/components/video/VerifiedBadge';
import { CommentSection } from '@/components/video/CommentSection';
import { ReportDialog } from '@/components/moderation/ReportDialog';
import { Avatar, Badge, Modal, Skeleton, Tabs } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconComment, IconFlag, IconLike, IconDislike, IconSave, IconShare } from '@/components/ui/Icons';

export default function WatchPage() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sideTab, setSideTab] = useState('related');
  const acknowledgedRef = useRef(false);
  const [ageAcknowledged, setAgeAcknowledged] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['video', slug],
    queryFn: () => api<{ video: VideoDetail }>(`/videos/${slug}`),
    retry: false,
  });

  const video = data?.video;

  const { data: related } = useQuery({
    queryKey: ['related', video?.id],
    queryFn: () => api<{ items: VideoSummary[] }>(`/videos/${video!.id}/related`),
    enabled: Boolean(video?.id),
  });

  const like = useMutation({
    mutationFn: (value: 1 | -1 | 0) => api<{ likeCount: number }>(`/videos/${video!.id}/like`, { method: 'POST', body: { value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video', slug] }),
    onError: () => push('Sign in to react to videos.', 'warning'),
  });

  const save = useMutation({
    mutationFn: () => api<{ saved: boolean }>(`/videos/${video!.id}/save`, { method: 'POST' }),
    onSuccess: (result) => {
      push(result.saved ? 'Saved to your library.' : 'Removed from your library.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['video', slug] });
    },
    onError: () => push('Sign in to save videos.', 'warning'),
  });

  const subscribe = useMutation({
    mutationFn: () => api<{ subscribed: boolean }>(`/channels/${video!.channel.id}/subscribe`, { method: 'POST' }),
    onSuccess: (result) => {
      push(result.subscribed ? `Subscribed to ${video?.channel.name}.` : 'Unsubscribed.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['video', slug] });
    },
    onError: () => push('Sign in to subscribe.', 'warning'),
  });

  /** Progress is reported to the API; it is what powers Continue Watching. */
  const reportProgress = useCallback(
    (progressSeconds: number, watchedDelta: number, completed: boolean) => {
      if (!user || !video) return;
      void api(`/videos/${video.id}/progress`, {
        method: 'POST',
        body: { progressSeconds, watchedSeconds: watchedDelta, completed },
      }).catch(() => undefined);
    },
    [user, video],
  );

  if (isLoading) return <WatchSkeleton />;

  if (error instanceof ApiError || !video) {
    const message =
      error instanceof ApiError && error.status === 403
        ? (error.message ?? 'This video is part of FaithTube Premium.')
        : 'This video is not available. It may have been removed, or it may still be in review.';
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Not available</h1>
        <p className="mt-2 text-sm ft-muted">{message}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-gold-deep hover:underline dark:text-gold-soft">
          Back to home
        </Link>
      </div>
    );
  }

  const needsAgeGate = video.ageRestricted && !ageAcknowledged && !acknowledgedRef.current;

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-5 lg:px-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {needsAgeGate ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl bg-navy px-6 text-center text-cream">
              <h2 className="font-display text-xl font-semibold">Content notice</h2>
              <p className="max-w-md text-sm text-cream/75">
                This is Christian content, but it covers subjects some viewers will find heavy
                {video.contentWarnings.length ? `: ${video.contentWarnings.join(', ').toLowerCase()}` : ''}.
              </p>
              <Button
                variant="gold"
                onClick={() => {
                  acknowledgedRef.current = true;
                  setAgeAcknowledged(true);
                }}
              >
                I understand — play the video
              </Button>
            </div>
          ) : (
            <VideoPlayer
              sources={video.sources}
              poster={video.thumbnailUrl}
              title={video.title}
              categorySlug={video.categorySlug}
              chapters={video.chapters}
              captionsUrl={video.captionsUrl}
              startAt={video.viewerState?.progressSeconds ?? 0}
              vertical={video.isShort}
              onProgress={reportProgress}
            />
          )}

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge verified={video.christianContentVerified} />
              <Link to={`/categories/${video.categorySlug}`}>
                <Badge tone="neutral" className="capitalize">
                  {video.categorySlug.replace(/-/g, ' ')}
                </Badge>
              </Link>
              {video.premiumOnly ? <Badge tone="gold">Premium</Badge> : null}
              {video.ageRestricted ? <Badge tone="warn">18+</Badge> : null}
            </div>

            <h1 className="mt-2.5 font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {video.title}
            </h1>

            <div className="mt-3.5 flex flex-col gap-3 border-b border-navy/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
              <div className="flex items-center gap-3">
                <Link to={`/channel/${video.channel.handle}`}>
                  <Avatar src={video.channel.avatarUrl} name={video.channel.name} size={42} />
                </Link>
                <div className="min-w-0">
                  <Link to={`/channel/${video.channel.handle}`} className="block truncate font-medium hover:underline">
                    {video.channel.name}
                  </Link>
                  <p className="text-xs ft-muted">{formatCount(video.channel.subscriberCount)} subscribers</p>
                </div>
                <Button
                  variant={video.viewerState?.subscribed ? 'secondary' : 'primary'}
                  size="sm"
                  className="ml-2 shrink-0"
                  loading={subscribe.isPending}
                  onClick={() => subscribe.mutate()}
                >
                  {video.viewerState?.subscribed ? 'Subscribed' : 'Subscribe'}
                </Button>
              </div>

              <div className="ft-no-scrollbar flex items-center gap-1.5 overflow-x-auto">
                <div className="flex items-center rounded-full bg-navy/[0.06] dark:bg-white/10">
                  <button
                    type="button"
                    onClick={() => like.mutate(video.viewerState?.liked ? 0 : 1)}
                    aria-pressed={video.viewerState?.liked}
                    className={cx(
                      'flex items-center gap-2 rounded-l-full px-3.5 py-2 text-sm font-medium transition hover:bg-navy/[0.06] dark:hover:bg-white/10',
                      video.viewerState?.liked && 'text-gold-deep dark:text-gold-soft',
                    )}
                  >
                    <IconLike className="h-[1.15rem] w-[1.15rem]" />
                    {formatCount(video.likeCount)}
                    <span className="sr-only">likes</span>
                  </button>
                  <span className="h-5 w-px bg-navy/15 dark:bg-white/15" />
                  <button
                    type="button"
                    onClick={() => like.mutate(-1)}
                    aria-label="Not for me"
                    className="rounded-r-full px-3.5 py-2 transition hover:bg-navy/[0.06] dark:hover:bg-white/10"
                  >
                    <IconDislike className="h-[1.15rem] w-[1.15rem]" />
                  </button>
                </div>

                <ActionButton icon={<IconShare className="h-[1.1rem] w-[1.1rem]" />} label="Share" onClick={() => void share(video, push)} />
                <ActionButton
                  icon={<IconSave className="h-[1.1rem] w-[1.1rem]" />}
                  label={video.viewerState?.saved ? 'Saved' : 'Save'}
                  active={video.viewerState?.saved}
                  onClick={() => (user ? save.mutate() : push('Sign in to save videos.', 'warning'))}
                />
                <ActionButton
                  icon={<IconSave className="h-[1.1rem] w-[1.1rem]" />}
                  label="Playlist"
                  onClick={() => (user ? setSaveOpen(true) : push('Sign in to build playlists.', 'warning'))}
                />
                <ActionButton
                  icon={<IconFlag className="h-[1.1rem] w-[1.1rem]" />}
                  label="Report"
                  onClick={() => (user ? setReportOpen(true) : push('Sign in to report a video.', 'warning'))}
                />
              </div>
            </div>

            {video.ageRestricted ? (
              <div className="mt-4">
                <AgeRestrictedNotice warnings={video.contentWarnings} />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setDescriptionOpen((value) => !value)}
              className="mt-4 w-full rounded-2xl bg-navy/[0.04] p-4 text-left transition hover:bg-navy/[0.07] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
              aria-expanded={descriptionOpen}
            >
              <p className="text-sm font-medium">
                {formatCount(video.viewCount)} view{video.viewCount === 1 ? '' : 's'} ·{' '}
                {video.publishedAt ? formatDate(video.publishedAt) : timeAgo(video.createdAt)}
              </p>
              <p className={cx('mt-2 whitespace-pre-wrap text-sm leading-relaxed', !descriptionOpen && 'ft-line-clamp-3')}>
                {video.description || 'No description was added to this video.'}
              </p>

              {video.scriptureRefs.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {video.scriptureRefs.map((ref) => (
                    <span key={ref} className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[0.72rem] font-medium text-gold-deep dark:text-gold-soft">
                      {ref}
                    </span>
                  ))}
                </div>
              ) : null}

              {video.tags.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {video.tags.slice(0, 12).map((tag) => (
                    <span key={tag} className="text-[0.75rem] text-gold-deep dark:text-gold-soft">
                      #{tag.replace(/\s+/g, '')}
                    </span>
                  ))}
                </div>
              ) : null}

              <span className="mt-2.5 inline-block text-xs font-medium text-gold-deep dark:text-gold-soft">
                {descriptionOpen ? 'Show less' : 'Show more'}
              </span>
            </button>

            {video.chapters.length ? <ChapterList chapters={video.chapters} /> : null}
            {video.transcript?.length ? <TranscriptPanel cues={video.transcript} /> : null}

            <div className="mt-6">
              <CommentSection videoId={video.id} commentCount={0} />
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <Tabs
            tabs={[
              { id: 'related', label: 'Related' },
              { id: 'channel', label: 'From this channel' },
            ]}
            active={sideTab}
            onChange={setSideTab}
            className="mb-3"
          />
          <div className="space-y-1">
            {(related?.items ?? [])
              .filter((item) => (sideTab === 'channel' ? item.channel.id === video.channel.id : true))
              .map((item) => (
                <VideoCard key={item.id} video={item} layout="compact" />
              ))}
            {!related?.items.length ? (
              <p className="px-2 py-6 text-sm ft-muted">Nothing related yet — more will appear as the library grows.</p>
            ) : null}
          </div>
        </aside>
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="VIDEO" targetId={video.id} targetLabel={video.title} />
      <AddToPlaylistDialog open={saveOpen} onClose={() => setSaveOpen(false)} videoId={video.id} />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex shrink-0 items-center gap-2 rounded-full bg-navy/[0.06] px-3.5 py-2 text-sm font-medium transition hover:bg-navy/[0.1] dark:bg-white/10 dark:hover:bg-white/[0.16]',
        active && 'text-gold-deep dark:text-gold-soft',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

async function share(video: VideoDetail, push: (message: string, tone?: 'success' | 'info') => void) {
  const url = `${window.location.origin}/watch/${video.slug}`;
  // The Web Share sheet is the right experience on mobile; clipboard elsewhere.
  if (navigator.share) {
    try {
      await navigator.share({ title: video.title, text: video.description.slice(0, 140), url });
      return;
    } catch {
      // The person dismissed the sheet; fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    push('Link copied.', 'success');
  } catch {
    push('Copy this link: ' + url, 'info');
  }
}

function ChapterList({ chapters }: { chapters: Array<{ startSeconds: number; title: string }> }) {
  return (
    <section className="mt-4 rounded-2xl bg-navy/[0.04] p-4 dark:bg-white/[0.04]">
      <h2 className="mb-2.5 text-sm font-semibold">Chapters</h2>
      <ol className="space-y-0.5">
        {chapters.map((chapter) => (
          <li key={chapter.startSeconds}>
            <a
              href={`#t=${chapter.startSeconds}`}
              onClick={(event) => {
                event.preventDefault();
                const node = document.querySelector('video');
                if (node) {
                  node.currentTime = chapter.startSeconds;
                  void node.play().catch(() => undefined);
                }
              }}
              className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-navy/[0.05] dark:hover:bg-white/5"
            >
              <span className="w-14 shrink-0 tabular-nums text-gold-deep dark:text-gold-soft">
                {formatDuration(chapter.startSeconds)}
              </span>
              <span>{chapter.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TranscriptPanel({ cues }: { cues: Array<{ startSeconds: number; endSeconds: number; text: string }> }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const visible = filter
    ? cues.filter((cue) => cue.text.toLowerCase().includes(filter.toLowerCase()))
    : cues;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl bg-navy/[0.04] dark:bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-semibold">Transcript</span>
        <span className="text-xs ft-muted">{open ? 'Hide' : `${cues.length} segment${cues.length === 1 ? '' : 's'}`}</span>
      </button>

      {open ? (
        <div className="px-4 pb-4">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search within this transcript"
            aria-label="Search transcript"
            className="mb-3 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-navy/12 focus:ring-2 focus:ring-gold dark:bg-navy dark:ring-white/12"
          />
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {visible.map((cue, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const node = document.querySelector('video');
                  if (node) node.currentTime = cue.startSeconds;
                }}
                className="flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm leading-relaxed transition hover:bg-navy/[0.05] dark:hover:bg-white/5"
              >
                {cue.endSeconds > 0 ? (
                  <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-gold-deep dark:text-gold-soft">
                    {formatDuration(cue.startSeconds)}
                  </span>
                ) : null}
                <span>{cue.text}</span>
              </button>
            ))}
            {!visible.length ? <p className="py-4 text-sm ft-muted">No matches in this transcript.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AddToPlaylistDialog({ open, onClose, videoId }: { open: boolean; onClose: () => void; videoId: string }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');

  const { data } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => api<{ items: Array<{ id: string; title: string; itemCount: number }> }>('/library/playlists'),
    enabled: open,
  });

  const addTo = useMutation({
    mutationFn: (playlistId: string) => api(`/library/playlists/${playlistId}/videos`, { method: 'POST', body: { videoId } }),
    onSuccess: () => {
      push('Added to playlist.', 'success');
      onClose();
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not add to that playlist.', 'error'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<{ playlist: { id: string } }>('/library/playlists', {
        method: 'POST',
        body: { title: newTitle, videoIds: [videoId] },
      }),
    onSuccess: () => {
      push('Playlist created.', 'success');
      setNewTitle('');
      void queryClient.invalidateQueries({ queryKey: ['playlists'] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Save to playlist">
      <div className="space-y-1">
        {data?.items.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            onClick={() => addTo.mutate(playlist.id)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-navy/[0.05] dark:hover:bg-white/5"
          >
            <span>{playlist.title}</span>
            <span className="text-xs ft-muted">{playlist.itemCount}</span>
          </button>
        ))}
        {!data?.items.length ? <p className="px-3 py-3 text-sm ft-muted">You have no playlists yet.</p> : null}
      </div>

      <div className="mt-4 border-t border-navy/10 pt-4 dark:border-white/10">
        <label htmlFor="new-playlist" className="text-sm font-medium">
          Create a new playlist
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="new-playlist"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Morning Devotion"
            className="flex-1 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-navy/15 focus:ring-2 focus:ring-gold dark:bg-navy dark:ring-white/15"
          />
          <Button onClick={() => create.mutate()} disabled={newTitle.trim().length < 1} loading={create.isPending}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function WatchSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 py-4 sm:px-5 lg:px-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="mt-4 h-6 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <div className="mt-5 flex gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="aspect-video w-[9.5rem] shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { IconComment };
