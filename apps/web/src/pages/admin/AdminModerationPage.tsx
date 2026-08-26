import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { REJECTION_REASONS, REPORT_REASON_LABELS, type RejectionReason } from '@faithtube/shared';
import { api, ApiError } from '@/lib/api';
import { cx, formatDuration, timeAgo } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, Checkbox, EmptyState, Field, Modal, Select, Tabs, Textarea } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { IconShield } from '@/components/ui/Icons';

interface QueueItem {
  video: {
    id: string;
    slug: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    categorySlug: string;
    tags: string[];
    durationSeconds: number;
    status: string;
    createdAt: string;
    transcriptExcerpt: string;
    hasTranscript: boolean;
    scriptureRefs: string[];
    sources: Array<{ quality: string; url: string }>;
  };
  creator: {
    id: string;
    displayName: string;
    username: string;
    strikeCount: number;
    channelId: string;
    channelName: string;
    channelHandle: string;
    verifiedChristianCreator: boolean;
    priorRejections: number;
  };
  classification: {
    decision: string;
    confidence: number;
    scores: Record<string, number>;
    findings: Array<{ signal: string; severity: string; detail: string }>;
    internalNotes: string;
    provider: string;
    model: string | null;
    createdAt: string;
  } | null;
  history: Array<{ decision: string; provider: string; createdAt: string }>;
  reports: Array<{ id: string; reason: string; details: string }>;
}

type Queue = 'human' | 'ai' | 'reports' | 'appeals';

export default function AdminModerationPage() {
  const [queue, setQueue] = useState<Queue>('human');
  const [decisionFor, setDecisionFor] = useState<QueueItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['moderation-queue', queue],
    queryFn: () => api<{ queue: Queue; items: QueueItem[] }>('/admin/moderation/queue', { query: { queue } }),
  });

  const { data: reports } = useQuery({
    queryKey: ['moderation-reports'],
    queryFn: () => api<{ items: ReportRow[] }>('/admin/moderation/queue', { query: { queue: 'reports' } }),
    enabled: queue === 'reports',
  });

  const { data: appeals } = useQuery({
    queryKey: ['moderation-appeals'],
    queryFn: () => api<{ items: AppealRow[] }>('/admin/moderation/queue', { query: { queue: 'appeals' } }),
    enabled: queue === 'appeals',
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Moderation Center"
        title="Review queue"
        description="The classifier assists — it does not decide. Every video here waits on a person."
      />

      <Tabs
        tabs={[
          { id: 'human', label: 'Needs a person', count: queue === 'human' ? data?.items.length : undefined },
          { id: 'ai', label: 'Automated decisions' },
          { id: 'reports', label: 'Reports', count: queue === 'reports' ? reports?.items.length : undefined },
          { id: 'appeals', label: 'Appeals', count: queue === 'appeals' ? appeals?.items.length : undefined },
        ]}
        active={queue}
        onChange={(id) => setQueue(id as Queue)}
        className="mb-6"
      />

      {queue === 'reports' ? <ReportQueue items={reports?.items ?? []} /> : null}
      {queue === 'appeals' ? <AppealQueue items={appeals?.items ?? []} /> : null}

      {queue === 'human' || queue === 'ai' ? (
        isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="ft-skeleton h-56 rounded-2xl" />
            ))}
          </div>
        ) : data?.items.length ? (
          <div className="space-y-5">
            {data.items.map((item) => (
              <ReviewCard key={item.video.id} item={item} onDecide={() => setDecisionFor(item)} readOnly={queue === 'ai'} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconShield className="h-8 w-8" />}
            title={queue === 'human' ? 'The queue is clear' : 'No automated decisions yet'}
            description={
              queue === 'human'
                ? 'Nothing is waiting on a moderator right now.'
                : 'Once videos have been reviewed automatically, they appear here for spot-checking.'
            }
          />
        )
      ) : null}

      <DecisionDialog item={decisionFor} onClose={() => setDecisionFor(null)} />
    </div>
  );
}

