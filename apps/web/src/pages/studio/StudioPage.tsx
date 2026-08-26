import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cx, formatCount, formatDuration, timeAgo } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, EmptyState, Field, Modal, Tabs, Textarea } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import { StatTile, LineChart, BarList } from '@/components/ui/Charts';
import { IconChart, IconUpload } from '@/components/ui/Icons';

interface Overview {
  channel: { id: string; name: string; handle: string; avatarUrl: string | null; subscriberCount: number; totalViews: number; verifiedChristianCreator: boolean };
  counts: { published: number; awaitingReview: number; rejected: number; scheduled: number; heldComments: number; pendingAppeals: number };
  recentComments: Array<{ id: string; body: string; createdAt: string; author: { displayName: string; avatarUrl: string | null }; video: { id: string; title: string; slug: string } }>;
  monetizationNotice: string;
}

export function StudioPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['studio-overview'],
    queryFn: () => api<Overview>('/studio/overview'),
    retry: false,
  });

  if (error instanceof ApiError) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">No channel yet</h1>
        <p className="mt-2 text-sm ft-muted">{error.message}</p>
        <LinkButton to="/upload" variant="gold" className="mt-6">
          Create your channel
        </LinkButton>
      </div>
    );
  }

  if (isLoading || !data) return <div className="py-20 text-center text-sm ft-muted">Loading your studio…</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Creator Studio"
        title={data.channel.name}
        description={`@${data.channel.handle} · ${formatCount(data.channel.subscriberCount)} subscribers · ${formatCount(data.channel.totalViews)} total views`}
        action={
          <div className="flex gap-2">
            <LinkButton to={`/channel/${data.channel.handle}`} variant="outline" size="sm">
              View channel
            </LinkButton>
            <LinkButton to="/upload" variant="gold" size="sm">
              <IconUpload className="h-4 w-4" />
              Upload
            </LinkButton>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Published" value={formatCount(data.counts.published)} />
        <StatTile label="In review" value={formatCount(data.counts.awaitingReview)} tone={data.counts.awaitingReview ? 'warn' : 'neutral'} />
        <StatTile label="Scheduled" value={formatCount(data.counts.scheduled)} />
        <StatTile label="Comments held" value={formatCount(data.counts.heldComments)} tone={data.counts.heldComments ? 'warn' : 'neutral'} />
      </div>

      {/* The platform's position on monetisation, stated where creators will see it. */}
      <Card className="mb-6 !bg-gold/[0.07] ring-gold/25">
        <h2 className="text-sm font-semibold">How reach works here</h2>
        <p className="mt-1.5 text-sm leading-relaxed ft-muted">{data.monetizationNotice}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StudioLink to="/studio/videos" title="Your videos" body="Edit details, check review status, publish or appeal." />
            <StudioLink to="/studio/analytics" title="Analytics" body="Views, watch time, retention and where your audience comes from." />
            <StudioLink to="/studio/comments" title="Comments" body={`${data.counts.heldComments} held for your review.`} />
            <StudioLink to="/studio/community" title="Community" body="Post an update, a question, a poll or a verse." />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent comments</h2>
          {data.recentComments.length ? (
            <div className="space-y-2">
              {data.recentComments.map((comment) => (
                <Link
                  key={comment.id}
                  to={`/watch/${comment.video.slug}`}
                  className="block rounded-xl p-3 transition hover:bg-navy/[0.04] dark:hover:bg-white/5"
                >
                  <p className="text-sm">
                    <span className="font-medium">{comment.author.displayName}</span>{' '}
                    <span className="text-xs ft-muted">{timeAgo(comment.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 ft-line-clamp-2 text-sm ft-muted">{comment.body}</p>
                  <p className="mt-1 truncate text-xs text-gold-deep dark:text-gold-soft">on “{comment.video.title}”</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-navy/[0.03] px-4 py-6 text-sm ft-muted dark:bg-white/[0.03]">No comments yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function StudioLink({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link to={to} className="ft-card p-4 transition hover:shadow-lift">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm ft-muted">{body}</p>
    </Link>
  );
}

interface StudioVideo {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: string;
  visibility: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string | null;
  christianContentVerified: boolean;
  review: { decision: string; message: string; scores: Record<string, number>; canAppeal: boolean } | null;
}

const STATUS_TONES: Record<string, 'verified' | 'warn' | 'danger' | 'neutral' | 'gold'> = {
  PUBLISHED: 'verified',
  APPROVED: 'verified',
  AWAITING_REVIEW: 'warn',
  AI_ANALYSIS: 'warn',
  PROCESSING: 'neutral',
  UPLOADING: 'neutral',
  SCHEDULED: 'gold',
  REJECTED: 'danger',
  REMOVED: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: 'Live',
  APPROVED: 'Approved — ready to publish',
  AWAITING_REVIEW: 'With a moderator',
  AI_ANALYSIS: 'In review',
  PROCESSING: 'Processing',
  UPLOADING: 'Uploading',
  SCHEDULED: 'Scheduled',
  REJECTED: 'Not approved',
  REMOVED: 'Removed',
};

export function StudioVideosPage() {
  const [filter, setFilter] = useState('all');
  const { push } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['studio-videos', filter],
    queryFn: () => api<{ items: StudioVideo[] }>('/studio/videos', { query: { status: filter === 'all' ? undefined : filter } }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api(`/videos/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      push('Your video is live.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['studio-videos'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Could not publish.', 'error'),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Creator Studio" title="Your videos" description="Everything you have uploaded, with its review status." />

      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'PUBLISHED', label: 'Live' },
          { id: 'AWAITING_REVIEW', label: 'In review' },
          { id: 'APPROVED', label: 'Ready' },
          { id: 'SCHEDULED', label: 'Scheduled' },
          { id: 'REJECTED', label: 'Not approved' },
        ]}
        active={filter}
        onChange={setFilter}
        className="mb-6"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ft-skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length ? (
        <div className="space-y-3">
          {data.items.map((video) => (
            <Card key={video.id} className="flex flex-col gap-4 sm:flex-row">
              <Link to={`/studio/videos/${video.id}`} className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-navy-soft sm:w-48">
                {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
                <span className="absolute bottom-1.5 right-1.5 rounded bg-navy-deep/85 px-1.5 py-0.5 text-[0.65rem] text-cream">
                  {formatDuration(video.durationSeconds)}
                </span>
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONES[video.status] ?? 'neutral'}>{STATUS_LABELS[video.status] ?? video.status}</Badge>
                  <Badge tone="neutral">{video.visibility.toLowerCase()}</Badge>
                </div>
                <Link to={`/studio/videos/${video.id}`} className="mt-1.5 block font-medium hover:underline">
                  {video.title}
                </Link>
                <p className="mt-0.5 text-xs ft-muted">
                  {video.publishedAt ? `Published ${timeAgo(video.publishedAt)}` : `Uploaded ${timeAgo(video.createdAt)}`}
                </p>

                {video.status === 'PUBLISHED' ? (
                  <div className="mt-2.5 flex gap-5 text-sm">
                    <span>
                      <strong className="tabular-nums">{formatCount(video.viewCount)}</strong> <span className="ft-muted">views</span>
                    </span>
                    <span>
                      <strong className="tabular-nums">{formatCount(video.likeCount)}</strong> <span className="ft-muted">likes</span>
                    </span>
                    <span>
                      <strong className="tabular-nums">{formatCount(video.commentCount)}</strong> <span className="ft-muted">comments</span>
                    </span>
                  </div>
                ) : video.review ? (
                  <p className="mt-2 rounded-lg bg-navy/[0.04] p-2.5 text-xs leading-relaxed ft-muted dark:bg-white/[0.04]">
                    {video.review.message}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                {video.status === 'APPROVED' ? (
                  <Button size="sm" variant="gold" loading={publish.isPending} onClick={() => publish.mutate(video.id)}>
                    Publish
                  </Button>
                ) : null}
                <LinkButton to={`/studio/videos/${video.id}`} variant="outline" size="sm">
                  Manage
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<IconUpload className="h-8 w-8" />}
          title="Nothing here yet"
          description="Upload your first video and it will appear here while it goes through review."
          action={
            <LinkButton to="/upload" variant="gold" size="sm">
              Upload a video
            </LinkButton>
          }
        />
      )}
    </div>
  );
}

export function StudioVideoDetailPage() {
  const { id = '' } = useParams();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['studio-video', id],
    queryFn: () =>
      api<{
        video: StudioVideo & { description: string; categorySlug: string; tags: string[]; scriptureRefs: string[]; contentWarnings: string[]; chapters: Array<{ startSeconds: number; title: string }>; commentsEnabled: boolean; ageRestricted: boolean };
        pipeline: { stages: Array<{ kind: string; label: string; status: string; error: string | null }>; overallProgress: number };
        reviewHistory: Array<{ decision: string; message: string; scores: Record<string, number>; reviewedAt: string; wasHumanReviewed: boolean }>;
      }>(`/studio/videos/${id}`),
  });

  const appeal = useMutation({
    mutationFn: () => api('/reports/appeals', { method: 'POST', body: { videoId: id, message: appealMessage } }),
    onSuccess: () => {
      push('Your appeal has been sent to a human moderator.', 'success');
      setAppealOpen(false);
      setAppealMessage('');
      void queryClient.invalidateQueries({ queryKey: ['studio-video', id] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'Your appeal could not be sent.', 'error'),
  });

  if (isLoading || !data) return <div className="py-20 text-center text-sm ft-muted">Loading…</div>;

  const { video, pipeline, reviewHistory } = data;
  const latest = reviewHistory[0];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Creator Studio"
        title={video.title}
        action={
          video.status === 'PUBLISHED' ? (
            <LinkButton to={`/watch/${video.slug}`} variant="outline" size="sm">
              View live
            </LinkButton>
          ) : null
        }
      />

      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[video.status] ?? 'neutral'}>{STATUS_LABELS[video.status] ?? video.status}</Badge>
            {video.christianContentVerified ? <Badge tone="verified">Christian Content Verified</Badge> : null}
            {video.ageRestricted ? <Badge tone="warn">Age restricted</Badge> : null}
          </div>

          <h2 className="mt-4 text-sm font-semibold">Processing</h2>
          <ol className="mt-2 space-y-1.5">
            {pipeline.stages.map((stage) => (
              <li key={stage.kind} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cx(
                    'h-2 w-2 shrink-0 rounded-full',
                    stage.status === 'DONE' ? 'bg-verified' : stage.status === 'FAILED' ? 'bg-danger' : stage.status === 'RUNNING' ? 'animate-pulse-soft bg-gold' : 'bg-navy/20 dark:bg-white/20',
                  )}
                />
                <span className={stage.status === 'DONE' ? '' : 'ft-muted'}>{stage.label}</span>
                {stage.error ? <span className="text-xs text-danger">{stage.error.slice(0, 80)}</span> : null}
              </li>
            ))}
          </ol>
        </Card>

        {latest ? (
          <Card>
            <h2 className="text-sm font-semibold">Review outcome</h2>
            <p className="mt-2 text-sm leading-relaxed">{latest.message}</p>
            <p className="mt-1.5 text-xs ft-muted">
              Reviewed {timeAgo(latest.reviewedAt)}
              {latest.wasHumanReviewed ? ' by a moderator' : ' automatically'}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['Christian relevance', latest.scores.christianRelevance, false],
                  ['Safety', latest.scores.safety, false],
                  ['Family suitability', latest.scores.familySuitability, false],
                  ['Spam risk', latest.scores.spamRisk, true],
                ] as Array<[string, number | undefined, boolean]>
              ).map(([label, value, invert]) => {
                const percent = Math.round((value ?? 0) * 100);
                return (
                  <div key={label}>
                    <dt className="text-[0.7rem] ft-muted">{label}</dt>
                    <dd className={cx('mt-0.5 text-lg font-semibold tabular-nums', (invert ? percent < 30 : percent > 65) ? 'text-verified' : 'text-warn')}>
                      {percent}%
                    </dd>
                  </div>
                );
              })}
            </dl>

            {video.review?.canAppeal || video.status === 'REJECTED' ? (
              <div className="mt-5 border-t border-navy/10 pt-4 dark:border-white/10">
                <p className="text-sm ft-muted">
                  If you believe this decision is wrong, you can appeal once. A person will read your explanation and the
                  video, and reply.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAppealOpen(true)}>
                  Appeal this decision
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <Row label="Category" value={video.categorySlug.replace(/-/g, ' ')} />
            <Row label="Visibility" value={video.visibility.toLowerCase()} />
            <Row label="Duration" value={formatDuration(video.durationSeconds)} />
            <Row label="Comments" value={video.commentsEnabled ? 'Enabled' : 'Disabled'} />
            {video.tags.length ? <Row label="Tags" value={video.tags.join(', ')} /> : null}
            {video.scriptureRefs.length ? <Row label="Scripture detected" value={video.scriptureRefs.join(', ')} /> : null}
            {video.contentWarnings.length ? <Row label="Content notices" value={video.contentWarnings.join(', ')} /> : null}
          </dl>
          {video.description ? (
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-navy/[0.03] p-3.5 text-sm leading-relaxed dark:bg-white/[0.03]">
              {video.description}
            </p>
          ) : null}
        </Card>

        {reviewHistory.length > 1 ? (
          <Card>
            <h2 className="text-sm font-semibold">Review history</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {reviewHistory.map((entry, index) => (
                <li key={index} className="flex items-center justify-between gap-3">
                  <span>
                    <Badge tone={entry.decision === 'REJECTED' ? 'danger' : entry.decision === 'APPROVED' ? 'verified' : 'warn'}>
                      {entry.decision.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    {entry.wasHumanReviewed ? <span className="ml-2 text-xs ft-muted">by a moderator</span> : null}
                  </span>
                  <span className="text-xs ft-muted">{timeAgo(entry.reviewedAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Modal
        open={appealOpen}
        onClose={() => setAppealOpen(false)}
        title="Appeal this decision"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAppealOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" loading={appeal.isPending} disabled={appealMessage.trim().length < 30} onClick={() => appeal.mutate()}>
              Send appeal
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm ft-muted">
          Tell us what you think the review got wrong. A person will read this alongside your video. You can appeal a
          decision once, so please include everything relevant.
        </p>
        <Field label="Your explanation" id="appeal-msg" required hint={`${appealMessage.length}/3000 — at least 30 characters.`}>
          <Textarea
            id="appeal-msg"
            value={appealMessage}
            onChange={(event) => setAppealMessage(event.target.value)}
            rows={6}
            maxLength={3000}
            placeholder="This is a Bible study on Judges 19, which is why the transcript mentions violence. The passage is handled pastorally throughout…"
          />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="ft-muted">{label}</dt>
      <dd className="text-right font-medium capitalize">{value}</dd>
    </div>
  );
}

export { IconChart, LineChart, BarList };
