import fs from 'node:fs/promises';
import path from 'node:path';
import type { Chapter, TranscriptCue, VideoSource } from '@faithtube/shared';
import { extractScriptureReferences, formatReference } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { logger } from '../lib/logger.js';
import { moderationProvider } from '../ai/index.js';
import { synthesiseCues, transcriptionProvider } from '../ai/transcription.js';
import { generateChapters } from '../ai/chapters.js';
import type { ModerationInput } from '../ai/types.js';
import { captureThumbnail, extractAudio, hasFfmpeg, laddersFor, probe, sampleFrames, transcode } from './media.service.js';
import { mediaKey, storage } from './storage.service.js';
import { notify } from './notification.service.js';

const log = logger('pipeline');

export type JobKind = 'PROBE' | 'TRANSCODE' | 'THUMBNAIL' | 'TRANSCRIBE' | 'MODERATE' | 'PUBLISH';

/**
 * The upload pipeline, in order. Each stage is a persisted job row so progress
 * survives a restart and the creator can watch it move on the studio page.
 */
export const PIPELINE_ORDER: JobKind[] = ['PROBE', 'THUMBNAIL', 'TRANSCRIBE', 'MODERATE', 'TRANSCODE', 'PUBLISH'];

export const STAGE_LABELS: Record<JobKind, string> = {
  PROBE: 'Reading video',
  THUMBNAIL: 'Preparing preview image',
  TRANSCRIBE: 'Generating transcript',
  MODERATE: 'AI review',
  TRANSCODE: 'Preparing playback quality options',
  PUBLISH: 'Publishing',
};

export async function enqueuePipeline(videoId: string): Promise<void> {
  await prisma.videoProcessingJob.createMany({
    data: PIPELINE_ORDER.map((kind, index) => ({
      videoId,
      kind,
      // Stages run in order: each is held until the previous one marks it ready.
      status: index === 0 ? 'QUEUED' : 'WAITING',
    })),
  });
  await prisma.video.update({ where: { id: videoId }, data: { status: 'PROCESSING' } });
}

/** Releases the next stage once the current one succeeds. */
async function advance(videoId: string, completed: JobKind): Promise<void> {
  const index = PIPELINE_ORDER.indexOf(completed);
  const next = PIPELINE_ORDER[index + 1];
  if (!next) return;
  await prisma.videoProcessingJob.updateMany({
    where: { videoId, kind: next, status: 'WAITING' },
    data: { status: 'QUEUED', runAfter: new Date() },
  });
}

