import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { auth, requireAuth, attachAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { PUBLISHED_VIDEO_WHERE, toVideoSummary, videoSummarySelect } from '../services/serialize.js';

export const libraryRouter = Router();

// ------------------------------------------------------------------ history

libraryRouter.get(
  '/history',
  requireAuth,
  validateQuery(z.object({ limit: z.coerce.number().min(1).max(100).default(40), cursor: z.string().optional() })),
  handler(async (req, res) => {
    const context = auth(req);
    const params = query<{ limit: number; cursor?: string }>(req);

    const rows = await prisma.watchHistory.findMany({
      where: { userId: context.userId, video: PUBLISHED_VIDEO_WHERE },
      include: { video: { select: videoSummarySelect } },
      orderBy: { lastWatchedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);
    res.json({
      items: page.map((entry) => ({
        ...toVideoSummary(entry.video),
        progressSeconds: entry.progressSeconds,
        completed: entry.completed,
        lastWatchedAt: entry.lastWatchedAt.toISOString(),
        historyId: entry.id,
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

libraryRouter.delete(
  '/history/:videoId',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    await prisma.watchHistory.deleteMany({ where: { userId: context.userId, videoId: req.params.videoId } });
    res.json({ ok: true });
  }),
);

libraryRouter.delete(
  '/history',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const { count } = await prisma.watchHistory.deleteMany({ where: { userId: context.userId } });
    res.json({ ok: true, removed: count });
  }),
);

libraryRouter.get(
  '/continue-watching',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const rows = await prisma.watchHistory.findMany({
      where: {
        userId: context.userId,
        completed: false,
        progressSeconds: { gt: 15 },
        video: PUBLISHED_VIDEO_WHERE,
      },
      include: { video: { select: videoSummarySelect } },
      orderBy: { lastWatchedAt: 'desc' },
      take: 20,
    });

    // Anything within 30 seconds of the end is effectively finished.
    const items = rows
      .filter((entry) => entry.video.durationSeconds - entry.progressSeconds > 30)
      .map((entry) => ({
        ...toVideoSummary(entry.video),
        progressSeconds: entry.progressSeconds,
        percentComplete: entry.video.durationSeconds
          ? Math.min(99, Math.round((entry.progressSeconds / entry.video.durationSeconds) * 100))
          : 0,
      }));

    res.json({ items });
  }),
);

libraryRouter.get(
  '/saved',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const rows = await prisma.savedVideo.findMany({
      where: { userId: context.userId, video: PUBLISHED_VIDEO_WHERE },
      include: { video: { select: videoSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: rows.map((row) => toVideoSummary(row.video)) });
  }),
);

// ---------------------------------------------------------------- playlists

const playlistCreate = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).default(''),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PRIVATE'),
  videoIds: z.array(z.string()).max(200).optional(),
});

libraryRouter.post(
  '/playlists',
  requireAuth,
  writeLimiter,
  validateBody(playlistCreate),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof playlistCreate>;

    const playlist = await prisma.playlist.create({
      data: {
        ownerId: context.userId,
        title: body.title.trim(),
        description: body.description.trim(),
        visibility: body.visibility,
      },
    });

    if (body.videoIds?.length) {
      // Only approved, published videos may be added — a private playlist is not
      // a route around moderation.
      const valid = await prisma.video.findMany({
        where: { id: { in: body.videoIds }, ...PUBLISHED_VIDEO_WHERE },
        select: { id: true, thumbnailUrl: true },
      });
      await prisma.playlistVideo.createMany({
        data: valid.map((video, index) => ({ playlistId: playlist.id, videoId: video.id, position: index })),
      });
      await prisma.playlist.update({
        where: { id: playlist.id },
        data: { itemCount: valid.length, thumbnailUrl: valid[0]?.thumbnailUrl },
      });
    }

    res.status(201).json({ playlist: { id: playlist.id, title: playlist.title, visibility: playlist.visibility } });
  }),
);

