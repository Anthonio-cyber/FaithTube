import { prisma } from './client.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const log = logger('cleanup');

/** Recorded once the purge has run, so it costs one query on every later boot. */
const FLAG_KEY = 'demoContentRemoved';

/**
 * Removes the sample channels and videos an earlier version of the seed
 * created.
 *
 * The seed no longer creates them, but a deployment that ran the old seed still
 * has them in its database, and there is no console on a free host to go and
 * delete them by hand. So the application removes them itself, once.
 *
 * It matches only the invented accounts — the @faithtube.example addresses the
 * seed used — and never the administrator, even though that account may share
 * the domain. Deleting a user cascades to their channel, videos, comments and
 * watch history, so removing the eight owners removes everything that hung off
 * them. Anything a real person has since created is untouched, because a real
 * person does not have one of these addresses.
 *
 * Once every deployment has run this, the whole file can be deleted.
 */
export async function removeDemoContent(): Promise<void> {
  try {
    const done = await prisma.platformSetting.findUnique({ where: { key: FLAG_KEY } });
    if (done) return;

    const demoUsers = await prisma.user.findMany({
      where: {
        email: { endsWith: '@faithtube.example' },
        NOT: { email: env.SEED_ADMIN_EMAIL },
      },
      select: { id: true, email: true },
    });

    if (demoUsers.length > 0) {
      const { count } = await prisma.user.deleteMany({ where: { id: { in: demoUsers.map((u) => u.id) } } });
      log.warn(
        `Removed ${count} sample account(s) and everything that belonged to them — ` +
          'their channels, videos and watch history. The seed no longer creates them.',
      );
    }

    await prisma.platformSetting.upsert({
      where: { key: FLAG_KEY },
      create: { key: FLAG_KEY, value: new Date().toISOString() },
      update: {},
    });
  } catch (error) {
    // Never block start-up for this. A deployment that keeps its sample content
    // for one more boot is a far smaller problem than one that will not start.
    log.warn('Could not remove sample content; continuing.', error);
  }
}
