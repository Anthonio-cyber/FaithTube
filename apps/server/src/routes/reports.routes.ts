import { Router } from 'express';
import { z } from 'zod';
import { MAX_APPEALS_PER_VIDEO, REPORT_REASONS } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { handler } from '../lib/async.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { reportLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

export const reportsRouter = Router();

const reportSchema = z.object({
  targetType: z.enum(['VIDEO', 'COMMENT', 'CHANNEL', 'USER', 'LIVESTREAM']),
  targetId: z.string(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).default(''),
});

reportsRouter.post(
  '/',
  requireAuth,
  reportLimiter,
  validateBody(reportSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof reportSchema>;

    // One open report per person per target, so a single user cannot flood the queue.
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: context.userId,
        targetType: body.targetType,
        targetId: body.targetId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
    });
    if (existing) {
      return res.json({ ok: true, message: 'You have already reported this. Our moderators are looking at it.' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: context.userId,
        targetType: body.targetType,
        targetId: body.targetId,
        videoId: body.targetType === 'VIDEO' ? body.targetId : null,
        commentId: body.targetType === 'COMMENT' ? body.targetId : null,
        reason: body.reason,
        details: body.details.trim(),
      },
    });

    // Several independent reports on one video pull it out of circulation
    // pending review rather than waiting for a moderator to notice.
    if (body.targetType === 'VIDEO') {
      const reportCount = await prisma.report.count({
        where: { targetType: 'VIDEO', targetId: body.targetId, status: { in: ['OPEN', 'IN_REVIEW'] } },
      });
      if (reportCount >= 5) {
        await prisma.video.updateMany({
          where: { id: body.targetId, status: 'PUBLISHED' },
          data: { status: 'AWAITING_REVIEW' },
        });
        await recordAudit({
          actorId: null,
          action: 'video.autoHold',
          targetType: 'VIDEO',
          targetId: body.targetId,
          summary: `Held automatically after ${reportCount} reports`,
        });
      }
    }

    res.status(201).json({
      ok: true,
      reportId: report.id,
      message: 'Thank you. A moderator will review this.',
    });
  }),
);

reportsRouter.get(
  '/mine',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const reports = await prisma.report.findMany({
      where: { reporterId: context.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, targetType: true, reason: true, status: true, createdAt: true, resolvedAt: true },
    });
    res.json({ items: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null })) });
  }),
);

// ------------------------------------------------------------------ appeals

const appealSchema = z.object({
  videoId: z.string(),
  message: z.string().min(30).max(3000),
});

reportsRouter.post(
  '/appeals',
  requireAuth,
  writeLimiter,
  validateBody(appealSchema),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as z.infer<typeof appealSchema>;

    const video = await prisma.video.findUnique({
      where: { id: body.videoId },
      include: { channel: true, moderations: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!video) throw notFound('No such video.');
    if (video.channel.ownerId !== context.userId) throw forbidden();
    if (video.status !== 'REJECTED' && video.status !== 'REMOVED') {
      throw badRequest('Only a rejected or removed video can be appealed.');
    }

    // A single appeal per decision. Endless automated appeals are not permitted.
    const priorAppeals = await prisma.appeal.count({ where: { videoId: video.id } });
    if (priorAppeals >= MAX_APPEALS_PER_VIDEO) {
      throw conflict(
        'This video has already been appealed and reviewed by a person. If you have new information, please contact support.',
      );
    }

    const appeal = await prisma.appeal.create({
      data: { videoId: video.id, creatorId: context.userId, message: body.message.trim() },
    });
    await recordAudit({
      action: 'appeal.submit',
      targetType: 'VIDEO',
      targetId: video.id,
      summary: `Appeal submitted for "${video.title}"`,
      req,
    });

    res.status(201).json({
      appeal: { id: appeal.id, status: appeal.status, createdAt: appeal.createdAt.toISOString() },
      message: 'Your appeal is in the queue. A human moderator will read it and reply.',
    });
  }),
);

reportsRouter.get(
  '/appeals/mine',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const appeals = await prisma.appeal.findMany({
      where: { creatorId: context.userId },
      include: { video: { select: { id: true, title: true, slug: true, thumbnailUrl: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({
      items: appeals.map((appeal) => ({
        id: appeal.id,
        status: appeal.status,
        message: appeal.message,
        decisionNote: appeal.decisionNote,
        createdAt: appeal.createdAt.toISOString(),
        reviewedAt: appeal.reviewedAt?.toISOString() ?? null,
        video: appeal.video,
      })),
    });
  }),
);

// -------------------------------------------------------------------- blocks

reportsRouter.post(
  '/blocks',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ userId: z.string() })),
  handler(async (req, res) => {
    const context = auth(req);
    const targetId = (req.body as { userId: string }).userId;
    if (targetId === context.userId) throw badRequest('You cannot block yourself.');

    const existing = await prisma.userBlock.findUnique({
      where: { ownerId_targetId: { ownerId: context.userId, targetId } },
    });
    if (existing) {
      await prisma.userBlock.delete({ where: { id: existing.id } });
      return res.json({ blocked: false });
    }
    await prisma.userBlock.create({ data: { ownerId: context.userId, targetId } });
    res.json({ blocked: true });
  }),
);

reportsRouter.get(
  '/blocks',
  requireAuth,
  handler(async (req, res) => {
    const context = auth(req);
    const blocks = await prisma.userBlock.findMany({
      where: { ownerId: context.userId },
      include: { target: { select: { id: true, displayName: true, username: true, avatarUrl: true } } },
    });
    res.json({ items: blocks.map((b) => ({ ...b.target, blockedAt: b.createdAt.toISOString() })) });
  }),
);

/** Lets a creator ask for their content decision to be explained by a person. */
reportsRouter.post(
  '/support',
  requireAuth,
  writeLimiter,
  validateBody(z.object({ subject: z.string().min(3).max(120), message: z.string().min(20).max(4000) })),
  handler(async (req, res) => {
    const context = auth(req);
    const body = req.body as { subject: string; message: string };

    const report = await prisma.report.create({
      data: {
        reporterId: context.userId,
        targetType: 'USER',
        targetId: context.userId,
        reason: 'OTHER',
        details: `SUPPORT REQUEST — ${body.subject}\n\n${body.message}`,
      },
    });

    await notify({
      userId: context.userId,
      type: 'ANNOUNCEMENT',
      title: 'We received your message',
      body: 'Our team will reply as soon as they can.',
    });

    res.status(201).json({ ok: true, ticketId: report.id });
  }),
);
