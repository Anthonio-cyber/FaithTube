import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { attachAuth, auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { moderateComment } from '../ai/commentModerator.js';
import { toPublicUser } from '../services/serialize.js';
import { notify } from '../services/notification.service.js';

export const commentsRouter = Router();

const listQuery = z.object({
  videoId: z.string(),
  parentId: z.string().optional(),
  sort: z.enum(['top', 'newest', 'oldest']).default('top'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

commentsRouter.get(
  '/',
  attachAuth,
  validateQuery(listQuery),
  handler(async (req, res) => {
    const params = query<z.infer<typeof listQuery>>(req);

    // Blocked users' comments disappear for the viewer who blocked them.
    const blockedIds = req.auth
      ? (await prisma.userBlock.findMany({ where: { ownerId: req.auth.userId }, select: { targetId: true } })).map(
          (b) => b.targetId,
        )
      : [];

    const orderBy =
      params.sort === 'top'
        ? [{ pinned: 'desc' as const }, { likeCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : params.sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : [{ createdAt: 'desc' as const }];

    const rows = await prisma.comment.findMany({
      where: {
        videoId: params.videoId,
        parentId: params.parentId ?? null,
        status: 'VISIBLE',
        authorId: blockedIds.length ? { notIn: blockedIds } : undefined,
      },
      include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true, role: true, createdAt: true, premium: true } } },
      orderBy,
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);

    const likedIds = req.auth
      ? new Set(
          (
            await prisma.commentLike.findMany({
              where: { userId: req.auth.userId, commentId: { in: page.map((c) => c.id) } },
              select: { commentId: true },
            })
          ).map((l) => l.commentId),
        )
      : new Set<string>();

    res.json({
      items: page.map((comment) => ({
        id: comment.id,
        body: comment.body,
        likeCount: comment.likeCount,
        replyCount: comment.replyCount,
        pinned: comment.pinned,
        heartedByCreator: comment.heartedByCreator,
        createdAt: comment.createdAt.toISOString(),
        editedAt: comment.editedAt?.toISOString() ?? null,
        author: toPublicUser(comment.author),
        viewerLiked: likedIds.has(comment.id),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

const createSchema = z.object({
  videoId: z.string(),
  parentId: z.string().optional(),
  body: z.string().min(1).max(5000),
});

commentsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validateBody(createSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof createSchema>;

    const video = await prisma.video.findUnique({
      where: { id: body.videoId },
      include: { channel: true },
    });
    if (!video) throw notFound('No such video.');
    if (!video.commentsEnabled) throw badRequest('Comments are turned off for this video.');
    if (video.status !== 'PUBLISHED') throw badRequest('You cannot comment on a video that is not published.');

    let parent = null;
    if (body.parentId) {
      parent = await prisma.comment.findUnique({ where: { id: body.parentId }, include: { author: true } });
      if (!parent || parent.videoId !== video.id) throw badRequest('That comment no longer exists.');
      // One level of nesting: a reply to a reply attaches to the same thread.
      if (parent.parentId) body.parentId = parent.parentId;
    }

    const verdict = moderateComment(body.body);
    const comment = await prisma.comment.create({
      data: {
        videoId: video.id,
        authorId: context.userId,
        parentId: body.parentId ?? null,
        body: body.body.trim(),
        status: verdict.action === 'ALLOW' ? 'VISIBLE' : verdict.action === 'HOLD' ? 'HELD_FOR_REVIEW' : 'REMOVED',
        moderationLabel: verdict.label,
        moderationScore: verdict.score,
        removedReason: verdict.action === 'REMOVE' ? verdict.reason : null,
      },
      include: { author: { select: { id: true, displayName: true, username: true, avatarUrl: true, role: true, createdAt: true, premium: true } } },
    });

    if (verdict.action === 'REMOVE') {
      return res.status(202).json({
        comment: null,
        held: true,
        message:
          'Your comment was not posted because it appears to breach our community guidelines. Disagreement is welcome here — personal attacks, spam and solicitation are not.',
      });
    }
    if (verdict.action === 'HOLD') {
      return res.status(202).json({
        comment: null,
        held: true,
        message: 'Your comment has been sent to the creator for review before it appears.',
      });
    }

    await prisma.video.update({ where: { id: video.id }, data: { commentCount: { increment: 1 } } });
    if (body.parentId) {
      await prisma.comment.update({ where: { id: body.parentId }, data: { replyCount: { increment: 1 } } });
    }

    const author = comment.author.displayName;
    if (parent && parent.authorId !== context.userId) {
      await notify({
        userId: parent.authorId,
        type: 'REPLY',
        title: `${author} replied to your comment`,
        body: comment.body.slice(0, 140),
        linkUrl: `/watch/${video.slug}`,
      });
    } else if (video.channel.ownerId !== context.userId) {
      await notify({
        userId: video.channel.ownerId,
        type: 'COMMENT',
        title: `${author} commented on "${video.title}"`,
        body: comment.body.slice(0, 140),
        linkUrl: `/watch/${video.slug}`,
      });
    }

    res.status(201).json({
      comment: {
        id: comment.id,
        body: comment.body,
        likeCount: 0,
        replyCount: 0,
        pinned: false,
        heartedByCreator: false,
        createdAt: comment.createdAt.toISOString(),
        editedAt: null,
        author: toPublicUser(comment.author),
        viewerLiked: false,
      },
    });
  }),
);

commentsRouter.post(
  '/:id/like',
  requireAuth,
  writeLimiter,
  handler(async (req, res) => {
    const context = auth(req);
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: req.params.id, userId: context.userId } },
    });
    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      const updated = await prisma.comment.update({
        where: { id: req.params.id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return res.json({ liked: false, likeCount: updated.likeCount });
    }
    await prisma.commentLike.create({ data: { commentId: req.params.id, userId: context.userId } });
    const updated = await prisma.comment.update({
      where: { id: req.params.id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    res.json({ liked: true, likeCount: updated.likeCount });
  }),
);

commentsRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ body: z.string().min(1).max(5000) })),
  handler(async (req, res) => {
    const context = auth(req);
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) throw notFound('No such comment.');
    if (comment.authorId !== context.userId) throw forbidden();

    const verdict = moderateComment(req.body.body);
    if (verdict.action === 'REMOVE') throw badRequest('That edit breaches our community guidelines.');

    const updated = await prisma.comment.update({
      where: { id: comment.id },
      data: {
        body: req.body.body.trim(),
        editedAt: new Date(),
        status: verdict.action === 'HOLD' ? 'HELD_FOR_REVIEW' : 'VISIBLE',
      },
    });
    res.json({ id: updated.id, body: updated.body, editedAt: updated.editedAt?.toISOString() });
  }),
);

commentsRouter.delete(
  '/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { video: { include: { channel: true } } },
    });
    if (!comment) throw notFound('No such comment.');

    const isAuthor = comment.authorId === context.userId;
    const isVideoOwner = comment.video.channel.ownerId === context.userId;
    const isStaff = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(context.role);
    if (!isAuthor && !isVideoOwner && !isStaff) throw forbidden();

    await prisma.comment.delete({ where: { id: comment.id } });
    if (comment.status === 'VISIBLE') {
      await prisma.video.update({ where: { id: comment.videoId }, data: { commentCount: { decrement: 1 } } });
      if (comment.parentId) {
        await prisma.comment.update({ where: { id: comment.parentId }, data: { replyCount: { decrement: 1 } } }).catch(() => undefined);
      }
    }
    res.json({ ok: true });
  }),
);

/** Creator moderation: pin, heart, remove, and work the held queue. */
commentsRouter.post(
  '/:id/creator-action',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ action: z.enum(['pin', 'unpin', 'heart', 'unheart', 'approve', 'remove']) })),
  handler(async (req, res) => {
    const context = auth(req);
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { video: { include: { channel: true } } },
    });
    if (!comment) throw notFound('No such comment.');
    if (comment.video.channel.ownerId !== context.userId && !['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(context.role)) {
      throw forbidden();
    }

    const action = (req.body as { action: string }).action;
    if (action === 'pin' || action === 'unpin') {
      if (action === 'pin') {
        await prisma.comment.updateMany({ where: { videoId: comment.videoId, pinned: true }, data: { pinned: false } });
      }
      await prisma.comment.update({ where: { id: comment.id }, data: { pinned: action === 'pin' } });
    } else if (action === 'heart' || action === 'unheart') {
      await prisma.comment.update({ where: { id: comment.id }, data: { heartedByCreator: action === 'heart' } });
    } else if (action === 'approve') {
      await prisma.comment.update({ where: { id: comment.id }, data: { status: 'VISIBLE', removedReason: null } });
      await prisma.video.update({ where: { id: comment.videoId }, data: { commentCount: { increment: 1 } } });
    } else if (action === 'remove') {
      await prisma.comment.update({
        where: { id: comment.id },
        data: { status: 'REMOVED', removedReason: 'Removed by the creator.' },
      });
      if (comment.status === 'VISIBLE') {
        await prisma.video.update({ where: { id: comment.videoId }, data: { commentCount: { decrement: 1 } } });
      }
    }

    res.json({ ok: true });
  }),
);

/** The creator's held-comment queue across all their videos. */
commentsRouter.get(
  '/held',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await prisma.channel.findUnique({ where: { ownerId: context.userId } });
    if (!channel) return res.json({ items: [] });

    const held = await prisma.comment.findMany({
      where: { video: { channelId: channel.id }, status: 'HELD_FOR_REVIEW' },
      include: {
        author: { select: { id: true, displayName: true, username: true, avatarUrl: true, role: true, createdAt: true, premium: true } },
        video: { select: { id: true, slug: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      items: held.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        label: comment.moderationLabel,
        score: comment.moderationScore,
        author: toPublicUser(comment.author),
        video: comment.video,
      })),
    });
  }),
);
