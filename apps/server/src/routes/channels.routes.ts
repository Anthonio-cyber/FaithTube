import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { brand } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { handler } from '../lib/async.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { newStorageKey, normalizeHandle } from '../lib/ids.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { mediaKey, storage } from '../services/storage.service.js';
import { PUBLISHED_VIDEO_WHERE, toChannelSummary, toVideoSummary, videoSummarySelect } from '../services/serialize.js';
import { notify } from '../services/notification.service.js';
import { recordAudit } from '../services/audit.service.js';

export const channelsRouter = Router();

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR, 'incoming');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${newStorageKey()}${path.extname(file.originalname).slice(0, 8)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Images must be JPEG, PNG or WebP.'));
      return;
    }
    cb(null, true);
  },
});

const createSchema = z.object({
  name: z.string().min(2).max(60),
  handle: z.string().min(3).max(30),
  description: z.string().max(2000).default(''),
  ministryAffiliation: z.string().max(120).optional(),
  location: z.string().max(80).optional(),
  websiteUrl: z.string().url().max(200).optional(),
});

const RESERVED_HANDLES = new Set(['admin', 'faithtube', 'official', 'support', 'staff', 'moderator', 'help']);

channelsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validateBody(createSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof createSchema>;

    if (await prisma.channel.findUnique({ where: { ownerId: context.userId } })) {
      throw conflict('You already have a channel.');
    }
    const handle = normalizeHandle(body.handle);
    if (handle.length < 3) throw badRequest('Channel handles need at least 3 characters.');
    if (RESERVED_HANDLES.has(handle)) throw conflict('That handle is reserved.');
    if (await prisma.channel.findUnique({ where: { handle } })) throw conflict('That handle is already taken.');

    const channel = await prisma.channel.create({
      data: {
        ownerId: context.userId,
        handle,
        name: body.name.trim(),
        description: body.description.trim(),
        ministryAffiliation: body.ministryAffiliation,
        location: body.location,
        websiteUrl: body.websiteUrl,
      },
    });

    // Creating a channel promotes a viewer to creator; higher roles are untouched.
    if (context.role === 'VIEWER') {
      await prisma.user.update({ where: { id: context.userId }, data: { role: 'CREATOR' } });
    }

    await notify({
      userId: context.userId,
      type: 'ANNOUNCEMENT',
      title: `Welcome to ${brand.name} Studio`,
      body: `Your channel "${channel.name}" is ready. Every video you upload passes our Christ-centred review before it goes live.`,
      linkUrl: '/studio',
    });
    await recordAudit({ action: 'channel.create', targetType: 'CHANNEL', targetId: channel.id, summary: `Created channel @${handle}`, req });

    res.status(201).json({ channel: toChannelSummary(channel) });
  }),
);

channelsRouter.get(
  '/:handleOrId',
  attachAuth,
  handler(async (req, res) => {
    const key = req.params.handleOrId.replace(/^@/, '').toLowerCase();
    const channel = await prisma.channel.findFirst({
      where: { OR: [{ handle: key }, { id: req.params.handleOrId }] },
      include: { owner: { select: { id: true, displayName: true, username: true, createdAt: true } } },
    });
    if (!channel || channel.suspended) throw notFound('That channel is not available.');

    const [videoCount, subscription, featured] = await Promise.all([
      prisma.video.count({ where: { channelId: channel.id, ...PUBLISHED_VIDEO_WHERE } }),
      req.auth
        ? prisma.subscription.findUnique({
            where: { userId_channelId: { userId: req.auth.userId, channelId: channel.id } },
          })
        : null,
      channel.featuredVideoId
        ? prisma.video.findFirst({
            where: { id: channel.featuredVideoId, ...PUBLISHED_VIDEO_WHERE },
            select: videoSummarySelect,
          })
        : null,
    ]);

    res.json({
      channel: {
        ...toChannelSummary(channel),
        description: channel.description,
        location: channel.location,
        websiteUrl: channel.websiteUrl,
        ministryAffiliation: channel.ministryAffiliation,
        accentColor: channel.accentColor,
        createdAt: channel.createdAt.toISOString(),
        videoCount,
        totalViews: channel.totalViews,
        owner: { displayName: channel.owner.displayName, username: channel.owner.username },
        isOwner: req.auth?.userId === channel.ownerId,
      },
      featuredVideo: featured ? toVideoSummary(featured) : null,
      subscribed: Boolean(subscription),
      notifyUploads: subscription?.notifyUploads ?? false,
    });
  }),
);

channelsRouter.get(
  '/:handleOrId/videos',
  handler(async (req, res) => {
    const key = req.params.handleOrId.replace(/^@/, '').toLowerCase();
    const channel = await prisma.channel.findFirst({ where: { OR: [{ handle: key }, { id: req.params.handleOrId }] } });
    if (!channel) throw notFound('That channel is not available.');

    const tab = String(req.query.tab ?? 'videos');
    const sort = String(req.query.sort ?? 'newest');

    const videos = await prisma.video.findMany({
      where: {
        channelId: channel.id,
        ...PUBLISHED_VIDEO_WHERE,
        isShort: tab === 'clips' ? true : tab === 'videos' ? false : undefined,
        isLive: tab === 'live' ? true : undefined,
      },
      select: videoSummarySelect,
      orderBy: sort === 'popular' ? { viewCount: 'desc' } : { publishedAt: 'desc' },
      take: 48,
    });

    res.json({ items: videos.map(toVideoSummary) });
  }),
);

