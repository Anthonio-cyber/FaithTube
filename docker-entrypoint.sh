#!/bin/sh
set -e

# The boot sequence itself lives in scripts/start-hosted.mjs so that the
# container and the native Node runtime start the platform in exactly the same
# way: check the database URL, apply the schema, optionally seed, then serve.
exec node /app/scripts/start-hosted.mjs
