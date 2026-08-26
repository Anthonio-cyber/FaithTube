import { Router } from 'express';
import { brand, CATEGORIES } from '@faithtube/shared';
import { prisma } from '../db/client.js';
import { env, integrationStatus } from '../config/env.js';
import { handler } from '../lib/async.js';
import { hasFfmpeg } from '../services/media.service.js';
import { moderationProvider } from '../ai/index.js';
import { transcriptionProvider } from '../ai/transcription.js';
import { currentPlan } from '../services/stripe.service.js';
import { PUBLISHED_VIDEO_WHERE } from '../services/serialize.js';

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
        maxUploadBytes: env.MAX_UPLOAD_BYTES,
        maxUploadLabel: `${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB`,
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
