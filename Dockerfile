# FaithTube — single-service image.
#
# One container runs the API, the background processing worker, and serves the
# built web client. That is what makes a single free service (Render, Fly.io,
# Koyeb, Railway) enough to host the whole platform on one subdomain.

# ---------------------------------------------------------------- build stage
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Prisma needs OpenSSL to select the right query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Manifests first so the dependency install is cached across source changes.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .

# The Prisma provider is baked in at build time. Hosted deployments should use
# postgresql, because free hosts have ephemeral disks.
ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

RUN npm run build:shared \
    && npm run build -w @faithtube/server \
    && npm run build -w @faithtube/web

# Drop dev dependencies. The Prisma CLI is a runtime dependency of the server
# package because the entrypoint applies the schema on boot, so it survives this.
RUN npm prune --omit=dev

# Pruning rewrites node_modules and takes the generated Prisma client with it,
# so the client is regenerated afterwards against the pruned tree. Without this
# the container starts and immediately dies on "@prisma/client did not
# initialize yet".
RUN npm run db:provider -w @faithtube/server     && npx --no-install prisma generate --schema apps/server/prisma/schema.prisma

# ----------------------------------------------------------------- run stage
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# ffmpeg is what enables real thumbnails, audio extraction for transcription and
# the adaptive quality ladder. Without it the platform still runs but serves
# originals only, so it is worth the image size.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    SERVE_WEB=true \
    WEB_DIST_DIR=/app/apps/web/dist \
    STORAGE_LOCAL_DIR=/data/uploads \
    PORT=4000

# The whole workspace tree is copied in one step. npm workspaces link packages
# through symlinks in the root node_modules, and copying selected directories
# leaves those links dangling — this keeps the layout exactly as npm built it.
COPY --from=build /app /app
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /data/uploads \
    && chown -R node:node /data

# Drop root before serving traffic.
USER node
WORKDIR /app/apps/server
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/system/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps the ffmpeg child processes the worker spawns.
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
