import { prisma } from '../db/client.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { runJob } from '../services/pipeline.service.js';
import { publishScheduledVideos } from '../services/schedule.service.js';

const log = logger('worker');

let running = false;
let timer: NodeJS.Timeout | null = null;

/**
 * Single-process job runner. It claims one job at a time with a conditional
 * update so two workers cannot pick up the same row, which keeps the design
 * correct if the deployment later runs several API instances.
 */
async function claimNextJob() {
  const candidate = await prisma.videoProcessingJob.findFirst({
    where: { status: 'QUEUED', runAfter: { lte: new Date() } },
    orderBy: [{ runAfter: 'asc' }, { createdAt: 'asc' }],
  });
  if (!candidate) return null;

  const claimed = await prisma.videoProcessingJob.updateMany({
    where: { id: candidate.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  });
  return claimed.count === 1 ? candidate.id : null;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < 3; i += 1) {
      const jobId = await claimNextJob();
      if (!jobId) break;
      await runJob(jobId);
    }
    await publishScheduledVideos();
  } catch (err) {
    log.error('Worker tick failed', err);
  } finally {
    running = false;
  }
}

export function startWorker() {
  if (!env.WORKER_ENABLED) {
    log.warn('Background worker disabled (WORKER_ENABLED=false). Uploads will queue but never process.');
    return;
  }
  log.info(`Background worker started (polling every ${env.WORKER_POLL_MS}ms)`);
  timer = setInterval(() => void tick(), env.WORKER_POLL_MS);
  timer.unref?.();
  void tick();
}

export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
