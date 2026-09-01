import { Router } from 'express';
import { z } from 'zod';
import { CATEGORY_SLUGS } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { moderateComment } from '../ai/commentModerator.js';
import { notifySubscribers } from '../services/notification.service.js';
import { recordAudit } from '../services/audit.service.js';

export const liveRouter = Router();

liveRouter.get(
  '/',
  handler(async (_req, res) => {
    const [live, upcoming] = await Promise.all([
      prisma.livestream.findMany({
        where: { status: 'LIVE', moderationStatus: { not: 'BLOCKED' } },
        include: { channel: true },
        orderBy: { currentViewers: 'desc' },
        take: 30,
      }),
      prisma.livestream.findMany({
        where: { status: 'SCHEDULED', scheduledFor: { gte: new Date() }, moderationStatus: { not: 'BLOCKED' } },
        include: { channel: true },
        orderBy: { scheduledFor: 'asc' },
        take: 30,
      }),
    ]);

    const shape = (stream: (typeof live)[number]) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      categorySlug: stream.categorySlug,
      thumbnailUrl: stream.thumbnailUrl,
      status: stream.status,
      currentViewers: stream.currentViewers,
      peakViewers: stream.peakViewers,
      scheduledFor: stream.scheduledFor?.toISOString() ?? null,
      startedAt: stream.startedAt?.toISOString() ?? null,
      playbackUrl: stream.playbackUrl,
      channel: {
        id: stream.channel.id,
        name: stream.channel.name,
        handle: stream.channel.handle,
        avatarUrl: stream.channel.avatarUrl,
        subscriberCount: stream.channel.subscriberCount,
      },
    });

    res.json({ live: live.map(shape), upcoming: upcoming.map(shape) });
  }),
);

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(3000).default(''),
  categorySlug: z.enum(CATEGORY_SLUGS as [string, ...string[]]).default('worship'),
  scheduledFor: z.string().datetime().optional(),
  chatEnabled: z.boolean().default(true),
});

/**
 * Creating a stream returns the stream key exactly once. It is stored hashed,
 * so it cannot be read back later — a lost key has to be rotated.
 */
liveRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validateBody(createSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof createSchema>;
    const channel = await prisma.channel.findUnique({ where: { ownerId: context.userId } });
    if (!channel) throw badRequest('Create a channel before going live.');
    if (channel.suspended) throw forbidden('Live streaming is paused on this channel.');

    const streamKey = randomToken(24);
    const stream = await prisma.livestream.create({
      data: {
        channelId: channel.id,
        title: body.title.trim(),
        description: body.description.trim(),
        categorySlug: body.categorySlug,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        chatEnabled: body.chatEnabled,
        streamKeyHash: sha256(streamKey),
        ingestUrl: env.LIVE_INGEST_BASE ?? null,
        playbackUrl: env.LIVE_PLAYBACK_BASE ? `${env.LIVE_PLAYBACK_BASE.replace(/\/$/, '')}/${channel.handle}.m3u8` : null,
      },
    });

    res.status(201).json({
      stream: { id: stream.id, title: stream.title, status: stream.status },
      streamKey,
      ingestUrl: stream.ingestUrl,
      // Without an ingest service the platform still manages the stream record,
      // schedule and chat; it just cannot receive video.
      ingestConfigured: Boolean(env.LIVE_INGEST_BASE && env.LIVE_PLAYBACK_BASE),
      setupNote: env.LIVE_INGEST_BASE
        ? 'Point your encoder at the ingest URL using this stream key. Save the key now — it is not shown again.'
        : 'Live broadcasting is not switched on for this site yet. You can still schedule this stream and open its ' +
          'chat — it just cannot receive video until an administrator connects a streaming service.',
    });
  }),
);

liveRouter.post(
  '/:id/start',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const stream = await prisma.livestream.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!stream) throw notFound('No such stream.');
    if (stream.channel.ownerId !== context.userId) throw forbidden();
    if (stream.moderationStatus === 'BLOCKED') throw forbidden('This stream has been blocked by a moderator.');

    await prisma.livestream.update({
      where: { id: stream.id },
      data: { status: 'LIVE', startedAt: new Date() },
    });

    await notifySubscribers(
      stream.channelId,
      {
        type: 'LIVE',
        title: `${stream.channel.name} is live`,
        body: stream.title,
        linkUrl: `/live/${stream.id}`,
      },
      'notifyLive',
    );

    res.json({ ok: true, status: 'LIVE' });
  }),
);

