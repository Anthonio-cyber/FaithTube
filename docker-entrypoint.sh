#!/bin/sh
set -e

cd /app/apps/server

if [ -z "${DATABASE_URL}" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  exit 1
fi

# Bring the database schema up to date before serving. `db push` is idempotent,
# and is the right tool here because the platform ships no migration history.
# Once you begin generating migrations, switch this to `prisma migrate deploy`.
echo "→ Applying database schema…"
npx --no-install prisma db push --skip-generate

# Seeding is opt-in and should be turned off again after the first boot.
if [ "${SEED_ON_BOOT}" = "true" ]; then
  echo "→ Seeding initial data…"
  node dist/db/seed.js || echo "→ Seed did not complete; continuing."
fi

echo "→ Starting FaithTube on port ${PORT:-4000}"
exec node dist/index.js
