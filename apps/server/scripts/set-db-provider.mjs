/**
 * Selects the Prisma datasource provider from DATABASE_PROVIDER.
 *
 * Prisma requires the provider to be a literal in the schema, so this rewrites
 * that one line before `generate` / `db push`. The data model itself is already
 * portable — it uses no provider-specific types, and enum-like columns are
 * plain strings validated in @faithtube/shared — so nothing else changes.
 *
 *   DATABASE_PROVIDER=sqlite      local development (default)
 *   DATABASE_PROVIDER=postgresql  hosted deployments (Neon, Supabase, Render)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SUPPORTED = ['sqlite', 'postgresql'];
const requested = (process.env.DATABASE_PROVIDER ?? '').trim() || inferFromUrl() || 'sqlite';

if (!SUPPORTED.includes(requested)) {
  console.error(`Unsupported DATABASE_PROVIDER "${requested}". Use one of: ${SUPPORTED.join(', ')}`);
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

const updated = schema.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*")[^"]+(")/,
  (_match, before, after) => `${before}${requested}${after}`,
);

if (updated !== schema) {
  writeFileSync(schemaPath, updated);
  console.log(`Prisma datasource provider set to "${requested}".`);
} else {
  console.log(`Prisma datasource provider already "${requested}".`);
}

/** A postgres:// URL is unambiguous, so infer rather than making people set two vars. */
function inferFromUrl() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql';
  if (url.startsWith('file:')) return 'sqlite';
  return null;
}