liveRouter.post(
  '/:id/end',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const stream = await prisma.livestream.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!stream) throw notFound('No such stream.');
    if (stream.channel.ownerId !== context.userId) throw forbidden();

    await prisma.livestream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt: new Date(), currentViewers: 0 },
    });
    res.json({ ok: true, status: 'ENDED' });
  }),
);

liveRouter.get(
  '/:id',
  attachAuth,
  handler(async (req, res) => {
    const stream = await prisma.livestream.findUnique({
      where: { id: req.params.id },
      include: { channel: true },
    });
    if (!stream || stream.moderationStatus === 'BLOCKED') throw notFound('That stream is not available.');

    res.json({
      stream: {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        categorySlug: stream.categorySlug,
        status: stream.status,
        playbackUrl: stream.playbackUrl,
        chatEnabled: stream.chatEnabled,
        currentViewers: stream.currentViewers,
        peakViewers: stream.peakViewers,
        scheduledFor: stream.scheduledFor?.toISOString() ?? null,
        startedAt: stream.startedAt?.toISOString() ?? null,
        isOwner: req.auth?.userId === stream.channel.ownerId,
        channel: {
          id: stream.channel.id,
          name: stream.channel.name,
          handle: stream.channel.handle,
          avatarUrl: stream.channel.avatarUrl,
          subscriberCount: stream.channel.subscriberCount,
        },
      },
    });
  }),
);

liveRouter.get(
  '/:id/chat',
  handler(async (req, res) => {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(Date.now() - 10 * 60_000);
    const messages = await prisma.liveChatMessage.findMany({
      where: { livestreamId: req.params.id, status: 'VISIBLE', createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const authorIds = [...new Set(messages.map((m) => m.authorId))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, username: true, avatarUrl: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    res.json({
      items: messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        author: authorMap.get(message.authorId) ?? null,
      })),
      serverTime: new Date().toISOString(),
    });
  }),
);

/** Live chat is screened by the same classifier as comments, message by message. */
liveRouter.post(
  '/:id/chat',
  requireAuth,
  validateBody(z.object({ body: z.string().min(1).max(500) })),
  handler(async (req, res) => {
    const context = auth(req);
    const stream = await prisma.livestream.findUnique({ where: { id: req.params.id } });
    if (!stream) throw notFound('No such stream.');
    if (!stream.chatEnabled) throw badRequest('Chat is turned off for this stream.');
    if (stream.status !== 'LIVE') throw badRequest('This stream is not live.');

    const verdict = moderateComment((req.body as { body: string }).body);
    const message = await prisma.liveChatMessage.create({
      data: {
        livestreamId: stream.id,
        authorId: context.userId,
        body: (req.body as { body: string }).body.trim(),
        status: verdict.action === 'ALLOW' ? 'VISIBLE' : 'REMOVED',
        moderationLabel: verdict.label,
      },
    });

    if (verdict.action !== 'ALLOW') {
      return res.status(202).json({ posted: false, message: 'That message was not posted.' });
    }
    res.status(201).json({ posted: true, id: message.id });
  }),
);

liveRouter.post(
  '/:id/heartbeat',
  handler(async (req, res) => {
    // Viewer presence: a simple counter the player pings while watching.
    const delta = Number(req.body?.delta ?? 1);
    const stream = await prisma.livestream.findUnique({ where: { id: req.params.id } });
    if (!stream) throw notFound('No such stream.');

    const current = Math.max(0, stream.currentViewers + (delta > 0 ? 1 : -1));
    await prisma.livestream.update({
      where: { id: stream.id },
      data: { currentViewers: current, peakViewers: Math.max(stream.peakViewers, current) },
    });
    res.json({ currentViewers: current });
  }),
);

liveRouter.post(
  '/:id/rotate-key',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const stream = await prisma.livestream.findUnique({ where: { id: req.params.id }, include: { channel: true } });
    if (!stream) throw notFound('No such stream.');
    if (stream.channel.ownerId !== context.userId) throw forbidden();

    const streamKey = randomToken(24);
    await prisma.livestream.update({ where: { id: stream.id }, data: { streamKeyHash: sha256(streamKey) } });
    await recordAudit({ action: 'live.rotateKey', targetType: 'LIVESTREAM', targetId: stream.id, summary: 'Stream key rotated', req });
    res.json({ streamKey });
  }),
);
