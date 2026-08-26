import { brand } from '@faithtube/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './db/client.js';
import { startWorker, stopWorker } from './workers/videoWorker.js';
import { moderationProvider } from './ai/index.js';

const log = logger('server');

async function main() {
  const app = createApp();

  // Fail fast on a bad database URL rather than 500ing on the first request.
  await prisma.$connect();

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
