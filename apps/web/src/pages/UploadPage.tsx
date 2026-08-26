import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@faithtube/shared';
import { api, ApiError, uploadWithProgress } from '@/lib/api';
import { cx } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Checkbox, Field, Input, ProgressBar, Select, Textarea } from '@/components/ui';
import { Button, LinkButton } from '@/components/ui/Button';
import { IconCheck, IconShield, IconUpload } from '@/components/ui/Icons';

type Stage = 'select' | 'details' | 'uploading' | 'review';

interface PipelineStage {
  kind: string;
  label: string;
  status: string;
  error: string | null;
}

interface StatusResponse {
  status: string;
  christianContentVerified: boolean;
  pipeline: { stages: PipelineStage[]; overallProgress: number; failed: boolean };
  review: {
    decision: string;
    message: string;
    scores: Record<string, number>;
    canAppeal: boolean;
  } | null;
}

/**
 * The upload flow: choose a file, describe it, submit for review, then watch the
 * pipeline run. The review step is not a loading spinner with a fake outcome —
 * it polls the real job queue and shows the real decision when it lands.
 */
export default function UploadPage() {
  const { user } = useAuth();
  const { limits, features, brand } = useConfig();
  const { push } = useToast();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('select');
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categorySlug: 'sermons',
    tags: '',
    visibility: 'PUBLIC',
    scheduledFor: '',
    madeForKids: false,
    isShort: false,
    premiumOnly: false,
  });

  // Poll the real pipeline until it reaches a terminal state.
  const { data: status } = useQuery({
    queryKey: ['upload-status', videoId],
    queryFn: () => api<StatusResponse>(`/videos/${videoId}/status`),
    enabled: Boolean(videoId) && stage === 'review',
    refetchInterval: (query) => {
      const data = query.state.data as StatusResponse | undefined;
      const terminal = ['PUBLISHED', 'REJECTED', 'AWAITING_REVIEW', 'APPROVED', 'SCHEDULED'];
      return data && terminal.includes(data.status) ? false : 2000;
    },
  });

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in to upload</h1>
        <p className="mt-2 text-sm ft-muted">You need an account before you can share a video on {brand.name}.</p>
        <LinkButton to="/signin?next=/upload" variant="gold" className="mt-6">
          Sign in
        </LinkButton>
      </div>
    );
  }

  if (!user.channelHandle) {
    return <CreateChannelPrompt />;
  }

  function chooseFile(selected: File | null | undefined) {
    if (!selected) return;
    if (selected.size > limits.maxUploadBytes) {
      push(`That file is larger than the ${limits.maxUploadLabel} limit.`, 'error');
      return;
    }
    setFile(selected);
    // A sensible default title from the filename saves everyone a step.
    setForm((current) => ({
      ...current,
      title: current.title || selected.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 140),
    }));
    setStage('details');
  }

  async function submit() {
    if (!file) return;
    setStage('uploading');
    setProgress(0);

    const body = new FormData();
    body.append('video', file);
    if (thumbnail) body.append('thumbnail', thumbnail);
    body.append('title', form.title.trim());
    body.append('description', form.description.trim());
    body.append('categorySlug', form.categorySlug);
    body.append('tags', form.tags);
    body.append('visibility', form.visibility);
    if (form.visibility === 'SCHEDULED' && form.scheduledFor) {
      body.append('scheduledFor', new Date(form.scheduledFor).toISOString());
    }
    body.append('madeForKids', String(form.madeForKids));
    body.append('isShort', String(form.isShort));
    body.append('premiumOnly', String(form.premiumOnly));

    const { promise, abort } = uploadWithProgress<{ video: { id: string } }>('/videos', body, setProgress);
    abortRef.current = abort;

    try {
      const result = await promise;
      setVideoId(result.video.id);
      setStage('review');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Your upload could not be completed.', 'error');
      setStage('details');
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        eyebrow="Create"
        title="Upload a video"
        description={`Every upload on ${brand.name} is reviewed before anyone can watch it. That usually takes a minute or two.`}
      />

      <StepIndicator stage={stage} />

      {stage === 'select' ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files?.[0]);
          }}
          className={cx(
            'flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-20 text-center transition',
            dragging ? 'border-gold bg-gold/5' : 'border-navy/15 dark:border-white/15',
          )}
        >
          <IconUpload className="h-10 w-10 text-gold" />
          <h2 className="mt-4 font-display text-lg font-semibold">Drop your video here</h2>
          <p className="mt-1.5 max-w-sm text-sm ft-muted">
            MP4, MOV, WebM or MKV, up to {limits.maxUploadLabel}. Your video stays private until it has passed review.
          </p>
          <label className="mt-6 cursor-pointer rounded-full bg-gilt px-6 py-3 text-sm font-semibold text-navy transition hover:brightness-105">
            Choose a file
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </label>

          {!features.videoTranscoding ? (
            <p className="mt-6 max-w-md rounded-xl bg-navy/[0.04] px-4 py-3 text-xs leading-relaxed ft-muted dark:bg-white/[0.04]">
              This deployment does not have ffmpeg available, so videos are served exactly as uploaded — no generated
              thumbnails or alternative quality options. Upload an MP4 that is already web-ready for the best result.
            </p>
          ) : null}
        </div>
      ) : null}

      {stage === 'details' && file ? (
        <div className="space-y-5">
          <Card className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold-deep dark:text-gold-soft">
              <IconUpload className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs ft-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setStage('select'); }}>
              Change
            </Button>
          </Card>

          <Card className="space-y-5">
            <Field label="Title" id="up-title" required hint="What will people see in search and on the home page?">
              <Input
                id="up-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                maxLength={140}
                required
              />
            </Field>

            <Field
              label="Description"
              id="up-desc"
              hint="Scripture references you mention here (like Romans 8:28) are detected automatically and made searchable."
            >
              <Textarea
                id="up-desc"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={6000}
                rows={6}
                placeholder="What is this teaching about? Which passage does it cover? Who is speaking?"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" id="up-category" required>
                <Select id="up-category" value={form.categorySlug} onChange={(event) => setForm({ ...form, categorySlug: event.target.value })}>
                  {CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tags" id="up-tags" hint="Comma separated. Up to 30.">
                <Input
                  id="up-tags"
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                  placeholder="romans, expository, grace"
                />
              </Field>
            </div>

            <Field label="Thumbnail" id="up-thumb" hint="JPEG, PNG or WebP, up to 8 MB. We generate one if you skip this.">
              <div className="flex items-center gap-4">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="h-16 w-28 rounded-lg object-cover ring-1 ring-navy/10" />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-navy/[0.06] text-xs ft-muted dark:bg-white/[0.06]">
                    None
                  </div>
                )}
                <label className="cursor-pointer rounded-full bg-navy/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-navy/[0.1] dark:bg-white/10">
                  Choose image
                  <input
                    id="up-thumb"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] ?? null;
                      setThumbnail(selected);
                      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
                      setThumbnailPreview(selected ? URL.createObjectURL(selected) : null);
                    }}
                  />
                </label>
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Visibility" id="up-vis">
                <Select id="up-vis" value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
                  <option value="PUBLIC">Public — publish as soon as it is approved</option>
                  <option value="UNLISTED">Unlisted — anyone with the link</option>
                  <option value="PRIVATE">Private — only you</option>
                  <option value="SCHEDULED">Scheduled — publish at a set time</option>
                </Select>
              </Field>

              {form.visibility === 'SCHEDULED' ? (
                <Field label="Publish at" id="up-when" required>
                  <Input
                    id="up-when"
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
                  />
                </Field>
              ) : null}
            </div>

            <fieldset className="space-y-3 rounded-2xl bg-navy/[0.03] p-4 dark:bg-white/[0.03]">
              <legend className="sr-only">Audience settings</legend>
              <Checkbox
                id="up-kids"
                checked={form.madeForKids}
                onChange={(event) => setForm({ ...form, madeForKids: event.target.checked })}
                label="This video is made for children"
                description="Comments are handled more strictly on children's content."
              />
              <Checkbox
                id="up-short"
                checked={form.isShort}
                onChange={(event) => setForm({ ...form, isShort: event.target.checked })}
                label="Publish as a Faith Clip"
                description="Vertical videos under three minutes are detected automatically, but you can force it here."
              />
              <Checkbox
                id="up-premium"
                checked={form.premiumOnly}
                onChange={(event) => setForm({ ...form, premiumOnly: event.target.checked })}
                label="Premium members only"
                description="Only viewers with a Premium subscription can watch this."
              />
            </fieldset>

            <div className="rounded-2xl bg-verified/8 p-4 ring-1 ring-verified/20">
              <div className="flex gap-3">
                <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-verified" />
                <div className="text-sm">
                  <p className="font-medium">This video will be reviewed before it is published</p>
                  <p className="mt-1 leading-relaxed ft-muted">
                    We check the title, description, thumbnail and spoken content to confirm it is Christ-centred and safe.
                    If our automated review is not confident, a person looks at it. You will be notified either way, and you
                    can appeal a rejection.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStage('select')}>
              Back
            </Button>
            <Button variant="gold" size="lg" onClick={submit} disabled={form.title.trim().length < 3}>
              Submit for review
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'uploading' ? (
        <Card className="py-12 text-center">
          <h2 className="font-display text-lg font-semibold">Uploading your video</h2>
          <p className="mt-1.5 text-sm ft-muted">Keep this tab open until the upload finishes.</p>
          <div className="mx-auto mt-6 max-w-sm">
            <ProgressBar value={progress} label="Upload progress" />
            <p className="mt-2 text-sm tabular-nums ft-muted">{progress}%</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-6"
            onClick={() => {
              abortRef.current?.();
              setStage('details');
            }}
          >
            Cancel upload
          </Button>
        </Card>
      ) : null}

      {stage === 'review' ? <ReviewPanel status={status} videoId={videoId} onDone={() => navigate('/studio')} /> : null}
    </div>
  );
}

