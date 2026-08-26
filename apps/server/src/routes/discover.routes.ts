import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES, type VideoSource } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { parseJson } from '../lib/json.js';
import { attachAuth } from '../middleware/auth.js';
import { validateQuery, query } from '../middleware/validate.js';
import { PUBLISHED_VIDEO_WHERE, toVideoSummary, videoSummarySelect } from '../services/serialize.js';
import { recommendForUser, trendingVideos } from '../services/recommendation.service.js';

export const discoverRouter = Router();

/**
 * The home page in one request: hero, continue watching, recommendations,
 * trending, and a rail per category. Composed server-side so a first visit is
 * one round trip on a slow connection.
 */
discoverRouter.get(
  '/home',
  attachAuth,
  handler(async (req, res) => {
    const userId = req.auth?.userId ?? null;

    const [featured, recommended, trending, recent, continueWatching, liveNow] = await Promise.all([
      heroVideo(),
      recommendForUser(userId, { limit: 20 }),
      trendingVideos({ limit: 18 }),
      prisma.video
        .findMany({
          where: { ...PUBLISHED_VIDEO_WHERE, isShort: false },
          select: videoSummarySelect,
          orderBy: { publishedAt: 'desc' },
          take: 18,
        })
        .then((rows) => rows.map(toVideoSummary)),
      userId ? continueWatchingFor(userId) : Promise.resolve([]),
      prisma.livestream
        .findMany({
          where: { status: 'LIVE', moderationStatus: { not: 'BLOCKED' } },
          include: { channel: true },
          orderBy: { currentViewers: 'desc' },
          take: 8,
        })
        .then((rows) =>
          rows.map((stream) => ({
            id: stream.id,
            title: stream.title,
            thumbnailUrl: stream.thumbnailUrl,
            categorySlug: stream.categorySlug,
            currentViewers: stream.currentViewers,
            startedAt: stream.startedAt?.toISOString() ?? null,
            channel: { id: stream.channel.id, name: stream.channel.name, handle: stream.channel.handle, avatarUrl: stream.channel.avatarUrl },
          })),
        ),
    ]);

    // Category rails are limited to those that actually have content, so the
    // home page never shows an empty section.
    const rails = await Promise.all(
      CATEGORIES.map(async (category) => {
        const rows = await prisma.video.findMany({
          where: { ...PUBLISHED_VIDEO_WHERE, categorySlug: category.slug, isShort: false },
          select: videoSummarySelect,
          orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
          take: 14,
        });
        return { category, items: rows.map(toVideoSummary) };
      }),
    );

    res.json({
      hero: featured,
      continueWatching,
      recommended,
      trending,
      recent,
      liveNow,
      rails: rails.filter((rail) => rail.items.length >= 3),
    });
  }),
);

