#!/usr/bin/env node
/**
 * Boot sequence for a hosted deployment.
 *
 * Shared by every hosting path — the Docker image and the native Node runtime
 * both end up here — so the sequence a container performs and the sequence a
 * plain `npm start` performs can never drift apart:
 *
 *   1. refuse to start without a database
 *   2. bring the schema up to date (idempotent)
 *   3. optionally seed, once, on the very first boot
 *   4. hand the process over to the server
 *
 * Everything runs from apps/server: Prisma resolves its schema and .env
 * relative to that package, and the server resolves WEB_DIST_DIR relative to
 * its own working directory.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(repoRoot, 'apps', 'server');

const log = (message) => console.log(`→ ${message}`);
const fail = (message) => {
  console.error(`FATAL: ${message}`);
  process.exit(1);
};

const run = (command, args, { allowFailure = false } = {}) => {
  const result = spawnSync(command, args, { cwd: serverDir, stdio: 'inherit', shell: false });
  if (result.error) {
    if (allowFailure) return false;
    fail(`could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return false;
    fail(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
  return true;
};

if (!process.env.DATABASE_URL) {
  fail(
    'DATABASE_URL is not set. A hosted deployment needs a Postgres connection ' +
      'string — see HOSTING.md for how to get a free one.'
  );
}

// The Prisma provider is fixed when the client is generated, i.e. at build
// time, from DATABASE_PROVIDER. If it does not match the database you are
// actually pointing at, Prisma fails with a wasm validation dump that says
// nothing about the cause. Say the useful thing instead.
const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');
if (existsSync(schemaPath)) {
  const builtProvider = /datasource\s+db\s*\{[^}]*?provider\s*=\s*"([^"]+)"/s.exec(
    readFileSync(schemaPath, 'utf8')
  )?.[1];
  const urlProvider = process.env.DATABASE_URL.startsWith('file:') ? 'sqlite' : 'postgresql';
  if (builtProvider && builtProvider !== urlProvider) {
    fail(
      `this build targets ${builtProvider}, but DATABASE_URL points at ${urlProvider}. ` +
        `Set DATABASE_PROVIDER=${urlProvider} in your host's environment and redeploy — ` +
        `the provider is chosen during the build, so changing it needs a rebuild, not a restart.`
    );
  }
}

const serverEntry = path.join(serverDir, 'dist', 'index.js');
if (!existsSync(serverEntry)) {
  fail('apps/server/dist/index.js is missing. The build step did not run, or it failed.');
}

// `db push` is the right tool here because the platform ships no migration
// history. It is idempotent, so it is safe on every boot. Once you start
// generating migrations, switch this to `prisma migrate deploy`.
log('Applying the database schema…');
run('npx', ['--no-install', 'prisma', 'db', 'push', '--skip-generate']);

// Seeding is opt-in, and should be switched off again once the first boot has
// created the admin account. A failed seed is not fatal: an already-seeded
// database is the usual reason, and refusing to serve traffic over it would
// turn a no-op into an outage.
if (process.env.SEED_ON_BOOT === 'true') {
  log('Seeding initial data…');
  const seeded = run('node', [path.join('dist', 'db', 'seed.js')], { allowFailure: true });
  if (!seeded) log('Seed did not complete (already seeded?) — continuing.');
}

// The server is imported rather than spawned, so this process *becomes* the
// server: one PID, and the SIGTERM a host sends on shutdown reaches the
// graceful-shutdown handler in index.js instead of a wrapper that would have
// to forward it.
log(`Starting FaithTube on port ${process.env.PORT ?? 4000}`);
process.chdir(serverDir);
await import(pathToFileURL(serverEntry).href);
