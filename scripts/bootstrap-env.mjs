/**
 * Creates a working .env on first run.
 *
 * A fresh clone has only .env.example, so Prisma and the server start with no
 * DATABASE_URL and setup fails. This copies the example across and swaps the
 * placeholder JWT secret for a real random one, so `npm run setup` works on a
 * clean checkout without anyone having to read the docs first.
 *
 * It never overwrites an existing .env.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Prisma resolves .env relative to the schema, and the server runs from the
// same directory, so apps/server/.env is the one that matters. The root copy
// is a convenience for tooling run from the repository root.
const targets = [
  { env: path.join(root, 'apps/server/.env'), example: path.join(root, 'apps/server/.env.example') },
  { env: path.join(root, '.env'), example: path.join(root, '.env.example') },
];

const secret = randomBytes(48).toString('base64');
let created = 0;

for (const { env, example } of targets) {
  if (existsSync(env)) {
    console.log(`· ${path.relative(root, env)} already exists — left alone`);
    continue;
  }
  if (!existsSync(example)) {
    console.warn(`· ${path.relative(root, example)} is missing; skipping`);
    continue;
  }

  copyFileSync(example, env);

  // Every deployment gets its own secret. Sharing the placeholder would mean
  // sessions minted on one install validate on another.
  const contents = readFileSync(env, 'utf8').replace(
    /^JWT_SECRET=.*$/m,
    `JWT_SECRET=${secret}`,
  );
  writeFileSync(env, contents);

  console.log(`✓ created ${path.relative(root, env)} with a generated JWT_SECRET`);
  created += 1;
}

if (created) {
  console.log('\n  Edit those files to add API keys. Everything works without them —');
  console.log('  unconfigured services report themselves as unavailable rather than failing.\n');
}