async function heroVideo() {
  // An admin-curated hero wins; otherwise the strongest recent video stands in.
  const featured = await prisma.featuredItem.findFirst({
    where: {
      placement: 'HERO',
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (featured?.videoId) {
    const video = await prisma.video.findFirst({
      where: { id: featured.videoId, ...PUBLISHED_VIDEO_WHERE },
      select: videoSummarySelect,
    });
    if (video) {
      return {
        video: toVideoSummary(video),
        title: featured.title,
        subtitle: featured.subtitle,
        curated: true,
      };
    }
  }

  const fallback = await prisma.video.findFirst({
    where: { ...PUBLISHED_VIDEO_WHERE, isShort: false, durationSeconds: { gt: 300 } },
    select: videoSummarySelect,
    orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
  });
  return fallback ? { video: toVideoSummary(fallback), title: null, subtitle: null, curated: false } : null;
}

async function continueWatchingFor(userId: string) {
  const rows = await prisma.watchHistory.findMany({
    where: { userId, completed: false, progressSeconds: { gt: 15 }, video: PUBLISHED_VIDEO_WHERE },
    include: { video: { select: videoSummarySelect } },
    orderBy: { lastWatchedAt: 'desc' },
    take: 12,
  });
  return rows
    .filter((entry) => entry.video.durationSeconds - entry.progressSeconds > 30)
    .map((entry) => ({
      ...toVideoSummary(entry.video),
      progressSeconds: entry.progressSeconds,
      percentComplete: entry.video.durationSeconds
        ? Math.min(99, Math.round((entry.progressSeconds / entry.video.durationSeconds) * 100))
        : 0,
    }));
}

discoverRouter.get(
  '/trending',
  validateQuery(z.object({ categorySlug: z.string().optional(), limit: z.coerce.number().min(1).max(50).default(30) })),
  handler(async (req, res) => {
    const params = query<{ categorySlug?: string; limit: number }>(req);
    res.json({ items: await trendingVideos(params) });
  }),
);

discoverRouter.get(
  '/recommendations',
  attachAuth,
  validateQuery(z.object({ limit: z.coerce.number().min(1).max(50).default(24), exclude: z.string().optional() })),
  handler(async (req, res) => {
    const params = query<{ limit: number; exclude?: string }>(req);
    const items = await recommendForUser(req.auth?.userId ?? null, {
      limit: params.limit,
      excludeVideoIds: params.exclude ? params.exclude.split(',') : [],
    });
    res.json({ items });
  }),
);

discoverRouter.get(
  '/categories',
  handler(async (_req, res) => {
    const counts = await prisma.video.groupBy({
      by: ['categorySlug'],
      where: PUBLISHED_VIDEO_WHERE,
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((row) => [row.categorySlug, row._count._all]));

    res.json({
      items: CATEGORIES.map((category) => ({
        ...category,
        videoCount: countMap.get(category.slug) ?? 0,
      })),
    });
  }),
);

discoverRouter.get(
  '/categories/:slug',
  validateQuery(
    z.object({
      sort: z.enum(['newest', 'popular', 'trending']).default('trending'),
      limit: z.coerce.number().min(1).max(50).default(30),
      cursor: z.string().optional(),
    }),
  ),
  handler(async (req, res) => {
    const params = query<{ sort: string; limit: number; cursor?: string }>(req);
    const category = CATEGORIES.find((c) => c.slug === req.params.slug);
    if (!category) return res.status(404).json({ error: 'not_found', message: 'No such category.' });

    if (params.sort === 'trending') {
      return res.json({
        category,
        items: await trendingVideos({ categorySlug: category.slug, limit: params.limit }),
        nextCursor: null,
      });
    }

    const rows = await prisma.video.findMany({
      where: { ...PUBLISHED_VIDEO_WHERE, categorySlug: category.slug, isShort: false },
      select: videoSummarySelect,
      orderBy: params.sort === 'popular' ? { viewCount: 'desc' } : { publishedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit).map(toVideoSummary);
    res.json({ category, items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null });
  }),
);

/** Faith Clips — the platform's short-form vertical feed. */
discoverRouter.get(
  '/clips',
  attachAuth,
  validateQuery(z.object({ limit: z.coerce.number().min(1).max(30).default(12), cursor: z.string().optional() })),
  handler(async (req, res) => {
    const params = query<{ limit: number; cursor?: string }>(req);

    const seen = req.auth
      ? (
          await prisma.watchHistory.findMany({
            where: { userId: req.auth.userId, video: { isShort: true }, completed: true },
            select: { videoId: true },
            take: 300,
          })
        ).map((h) => h.videoId)
      : [];

    // Clips need their playable sources inline: the vertical feed swaps between
    // videos as you scroll, so a second request per clip would stall it.
    const rows = await prisma.video.findMany({
      where: { ...PUBLISHED_VIDEO_WHERE, isShort: true, id: seen.length ? { notIn: seen } : undefined },
      select: { ...videoSummarySelect, sources: true },
      orderBy: [{ publishedAt: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit).map((row) => ({
      ...toVideoSummary(row),
      sources: parseJson<VideoSource[]>(row.sources, []),
    }));
    res.json({ items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null });
  }),
);

/** The Connect tab: latest from every channel the viewer follows. */
discoverRouter.get(
  '/subscriptions-feed',
  attachAuth,
  handler(async (req, res) => {
    if (!req.auth) return res.json({ items: [], channels: [] });

    const subs = await prisma.subscription.findMany({
      where: { userId: req.auth.userId },
      include: { channel: true },
    });
    const channelIds = subs.map((s) => s.channelId);
    if (!channelIds.length) return res.json({ items: [], channels: [] });

    const rows = await prisma.video.findMany({
      where: { ...PUBLISHED_VIDEO_WHERE, channelId: { in: channelIds } },
      select: videoSummarySelect,
      orderBy: { publishedAt: 'desc' },
      take: 60,
    });

    res.json({
      items: rows.map(toVideoSummary),
      channels: subs.map((sub) => ({
        id: sub.channel.id,
        name: sub.channel.name,
        handle: sub.channel.handle,
        avatarUrl: sub.channel.avatarUrl,
      })),
    });
  }),
);
