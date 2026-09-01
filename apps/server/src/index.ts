import { brand } from '@faithtube/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './db/client.js';
import { startWorker, stopWorker } from './workers/videoWorker.js';
import { moderationProvider } from './ai/index.js';
import { removeDemoContent } from './db/removeDemoContent.js';
import { refreshPlaybackHosts } from './services/livePlayback.service.js';

const log = logger('server');

async function main() {
  const app = createApp();

  // Fail fast on a bad database URL rather than 500ing on the first request.
  await prisma.$connect();

  // One-time tidy-up of sample content left by an older seed. A single lookup
  // once it has run.
  await removeDemoContent();

  // The content security policy is built from this, so it has to be in memory
  // before the first request is served.
  await refreshPlaybackHosts();

  const server = app.listen(env.PORT, () => {
    log.info(`${brand.name} API listening on http://localhost:${env.PORT}`);
    log.info(`Motto: ${brand.motto}`);
    log.info(`Moderation: ${moderationProvider().name}`);
  });

  startWorker();

  const shutdown = async (signal: string) => {
    log.info(`${signal} received — shutting down`);
    stopWorker();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  log.error('Failed to start', err);
  process.exit(1);
});