channelsRouter.get(
  '/:handleOrId/playlists',
  handler(async (req, res) => {
    const key = req.params.handleOrId.replace(/^@/, '').toLowerCase();
    const channel = await prisma.channel.findFirst({ where: { OR: [{ handle: key }, { id: req.params.handleOrId }] } });
    if (!channel) throw notFound('That channel is not available.');

    const playlists = await prisma.playlist.findMany({
      where: { ownerId: channel.ownerId, visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
    res.json({
      items: playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        itemCount: p.itemCount,
        thumbnailUrl: p.thumbnailUrl,
      })),
    });
  }),
);

const updateSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(80).nullable().optional(),
  websiteUrl: z.string().url().max(200).nullable().optional(),
  ministryAffiliation: z.string().max(120).nullable().optional(),
  featuredVideoId: z.string().nullable().optional(),
  /** Restricted to the platform palette so customisation cannot break the design system. */
  accentColor: z.enum(['navy', 'gold', 'plum', 'verified']).nullable().optional(),
});

channelsRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validateBody(updateSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof updateSchema>;
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) throw notFound('No such channel.');
    if (channel.ownerId !== context.userId) throw forbidden();

    if (body.featuredVideoId) {
      const video = await prisma.video.findFirst({
        where: { id: body.featuredVideoId, channelId: channel.id, ...PUBLISHED_VIDEO_WHERE },
      });
      if (!video) throw badRequest('You can only feature one of your own published videos.');
    }

    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: body.name?.trim(),
        description: body.description?.trim(),
        location: body.location,
        websiteUrl: body.websiteUrl,
        ministryAffiliation: body.ministryAffiliation,
        featuredVideoId: body.featuredVideoId,
        accentColor: body.accentColor ? brand.palette[body.accentColor] : body.accentColor,
      },
    });
    res.json({ channel: toChannelSummary(updated) });
  }),
);

channelsRouter.post(
  '/:id/images',
  requireAuth,
  writeLimiter,
  imageUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) throw notFound('No such channel.');
    if (channel.ownerId !== context.userId) throw forbidden();

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const data: { avatarUrl?: string; bannerUrl?: string } = {};

    for (const [field, kind] of [
      ['avatar', 'avatar'],
      ['banner', 'banner'],
    ] as const) {
      const file = files?.[field]?.[0];
      if (!file) continue;
      const key = mediaKey(kind, `${channel.id}-${Date.now()}`, path.extname(file.originalname) || '.jpg');
      await storage.put(key, file.path, file.mimetype);
      await fs.rm(file.path, { force: true });
      if (field === 'avatar') data.avatarUrl = storage.urlFor(key);
      else data.bannerUrl = storage.urlFor(key);
    }

    if (!Object.keys(data).length) throw badRequest('No image was received.');
    const updated = await prisma.channel.update({ where: { id: channel.id }, data });
    res.json({ channel: toChannelSummary(updated) });
  }),
);

// ----------------------------------------------------------- subscriptions

channelsRouter.post(
  '/:id/subscribe',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) throw notFound('No such channel.');
    if (channel.ownerId === context.userId) throw badRequest('You cannot subscribe to your own channel.');

    const existing = await prisma.subscription.findUnique({
      where: { userId_channelId: { userId: context.userId, channelId: channel.id } },
    });

    if (existing) {
      await prisma.subscription.delete({ where: { id: existing.id } });
      const updated = await prisma.channel.update({
        where: { id: channel.id },
        data: { subscriberCount: { decrement: 1 } },
        select: { subscriberCount: true },
      });
      return res.json({ subscribed: false, subscriberCount: updated.subscriberCount });
    }

    await prisma.subscription.create({ data: { userId: context.userId, channelId: channel.id } });
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: { subscriberCount: { increment: 1 } },
      select: { subscriberCount: true },
    });

    const subscriber = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { displayName: true },
    });
    await notify({
      userId: channel.ownerId,
      type: 'NEW_SUBSCRIBER',
      title: 'New subscriber',
      body: `${subscriber.displayName} subscribed to ${channel.name}.`,
      linkUrl: `/studio/audience`,
    });

    res.json({ subscribed: true, subscriberCount: updated.subscriberCount });
  }),
);

channelsRouter.patch(
  '/:id/subscription',
  requireAuth,
  validateBody(z.object({ notifyUploads: z.boolean().optional(), notifyLive: z.boolean().optional() })),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as { notifyUploads?: boolean; notifyLive?: boolean };
    const subscription = await prisma.subscription.findUnique({
      where: { userId_channelId: { userId: context.userId, channelId: req.params.id } },
    });
    if (!subscription) throw notFound('You are not subscribed to that channel.');

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { notifyUploads: body.notifyUploads, notifyLive: body.notifyLive },
    });
    res.json({ notifyUploads: updated.notifyUploads, notifyLive: updated.notifyLive });
  }),
);

channelsRouter.get(
  '/me/subscriptions',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const subs = await prisma.subscription.findMany({
      where: { userId: context.userId },
      include: { channel: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: subs.map((sub) => ({
        ...toChannelSummary(sub.channel),
        notifyUploads: sub.notifyUploads,
        notifyLive: sub.notifyLive,
        subscribedAt: sub.createdAt.toISOString(),
      })),
    });
  }),
);
