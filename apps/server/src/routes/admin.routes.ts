import { Router } from 'express';
import { z } from 'zod';
import { ROLES, REJECTION_MESSAGES, type RejectionReason } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { auth, requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody, validateQuery, query } from '../middleware/validate.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { integrationStatus } from '../config/env.js';
import { platformAnalytics } from '../services/analytics.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify, notifyAllUsers } from '../services/notification.service.js';
import { publishVideo } from '../services/pipeline.service.js';
import { currentPlan, updatePlan } from '../services/stripe.service.js';
import { toScores, toVideoSummary, videoSummarySelect } from '../services/serialize.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);

// ------------------------------------------------------------------ overview

adminRouter.get(
  '/overview',
  requirePermission('audit:read'),
  validateQuery(z.object({ days: z.coerce.number().min(7).max(365).default(30) })),
  handler(async (req, res) => {
    const params = query<{ days: number }>(req);
    res.json({
      ...(await platformAnalytics(params.days)),
      integrations: integrationStatus(),
    });
  }),
);

// ---------------------------------------------------------- moderation queue

const queueQuery = z.object({
  queue: z.enum(['ai', 'human', 'reports', 'appeals']).default('human'),
  limit: z.coerce.number().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

/**
 * The moderation centre. Each queue returns everything a moderator needs to
 * decide without leaving the page: the video, the creator, transcript, AI
 * classification with confidence and reasons, reports and prior history.
 */
adminRouter.get(
  '/moderation/queue',
  requirePermission('video:moderate'),
  validateQuery(queueQuery),
  handler(async (req, res) => {
    const params = query<z.infer<typeof queueQuery>>(req);

    if (params.queue === 'reports') {
      const reports = await prisma.report.findMany({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
        include: {
          reporter: { select: { id: true, displayName: true, username: true } },
          video: { select: { id: true, slug: true, title: true, thumbnailUrl: true, status: true, channelId: true } },
          comment: { select: { id: true, body: true, authorId: true, videoId: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: params.limit,
      });
      return res.json({
        queue: 'reports',
        items: reports.map((report) => ({
          id: report.id,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: report.createdAt.toISOString(),
          reporter: report.reporter,
          video: report.video,
          comment: report.comment,
        })),
      });
    }

    if (params.queue === 'appeals') {
      const appeals = await prisma.appeal.findMany({
        where: { status: 'PENDING' },
        include: {
          creator: { select: { id: true, displayName: true, username: true, strikeCount: true } },
          video: {
            include: { moderations: { orderBy: { createdAt: 'desc' }, take: 1 }, channel: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: params.limit,
      });
      return res.json({
        queue: 'appeals',
        items: appeals.map((appeal) => {
          const moderation = appeal.video.moderations[0];
          return {
            id: appeal.id,
            message: appeal.message,
            createdAt: appeal.createdAt.toISOString(),
            creator: appeal.creator,
            video: {
              id: appeal.video.id,
              slug: appeal.video.slug,
              title: appeal.video.title,
              description: appeal.video.description,
              thumbnailUrl: appeal.video.thumbnailUrl,
              status: appeal.video.status,
              channelName: appeal.video.channel.name,
            },
            originalDecision: moderation
              ? {
                  decision: moderation.decision,
                  scores: toScores(moderation.scores),
                  confidence: moderation.confidence,
                  findings: parseJson(moderation.findings, []),
                  internalNotes: moderation.internalNotes,
                  provider: moderation.provider,
                }
              : null,
          };
        }),
      });
    }

    // AI queue = recent automated decisions for spot-checking.
    // Human queue = everything actually waiting on a person.
    const where =
      params.queue === 'ai'
        ? { status: { in: ['APPROVED', 'REJECTED'] }, moderations: { some: {} } }
        : { status: 'AWAITING_REVIEW' };

    const videos = await prisma.video.findMany({
      where,
      include: {
        channel: { include: { owner: { select: { id: true, displayName: true, username: true, strikeCount: true } } } },
        moderations: { orderBy: { createdAt: 'desc' }, take: 3 },
        reports: { where: { status: { in: ['OPEN', 'IN_REVIEW'] } }, select: { id: true, reason: true, details: true } },
      },
      orderBy: params.queue === 'ai' ? { updatedAt: 'desc' } : { createdAt: 'asc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = videos.length > params.limit;
    const page = videos.slice(0, params.limit);

    const items = await Promise.all(
      page.map(async (video) => {
        const moderation = video.moderations[0];
        const priorDecisions = await prisma.videoModerationResult.count({
          where: { video: { channelId: video.channelId }, decision: 'REJECTED' },
        });
        return {
          video: {
            id: video.id,
            slug: video.slug,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            categorySlug: video.categorySlug,
            tags: parseJson(video.tags, []),
            durationSeconds: video.durationSeconds,
            status: video.status,
            createdAt: video.createdAt.toISOString(),
            transcriptExcerpt: (video.transcriptText ?? '').slice(0, 4000),
            hasTranscript: Boolean(video.transcript),
            scriptureRefs: parseJson(video.scriptureRefs, []),
            sources: parseJson(video.sources, []),
          },
          creator: {
            ...video.channel.owner,
            channelId: video.channel.id,
            channelName: video.channel.name,
            channelHandle: video.channel.handle,
            verifiedChristianCreator: video.channel.verifiedChristianCreator,
            priorRejections: priorDecisions,
          },
          classification: moderation
            ? {
                decision: moderation.decision,
                confidence: moderation.confidence,
                scores: toScores(moderation.scores),
                findings: parseJson(moderation.findings, []),
                internalNotes: moderation.internalNotes,
                provider: moderation.provider,
                model: moderation.model,
                createdAt: moderation.createdAt.toISOString(),
              }
            : null,
          history: video.moderations.slice(1).map((entry) => ({
            decision: entry.decision,
            provider: entry.provider,
            createdAt: entry.createdAt.toISOString(),
          })),
          reports: video.reports,
        };
      }),
    );

    res.json({ queue: params.queue, items, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null });
  }),
);

const decisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'RESTRICT', 'REQUEST_CHANGES', 'REMOVE']),
  reason: z.string().optional(),
  note: z.string().max(2000).optional(),
  messageToCreator: z.string().max(1000).optional(),
  publishImmediately: z.boolean().default(false),
});

adminRouter.post(
  '/moderation/videos/:id/decide',
  requirePermission('video:moderate'),
  validateBody(decisionSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof decisionSchema>;
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { channel: { include: { owner: true } }, moderations: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!video) throw notFound('No such video.');

    const outcomes = {
      APPROVE: { status: 'APPROVED', verified: true, decision: 'APPROVED' },
      RESTRICT: { status: 'APPROVED', verified: true, decision: 'RESTRICTED' },
      REQUEST_CHANGES: { status: 'AWAITING_REVIEW', verified: false, decision: 'HUMAN_REVIEW' },
      REJECT: { status: 'REJECTED', verified: false, decision: 'REJECTED' },
      REMOVE: { status: 'REMOVED', verified: false, decision: 'REJECTED' },
    } as const;
    const outcome = outcomes[body.action];

    const creatorMessage =
      body.messageToCreator?.trim() ||
      (body.action === 'REJECT' || body.action === 'REMOVE'
        ? REJECTION_MESSAGES[(body.reason as RejectionReason) ?? 'OTHER'] ?? REJECTION_MESSAGES.OTHER
        : body.action === 'REQUEST_CHANGES'
          ? 'A moderator has asked for changes to this video before it can be published. Please review the platform’s Christian Content Policy and re-submit.'
          : body.action === 'RESTRICT'
            ? 'Your video is approved with an age restriction because of the topics it covers.'
            : 'A moderator has approved your video.');

    await prisma.$transaction([
      prisma.video.update({
        where: { id: video.id },
        data: {
          status: outcome.status,
          christianContentVerified: outcome.verified,
          ageRestricted: body.action === 'RESTRICT' ? true : undefined,
          removedAt: body.action === 'REMOVE' ? new Date() : null,
          removedReason: body.action === 'REMOVE' ? (body.reason ?? 'Removed by a moderator.') : null,
          visibility: outcome.verified ? video.visibility : 'PRIVATE',
        },
      }),
      // The human decision is recorded as a new result rather than editing the
      // AI's, so the audit trail keeps both.
      prisma.videoModerationResult.create({
        data: {
          videoId: video.id,
          decision: outcome.decision,
          scores: video.moderations[0]?.scores ?? '{}',
          confidence: 1,
          findings: stringifyJson([]),
          internalNotes: body.note ?? `Manual decision by moderator ${context.userId}.`,
          creatorMessage,
          rejectionReason: body.reason ?? null,
          provider: 'human',
          overriddenBy: context.userId,
          ageRestricted: body.action === 'RESTRICT',
        },
      }),
      prisma.moderationAction.create({
        data: {
          actorId: context.userId,
          videoId: video.id,
          targetType: 'VIDEO',
          targetId: video.id,
          action: body.action,
          reason: body.reason,
          note: body.note,
        },
      }),
      prisma.report.updateMany({
        where: { targetType: 'VIDEO', targetId: video.id, status: { in: ['OPEN', 'IN_REVIEW'] } },
        data: {
          status: body.action === 'APPROVE' ? 'DISMISSED' : 'ACTIONED',
          resolvedById: context.userId,
          resolvedAt: new Date(),
          resolution: `Video ${body.action.toLowerCase()}d by a moderator.`,
        },
      }),
    ]);

    // A rejection for a serious breach adds a strike to the creator's record.
    const strikeWorthy: RejectionReason[] = [
      'SEXUAL_CONTENT', 'HATE_OR_HARASSMENT', 'SCAM_OR_FRAUD', 'DANGEROUS_CONTENT', 'MODERATION_EVASION',
    ];
    if ((body.action === 'REJECT' || body.action === 'REMOVE') && strikeWorthy.includes(body.reason as RejectionReason)) {
      await prisma.user.update({
        where: { id: video.channel.ownerId },
        data: { strikeCount: { increment: 1 } },
      });
    }

    if (outcome.verified && (body.publishImmediately || video.visibility === 'PUBLIC')) {
      await prisma.video.update({ where: { id: video.id }, data: { visibility: 'PUBLIC' } });
      await publishVideo(video.id);
    }

    await notify({
      userId: video.channel.ownerId,
      type: 'MODERATION',
      title:
        body.action === 'APPROVE' || body.action === 'RESTRICT'
          ? `"${video.title}" was approved`
          : `Update on "${video.title}"`,
      body: creatorMessage,
      linkUrl: `/studio/videos/${video.id}`,
    });

    await recordAudit({
      action: `moderation.${body.action.toLowerCase()}`,
      targetType: 'VIDEO',
      targetId: video.id,
      summary: `${body.action} "${video.title}"${body.reason ? ` (${body.reason})` : ''}`,
      metadata: { note: body.note },
      req,
    });

    res.json({ ok: true, status: outcome.status });
  }),
);

const appealDecisionSchema = z.object({
  decision: z.enum(['UPHELD', 'OVERTURNED', 'CHANGES_REQUESTED']),
  note: z.string().min(10).max(2000),
});

adminRouter.post(
  '/moderation/appeals/:id/decide',
  requirePermission('appeal:review'),
  validateBody(appealDecisionSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof appealDecisionSchema>;
    const appeal = await prisma.appeal.findUnique({
      where: { id: req.params.id },
      include: { video: { include: { channel: true } } },
    });
    if (!appeal) throw notFound('No such appeal.');
    if (appeal.status !== 'PENDING') throw badRequest('That appeal has already been decided.');

    await prisma.appeal.update({
      where: { id: appeal.id },
      data: { status: body.decision, decisionNote: body.note, reviewedById: context.userId, reviewedAt: new Date() },
    });

    if (body.decision === 'OVERTURNED') {
      await prisma.video.update({
        where: { id: appeal.videoId },
        data: { status: 'APPROVED', christianContentVerified: true, removedAt: null, removedReason: null },
      });
      await prisma.videoModerationResult.create({
        data: {
          videoId: appeal.videoId,
          decision: 'APPROVED',
          confidence: 1,
          internalNotes: `Appeal upheld by moderator ${context.userId}: ${body.note}`,
          creatorMessage: 'We reviewed your appeal and approved your video. It is ready to publish.',
          provider: 'human',
          overriddenBy: context.userId,
        },
      });
    }

    const titles = {
      UPHELD: 'Your appeal was reviewed — the original decision stands',
      OVERTURNED: 'Good news — your appeal was successful',
      CHANGES_REQUESTED: 'Your appeal was reviewed — changes are needed',
    };
    await notify({
      userId: appeal.creatorId,
      type: 'MODERATION',
      title: titles[body.decision],
      body: body.note,
      linkUrl: `/studio/videos/${appeal.videoId}`,
    });

    await recordAudit({
      action: `appeal.${body.decision.toLowerCase()}`,
      targetType: 'VIDEO',
      targetId: appeal.videoId,
      summary: `Appeal ${body.decision} for "${appeal.video.title}"`,
      req,
    });

    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/moderation/reports/:id/resolve',
  requirePermission('report:review'),
  validateBody(z.object({ status: z.enum(['ACTIONED', 'DISMISSED']), resolution: z.string().max(1000).optional() })),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as { status: 'ACTIONED' | 'DISMISSED'; resolution?: string };
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) throw notFound('No such report.');

    await prisma.report.update({
      where: { id: report.id },
      data: { status: body.status, resolution: body.resolution, resolvedById: context.userId, resolvedAt: new Date() },
    });
    await recordAudit({
      action: `report.${body.status.toLowerCase()}`,
      targetType: report.targetType,
      targetId: report.targetId,
      summary: `Report ${body.status.toLowerCase()}: ${report.reason}`,
      req,
    });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/moderation/comments/:id',
  requirePermission('comment:moderate'),
  validateBody(z.object({ action: z.enum(['APPROVE', 'REMOVE']), reason: z.string().max(500).optional() })),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as { action: 'APPROVE' | 'REMOVE'; reason?: string };
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) throw notFound('No such comment.');

    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        status: body.action === 'APPROVE' ? 'VISIBLE' : 'REMOVED',
        removedReason: body.action === 'REMOVE' ? (body.reason ?? 'Removed by a moderator.') : null,
      },
    });
    await prisma.moderationAction.create({
      data: {
        actorId: context.userId,
        targetType: 'COMMENT',
        targetId: comment.id,
        action: body.action,
        reason: body.reason,
      },
    });
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------ user management

adminRouter.get(
  '/users',
  requirePermission('user:manage'),
  validateQuery(
    z.object({
      q: z.string().optional(),
      role: z.enum(ROLES).optional(),
      suspended: z.coerce.boolean().optional(),
      limit: z.coerce.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }),
  ),
  handler(async (req, res) => {
    const params = query<{ q?: string; role?: string; suspended?: boolean; limit: number; cursor?: string }>(req);

    const rows = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: params.role,
        suspendedUntil: params.suspended ? { gt: new Date() } : undefined,
        OR: params.q
          ? [{ email: { contains: params.q } }, { username: { contains: params.q } }, { displayName: { contains: params.q } }]
          : undefined,
      },
      include: { channel: true, premium: true },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);

    res.json({
      items: page.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
        country: user.country,
        strikeCount: user.strikeCount,
        suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        suspensionReason: user.suspensionReason,
        premiumStatus: user.premium?.status ?? null,
        channel: user.channel ? { id: user.channel.id, handle: user.channel.handle, name: user.channel.name } : null,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

adminRouter.post(
  '/users/:id/suspend',
  requirePermission('user:suspend'),
  validateBody(z.object({ days: z.number().min(0).max(3650), reason: z.string().min(5).max(500) })),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as { days: number; reason: string };
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('No such user.');
    // A moderator must not be able to act against an admin.
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role) && context.role !== 'SUPER_ADMIN') {
      throw forbidden('Only a super admin can suspend an administrator.');
    }

    const lifting = body.days === 0;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        suspendedUntil: lifting ? null : new Date(Date.now() + body.days * 86_400_000),
        suspensionReason: lifting ? null : body.reason,
      },
    });
    if (!lifting) {
      const { revokeAllSessions } = await import('../services/auth.service.js');
      await revokeAllSessions(user.id);
    }

    await notify({
      userId: user.id,
      type: 'MODERATION',
      title: lifting ? 'Your account has been reinstated' : `Your account has been suspended for ${body.days} days`,
      body: lifting ? 'Welcome back.' : body.reason,
    });
    await recordAudit({
      action: lifting ? 'user.reinstate' : 'user.suspend',
      targetType: 'USER',
      targetId: user.id,
      summary: lifting ? `Reinstated @${user.username}` : `Suspended @${user.username} for ${body.days} days: ${body.reason}`,
      req,
    });

    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/users/:id/role',
  requirePermission('role:assign'),
  validateBody(z.object({ role: z.enum(ROLES) })),
  handler(async (req, res) => {
    const context = auth(req);
    const role = (req.body as { role: string }).role;
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('No such user.');
    if (user.id === context.userId) throw badRequest('You cannot change your own role.');

    await prisma.user.update({ where: { id: user.id }, data: { role } });
    await recordAudit({
      action: 'user.role',
      targetType: 'USER',
      targetId: user.id,
      summary: `Role changed ${user.role} → ${role} for @${user.username}`,
      req,
    });
    res.json({ ok: true, role });
  }),
);

adminRouter.post(
  '/channels/:id/verify',
  requirePermission('user:manage'),
  validateBody(z.object({ verified: z.boolean() })),
  handler(async (req, res) => {
    const verified = (req.body as { verified: boolean }).verified;
    const channel = await prisma.channel.update({
      where: { id: req.params.id },
      data: { verifiedChristianCreator: verified },
    });
    await recordAudit({
      action: 'channel.verify',
      targetType: 'CHANNEL',
      targetId: channel.id,
      summary: `${verified ? 'Verified' : 'Unverified'} @${channel.handle}`,
      req,
    });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/channels/:id/suspend',
  requirePermission('user:suspend'),
  validateBody(z.object({ suspended: z.boolean(), reason: z.string().max(500).optional() })),
  handler(async (req, res) => {
    const body = req.body as { suspended: boolean; reason?: string };
    const channel = await prisma.channel.update({
      where: { id: req.params.id },
      data: { suspended: body.suspended, suspendedReason: body.suspended ? body.reason : null },
    });
    if (body.suspended) {
      await prisma.video.updateMany({
        where: { channelId: channel.id, status: 'PUBLISHED' },
        data: { status: 'REMOVED', removedAt: new Date(), removedReason: 'Channel suspended.' },
      });
    }
    await recordAudit({
      action: body.suspended ? 'channel.suspend' : 'channel.reinstate',
      targetType: 'CHANNEL',
      targetId: channel.id,
      summary: `${body.suspended ? 'Suspended' : 'Reinstated'} @${channel.handle}`,
      req,
    });
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------- platform

adminRouter.get(
  '/audit',
  requirePermission('audit:read'),
  validateQuery(
    z.object({
      action: z.string().optional(),
      actorId: z.string().optional(),
      limit: z.coerce.number().min(1).max(200).default(60),
      cursor: z.string().optional(),
    }),
  ),
  handler(async (req, res) => {
    const params = query<{ action?: string; actorId?: string; limit: number; cursor?: string }>(req);
    const rows = await prisma.adminLog.findMany({
      where: { action: params.action ? { contains: params.action } : undefined, actorId: params.actorId },
      include: { actor: { select: { id: true, displayName: true, username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit);
    res.json({
      items: page.map((entry) => ({
        id: entry.id,
        action: entry.action,
        summary: entry.summary,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: parseJson(entry.metadata, {}),
        actor: entry.actor,
        createdAt: entry.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

adminRouter.get(
  '/settings',
  requirePermission('settings:manage'),
  handler(async (_req, res) => {
    const settings = await prisma.platformSetting.findMany();
    res.json({
      settings: Object.fromEntries(settings.map((row) => [row.key, parseJson(row.value, row.value)])),
      plan: await currentPlan(),
      integrations: integrationStatus(),
    });
  }),
);

adminRouter.put(
  '/settings/:key',
  requirePermission('settings:manage'),
  validateBody(z.object({ value: z.unknown() })),
  handler(async (req, res) => {
    const value = stringifyJson((req.body as { value: unknown }).value);
    await prisma.platformSetting.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, value },
      update: { value },
    });
    await recordAudit({ action: 'settings.update', targetType: 'SETTING', targetId: req.params.key, summary: `Updated ${req.params.key}`, req });
    res.json({ ok: true });
  }),
);

adminRouter.put(
  '/premium/plan',
  requirePermission('billing:manage'),
  validateBody(
    z.object({
      name: z.string().min(1).max(40).optional(),
      amountMinor: z.number().int().min(0).max(1_000_000).optional(),
      currency: z.string().length(3).optional(),
      features: z.array(z.string().max(200)).max(20).optional(),
    }),
  ),
  handler(async (req, res) => {
    const plan = await updatePlan(req.body as never);
    await recordAudit({ action: 'premium.plan.update', targetType: 'SETTING', targetId: 'premium.plan', summary: `Premium price set to ${plan.amountMinor} ${plan.currency}`, req });
    res.json({ plan });
  }),
);

adminRouter.post(
  '/premium/grant',
  requirePermission('billing:manage'),
  validateBody(z.object({ userId: z.string(), months: z.number().min(1).max(120).default(12) })),
  handler(async (req, res) => {
    const body = req.body as { userId: string; months: number };
    const until = new Date(Date.now() + body.months * 30 * 86_400_000);

    await prisma.premiumSubscription.upsert({
      where: { userId: body.userId },
      create: { userId: body.userId, status: 'COMPLIMENTARY', provider: 'manual', currentPeriodEnd: until },
      update: { status: 'COMPLIMENTARY', provider: 'manual', currentPeriodEnd: until, canceledAt: null },
    });
    await notify({
      userId: body.userId,
      type: 'PREMIUM',
      title: 'Premium has been added to your account',
      body: `You have complimentary Premium access until ${until.toISOString().slice(0, 10)}.`,
      linkUrl: '/premium',
    });
    await recordAudit({ action: 'premium.grant', targetType: 'USER', targetId: body.userId, summary: `Granted ${body.months} months of complimentary Premium`, req });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/featured',
  requirePermission('featured:manage'),
  validateBody(
    z.object({
      placement: z.enum(['HERO', 'BANNER', 'RAIL']),
      videoId: z.string().optional(),
      title: z.string().max(120).optional(),
      subtitle: z.string().max(240).optional(),
      imageUrl: z.string().url().optional(),
      linkUrl: z.string().max(300).optional(),
      sortOrder: z.number().int().default(0),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
    }),
  ),
  handler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (body.videoId) {
      const video = await prisma.video.findFirst({
        where: { id: String(body.videoId), status: 'PUBLISHED', christianContentVerified: true },
      });
      if (!video) throw badRequest('Only a published, approved video can be featured.');
    }
    const item = await prisma.featuredItem.create({
      data: {
        placement: String(body.placement),
        videoId: body.videoId ? String(body.videoId) : null,
        title: body.title ? String(body.title) : null,
        subtitle: body.subtitle ? String(body.subtitle) : null,
        imageUrl: body.imageUrl ? String(body.imageUrl) : null,
        linkUrl: body.linkUrl ? String(body.linkUrl) : null,
        sortOrder: Number(body.sortOrder ?? 0),
        startsAt: body.startsAt ? new Date(String(body.startsAt)) : null,
        endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
      },
    });
    await recordAudit({ action: 'featured.create', targetType: 'FEATURED', targetId: item.id, summary: `Featured item added (${item.placement})`, req });
    res.status(201).json({ item });
  }),
);

adminRouter.get(
  '/featured',
  requirePermission('featured:manage'),
  handler(async (_req, res) => {
    const items = await prisma.featuredItem.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
    const videoIds = items.map((i) => i.videoId).filter(Boolean) as string[];
    const videos = videoIds.length
      ? await prisma.video.findMany({ where: { id: { in: videoIds } }, select: videoSummarySelect })
      : [];
    const videoMap = new Map(videos.map((v) => [v.id, toVideoSummary(v)]));
    res.json({ items: items.map((item) => ({ ...item, video: item.videoId ? videoMap.get(item.videoId) ?? null : null })) });
  }),
);

adminRouter.delete(
  '/featured/:id',
  requirePermission('featured:manage'),
  handler(async (req, res) => {
    await prisma.featuredItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/announcements',
  requirePermission('announcement:publish'),
  validateBody(z.object({ title: z.string().min(3).max(120), body: z.string().min(3).max(1000), linkUrl: z.string().max(300).optional() })),
  handler(async (req, res) => {
    const body = req.body as { title: string; body: string; linkUrl?: string };
    const delivered = await notifyAllUsers({
      type: 'ANNOUNCEMENT',
      title: body.title,
      body: body.body,
      linkUrl: body.linkUrl,
    });
    await recordAudit({ action: 'announcement.publish', summary: `Announcement sent to ${delivered} members: ${body.title}`, req });
    res.json({ ok: true, delivered });
  }),
);
