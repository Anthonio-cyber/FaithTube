import { Router } from 'express';
import { brand, CATEGORIES } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { effectiveMaxUploadBytes, env, integrationStatus, uploadLimitLabel } from '../config/env.js';
import { handler } from '../lib/async.js';
import { hasFfmpeg } from '../services/media.service.js';
import { moderationProvider } from '../ai/index.js';
import { transcriptionProvider } from '../ai/transcription.js';
import { currentPlan } from '../services/stripe.service.js';
import { PUBLISHED_VIDEO_WHERE } from '../services/serialize.js';
import { runWorkerPass } from '../workers/videoWorker.js';
import { timingSafeEqual } from '../lib/crypto.js';
import { forbidden, notConfigured } from '../lib/errors.js';

export const systemRouter = Router();

systemRouter.get(
  '/health',
  handler(async (_req, res) => {
    let database = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unavailable';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
      // Which build is actually serving. Without this there is no way to tell a
      // deployed change from one that silently never shipped — uptime alone
      // cannot distinguish "deployed and restarted" from "never deployed".
      commit: (process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null,
    });
  }),
);

/**
 * What this deployment can actually do. The web and mobile clients read this to
 * show honest states — a "not configured" notice instead of a button that
 * pretends to work.
 */
systemRouter.get(
  '/config',
  handler(async (_req, res) => {
    const integrations = integrationStatus();
    res.json({
      brand,
      categories: CATEGORIES,
      plan: await currentPlan(),
      features: {
        googleSignIn: integrations.googleAuth,
        premiumCheckout: integrations.stripe,
        aiModeration: integrations.anthropicModeration,
        automaticTranscription: transcriptionProvider().name !== 'metadata-fallback',
        videoTranscoding: await hasFfmpeg(),
        liveStreaming: integrations.liveIngest,
        cdn: integrations.cdn,
      },
      moderation: {
        provider: moderationProvider().name,
        // Stated plainly so nobody mistakes the fallback for a full AI review.
        note:
          moderationProvider().name === 'heuristic-v1'
            ? 'This deployment is running the on-device classifier. It is fully functional; adding ANTHROPIC_API_KEY enables the more capable model-based review.'
            : 'Model-based review is active, with the on-device classifier as a pre-filter and fallback.',
      },
      limits: {
        maxUploadBytes: effectiveMaxUploadBytes(),
        maxUploadLabel: uploadLimitLabel(),
      },
    });
  }),
);

systemRouter.get(
  '/stats',
  handler(async (_req, res) => {
    const [videos, channels, members, watchSeconds] = await Promise.all([
      prisma.video.count({ where: PUBLISHED_VIDEO_WHERE }),
      prisma.channel.count({ where: { suspended: false } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.video.aggregate({ _sum: { totalWatchSeconds: true } }),
    ]);
    res.json({
      videos,
      channels,
      members,
      watchHours: Math.round((watchSeconds._sum.totalWatchSeconds ?? 0) / 3600),
    });
  }),
);

/**
 * Drives one pass of the processing queue.
 *
 * Only needed where the platform cannot keep a background process alive. Set
 * CRON_SECRET and call this on a schedule; Vercel Cron sends the secret as a
 * Bearer token automatically. When WORKER_ENABLED is true the in-process worker
 * is already doing this, and calling it here is harmless but redundant.
 */
systemRouter.all(
  '/cron/process',
  handler(async (req, res) => {
    if (!env.CRON_SECRET) {
      throw notConfigured(
        'Scheduled processing',
        'Set CRON_SECRET on the API, then call this endpoint on a schedule with "Authorization: Bearer <CRON_SECRET>".',
      );
    }

    const header = req.headers.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : String(req.query.secret ?? '');
    if (!provided || !timingSafeEqual(provided, env.CRON_SECRET)) {
      throw forbidden('Invalid cron secret.');
    }

    const result = await runWorkerPass(env.CRON_MAX_JOBS);
    res.json({ ok: true, ...result, workerAlsoRunningInProcess: env.WORKER_ENABLED });
  }),
);
