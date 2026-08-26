import { prisma } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { publishVideo } from './pipeline.service.js';

const log = logger('scheduler');

/** Publishes approved videos whose scheduled time has arrived. */
export async function publishScheduledVideos(): Promise<number> {
  const due = await prisma.video.findMany({
    where: {
      status: 'SCHEDULED',
      visibility: 'SCHEDULED',
      christianContentVerified: true,
      scheduledFor: { lte: new Date() },
    },
    select: { id: true },
    take: 25,
  });

  for (const video of due) {
    try {
      // A scheduled video becomes an ordinary public one at its publish time.
      await prisma.video.update({ where: { id: video.id }, data: { visibility: 'PUBLIC' } });
      await publishVideo(video.id);
    } catch (err) {
      log.error(`Failed to publish scheduled video ${video.id}`, err);
    }
  }
  return due.length;
}
