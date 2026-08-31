#!/usr/bin/env node
/**
 * Brings the database up to date, and optionally seeds it.
 *
 * Shared by every deployment shape, because *when* this can run differs by
 * host: a long-running server does it on boot, while a serverless deployment
 * has no boot step at all and has to do it during the build. Keeping one
 * implementation means the two cannot drift.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const serverDir = path.join(repoRoot, 'apps', 'server');

/**
 * Written once the schema has been applied, so a later boot can tell whether
 * there is anything to do. It records a hash of the schema and of the database
 * being pointed at — change either and the work runs again.
 *
 * This matters more than it sounds. A host that stops an idle instance re-runs
 * the start command on every wake, and `prisma db push` costs ~25 seconds even
 * when there is nothing to change. That is time a visitor spends looking at a
 * blank page.
 */
const markerPath = path.join(serverDir, '.schema-applied');

export function schemaFingerprint() {
  const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, 'utf8') : '';
  // The URL is hashed, never stored: the marker ends up in the build output.
  return createHash('sha256').update(schema).update('\0').update(process.env.DATABASE_URL ?? '').digest('hex');
}

/** True when this exact schema has already been applied to this exact database. */
export function schemaAlreadyApplied() {
  try {
    return readFileSync(markerPath, 'utf8').trim() === schemaFingerprint();
  } catch {
    return false;
  }
}

export const log = (message) => console.log(`→ ${message}`);
export const fail = (message) => {
  console.error(`FATAL: ${message}`);
  process.exit(1);
};

function run(command, args, { allowFailure = false } = {}) {
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
}

/**
 * The Prisma provider is fixed when the client is generated, i.e. at build
 * time, from DATABASE_PROVIDER. If it does not match the database being pointed
 * at, Prisma fails with a wasm validation dump that says nothing about the
 * cause. Say the useful thing instead.
 */
function assertProviderMatches() {
  const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) return;
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

/**
 * @param skipSchemaIfApplied  Skip the migration when the build already ran it.
 *        Only the migration: seeding still happens, because it is cheap once
 *        the data is there and self-heals a seed that failed during the build.
 */
export function prepareDatabase({ requireBuild = true, optional = false, skipSchemaIfApplied = false } = {}) {
  if (!process.env.DATABASE_URL) {
    // During a build the database may legitimately not be reachable yet; leave
    // it to boot rather than failing the build.
    if (optional) {
      log('DATABASE_URL is not set at build time — the schema will be applied on first boot instead.');
      return;
    }
    fail(
      'DATABASE_URL is not set. A hosted deployment needs a Postgres connection ' +
        'string — see HOSTING.md (Render) or VERCEL.md (Vercel) for how to get a free one.'
    );
  }

  assertProviderMatches();

  const seedEntry = path.join(serverDir, 'dist', 'db', 'seed.js');
  if (requireBuild && !existsSync(path.join(serverDir, 'dist', 'index.js'))) {
    fail('apps/server/dist/index.js is missing. The build step did not run, or it failed.');
  }

  // `db push` is the right tool here because the platform ships no migration
  // history. It is idempotent, so it is safe to repeat on every deploy. Once you
  // start generating migrations, switch this to `prisma migrate deploy`.
  //
  // It is also the slow part — around 25 seconds even with nothing to change —
  // which is why a boot that knows the build already did it goes straight past.
  if (skipSchemaIfApplied && schemaAlreadyApplied()) {
    log('Schema already applied by the build — skipping the migration.');
  } else {
    log('Applying the database schema…');
    run('npx', ['--no-install', 'prisma', 'db', 'push', '--skip-generate']);
    try {
      writeFileSync(markerPath, schemaFingerprint());
    } catch {
      // Not fatal: the next boot just does the work again.
    }
  }

  // Seeding is opt-in, and should be switched off again once the first deploy
  // has created the admin account. A failed seed is not fatal: an
  // already-seeded database is the usual reason, and refusing to serve traffic
  // over it would turn a no-op into an outage.
  if (process.env.SEED_ON_BOOT === 'true') {
    if (!existsSync(seedEntry)) {
      log('Seed requested, but the build output is missing — skipping.');
    } else {
      log('Seeding initial data…');
      if (!run('node', [path.join('dist', 'db', 'seed.js')], { allowFailure: true })) {
        log('Seed did not complete (already seeded?) — continuing.');
      }
    }
  }
}

// Running this file directly is how a build prepares the database — on every
// host, not just serverless ones. Doing it at build time rather than at boot is
// what keeps a wake-from-idle fast.
if (import.meta.url === `file://${process.argv[1]}`) {
  prepareDatabase({ optional: process.argv.includes('--optional') });
}