export async function runJob(jobId: string): Promise<void> {
  const job = await prisma.videoProcessingJob.findUnique({
    where: { id: jobId },
    include: { video: { include: { channel: { include: { owner: true } } } } },
  });
  if (!job || job.status !== 'RUNNING') return;

  const video = job.video;
  try {
    switch (job.kind as JobKind) {
      case 'PROBE':
        await runProbe(video.id);
        break;
      case 'THUMBNAIL':
        await runThumbnail(video.id);
        break;
      case 'TRANSCRIBE':
        await runTranscribe(video.id);
        break;
      case 'MODERATE':
        await runModeration(video.id);
        break;
      case 'TRANSCODE':
        await runTranscode(video.id);
        break;
      case 'PUBLISH':
        await runPublish(video.id);
        break;
      default:
        throw new Error(`Unknown job kind ${job.kind}`);
    }

    await prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: { status: 'DONE', progress: 100, finishedAt: new Date(), error: null },
    });
    await advance(video.id, job.kind as JobKind);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Job ${job.kind} failed for video ${video.id}`, message);
    const attempts = job.attempts;
    const willRetry = attempts < job.maxAttempts;
    await prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: willRetry ? 'QUEUED' : 'FAILED',
        error: message.slice(0, 1000),
        finishedAt: willRetry ? null : new Date(),
        // Exponential backoff between retries.
        runAfter: new Date(Date.now() + Math.min(2 ** attempts * 5000, 5 * 60_000)),
      },
    });
    if (!willRetry) await failVideo(video.id, job.kind as JobKind, message);
  }
}

async function failVideo(videoId: string, kind: JobKind, message: string) {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: { status: 'AWAITING_REVIEW' },
    include: { channel: true },
  });
  await notify({
    userId: video.channel.ownerId,
    type: 'MODERATION',
    title: 'We hit a problem processing your video',
    body: `"${video.title}" could not complete the ${STAGE_LABELS[kind]} step. Our team has been notified and will look at it.`,
    linkUrl: `/studio/videos/${video.id}`,
  });
  log.error(`Video ${videoId} parked for manual attention: ${message}`);
}

// --------------------------------------------------------------------- stages

async function runProbe(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (!video.storageKey) throw new Error('No stored file for this video');
  const local = storage.localPath(video.storageKey);
  if (!local) {
    // Remote storage: metadata was captured at upload time by the client/edge.
    await prisma.video.update({ where: { id: videoId }, data: { status: 'AI_ANALYSIS' } });
    return;
  }
  const result = await probe(local);
  const stat = await fs.stat(local).catch(() => null);
  await prisma.video.update({
    where: { id: videoId },
    data: {
      durationSeconds: result.durationSeconds,
      width: result.width,
      height: result.height,
      sizeBytes: stat?.size ?? video.sizeBytes,
      status: 'AI_ANALYSIS',
      // Vertical and under 3 minutes is the platform's definition of a Faith Clip.
      isShort:
        video.isShort ||
        (result.height > result.width && result.durationSeconds > 0 && result.durationSeconds <= 180),
      sources: stringifyJson([
        {
          quality: result.height ? `${result.height}p` : 'original',
          url: storage.urlFor(video.storageKey),
          width: result.width,
          height: result.height,
          bitrateKbps: result.bitrateKbps,
          original: true,
        } satisfies VideoSource,
      ]),
    },
  });
}

async function runThumbnail(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (video.thumbnailUrl || !video.storageKey) return; // creator supplied one
  const local = storage.localPath(video.storageKey);
  if (!local || !(await hasFfmpeg())) return;

  const key = mediaKey('thumbnail', `${video.id}-auto`, '.jpg');
  const localTarget = storage.localPath(key);
  const at = Math.min(Math.max(video.durationSeconds * 0.25, 1), Math.max(video.durationSeconds - 1, 1));
  const target = localTarget ?? path.join(process.cwd(), 'var', 'tmp', `${video.id}.jpg`);

  if (await captureThumbnail(local, at, target)) {
    if (!localTarget) {
      await storage.put(key, target, 'image/jpeg');
      await fs.rm(target, { force: true });
    }
    await prisma.video.update({ where: { id: videoId }, data: { thumbnailUrl: storage.urlFor(key) } });
  }
}

async function runTranscribe(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  const local = video.storageKey ? storage.localPath(video.storageKey) : null;
  const audioPath = local ? await extractAudio(local) : null;

  const provider = transcriptionProvider();
  const result = await provider.transcribe({
    videoId,
    audioPath,
    fallbackText: [video.title, video.description].filter(Boolean).join('\n'),
  });
  if (audioPath) await fs.rm(audioPath, { force: true }).catch(() => undefined);

  let cues: TranscriptCue[] = result.cues;
  if (result.automated && cues.length <= 1 && result.text.length > 400) {
    cues = synthesiseCues(result.text, video.durationSeconds);
  }

  const chapters: Chapter[] = result.automated ? await generateChapters(cues, video.durationSeconds, video.title) : [];
  const refs = extractScriptureReferences([video.title, video.description, result.text].join('\n'));

  await prisma.video.update({
    where: { id: videoId },
    data: {
      transcript: result.automated ? stringifyJson(cues) : null,
      transcriptText: result.text.slice(0, 200_000),
      chapters: stringifyJson(chapters),
      scriptureRefs: stringifyJson([...new Set(refs.map(formatReference))].slice(0, 40)),
    },
  });
}

async function runModeration(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { channel: { include: { owner: true } } },
  });

  const [approvedCount, rejectedCount] = await Promise.all([
    prisma.video.count({ where: { channelId: video.channelId, christianContentVerified: true } }),
    prisma.video.count({ where: { channelId: video.channelId, status: 'REJECTED' } }),
  ]);

  const frameSignals: string[] = [];
  const local = video.storageKey ? storage.localPath(video.storageKey) : null;
  if (local && (await hasFfmpeg())) {
    const frames = await sampleFrames(local, video.durationSeconds, 6);
    if (frames.length) {
      frameSignals.push(`${frames.length} frames sampled across the video for visual review`);
      await Promise.all(frames.map((f) => fs.rm(f, { force: true }).catch(() => undefined)));
    }
  }

  const input: ModerationInput = {
    videoId: video.id,
    title: video.title,
    description: video.description,
    tags: parseJson<string[]>(video.tags, []),
    categorySlug: video.categorySlug,
    transcript: video.transcriptText ?? '',
    transcriptCues: parseJson<TranscriptCue[]>(video.transcript, []),
    durationSeconds: video.durationSeconds,
    thumbnailSignals: video.thumbnailUrl ? [path.basename(video.thumbnailUrl)] : [],
    frameSignals,
    isShort: video.isShort,
    isLive: video.isLive,
    channel: {
      id: video.channelId,
      name: video.channel.name,
      approvedVideoCount: approvedCount,
      rejectedVideoCount: rejectedCount,
      strikeCount: video.channel.owner.strikeCount,
      verifiedChristianCreator: video.channel.verifiedChristianCreator,
    },
  };

  const provider = moderationProvider();
  const result = await provider.classify(input);

  await prisma.videoModerationResult.create({
    data: {
      videoId,
      decision: result.decision,
      scores: stringifyJson(result.scores),
      confidence: result.confidence,
      findings: stringifyJson(result.findings),
      internalNotes: result.internalNotes,
      creatorMessage: result.creatorMessage,
      provider: result.provider,
      model: result.model ?? null,
      ageRestricted: result.ageRestricted,
      contentWarnings: stringifyJson(result.contentWarnings),
    },
  });

  const statusByDecision = {
    APPROVED: 'APPROVED',
    RESTRICTED: 'APPROVED',
    HUMAN_REVIEW: 'AWAITING_REVIEW',
    REJECTED: 'REJECTED',
  } as const;

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: statusByDecision[result.decision],
      christianContentVerified: result.decision === 'APPROVED' || result.decision === 'RESTRICTED',
      ageRestricted: result.ageRestricted,
      contentWarnings: stringifyJson(result.contentWarnings),
    },
  });

  await notifyCreatorOfDecision(videoId, result.decision, result.creatorMessage);

  // Rejected and held videos stop here; nothing further should be prepared for them.
  if (result.decision === 'REJECTED' || result.decision === 'HUMAN_REVIEW') {
    await prisma.videoProcessingJob.updateMany({
      where: { videoId, status: { in: ['WAITING', 'QUEUED'] }, kind: { in: ['TRANSCODE', 'PUBLISH'] } },
      data: { status: 'DONE', message: 'Skipped — awaiting moderation outcome.', finishedAt: new Date() },
    });
  }
}

async function notifyCreatorOfDecision(videoId: string, decision: string, message: string) {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { channel: true },
  });
  const titles: Record<string, string> = {
    APPROVED: `Approved — "${video.title}" is ready to publish`,
    RESTRICTED: `Approved with an age restriction — "${video.title}"`,
    HUMAN_REVIEW: `"${video.title}" is with a human moderator`,
    REJECTED: `"${video.title}" was not approved`,
  };
  await notify({
    userId: video.channel.ownerId,
    type: 'MODERATION',
    title: titles[decision] ?? 'Review update',
    body: message,
    linkUrl: `/studio/videos/${video.id}`,
  });
}

async function runTranscode(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (!video.storageKey) return;
  const local = storage.localPath(video.storageKey);
  if (!local || !(await hasFfmpeg())) return;

  const specs = laddersFor(video.height);
  if (!specs.length) return;

  const sources = parseJson<VideoSource[]>(video.sources, []);
  for (const spec of specs) {
    const key = mediaKey('video', `${video.id}-${spec.label}`, '.mp4');
    const targetLocal = storage.localPath(key);
    if (!targetLocal) continue;
    const { ok } = await transcode(local, spec, targetLocal);
    if (!ok) continue;
    sources.push({
      quality: spec.label,
      url: storage.urlFor(key),
      width: Math.round((video.width / video.height) * spec.height / 2) * 2,
      height: spec.height,
      bitrateKbps: spec.videoBitrateKbps,
    });
    await prisma.video.update({ where: { id: videoId }, data: { sources: stringifyJson(sources) } });
  }
}

async function runPublish(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { channel: true } });
  if (video.status !== 'APPROVED') return;

  // A creator can approve-and-hold: only PUBLIC and SCHEDULED go live automatically.
  if (video.visibility === 'SCHEDULED' && video.scheduledFor && video.scheduledFor > new Date()) {
    await prisma.video.update({ where: { id: videoId }, data: { status: 'SCHEDULED' } });
    return;
  }
  if (video.visibility === 'PRIVATE') return;

  await publishVideo(videoId);
}

/** Makes an approved video visible and fans out subscriber notifications. */
export async function publishVideo(videoId: string): Promise<void> {
  const video = await prisma.video.update({
    where: { id: videoId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
    include: { channel: true },
  });

  await prisma.channel.update({
    where: { id: video.channelId },
    data: { videoCount: { increment: 1 } },
  });

  const { notifySubscribers } = await import('./notification.service.js');
  await notifySubscribers(video.channelId, {
    type: 'NEW_UPLOAD',
    title: `${video.channel.name} posted a new video`,
    body: video.title,
    linkUrl: `/watch/${video.slug}`,
    imageUrl: video.thumbnailUrl ?? undefined,
  });
}

/** Progress summary for the creator studio. */
export async function pipelineStatus(videoId: string) {
  const jobs = await prisma.videoProcessingJob.findMany({
    where: { videoId },
    orderBy: { createdAt: 'asc' },
  });
  const ordered = PIPELINE_ORDER.map((kind) => {
    const job = jobs.find((j) => j.kind === kind);
    return {
      kind,
      label: STAGE_LABELS[kind],
      status: job?.status ?? 'WAITING',
      progress: job?.progress ?? 0,
      message: job?.message ?? null,
      error: job?.error ?? null,
    };
  });
  const done = ordered.filter((s) => s.status === 'DONE').length;
  return {
    stages: ordered,
    overallProgress: Math.round((done / PIPELINE_ORDER.length) * 100),
    failed: ordered.some((s) => s.status === 'FAILED'),
  };
}
