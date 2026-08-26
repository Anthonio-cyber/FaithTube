import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CATEGORY_SLUGS } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { handler } from '../lib/async.js';
import { badRequest, notFound } from '../lib/errors.js';
import { newStorageKey } from '../lib/ids.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { mediaKey, storage } from '../services/storage.service.js';
import { toPublicUser, toVideoSummary, videoSummarySelect, PUBLISHED_VIDEO_WHERE } from '../services/serialize.js';
import { assertUsernameAvailable, revokeAllSessions, toSessionUser } from '../services/auth.service.js';
import { recordAudit } from '../services/audit.service.js';

export const usersRouter = Router();

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR, 'incoming');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, `${newStorageKey()}${path.extname(file.originalname).slice(0, 8)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Images must be JPEG, PNG or WebP.'));
      return;
    }
    cb(null, true);
  },
});

usersRouter.get(
  '/me',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      include: { channel: true, premium: true },
    });
    res.json({ user: toSessionUser(user) });
  }),
);

const profileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().length(2).nullable().optional(),
  interests: z.array(z.enum(CATEGORY_SLUGS as [string, ...string[]])).max(20).optional(),
  showEmailPublicly: z.boolean().optional(),
});

usersRouter.patch(
  '/me',
  requireAuth,
  writeLimiter,
  validateBody(profileSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof profileSchema>;
    const username = body.username ? await assertUsernameAvailable(body.username, context.userId) : undefined;

    const user = await prisma.user.update({
      where: { id: context.userId },
      data: {
        displayName: body.displayName?.trim(),
        username,
        bio: body.bio?.trim(),
        country: body.country === null ? null : body.country?.toUpperCase(),
        interests: body.interests ? stringifyJson(body.interests) : undefined,
        showEmailPublicly: body.showEmailPublicly,
      },
      include: { channel: true, premium: true },
    });
    res.json({ user: toSessionUser(user) });
  }),
);

usersRouter.post(
  '/me/avatar',
  requireAuth,
  writeLimiter,
  avatarUpload.single('avatar'),
  handler(async (req, res) => {
    const context = auth(req);
    if (!req.file) throw badRequest('No image was received.');

    const key = mediaKey('avatar', `${context.userId}-${Date.now()}`, path.extname(req.file.originalname) || '.jpg');
    await storage.put(key, req.file.path, req.file.mimetype);
    await fs.rm(req.file.path, { force: true });

    const user = await prisma.user.update({
      where: { id: context.userId },
      data: { avatarUrl: storage.urlFor(key) },
      include: { channel: true, premium: true },
    });
    res.json({ user: toSessionUser(user) });
  }),
);

usersRouter.get(
  '/:username',
  attachAuth,
  handler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username.replace(/^@/, '').toLowerCase() },
      include: { channel: true, premium: true },
    });
    if (!user || user.deletedAt) throw notFound('No such person.');

    const publicUser = toPublicUser(user);
    const publicPlaylists = await prisma.playlist.findMany({
      where: { ownerId: user.id, visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    });

    res.json({
      user: {
        ...publicUser,
        bio: user.bio,
        // A private email is never included unless the person opted in.
        email: user.showEmailPublicly ? user.email : null,
        channel: user.channel
          ? { id: user.channel.id, handle: user.channel.handle, name: user.channel.name, avatarUrl: user.channel.avatarUrl, subscriberCount: user.channel.subscriberCount }
          : null,
      },
      playlists: publicPlaylists.map((p) => ({ id: p.id, title: p.title, itemCount: p.itemCount, thumbnailUrl: p.thumbnailUrl })),
    });
  }),
);

/** GDPR-style export of everything the platform holds about the caller. */
usersRouter.get(
  '/me/export',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const [user, channel, videos, comments, playlists, history, subscriptions, reports, payments] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: context.userId } }),
      prisma.channel.findUnique({ where: { ownerId: context.userId } }),
      prisma.video.findMany({ where: { channel: { ownerId: context.userId } }, select: { id: true, title: true, status: true, createdAt: true } }),
      prisma.comment.findMany({ where: { authorId: context.userId }, select: { body: true, createdAt: true, videoId: true } }),
      prisma.playlist.findMany({ where: { ownerId: context.userId }, select: { title: true, visibility: true, itemCount: true } }),
      prisma.watchHistory.findMany({ where: { userId: context.userId }, select: { videoId: true, lastWatchedAt: true, watchSeconds: true } }),
      prisma.subscription.findMany({ where: { userId: context.userId }, select: { channelId: true, createdAt: true } }),
      prisma.report.findMany({ where: { reporterId: context.userId }, select: { reason: true, createdAt: true, status: true } }),
      prisma.payment.findMany({ where: { userId: context.userId }, select: { amountMinor: true, currency: true, status: true, createdAt: true } }),
    ]);

    res.setHeader('Content-Disposition', `attachment; filename="faithtube-export-${user.username}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        country: user.country,
        role: user.role,
        createdAt: user.createdAt,
        interests: parseJson(user.interests, []),
        notificationPreferences: parseJson(user.notificationPrefs, {}),
      },
      channel,
      videos,
      comments,
      playlists,
      watchHistory: history,
      subscriptions,
      reports,
      payments,
    });
  }),
);

usersRouter.post(
  '/me/delete',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ confirm: z.literal('DELETE MY ACCOUNT') })),
  handler(async (req, res) => {
    const context = auth(req);

    /**
     * Soft delete. Identifying fields are scrubbed and the account is closed;
     * published videos are unpublished rather than hard-deleted so that watch
     * history and moderation records of other users stay coherent.
     */
    const timestamp = Date.now();
    await prisma.$transaction([
      prisma.video.updateMany({
        where: { channel: { ownerId: context.userId } },
        data: { status: 'REMOVED', visibility: 'PRIVATE', removedAt: new Date(), removedReason: 'Account closed by the owner.' },
      }),
      prisma.channel.updateMany({ where: { ownerId: context.userId }, data: { suspended: true, suspendedReason: 'Account closed.' } }),
      prisma.user.update({
        where: { id: context.userId },
        data: {
          deletedAt: new Date(),
          email: `deleted-${timestamp}-${context.userId}@deleted.faithtube`,
          displayName: 'Former member',
          username: `deleted_${timestamp.toString(36)}`,
          avatarUrl: null,
          bio: null,
          passwordHash: null,
          googleId: null,
          country: null,
          dateOfBirth: null,
        },
      }),
    ]);

    await revokeAllSessions(context.userId);
    await recordAudit({ action: 'user.delete', targetType: 'USER', targetId: context.userId, summary: 'Account closed by its owner', req });
    res.json({ ok: true, message: 'Your account has been closed.' });
  }),
);

usersRouter.get(
  '/me/sessions',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const sessions = await prisma.session.findMany({
      where: { userId: context.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
    });
    res.json({
      items: sessions.map((session) => ({
        ...session,
        current: session.id === context.sessionId,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      })),
    });
  }),
);

usersRouter.delete(
  '/me/sessions/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    await prisma.session.updateMany({
      where: { id: req.params.id, userId: context.userId },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

usersRouter.get(
  '/me/liked',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const likes = await prisma.videoLike.findMany({
      where: { userId: context.userId, value: 1, video: PUBLISHED_VIDEO_WHERE },
      include: { video: { select: videoSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ items: likes.map((like) => toVideoSummary(like.video)) });
  }),
);