function ReviewPanel({ status, videoId, onDone }: { status: StatusResponse | undefined; videoId: string | null; onDone: () => void }) {
  const decision = status?.review?.decision;
  const stages = status?.pipeline.stages ?? [];

  return (
    <Card className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-xl font-semibold">
          {decision === 'APPROVED' || decision === 'RESTRICTED'
            ? 'Approved'
            : decision === 'REJECTED'
              ? 'Not approved'
              : decision === 'HUMAN_REVIEW'
                ? 'With a moderator'
                : 'Review in progress…'}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm ft-muted">
          {status?.review?.message ?? 'We are reading your video now. This usually takes a minute or two.'}
        </p>
      </div>

      <ol className="space-y-2">
        {stages.map((stageItem) => (
          <li key={stageItem.kind} className="flex items-center gap-3 rounded-xl bg-navy/[0.03] px-4 py-2.5 dark:bg-white/[0.03]">
            <span
              className={cx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                stageItem.status === 'DONE'
                  ? 'bg-verified text-white'
                  : stageItem.status === 'RUNNING'
                    ? 'bg-gold text-navy'
                    : stageItem.status === 'FAILED'
                      ? 'bg-danger text-white'
                      : 'bg-navy/10 ft-muted dark:bg-white/10',
              )}
            >
              {stageItem.status === 'DONE' ? (
                <IconCheck className="h-3.5 w-3.5" />
              ) : stageItem.status === 'RUNNING' ? (
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-navy" />
              ) : stageItem.status === 'FAILED' ? (
                '!'
              ) : (
                ''
              )}
            </span>
            <span className={cx('text-sm', stageItem.status === 'DONE' ? '' : 'ft-muted')}>{stageItem.label}</span>
            {stageItem.error ? <span className="ml-auto text-xs text-danger">{stageItem.error.slice(0, 60)}</span> : null}
          </li>
        ))}
      </ol>

      {status?.review ? (
        <div className="rounded-2xl bg-navy/[0.04] p-4 dark:bg-white/[0.04]">
          <h3 className="mb-3 text-sm font-semibold">Review summary</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Score label="Christian relevance" value={status.review.scores.christianRelevance} />
            <Score label="Safety" value={status.review.scores.safety} />
            <Score label="Family suitability" value={status.review.scores.familySuitability} />
            <Score label="Spam risk" value={status.review.scores.spamRisk} invert />
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="gold" onClick={onDone}>
          Go to Creator Studio
        </Button>
        {videoId && status?.review?.canAppeal ? (
          <LinkButton to={`/studio/videos/${videoId}`} variant="outline">
            Appeal this decision
          </LinkButton>
        ) : null}
      </div>
    </Card>
  );
}

function Score({ label, value, invert }: { label: string; value: number | undefined; invert?: boolean }) {
  const percent = Math.round((value ?? 0) * 100);
  const good = invert ? percent < 30 : percent > 65;
  return (
    <div>
      <dt className="text-[0.7rem] ft-muted">{label}</dt>
      <dd className={cx('mt-0.5 text-lg font-semibold tabular-nums', good ? 'text-verified' : 'text-warn')}>{percent}%</dd>
    </div>
  );
}

function StepIndicator({ stage }: { stage: Stage }) {
  const steps: Array<{ id: Stage; label: string }> = [
    { id: 'select', label: 'Choose file' },
    { id: 'details', label: 'Details' },
    { id: 'uploading', label: 'Upload' },
    { id: 'review', label: 'Review' },
  ];
  const activeIndex = steps.findIndex((step) => step.id === stage);

  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Upload steps">
      {steps.map((step, index) => (
        <li key={step.id} className="flex flex-1 items-center gap-2">
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              index < activeIndex ? 'bg-verified text-white' : index === activeIndex ? 'bg-gilt text-navy' : 'bg-navy/10 ft-muted dark:bg-white/10',
            )}
          >
            {index < activeIndex ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className={cx('hidden text-xs sm:block', index === activeIndex ? 'font-medium' : 'ft-muted')}>{step.label}</span>
          {index < steps.length - 1 ? <span className="h-px flex-1 bg-navy/10 dark:bg-white/10" /> : null}
        </li>
      ))}
    </ol>
  );
}

function CreateChannelPrompt() {
  const { push } = useToast();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api('/channels', { method: 'POST', body: { name: name.trim(), handle: handle.trim(), description: description.trim() } });
      await refresh();
      push('Your channel is ready.', 'success');
      navigate('/upload');
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Your channel could not be created.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow="Create"
        title="Set up your channel"
        description="Before you can upload, give your ministry or teaching a home on FaithTube."
      />
      <Card className="space-y-5">
        <Field label="Channel name" id="ch-name" required>
          <Input id="ch-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cornerstone Chapel" maxLength={60} />
        </Field>
        <Field label="Handle" id="ch-handle" required hint="Your public address: faithtube.example/channel/@your-handle">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm ft-muted">@</span>
            <Input
              id="ch-handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
              className="pl-7"
              maxLength={30}
            />
          </div>
        </Field>
        <Field label="What is this channel for?" id="ch-desc">
          <Textarea
            id="ch-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Verse-by-verse preaching from our congregation, plus midweek Bible study."
          />
        </Field>
        <Button variant="gold" fullWidth size="lg" loading={busy} disabled={name.trim().length < 2 || handle.trim().length < 3} onClick={create}>
          Create channel
        </Button>
      </Card>
    </div>
  );
}
