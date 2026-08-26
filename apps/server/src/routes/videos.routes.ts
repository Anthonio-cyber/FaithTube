import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CATEGORY_SLUGS, VISIBILITIES } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { newStorageKey, newVideoSlug } from '../lib/ids.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { uploadLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { booleanish, optionalBooleanish } from '../lib/zod.js';
import { mediaKey, storage } from '../services/storage.service.js';
import { enqueuePipeline, pipelineStatus, publishVideo } from '../services/pipeline.service.js';
import { checkThumbnailMetadata } from '../ai/thumbnailSafety.js';
import {
  PUBLISHED_VIDEO_WHERE,
  toVideoDetail,
  toVideoSummary,
  videoDetailSelect,
  videoSummarySelect,
} from '../services/serialize.js';
import { relatedVideos } from '../services/recommendation.service.js';
import { recordAudit } from '../services/audit.service.js';

export const videosRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR, 'incoming');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${newStorageKey()}${path.extname(file.originalname).slice(0, 8)}`),
  }),
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/mpeg', 'video/x-m4v'];
    if (file.fieldname === 'video' && !allowed.includes(file.mimetype)) {
      cb(new Error(`Unsupported video format: ${file.mimetype}. Upload MP4, MOV, WebM or MKV.`));
      return;
    }
    if (file.fieldname === 'thumbnail' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Thumbnails must be JPEG, PNG or WebP.'));
      return;
    }
    cb(null, true);
  },
});

const uploadMetadataSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(6000).default(''),
  categorySlug: z.enum(CATEGORY_SLUGS as [string, ...string[]]),
  tags: z.string().optional(),
  visibility: z.enum(VISIBILITIES).default('PRIVATE'),
  scheduledFor: z.string().datetime().optional(),
  madeForKids: booleanish(false),
  isShort: booleanish(false),
  premiumOnly: booleanish(false),
  playlistId: z.string().optional(),
  language: z.string().max(10).default('en'),
});

/**
 * Upload entry point.
 *
 * The video is stored, a row is created in UPLOADING, and the processing
 * pipeline is enqueued. The video is not visible to anyone but its creator until
 * moderation has run — see PUBLISHED_VIDEO_WHERE.
 */
videosRouter.post(
  '/',
  requireAuth,
  uploadLimiter,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  handler(async (req, res) => {
    const context = auth(req);
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.video?.[0];
    if (!videoFile) throw badRequest('No video file was received.');

    const parsed = uploadMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      await fs.rm(videoFile.path, { force: true });
      throw parsed.error;
    }
    const meta = parsed.data;

    const channel = await prisma.channel.findUnique({ where: { ownerId: context.userId } });
    if (!channel) {
      await fs.rm(videoFile.path, { force: true });
      throw badRequest('Create your channel before uploading. Visit the studio to set one up.');
    }
    if (channel.suspended) {
      await fs.rm(videoFile.path, { force: true });
      throw forbidden('Uploads are paused on this channel.');
    }

    const videoId = newVideoSlug();
    const storageKey = mediaKey('video', videoId, path.extname(videoFile.originalname) || '.mp4');
    await storage.put(storageKey, videoFile.path, videoFile.mimetype);
    await fs.rm(videoFile.path, { force: true });

    let thumbnailUrl: string | null = null;
    const thumbFile = files?.thumbnail?.[0];
    if (thumbFile) {
      const check = checkThumbnailMetadata({
        originalFilename: thumbFile.originalname,
        mimeType: thumbFile.mimetype,
        sizeBytes: thumbFile.size,
      });
      if (!check.passed) {
        await fs.rm(thumbFile.path, { force: true });
        throw badRequest(check.reason ?? 'That thumbnail cannot be used.');
      }
      const thumbKey = mediaKey('thumbnail', videoId, path.extname(thumbFile.originalname) || '.jpg');
      await storage.put(thumbKey, thumbFile.path, thumbFile.mimetype);
      await fs.rm(thumbFile.path, { force: true });
      thumbnailUrl = storage.urlFor(thumbKey);
    }

    const tags = (meta.tags ?? '')
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 30);

    const video = await prisma.video.create({
      data: {
        id: videoId,
        slug: videoId,
        channelId: channel.id,
        title: meta.title.trim(),
        description: meta.description.trim(),
        categorySlug: meta.categorySlug,
        tags: stringifyJson(tags),
        language: meta.language,
        storageKey,
        thumbnailUrl,
        sizeBytes: videoFile.size,
        visibility: meta.visibility,
        scheduledFor: meta.scheduledFor ? new Date(meta.scheduledFor) : null,
        madeForKids: meta.madeForKids,
        isShort: meta.isShort,
        premiumOnly: meta.premiumOnly,
        status: 'UPLOADING',
      },
    });

    if (meta.playlistId) {
      const playlist = await prisma.playlist.findFirst({
        where: { id: meta.playlistId, ownerId: context.userId },
      });
      if (playlist) {
        await prisma.playlistVideo.create({
          data: { playlistId: playlist.id, videoId: video.id, position: playlist.itemCount },
        });
        await prisma.playlist.update({ where: { id: playlist.id }, data: { itemCount: { increment: 1 } } });
      }
    }

    await enqueuePipeline(video.id);
    await recordAudit({
      action: 'video.upload',
      targetType: 'VIDEO',
      targetId: video.id,
      summary: `Uploaded "${video.title}"`,
      req,
    });

    res.status(201).json({
      video: { id: video.id, slug: video.slug, title: video.title, status: 'PROCESSING' },
      message: 'Upload received. Your video is now in review — we will let you know as soon as it is done.',
    });
  }),
);

videosRouter.get(
  '/:idOrSlug/status',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const video = await prisma.video.findFirst({
      where: { OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }] },
      include: { channel: true, moderations: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();

    const moderation = video.moderations[0];
    res.json({
      status: video.status,
      visibility: video.visibility,
      christianContentVerified: video.christianContentVerified,
      pipeline: await pipelineStatus(video.id),
      // Creators see their scores and the outcome message, never the internal notes.
      review: moderation
        ? {
            decision: moderation.decision,
            message: moderation.creatorMessage,
            scores: parseJson(moderation.scores, {}),
            reviewedAt: moderation.createdAt.toISOString(),
            canAppeal: moderation.decision === 'REJECTED',
          }
        : null,
    });
  }),
);

videosRouter.get(
  '/:idOrSlug',
  attachAuth,
  handler(async (req, res) => {
    const video = await prisma.video.findFirst({
      where: { OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }] },
      select: { ...videoDetailSelect, removedAt: true, channel: { select: { ...videoDetailSelect.channel.select, ownerId: true } } },
    });
    if (!video || video.removedAt) throw notFound('That video is not available.');

    const ownerId = (video.channel as unknown as { ownerId: string }).ownerId;
    const isOwner = req.auth?.userId === ownerId;
    const isStaff = req.auth ? ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.auth.role) : false;
    const isPublic = video.status === 'PUBLISHED' && video.christianContentVerified;
    const isUnlisted = video.visibility === 'UNLISTED' && video.christianContentVerified && video.status === 'PUBLISHED';

    if (!isPublic && !isUnlisted && !isOwner && !isStaff) {
      throw notFound('That video is not available.');
    }
    if (video.premiumOnly && !req.auth?.isPremium && !isOwner && !isStaff) {
      throw forbidden('This video is part of FaithTube Premium.');
    }

    let viewerState = null;
    if (req.auth) {
      const [like, saved, subscription, history] = await Promise.all([
        prisma.videoLike.findUnique({ where: { videoId_userId: { videoId: video.id, userId: req.auth.userId } } }),
        prisma.savedVideo.findUnique({ where: { userId_videoId: { userId: req.auth.userId, videoId: video.id } } }),
        prisma.subscription.findUnique({
          where: { userId_channelId: { userId: req.auth.userId, channelId: video.channel.id } },
        }),
        prisma.watchHistory.findUnique({ where: { userId_videoId: { userId: req.auth.userId, videoId: video.id } } }),
      ]);
      viewerState = {
        liked: like?.value === 1,
        saved: Boolean(saved),
        subscribed: Boolean(subscription),
        progressSeconds: history?.progressSeconds ?? 0,
      };
    }

    res.json({ video: toVideoDetail(video as never, viewerState) });
  }),
);

videosRouter.get(
  '/:id/related',
  handler(async (req, res) => {
    res.json({ items: await relatedVideos(req.params.id, 14) });
  }),
);

const updateSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  description: z.string().max(6000).optional(),
  categorySlug: z.enum(CATEGORY_SLUGS as [string, ...string[]]).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  commentsEnabled: z.boolean().optional(),
  premiumOnly: z.boolean().optional(),
  madeForKids: z.boolean().optional(),
});

videosRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validateBody(updateSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof updateSchema>;
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();

    // A creator may edit metadata freely, but cannot make an unapproved video public.
    if (body.visibility && body.visibility !== 'PRIVATE' && !video.christianContentVerified) {
      throw badRequest('This video has not completed review yet, so it cannot be made public.');
    }

    // Re-running review on a substantive edit stops "approve then rewrite" abuse.
    const materialEdit =
      (body.title && body.title !== video.title) ||
      (body.description && body.description !== video.description) ||
      (body.categorySlug && body.categorySlug !== video.categorySlug);

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: {
        title: body.title?.trim(),
        description: body.description?.trim(),
        categorySlug: body.categorySlug,
        tags: body.tags ? stringifyJson(body.tags) : undefined,
        visibility: body.visibility,
        scheduledFor: body.scheduledFor === null ? null : body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        commentsEnabled: body.commentsEnabled,
        premiumOnly: body.premiumOnly,
        madeForKids: body.madeForKids,
      },
    });

    if (materialEdit && video.status === 'PUBLISHED') {
      await prisma.videoProcessingJob.create({ data: { videoId: video.id, kind: 'MODERATE', status: 'QUEUED' } });
      await recordAudit({
        action: 'video.reReview',
        targetType: 'VIDEO',
        targetId: video.id,
        summary: 'Metadata edited after publication; re-queued for review',
        req,
      });
    }

    res.json({ video: { id: updated.id, title: updated.title, visibility: updated.visibility, status: updated.status } });
  }),
);

videosRouter.post(
  '/:id/publish',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const context = auth(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();
    if (!video.christianContentVerified || video.status !== 'APPROVED') {
      throw badRequest('Only videos that have passed review can be published.');
    }
    await prisma.video.update({ where: { id: video.id }, data: { visibility: 'PUBLIC' } });
    await publishVideo(video.id);
    res.json({ ok: true, message: 'Your video is live.' });
  }),
);

videosRouter.delete(
  '/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();

    if (video.storageKey) await storage.delete(video.storageKey).catch(() => undefined);
    await prisma.video.delete({ where: { id: video.id } });
    if (video.status === 'PUBLISHED') {
      await prisma.channel.update({
        where: { id: video.channelId },
        data: { videoCount: { decrement: 1 } },
      });
    }
    await recordAudit({ action: 'video.delete', targetType: 'VIDEO', targetId: video.id, summary: `Deleted "${video.title}"`, req });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------- engagement

videosRouter.post(
  '/:id/like',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) })),
  handler(async (req, res) => {
    const context = auth(req);
    const { value } = req.body as { value: 1 | -1 | 0 };
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) throw notFound('No such video.');

    const existing = await prisma.videoLike.findUnique({
      where: { videoId_userId: { videoId: video.id, userId: context.userId } },
    });

    let likeDelta = 0;
    let dislikeDelta = 0;
    if (existing) {
      if (existing.value === 1) likeDelta -= 1;
      if (existing.value === -1) dislikeDelta -= 1;
    }
    if (value === 0) {
      if (existing) await prisma.videoLike.delete({ where: { id: existing.id } });
    } else {
      if (value === 1) likeDelta += 1;
      if (value === -1) dislikeDelta += 1;
      await prisma.videoLike.upsert({
        where: { videoId_userId: { videoId: video.id, userId: context.userId } },
        create: { videoId: video.id, userId: context.userId, value },
        update: { value },
      });
    }

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { likeCount: { increment: likeDelta }, dislikeCount: { increment: dislikeDelta } },
      select: { likeCount: true, dislikeCount: true },
    });
    res.json({ ...updated, value });
  }),
);

videosRouter.post(
  '/:id/save',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const context = auth(req);
    const existing = await prisma.savedVideo.findUnique({
      where: { userId_videoId: { userId: context.userId, videoId: req.params.id } },
    });
    if (existing) {
      await prisma.savedVideo.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }
    await prisma.savedVideo.create({ data: { userId: context.userId, videoId: req.params.id } });
    res.json({ saved: true });
  }),
);

const progressSchema = z.object({
  progressSeconds: z.number().min(0).max(86_400),
  watchedSeconds: z.number().min(0).max(86_400).default(0),
  completed: z.boolean().default(false),
});

/**
 * Watch progress. Also the point where a view is counted — once per user per
 * video, and only after 10 seconds of actual watching, so refreshes and
 * autoplay-scrolls do not inflate counts.
 */
videosRouter.post(
  '/:id/progress',
  requireAuth,
  validateBody(progressSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof progressSchema>;
    const video = await prisma.video.findUnique({ where: { id: req.params.id }, select: { id: true, durationSeconds: true } });
    if (!video) throw notFound('No such video.');

    const existing = await prisma.watchHistory.findUnique({
      where: { userId_videoId: { userId: context.userId, videoId: video.id } },
    });

    const watchDelta = Math.max(0, Math.round(body.watchedSeconds));
    const countsAsView = !existing && body.progressSeconds >= 10;

    await prisma.watchHistory.upsert({
      where: { userId_videoId: { userId: context.userId, videoId: video.id } },
      create: {
        userId: context.userId,
        videoId: video.id,
        progressSeconds: Math.round(body.progressSeconds),
        watchSeconds: watchDelta,
        completed: body.completed,
      },
      update: {
        progressSeconds: Math.round(body.progressSeconds),
        watchSeconds: { increment: watchDelta },
        completed: body.completed || existing?.completed,
        lastWatchedAt: new Date(),
      },
    });

    await prisma.video.update({
      where: { id: video.id },
      data: {
        totalWatchSeconds: { increment: watchDelta },
        viewCount: countsAsView ? { increment: 1 } : undefined,
      },
    });
    if (countsAsView) {
      await prisma.channel.update({
        where: { id: (await prisma.video.findUniqueOrThrow({ where: { id: video.id }, select: { channelId: true } })).channelId },
        data: { totalViews: { increment: 1 } },
      });
    }

    res.json({ ok: true, countedView: countsAsView });
  }),
);

const listQuerySchema = z.object({
  categorySlug: z.string().optional(),
  channelId: z.string().optional(),
  isShort: optionalBooleanish(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(24),
});

videosRouter.get(
  '/',
  validateQuery(listQuerySchema),
  handler(async (req, res) => {
    const params = query<z.infer<typeof listQuerySchema>>(req);
    const rows = await prisma.video.findMany({
      where: {
        ...PUBLISHED_VIDEO_WHERE,
        categorySlug: params.categorySlug,
        channelId: params.channelId,
        isShort: params.isShort,
      },
      select: videoSummarySelect,
      orderBy: { publishedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit).map(toVideoSummary);
    res.json({ items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null });
  }),
);