libraryRouter.get(
  '/playlists',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const playlists = await prisma.playlist.findMany({
      where: { ownerId: context.userId },
      orderBy: [{ systemKey: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json({
      items: playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        visibility: p.visibility,
        itemCount: p.itemCount,
        thumbnailUrl: p.thumbnailUrl,
        systemKey: p.systemKey,
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  }),
);

libraryRouter.get(
  '/playlists/:id',
  attachAuth,
  handler(async (req, res) => {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, displayName: true, username: true } },
        items: {
          include: { video: { select: videoSummarySelect } },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!playlist) throw notFound('No such playlist.');

    const isOwner = req.auth?.userId === playlist.ownerId;
    if (playlist.visibility === 'PRIVATE' && !isOwner) throw notFound('No such playlist.');

    res.json({
      playlist: {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        visibility: playlist.visibility,
        itemCount: playlist.itemCount,
        owner: playlist.owner,
        isOwner,
      },
      // A video removed after being added must not resurface through a playlist.
      items: playlist.items
        .filter((item) => item.video.christianContentVerified)
        .map((item) => ({ ...toVideoSummary(item.video), position: item.position })),
    });
  }),
);

libraryRouter.patch(
  '/playlists/:id',
  requireAuth,
  writeLimiter,
  validateBody(
    z.object({
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
    }),
  ),
  handler(async (req, res) => {
    const context = auth(req);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound('No such playlist.');
    if (playlist.ownerId !== context.userId) throw forbidden();
    if (playlist.systemKey) throw badRequest('System playlists cannot be renamed.');

    const updated = await prisma.playlist.update({ where: { id: playlist.id }, data: req.body });
    res.json({ playlist: { id: updated.id, title: updated.title, visibility: updated.visibility } });
  }),
);

libraryRouter.post(
  '/playlists/:id/videos',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ videoId: z.string() })),
  handler(async (req, res) => {
    const context = auth(req);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound('No such playlist.');
    if (playlist.ownerId !== context.userId) throw forbidden();

    const video = await prisma.video.findFirst({
      where: { id: (req.body as { videoId: string }).videoId, ...PUBLISHED_VIDEO_WHERE },
      select: { id: true, thumbnailUrl: true },
    });
    if (!video) throw badRequest('That video is not available to add.');

    const existing = await prisma.playlistVideo.findUnique({
      where: { playlistId_videoId: { playlistId: playlist.id, videoId: video.id } },
    });
    if (existing) return res.json({ ok: true, alreadyPresent: true });

    await prisma.playlistVideo.create({
      data: { playlistId: playlist.id, videoId: video.id, position: playlist.itemCount },
    });
    await prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        itemCount: { increment: 1 },
        thumbnailUrl: playlist.thumbnailUrl ?? video.thumbnailUrl,
      },
    });
    res.json({ ok: true });
  }),
);

libraryRouter.delete(
  '/playlists/:id/videos/:videoId',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound('No such playlist.');
    if (playlist.ownerId !== context.userId) throw forbidden();

    const { count } = await prisma.playlistVideo.deleteMany({
      where: { playlistId: playlist.id, videoId: req.params.videoId },
    });
    if (count) {
      await prisma.playlist.update({ where: { id: playlist.id }, data: { itemCount: { decrement: count } } });
    }
    res.json({ ok: true, removed: count });
  }),
);

libraryRouter.post(
  '/playlists/:id/reorder',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ videoIds: z.array(z.string()).min(1).max(500) })),
  handler(async (req, res) => {
    const context = auth(req);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound('No such playlist.');
    if (playlist.ownerId !== context.userId) throw forbidden();

    const { videoIds } = req.body as { videoIds: string[] };
    await prisma.$transaction(
      videoIds.map((videoId, index) =>
        prisma.playlistVideo.updateMany({
          where: { playlistId: playlist.id, videoId },
          data: { position: index },
        }),
      ),
    );
    res.json({ ok: true });
  }),
);

libraryRouter.delete(
  '/playlists/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound('No such playlist.');
    if (playlist.ownerId !== context.userId) throw forbidden();
    if (playlist.systemKey) throw badRequest('System playlists cannot be deleted.');

    await prisma.playlist.delete({ where: { id: playlist.id } });
    res.json({ ok: true });
  }),
);