function ReviewCard({ item, onDecide, readOnly }: { item: QueueItem; onDecide: () => void; readOnly: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const { classification, creator, video } = item;

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-navy-soft sm:w-56">
          {video.sources[0] ? (
            <video src={video.sources[0].url} controls preload="metadata" poster={video.thumbnailUrl ?? undefined} className="h-full w-full object-contain" />
          ) : video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-cream/60">No preview</div>
          )}
          <span className="absolute bottom-1.5 right-1.5 rounded bg-navy-deep/85 px-1.5 py-0.5 text-[0.65rem] text-cream">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {classification ? (
              <Badge
                tone={
                  classification.decision === 'APPROVED'
                    ? 'verified'
                    : classification.decision === 'REJECTED'
                      ? 'danger'
                      : classification.decision === 'RESTRICTED'
                        ? 'gold'
                        : 'warn'
                }
              >
                {classification.decision.replace(/_/g, ' ')} · {Math.round(classification.confidence * 100)}% confident
              </Badge>
            ) : (
              <Badge tone="neutral">Not yet classified</Badge>
            )}
            <Badge tone="neutral" className="capitalize">
              {video.categorySlug.replace(/-/g, ' ')}
            </Badge>
            {item.reports.length ? <Badge tone="danger">{item.reports.length} report{item.reports.length === 1 ? '' : 's'}</Badge> : null}
          </div>

          <h2 className="mt-2 font-display text-lg font-semibold leading-snug">{video.title}</h2>
          <p className="mt-1 ft-line-clamp-2 text-sm ft-muted">{video.description || 'No description.'}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ft-muted">
            <Link to={`/channel/${creator.channelHandle}`} className="font-medium text-navy hover:underline dark:text-cream">
              {creator.channelName}
            </Link>
            <span>@{creator.username}</span>
            <span>Uploaded {timeAgo(video.createdAt)}</span>
            {creator.verifiedChristianCreator ? <Badge tone="verified">Verified creator</Badge> : null}
            {creator.strikeCount > 0 ? <Badge tone="danger">{creator.strikeCount} strike{creator.strikeCount === 1 ? '' : 's'}</Badge> : null}
            {creator.priorRejections > 0 ? <span>{creator.priorRejections} prior rejection{creator.priorRejections === 1 ? '' : 's'}</span> : null}
          </div>
        </div>
      </div>

      {classification ? (
        <div className="rounded-xl bg-navy/[0.04] p-4 dark:bg-white/[0.04]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Classifier output</h3>
            <span className="text-xs ft-muted">
              {classification.provider}
              {classification.model ? ` · ${classification.model}` : ''}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreCell label="Christian relevance" value={classification.scores.christianRelevance} />
            <ScoreCell label="Safety" value={classification.scores.safety} />
            <ScoreCell label="Family suitability" value={classification.scores.familySuitability} />
            <ScoreCell label="Spam risk" value={classification.scores.spamRisk} invert />
          </dl>

          {classification.findings.length ? (
            <ul className="mt-3 space-y-1.5">
              {classification.findings.map((finding, index) => (
                <li key={index} className="flex gap-2 text-xs leading-relaxed">
                  <span
                    className={cx(
                      'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                      finding.severity === 'high' ? 'bg-danger' : finding.severity === 'medium' ? 'bg-warn' : finding.severity === 'low' ? 'bg-gold' : 'bg-navy/30 dark:bg-white/30',
                    )}
                  />
                  <span className="ft-muted">{finding.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {classification.internalNotes ? (
            <p className="mt-3 border-t border-navy/10 pt-3 text-xs leading-relaxed ft-muted dark:border-white/10">
              <span className="font-medium">Reasoning:</span> {classification.internalNotes}
            </p>
          ) : null}
        </div>
      ) : null}

      {item.reports.length ? (
        <div className="rounded-xl bg-danger/[0.06] p-4 ring-1 ring-danger/20">
          <h3 className="text-sm font-semibold text-danger">Viewer reports</h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            {item.reports.map((report) => (
              <li key={report.id}>
                <span className="font-medium">{REPORT_REASON_LABELS[report.reason as keyof typeof REPORT_REASON_LABELS] ?? report.reason}</span>
                {report.details ? <span className="ft-muted"> — {report.details}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowTranscript((value) => !value)}
          aria-expanded={showTranscript}
          className="text-sm font-medium text-gold-deep hover:underline dark:text-gold-soft"
        >
          {showTranscript ? 'Hide transcript' : video.hasTranscript ? 'Read transcript' : 'Show available text'}
        </button>
        {showTranscript ? (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-navy/[0.03] p-3.5 text-sm leading-relaxed dark:bg-white/[0.03]">
            {video.transcriptExcerpt ? (
              <p className="whitespace-pre-wrap">{video.transcriptExcerpt}</p>
            ) : (
              <p className="ft-muted">
                No transcript was produced for this video. Automatic transcription may not be configured on this
                deployment, which is itself a reason this reached the human queue.
              </p>
            )}
            {video.scriptureRefs.length ? (
              <p className="mt-3 border-t border-navy/10 pt-3 text-xs dark:border-white/10">
                <span className="font-medium">Scripture detected:</span> {video.scriptureRefs.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {item.history.length ? (
        <p className="text-xs ft-muted">
          Previously reviewed: {item.history.map((entry) => `${entry.decision.toLowerCase()} (${timeAgo(entry.createdAt)})`).join(', ')}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="flex justify-end gap-2 border-t border-navy/10 pt-4 dark:border-white/10">
          <Button variant="gold" onClick={onDecide}>
            Make a decision
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2 border-t border-navy/10 pt-4 dark:border-white/10">
          <Button variant="outline" size="sm" onClick={onDecide}>
            Override this decision
          </Button>
        </div>
      )}
    </Card>
  );
}

function ScoreCell({ label, value, invert }: { label: string; value: number | undefined; invert?: boolean }) {
  const percent = Math.round((value ?? 0) * 100);
  const good = invert ? percent < 30 : percent > 65;
  const bad = invert ? percent > 60 : percent < 35;
  return (
    <div>
      <dt className="text-[0.68rem] ft-muted">{label}</dt>
      <dd className={cx('mt-0.5 text-lg font-semibold tabular-nums', good ? 'text-verified' : bad ? 'text-danger' : 'text-warn')}>
        {percent}%
      </dd>
    </div>
  );
}

function DecisionDialog({ item, onClose }: { item: QueueItem | null; onClose: () => void }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | 'RESTRICT' | 'REQUEST_CHANGES' | 'REMOVE'>('APPROVE');
  const [reason, setReason] = useState<RejectionReason>('NOT_CHRISTIAN_CONTENT');
  const [note, setNote] = useState('');
  const [messageToCreator, setMessageToCreator] = useState('');
  const [publishNow, setPublishNow] = useState(true);

  const decide = useMutation({
    mutationFn: () =>
      api(`/admin/moderation/videos/${item!.video.id}/decide`, {
        method: 'POST',
        body: {
          action,
          reason: ['REJECT', 'REMOVE'].includes(action) ? reason : undefined,
          note: note.trim() || undefined,
          messageToCreator: messageToCreator.trim() || undefined,
          publishImmediately: publishNow,
        },
      }),
    onSuccess: () => {
      push('Decision recorded and the creator has been notified.', 'success');
      setNote('');
      setMessageToCreator('');
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'The decision could not be saved.', 'error'),
  });

  if (!item) return null;

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title="Moderation decision"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={['REJECT', 'REMOVE'].includes(action) ? 'danger' : 'gold'} loading={decide.isPending} onClick={() => decide.mutate()}>
            Confirm {action.replace(/_/g, ' ').toLowerCase()}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm ft-muted">
        Deciding on <span className="font-medium text-navy dark:text-cream">“{item.video.title}”</span> by{' '}
        {item.creator.channelName}.
      </p>

      <div className="space-y-4">
        <Field label="Action" id="mod-action" required>
          <Select id="mod-action" value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
            <option value="APPROVE">Approve — Christ-centred and safe</option>
            <option value="RESTRICT">Approve with age restriction — Christian but heavy</option>
            <option value="REQUEST_CHANGES">Request changes — send back to the creator</option>
            <option value="REJECT">Reject — does not meet the content requirements</option>
            <option value="REMOVE">Remove — take down a published video</option>
          </Select>
        </Field>

        {['REJECT', 'REMOVE'].includes(action) ? (
          <Field label="Reason" id="mod-reason" required hint="This selects the standard explanation the creator receives.">
            <Select id="mod-reason" value={reason} onChange={(event) => setReason(event.target.value as RejectionReason)}>
              {REJECTION_REASONS.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {action === 'APPROVE' || action === 'RESTRICT' ? (
          <Checkbox
            id="mod-publish"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
            label="Publish immediately"
            description="Otherwise the creator publishes it themselves when they are ready."
          />
        ) : null}

        <Field
          label="Message to the creator"
          id="mod-message"
          hint="Optional. Leave blank to send the standard explanation for this reason. Never include details of how detection works."
        >
          <Textarea id="mod-message" value={messageToCreator} onChange={(event) => setMessageToCreator(event.target.value)} rows={3} maxLength={1000} />
        </Field>

        <Field label="Internal note" id="mod-note" hint="Visible to moderators and admins only. Recorded in the audit log.">
          <Textarea id="mod-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}

interface ReportRow {
  id: string;
  targetType: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporter: { displayName: string; username: string } | null;
  video: { id: string; slug: string; title: string; thumbnailUrl: string | null } | null;
  comment: { id: string; body: string } | null;
}

function ReportQueue({ items }: { items: ReportRow[] }) {
  const { push } = useToast();
  const queryClient = useQueryClient();

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIONED' | 'DISMISSED' }) =>
      api(`/admin/moderation/reports/${id}/resolve`, { method: 'POST', body: { status } }),
    onSuccess: () => {
      push('Report resolved.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
    },
  });

  if (!items.length) {
    return <EmptyState title="No open reports" description="Reports from viewers will appear here." />;
  }

  return (
    <div className="space-y-3">
      {items.map((report) => (
        <Card key={report.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{REPORT_REASON_LABELS[report.reason as keyof typeof REPORT_REASON_LABELS] ?? report.reason}</Badge>
            <Badge tone="neutral">{report.targetType.toLowerCase()}</Badge>
            <span className="text-xs ft-muted">{timeAgo(report.createdAt)}</span>
          </div>

          {report.video ? (
            <Link to={`/watch/${report.video.slug}`} className="mt-2 block font-medium hover:underline">
              {report.video.title}
            </Link>
          ) : null}
          {report.comment ? <p className="mt-2 rounded-lg bg-navy/[0.04] p-3 text-sm dark:bg-white/[0.04]">{report.comment.body}</p> : null}
          {report.details ? <p className="mt-2 text-sm ft-muted">“{report.details}”</p> : null}
          {report.reporter ? <p className="mt-1.5 text-xs ft-muted">Reported by @{report.reporter.username}</p> : null}

          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: report.id, status: 'DISMISSED' })}>
              Dismiss
            </Button>
            <Button variant="danger" size="sm" onClick={() => resolve.mutate({ id: report.id, status: 'ACTIONED' })}>
              Mark actioned
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

interface AppealRow {
  id: string;
  message: string;
  createdAt: string;
  creator: { displayName: string; username: string; strikeCount: number };
  video: { id: string; slug: string; title: string; description: string; thumbnailUrl: string | null; status: string; channelName: string };
  originalDecision: {
    decision: string;
    scores: Record<string, number>;
    confidence: number;
    findings: Array<{ signal: string; severity: string; detail: string }>;
    internalNotes: string;
    provider: string;
  } | null;
}

function AppealQueue({ items }: { items: AppealRow[] }) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<AppealRow | null>(null);
  const [decision, setDecision] = useState<'UPHELD' | 'OVERTURNED' | 'CHANGES_REQUESTED'>('OVERTURNED');
  const [note, setNote] = useState('');

  const decide = useMutation({
    mutationFn: () => api(`/admin/moderation/appeals/${active!.id}/decide`, { method: 'POST', body: { decision, note } }),
    onSuccess: () => {
      push('Appeal decided and the creator has been notified.', 'success');
      setActive(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['moderation-appeals'] });
    },
    onError: (err) => push(err instanceof ApiError ? err.message : 'The appeal could not be decided.', 'error'),
  });

  if (!items.length) {
    return <EmptyState title="No appeals waiting" description="When a creator appeals a rejection, it lands here." />;
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((appeal) => (
          <Card key={appeal.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warn">Appeal</Badge>
              {appeal.originalDecision ? (
                <Badge tone="danger">
                  Originally {appeal.originalDecision.decision.toLowerCase().replace(/_/g, ' ')} by {appeal.originalDecision.provider}
                </Badge>
              ) : null}
              <span className="text-xs ft-muted">{timeAgo(appeal.createdAt)}</span>
            </div>

            <div>
              <Link to={`/watch/${appeal.video.slug}`} className="font-display text-lg font-semibold hover:underline">
                {appeal.video.title}
              </Link>
              <p className="mt-0.5 text-sm ft-muted">
                {appeal.video.channelName} · @{appeal.creator.username}
                {appeal.creator.strikeCount > 0 ? ` · ${appeal.creator.strikeCount} strikes` : ''}
              </p>
            </div>

            <blockquote className="rounded-xl bg-navy/[0.04] p-4 text-sm leading-relaxed dark:bg-white/[0.04]">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide ft-muted">The creator says</p>
              {appeal.message}
            </blockquote>

            {appeal.originalDecision ? (
              <div className="rounded-xl bg-navy/[0.03] p-4 dark:bg-white/[0.03]">
                <h3 className="mb-2 text-sm font-semibold">Original classification</h3>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ScoreCell label="Christian relevance" value={appeal.originalDecision.scores.christianRelevance} />
                  <ScoreCell label="Safety" value={appeal.originalDecision.scores.safety} />
                  <ScoreCell label="Family suitability" value={appeal.originalDecision.scores.familySuitability} />
                  <ScoreCell label="Spam risk" value={appeal.originalDecision.scores.spamRisk} invert />
                </dl>
                {appeal.originalDecision.internalNotes ? (
                  <p className="mt-3 text-xs leading-relaxed ft-muted">{appeal.originalDecision.internalNotes}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button variant="gold" size="sm" onClick={() => setActive(appeal)}>
                Decide this appeal
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title="Decide this appeal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button variant="gold" loading={decide.isPending} disabled={note.trim().length < 10} onClick={() => decide.mutate()}>
              Send decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Outcome" id="ap-decision" required>
            <Select id="ap-decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
              <option value="OVERTURNED">Approve the video — the original decision was wrong</option>
              <option value="UPHELD">Uphold the original decision</option>
              <option value="CHANGES_REQUESTED">Ask the creator to change and re-submit</option>
            </Select>
          </Field>
          <Field
            label="What should the creator be told?"
            id="ap-note"
            required
            hint="This is sent to them directly. Be clear and courteous — this is the reply to a person who believes we got it wrong."
          >
            <Textarea id="ap-note" value={note} onChange={(event) => setNote(event.target.value)} rows={5} maxLength={2000} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
