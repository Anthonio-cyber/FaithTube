import { Router } from 'express';
import { z } from 'zod';
import { DEFAULT_NOTIFICATION_PREFS } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { parseJson, stringifyJson } from '../lib/json.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  requireAuth,
  validateQuery(
    z.object({
      unreadOnly: z.coerce.boolean().default(false),
      limit: z.coerce.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }),
  ),
  handler(async (req, res) => {
    const context = auth(req);
    const params = query<{ unreadOnly: boolean; limit: number; cursor?: string }>(req);

    const rows = await prisma.notification.findMany({
      where: { userId: context.userId, readAt: params.unreadOnly ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);
    const unreadCount = await prisma.notification.count({ where: { userId: context.userId, readAt: null } });

    res.json({
      items: page.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        imageUrl: n.imageUrl,
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

notificationsRouter.post(
  '/read',
  requireAuth,
  validateBody(z.object({ ids: z.array(z.string()).max(200).optional() })),
  handler(async (req, res) => {
    const context = auth(req);
    const { ids } = req.body as { ids?: string[] };
    const { count } = await prisma.notification.updateMany({
      where: { userId: context.userId, readAt: null, id: ids ? { in: ids } : undefined },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, marked: count });
  }),
);

notificationsRouter.delete(
  '/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    await prisma.notification.deleteMany({ where: { id: req.params.id, userId: context.userId } });
    res.json({ ok: true });
  }),
);

const prefsSchema = z.object({
  newUploads: z.boolean().optional(),
  newSubscribers: z.boolean().optional(),
  comments: z.boolean().optional(),
  replies: z.boolean().optional(),
  live: z.boolean().optional(),
  moderation: z.boolean().optional(),
  premium: z.boolean().optional(),
  announcements: z.boolean().optional(),
  email: z.boolean().optional(),
});

notificationsRouter.get(
  '/preferences',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { notificationPrefs: true },
    });
    res.json({ preferences: { ...DEFAULT_NOTIFICATION_PREFS, ...parseJson(user.notificationPrefs, {}) } });
  }),
);

notificationsRouter.patch(
  '/preferences',
  requireAuth,
  validateBody(prefsSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { notificationPrefs: true },
    });
    const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...parseJson(user.notificationPrefs, {}), ...req.body };
    await prisma.user.update({ where: { id: context.userId }, data: { notificationPrefs: stringifyJson(merged) } });
    res.json({ preferences: merged });
  }),
);
