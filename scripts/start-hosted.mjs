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

// Hosts that only ever run the start command (the Docker image, a bare
// `npm start`) find no marker and do the full job here, exactly as before.
prepareDatabase({ skipSchemaIfApplied: true });

// The server is imported rather than spawned, so this process *becomes* the
// server: one PID, and the SIGTERM a host sends on shutdown reaches the
// graceful-shutdown handler in index.js instead of a wrapper that would have
// to forward it.
log(`Starting FaithTube on port ${process.env.PORT ?? 4000}`);
process.chdir(serverDir);
await import(pathToFileURL(path.join(serverDir, 'dist', 'index.js')).href);
