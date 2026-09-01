#!/usr/bin/env node
/**
 * Boot sequence for a hosted deployment that runs a real process.
 *
 * Shared by every such path — the Docker image and the native Node runtime both
 * end up here — so the sequence a container performs and the sequence a plain
 * `npm start` performs can never drift apart:
 *
 *   1. refuse to start without a database
 *   2. bring the schema up to date, unless the build already did
 *   3. optionally seed, once, on the very first boot
 *   4. hand the process over to the server
 *
 * Step 2 is skipped whenever the build has already applied this schema to this
 * database, because a host that stops idle instances runs this file again on
 * every wake — and a visitor should not wait half a minute for a migration
 * that has nothing to do.
 *
 * Serverless deployments skip this file entirely — they have no boot step, and
 * do steps 1-3 during the build instead. Both call prepare-database.mjs.
 *
 * Everything runs from apps/server: Prisma resolves its schema and .env
 * relative to that package, and the server resolves WEB_DIST_DIR relative to
 * its own working directory.
 */
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { log, prepareDatabase, serverDir } from './prepare-database.mjs';

/**
 * Is the database already set up? One query answers it.
 *
 * This deliberately asks the database rather than trusting a file written at
 * build time: a marker only tells you what some earlier process believed, and
 * if the build output does not reach the runtime — which is exactly what
 * happened on the first attempt at this — you silently pay for a migration and
 * a full re-seed on every single wake. The database is the thing whose state
 * actually matters, so ask it. One round trip, and it is right by construction.
 */
async function databaseIsReady() {
  if (!process.env.DATABASE_URL) return false;
  let prisma;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    // Categories are created by the seed, so a non-zero count means both that
    // the schema exists and that the seed has run.
    return (await prisma.category.count()) > 0;
  } catch {
    // Missing table, unreachable database, anything: fall through and do the work.
    return false;
  } finally {
    await prisma?.$disconnect().catch(() => {});
  }
}

if (await databaseIsReady()) {
  log('Database is already set up — starting straight up.');
} else {
  prepareDatabase();
}

// The server is imported rather than spawned, so this process *becomes* the
// server: one PID, and the SIGTERM a host sends on shutdown reaches the
// graceful-shutdown handler in index.js instead of a wrapper that would have
// to forward it.
log(`Starting FaithTube on port ${process.env.PORT ?? 4000}`);
process.chdir(serverDir);
await import(pathToFileURL(path.join(serverDir, 'dist', 'index.js')).href);
