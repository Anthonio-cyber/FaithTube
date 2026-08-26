import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { parseJson } from '../lib/json.js';
import { channelAnalytics } from '../services/analytics.service.js';
import { pipelineStatus } from '../services/pipeline.service.js';
import { toVideoSummary, videoSummarySelect } from '../services/serialize.js';

export const studioRouter = Router();

/** Every studio route needs the caller's own channel. */
async function requireOwnChannel(userId: string) {
  const channel = await prisma.channel.findUnique({ where: { ownerId: userId } });
  if (!channel) throw badRequest('You do not have a channel yet.');
  return channel;
}

studioRouter.get(
  '/overview',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await requireOwnChannel(context.userId);

    const [videos, awaitingReview, rejected, scheduled, heldComments, pendingAppeals, recentComments] =
      await Promise.all([
        prisma.video.count({ where: { channelId: channel.id, status: 'PUBLISHED' } }),
        prisma.video.count({ where: { channelId: channel.id, status: 'AWAITING_REVIEW' } }),
        prisma.video.count({ where: { channelId: channel.id, status: 'REJECTED' } }),
        prisma.video.count({ where: { channelId: channel.id, status: 'SCHEDULED' } }),
        prisma.comment.count({ where: { video: { channelId: channel.id }, status: 'HELD_FOR_REVIEW' } }),
        prisma.appeal.count({ where: { creatorId: context.userId, status: 'PENDING' } }),
        prisma.comment.findMany({
          where: { video: { channelId: channel.id }, status: 'VISIBLE' },
          include: {
            author: { select: { displayName: true, username: true, avatarUrl: true } },
            video: { select: { id: true, title: true, slug: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);

    res.json({
      channel: {
        id: channel.id,
        name: channel.name,
        handle: channel.handle,
        avatarUrl: channel.avatarUrl,
        bannerUrl: channel.bannerUrl,
        subscriberCount: channel.subscriberCount,
        totalViews: channel.totalViews,
        verifiedChristianCreator: channel.verifiedChristianCreator,
      },
      counts: { published: videos, awaitingReview, rejected, scheduled, heldComments, pendingAppeals },
      recentComments: recentComments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
        video: comment.video,
      })),
      /**
       * Stated plainly on the dashboard: audience size does not generate income
       * on this platform, so creators are not chasing a subscriber threshold.
       */
      monetizationNotice:
        'FaithTube does not pay creators based on subscriber count or views. There is no monetisation threshold to reach — ' +
        'your reach here is measured in people taught, not payouts earned.',
    });
  }),
);

studioRouter.get(
  '/videos',
  requireAuth,
  validateQuery(
    z.object({
      status: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }),
  ),
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await requireOwnChannel(context.userId);
    const params = query<{ status?: string; limit: number; cursor?: string }>(req);

    const rows = await prisma.video.findMany({
      where: { channelId: channel.id, status: params.status },
      include: { moderations: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);

    res.json({
      items: page.map((video) => {
        const moderation = video.moderations[0];
        return {
          id: video.id,
          slug: video.slug,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          status: video.status,
          visibility: video.visibility,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          createdAt: video.createdAt.toISOString(),
          publishedAt: video.publishedAt?.toISOString() ?? null,
          scheduledFor: video.scheduledFor?.toISOString() ?? null,
          christianContentVerified: video.christianContentVerified,
          ageRestricted: video.ageRestricted,
          review: moderation
            ? {
                decision: moderation.decision,
                message: moderation.creatorMessage,
                scores: parseJson(moderation.scores, {}),
                canAppeal: moderation.decision === 'REJECTED',
                reviewedAt: moderation.createdAt.toISOString(),
              }
            : null,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

studioRouter.get(
  '/videos/:id',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { channel: true, moderations: { orderBy: { createdAt: 'desc' } } },
    });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();

    res.json({
      video: {
        id: video.id,
        slug: video.slug,
        title: video.title,
        description: video.description,
        categorySlug: video.categorySlug,
        tags: parseJson<string[]>(video.tags, []),
        thumbnailUrl: video.thumbnailUrl,
        status: video.status,
        visibility: video.visibility,
        scheduledFor: video.scheduledFor?.toISOString() ?? null,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        commentsEnabled: video.commentsEnabled,
        premiumOnly: video.premiumOnly,
        madeForKids: video.madeForKids,
        ageRestricted: video.ageRestricted,
        contentWarnings: parseJson<string[]>(video.contentWarnings, []),
        scriptureRefs: parseJson<string[]>(video.scriptureRefs, []),
        chapters: parseJson(video.chapters, []),
        christianContentVerified: video.christianContentVerified,
        createdAt: video.createdAt.toISOString(),
      },
      pipeline: await pipelineStatus(video.id),
      // Creators see the outcome and the scores, never the internal reasoning.
      reviewHistory: video.moderations.map((moderation) => ({
        decision: moderation.decision,
        message: moderation.creatorMessage,
        scores: parseJson(moderation.scores, {}),
        reviewedAt: moderation.createdAt.toISOString(),
        wasHumanReviewed: Boolean(moderation.overriddenBy),
      })),
    });
  }),
);

studioRouter.get(
  '/analytics',
  requireAuth,
  validateQuery(z.object({ days: z.coerce.number().min(7).max(365).default(28) })),
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await requireOwnChannel(context.userId);
    const params = query<{ days: number }>(req);
    res.json(await channelAnalytics(channel.id, params.days));
  }),
);

studioRouter.get(
  '/audience',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await requireOwnChannel(context.userId);

    const [recent, total, countries] = await Promise.all([
      prisma.subscription.findMany({
        where: { channelId: channel.id },
        include: { user: { select: { displayName: true, username: true, avatarUrl: true, country: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      prisma.subscription.count({ where: { channelId: channel.id } }),
      prisma.user.groupBy({
        by: ['country'],
        where: { subscriptions: { some: { channelId: channel.id } }, country: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
        take: 12,
      }),
    ]);

    res.json({
      total,
      recent: recent.map((sub) => ({ ...sub.user, subscribedAt: sub.createdAt.toISOString() })),
      byCountry: countries.map((row) => ({ country: row.country, count: row._count._all })),
    });
  }),
);

const postSchema = z.object({
  type: z.enum(['TEXT', 'IMAGE', 'POLL', 'ANNOUNCEMENT', 'VERSE', 'QUESTION']).default('TEXT'),
  body: z.string().min(1).max(4000),
  imageUrl: z.string().url().optional(),
  scriptureRef: z.string().max(60).optional(),
  pollOptions: z.array(z.string().min(1).max(120)).min(2).max(6).optional(),
});

studioRouter.post(
  '/community',
  requireAuth,
  writeLimiter,
  validateBody(postSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const channel = await requireOwnChannel(context.userId);
    const body = req.body as z.infer<typeof postSchema>;
    if (body.type === 'POLL' && !body.pollOptions?.length) throw badRequest('A poll needs at least two options.');

    // Community posts pass the same comment-safety classifier before going out.
    const { moderateComment } = await import('../ai/commentModerator.js');
    const verdict = moderateComment(body.body);
    if (verdict.action === 'REMOVE') {
      throw badRequest('That post breaches our community guidelines and was not published.');
    }

    const post = await prisma.communityPost.create({
      data: {
        channelId: channel.id,
        type: body.type,
        body: body.body.trim(),
        imageUrl: body.imageUrl,
        scriptureRef: body.scriptureRef,
        pollOptions: JSON.stringify(
          (body.pollOptions ?? []).map((label, index) => ({ id: `opt-${index}`, label, votes: 0 })),
        ),
        status: verdict.action === 'HOLD' ? 'HELD_FOR_REVIEW' : 'VISIBLE',
        moderationNote: verdict.action === 'HOLD' ? verdict.reason : null,
      },
    });

    if (post.status === 'VISIBLE') {
      const { notifySubscribers } = await import('../services/notification.service.js');
      await notifySubscribers(channel.id, {
        type: 'NEW_UPLOAD',
        title: `${channel.name} posted an update`,
        body: post.body.slice(0, 140),
        linkUrl: `/channel/${channel.handle}?tab=community`,
      });
    }

    res.status(201).json({
      post: { id: post.id, status: post.status },
      held: post.status !== 'VISIBLE',
    });
  }),
);
